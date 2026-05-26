/**
 * atomcode.js — AtomCode CLI Driver
 *
 * Implements the unified driver interface:
 *   run(prompt, options)     — non-streaming (Agent pipeline)
 *   stream({ prompt, res })  — streaming SSE (Chat UI)
 *
 * The atomcode CLI runs headless with `-p <prompt>`. No `-o`/`--stream` flags.
 * Session resume uses `-c`/`--continue` (no UUID param).
 */
'use strict';

const { spawn } = require('child_process');
const { serverLog, errorLog, warnLog } = require('../../logger');
// Lazily resolve CWD to avoid circular dependency (base.js → drivers → atomcode → base)
function getCWD() {
    return require('../base').CWD || require('path').resolve(__dirname, '..', '..');
}

// ── Non-streaming run (Agent pipeline) ───────────────────────────────────────

/**
 * Spawn atomcode CLI with the given prompt and return the response text.
 *
 * @param {string} prompt
 * @param {object} [options]       - { model, provider, cwd, timeout }
 * @returns {Promise<string>}
 */
async function run(prompt, options = {}) {
    const args = ['-p', prompt];
    if (options.provider) args.push('--provider', options.provider);
    if (options.model) args.push('--model', options.model);
    if (options.cwd) args.push('-C', options.cwd);
    
    // Disable mutating tools to ensure fast and non-destructive LLM-only execution
    args.push('--disable-tools', 'write_file,edit_file,delete_file,move_file,bash,run_command,search_replace,parallel_edit_files');

    return new Promise((resolve, reject) => {
        const child = spawn('atomcode', args, {
            cwd: options.cwd || getCWD(),
            env: { ...process.env },
            stdio: ['pipe', 'pipe', 'pipe'],
            windowsHide: true,
            timeout: options.timeout || 300000,
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
        child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

        child.on('exit', (code) => {
            if (code === 0) {
                resolve(stdout.trim());
            } else {
                const detail = (stderr || stdout).slice(-300);
                reject(new Error(`AtomCode CLI exited with code ${code}: ${detail}`));
            }
        });

        child.on('error', (err) => {
            reject(new Error(`AtomCode CLI spawn error: ${err.message}`));
        });
    });
}

// ── Streaming SSE (Chat UI) ──────────────────────────────────────────────────

/**
 * Spawn atomcode CLI and stream stdout to SSE.
 * The sessionId is used only for logging (not passed to CLI).
 *
 * @param {object} opts
 * @param {string}          opts.prompt     - user prompt text
 * @param {Array<object>}   [opts.history]  - ignored (atomcode CLI has no history injection)
 * @param {object}          opts.res        - Express SSE response object
 * @param {AbortController} [opts.signal]   - optional abort signal
 * @param {string}          [opts.provider] - provider name override
 * @param {string}          [opts.model]    - model name override
 * @returns {Promise<string>} full response text
 */
function stream({ prompt, history, res, signal, provider, model }) {
    serverLog(`[AtomCode CLI] Streaming prompt (${prompt.length} chars)`);

    const args = ['-p', prompt];
    if (provider) args.push('--provider', provider);
    if (model) args.push('--model', model);

    return new Promise((resolve, reject) => {
        const child = spawn('atomcode', args, {
            cwd: getCWD(),
            env: { ...process.env },
            stdio: ['pipe', 'pipe', 'pipe'],
            windowsHide: true,
        });

        // Support abort via signal
        if (signal) {
            signal.addEventListener('abort', () => {
                if (!child.killed) {
                    child.kill();
                }
                reject(new Error('AtomCode stream aborted'));
            }, { once: true });
        }

        let accumulatedResponse = '';

        child.stdout.on('data', (chunk) => {
            const text = chunk.toString();
            accumulatedResponse += text;
            res.write(`event: message\ndata: ${JSON.stringify({ text })}\n\n`);
        });

        child.stderr.on('data', (chunk) => {
            const text = chunk.toString();
            warnLog('[AtomCode CLI stderr]', text);
            res.write(`event: warning\ndata: ${JSON.stringify({ text })}\n\n`);
        });

        child.on('exit', (code) => {
            serverLog(`[AtomCode CLI] Exited with code ${code}`);
            if (code === 0) {
                resolve({ content: accumulatedResponse, usage: null });
            } else {
                reject(new Error(`AtomCode CLI exited with code ${code}`));
            }
        });

        child.on('error', (err) => {
            reject(new Error(`AtomCode CLI spawn error: ${err.message}`));
        });
    });
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
    name: 'atomcode',
    run,
    stream,
};
