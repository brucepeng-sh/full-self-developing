/**
 * gemini-cli.js — Gemini CLI Driver
 *
 * Implements the unified driver interface:
 *   run(prompt, options)     — non-streaming (Agent pipeline)
 *   stream({ prompt, res })  — streaming SSE (Chat UI)
 *
 * Wraps the `gemini` CLI v0.42.0 command: gemini -p <prompt> -m <model>
 */
'use strict';

const { spawn } = require('child_process');
const { serverLog, errorLog, warnLog } = require('../../logger');
// Lazily resolve CWD to avoid circular dependency (base.js → drivers → gemini-cli → base)
function getCWD() {
    return require('../base').CWD || require('path').resolve(__dirname, '..', '..');
}

// DEFAULT_MODEL: use flash by default — it runs as a simple Q&A model.
// gemini-2.5-pro in stdin mode triggers Gemini CLI's interactive agent,
// which reads project files and calls tools, eventually hitting API 404s.
const DEFAULT_MODEL = 'gemini-2.5-flash';

function mapModel(modelName) {
    if (!modelName || typeof modelName !== 'string') {
        return DEFAULT_MODEL;
    }
    return modelName;
}

// ── Non-streaming run (Agent pipeline) ───────────────────────────────────────

/**
 * Spawn gemini CLI with the given prompt and return the response text.
 *
 * @param {string} prompt
 * @param {object} [options]       - { model, cwd, timeout }
 * @returns {Promise<string>}
 */
async function run(prompt, options = {}) {
    const model = mapModel(options.model);
    // Use stdin to pass the prompt — avoids shell escaping issues with
    // special characters. Specify '-o', 'text' to run in non-interactive,
    // text-only mode and prevent interactive agent tool execution.
    const args = ['-m', model, '-o', 'text'];

    serverLog(`[Gemini CLI] Spawning: gemini -m ${model} -o text (prompt via stdin, ${prompt.length} chars)`);

    return new Promise((resolve, reject) => {
        const child = spawn('gemini', args, {
            cwd: options.cwd || getCWD(),
            env: { ...process.env },
            stdio: ['pipe', 'pipe', 'pipe'],
            windowsHide: true,
            shell: true,
            timeout: options.timeout || 120000,
        });

        let stdout = '';
        let stderr = '';

        child.stdin.write(prompt + '\n');
        child.stdin.end();

        child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
        child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

        child.on('close', (code) => {
            if (code === 0) {
                resolve(stdout.trim());
            } else {
                const detail = (stderr || stdout).slice(-500);
                errorLog(`[Gemini CLI] Exited with code ${code}: ${detail}`);
                reject(new Error(`Gemini CLI exited with code ${code}: ${detail}`));
            }
        });

        child.on('error', (err) => {
            errorLog(`[Gemini CLI] Spawn error: ${err.message}`);
            reject(new Error(`Gemini CLI spawn error: ${err.message}`));
        });
    });
}

// ── Streaming SSE (Chat UI) ──────────────────────────────────────────────────

/**
 * Spawn gemini CLI and stream stdout to SSE.
 *
 * @param {object} opts
 * @param {string}          opts.prompt   - user prompt text
 * @param {object}          opts.res      - Express SSE response object
 * @param {AbortController} [opts.signal] - optional abort signal
 * @param {string}          [opts.model]  - model to use
 * @returns {Promise<string>} full response text
 */
function stream({ prompt, res, signal, model }) {
    const mappedModel = mapModel(model);
    serverLog(`[Gemini CLI] Streaming prompt (${prompt.length} chars, model=${mappedModel}, via stdin)`);

    const args = ['-o', 'stream-json'];
    if (mappedModel) args.push('-m', mappedModel);

    return new Promise((resolve, reject) => {
        const child = spawn('gemini', args, {
            cwd: getCWD(),
            env: { ...process.env },
            stdio: ['pipe', 'pipe', 'pipe'],
            shell: true,
            windowsHide: true,
        });

        if (signal) {
            signal.addEventListener('abort', () => {
                if (!child.killed) {
                    child.kill();
                }
                reject(new Error('Gemini CLI stream aborted'));
            }, { once: true });
        }

        child.stdin.write(prompt + '\n');
        child.stdin.end();

        let accumulatedResponse = '';
        let accumulatedUsage = null;
        let stderr = '';
        let buffer = '';

        child.stdout.on('data', (chunk) => {
            buffer += chunk.toString();
            let newlineIndex;
            while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
                const line = buffer.slice(0, newlineIndex).trim();
                buffer = buffer.slice(newlineIndex + 1);
                if (!line) continue;
                
                try {
                    const parsed = JSON.parse(line);
                    if (parsed.type === 'message' && parsed.role === 'assistant' && parsed.content) {
                        accumulatedResponse += parsed.content;
                        // Send delta to the frontend
                        res.write(`event: message\ndata: ${JSON.stringify({ text: parsed.content })}\n\n`);
                    } else if (parsed.type === 'tool_call') {
                        const toolMsg = `\n*[Tool Call: ${parsed.tool_name}]*\n`;
                        accumulatedResponse += toolMsg;
                        res.write(`event: message\ndata: ${JSON.stringify({ text: toolMsg })}\n\n`);
                    } else if (parsed.type === 'result' && parsed.stats) {
                        accumulatedUsage = {
                            prompt_tokens: parsed.stats.input_tokens || 0,
                            completion_tokens: parsed.stats.output_tokens || 0,
                            total_tokens: parsed.stats.total_tokens || 0
                        };
                    }
                } catch (e) {
                    // Ignore non-json output or partial lines
                }
            }
        });

        child.stderr.on('data', (chunk) => {
            const text = chunk.toString();
            stderr += text;
            // Do not send stderr as 'warning' event unless we want to, it clutters the UI
            warnLog(`[Gemini CLI stderr chunk] ${text}`);
        });

        child.on('close', (code) => {
            serverLog(`[Gemini CLI] Exited with code ${code}`);
            if (code === 0 || code === null) {
                resolve({ content: accumulatedResponse, usage: accumulatedUsage });
            } else {
                const detail = (stderr || accumulatedResponse || '').trim();
                const message = detail
                    ? `Gemini CLI exited with code ${code}: ${detail.slice(-4000)}`
                    : `Gemini CLI exited with code ${code}`;
                errorLog(`[Gemini CLI] Stream failed: ${message}`);
                reject(new Error(message));
            }
        });

        child.on('error', (err) => {
            errorLog(`[Gemini CLI] Spawn error: ${err.message}`);
            reject(new Error(`Gemini CLI spawn error: ${err.message}`));
        });
    });
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
    name: 'gemini-cli',
    run,
    stream,
};
