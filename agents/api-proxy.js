/**
 * api-proxy.js — OpenAI-compatible Reverse Proxy over AtomCode / configured engines
 *
 * Exposes an OpenAI-style Chat Completions API that forwards requests to
 * FSD's configured AI engine (AtomCode CLI, OpenRouter, Gemini CLI, etc.).
 *
 * This allows ANY third-party application (Cline, Continue.dev, IDE plugins,
 * custom scripts) to use the FSD system as if it were an OpenAI API endpoint.
 *
 * ## Supported endpoints (mounted by server.js)
 *   POST /v1/chat/completions   — streaming or non-streaming
 *   GET  /v1/models             — list available models
 *
 * ## OpenAI request fields supported:
 *   model, messages, stream, temperature, max_tokens, top_p, stop
 *
 * ## Config
 *   In .engine/engine-config.json under "apiProxy":
 *   {
 *     "apiProxy": {
 *       "enabled": true,
 *       "requireAuth": false,
 *       "apiKeys": ["sk-fsd-..."],
 *       "defaultModel": "auto",
 *       "allowedEngines": ["atomcode", "openrouter"]
 *     }
 *   }
 */
'use strict';

const { spawn } = require('child_process');
const path = require('path');
const { serverLog, warnLog, errorLog } = require('../logger');
const engineConfig = require('./engine-config');
const dispatcher = require('./dispatcher');

// ── Config ────────────────────────────────────────────────────────────────────

let proxyConfig = {
    enabled: false,
    requireAuth: false,
    apiKeys: [],
    defaultModel: 'auto',
    allowedEngines: ['atomcode', 'openrouter', 'gemini-cli'],
};

function loadConfig() {
    try {
        const cfg = engineConfig.loadEngineConfig();
        const pc = cfg.apiProxy;
        if (pc && typeof pc === 'object') {
            proxyConfig.enabled = pc.enabled !== false; // default enabled
            proxyConfig.requireAuth = pc.requireAuth === true;
            proxyConfig.apiKeys = Array.isArray(pc.apiKeys) ? pc.apiKeys : [];
            proxyConfig.defaultModel = pc.defaultModel || 'auto';
            proxyConfig.allowedEngines = Array.isArray(pc.allowedEngines) ? pc.allowedEngines : ['atomcode', 'openrouter', 'gemini-cli'];
            serverLog(`[APIProxy] Config loaded: enabled=${proxyConfig.enabled}, auth=${proxyConfig.requireAuth}`);
        }
    } catch (e) {
        // No config = disabled
        proxyConfig.enabled = false;
    }
}

loadConfig();

// ── Auth helper ───────────────────────────────────────────────────────────────

/**
 * Verify the Authorization header against configured API keys.
 * Returns true if auth passes (or auth is disabled).
 */
function verifyAuth(authHeader) {
    if (!proxyConfig.requireAuth) return true;
    if (!authHeader) return false;
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) return false;
    return proxyConfig.apiKeys.includes(match[1]);
}

// ── Model listing ─────────────────────────────────────────────────────────────

/**
 * Get the list of models available via the proxy.
 * Combines models from all enabled engines.
 * @returns {{ id: string, object: string, created: number, owned_by: string }[]}
 */
function getModelList() {
    const now = Math.floor(Date.now() / 1000);
    const models = [];

    // AtomCode models
    const atomModels = engineConfig.getAtomCodeModels();
    for (const m of atomModels) {
        models.push({ id: m.id, object: 'model', created: now, owned_by: 'atomcode' });
    }

    // Gemini CLI models
    const geminiModels = engineConfig.getGeminiCliModels();
    for (const m of geminiModels) {
        models.push({ id: m.id, object: 'model', created: now, owned_by: 'gemini-cli' });
    }

    // OpenRouter models (commonly used ones)
    const openrouterPrefixes = [
        'openai/', 'anthropic/', 'google/', 'mistral/', 'meta-llama/',
        'deepseek/', 'qwen/', 'cohere/', 'ai21/', 'x-ai/',
    ];
    // We'll dynamically add some well-known ones
    const knownModels = [
        'openai/gpt-4o', 'openai/gpt-4o-mini', 'openai/gpt-4-turbo',
        'anthropic/claude-3.5-sonnet', 'anthropic/claude-3-opus',
        'google/gemini-2.0-flash-001', 'google/gemini-2.0-pro-001',
        'deepseek/deepseek-chat', 'deepseek/deepseek-coder',
        'mistral/mistral-large-latest', 'meta-llama/llama-3.1-70b-instruct',
        'qwen/qwen-2.5-72b-instruct',
    ];
    for (const m of knownModels) {
        models.push({ id: m, object: 'model', created: now, owned_by: 'openrouter' });
    }

    // Also add engines themselves as pseudo-models
    for (const eng of proxyConfig.allowedEngines) {
        models.push({ id: `${eng}://auto`, object: 'model', created: now, owned_by: eng });
    }

    return models;
}

// ── Chat Completion ──────────────────────────────────────────────────────────

/**
 * Convert OpenAI-style messages into a flat prompt string for FSD engines.
 */
function messagesToPrompt(messages) {
    let prompt = '';
    for (const msg of messages) {
        const role = msg.role || 'user';
        const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
        switch (role) {
            case 'system':
                prompt += `[System]\n${content}\n\n`;
                break;
            case 'user':
                prompt += `[User]\n${content}\n\n`;
                break;
            case 'assistant':
                prompt += `[Assistant]\n${content}\n\n`;
                break;
            case 'tool':
                prompt += `[Tool Result]\n${content}\n\n`;
                break;
            default:
                prompt += `[${role}]\n${content}\n\n`;
        }
    }
    prompt += '[Assistant]\n';
    return prompt;
}

/**
 * Convert messages + model into a properly structured payload for the engine.
 * Uses OpenRouter-style API call or AtomCode CLI depending on current engine.
 */
async function sendToEngine(messages, model, options = {}) {
    const currentEngine = engineConfig.getCurrentEngine();
    const prompt = messagesToPrompt(messages);
    const { temperature = 0.7, max_tokens = 4096, top_p = 1 } = options;

    serverLog(`[APIProxy] Engine="${currentEngine}" model="${model}"`);

    // ── Route to AtomCode CLI ──────────────────────────────────────────────
    if (currentEngine === 'atomcode') {
        const models = engineConfig.getAtomCodeModels();
        const resolvedModel = (model && model !== 'auto' && !model.includes('://auto'))
            ? model
            : (models.length > 0 ? models[0].id : 'deepseek/deepseek-chat');

        try {
            const atomcodePath = engineConfig.checkAtomCodeAvailable();
            if (!atomcodePath) throw new Error('AtomCode CLI not found');

            return await new Promise((resolve, reject) => {
                const child = spawn(
                    atomcodePath,
                    ['run', '--model', resolvedModel, '--prompt', prompt],
                    {
                        cwd: path.resolve(__dirname, '..'),
                        stdio: ['ignore', 'pipe', 'pipe'],
                        env: {
                            ...process.env,
                            NODE_NO_WARNINGS: '1',
                            ATOMCODE_NONINTERACTIVE: '1',
                        },
                        shell: true,
                        windowsHide: true,
                    }
                );

                let stdout = '';
                let stderr = '';

                child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
                child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

                child.on('close', (code) => {
                    if (code !== 0) {
                        reject(new Error(`AtomCode exited ${code}: ${stderr.trim()}`));
                    } else {
                        resolve({ content: stdout.trim(), model: resolvedModel });
                    }
                });
                child.on('error', reject);
            });
        } catch (e) {
            errorLog('[APIProxy] AtomCode error:', e.message);
            throw e;
        }
    }

    // ── Route to Gemini CLI ────────────────────────────────────────────────
    if (currentEngine === 'gemini-cli') {
        try {
            const geminiPath = engineConfig.checkGeminiCliAvailable();
            if (!geminiPath) throw new Error('Gemini CLI not found');

            const resolvedModel = (model && model !== 'auto' && !model.includes('://auto'))
                ? model
                : 'gemini-2.0-flash-001';

            // Gemini CLI typically uses stdin for the prompt
            return await new Promise((resolve, reject) => {
                const child = spawn(
                    geminiPath,
                    ['-m', resolvedModel, 'prompts', '-'],
                    {
                        stdio: ['pipe', 'pipe', 'pipe'],
                        env: { ...process.env },
                        shell: true,
                        windowsHide: true,
                    }
                );

                let stdout = '';
                let stderr = '';

                child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
                child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

                child.stdin.write(prompt);
                child.stdin.end();

                child.on('close', (code) => {
                    if (code !== 0) {
                        reject(new Error(`Gemini CLI exited ${code}: ${stderr.trim()}`));
                    } else {
                        resolve({ content: stdout.trim(), model: resolvedModel });
                    }
                });
                child.on('error', reject);
            });
        } catch (e) {
            errorLog('[APIProxy] Gemini error:', e.message);
            throw e;
        }
    }

    // ── Route to OpenRouter via HTTP ────────────────────────────────────────
    // Use the OpenRouter driver's `run()` which returns a string.
    try {
        const driver = require('./drivers').getDriver('openrouter');
        if (!driver || !driver.run) throw new Error('OpenRouter driver unavailable');

        const resolvedModel = (model && model !== 'auto' && !model.includes('://auto')) ? model : undefined;
        const result = await driver.run(prompt, {
            model: resolvedModel,
            temperature,
            max_tokens,
            top_p,
        });

        return { content: result.trim(), model: resolvedModel || 'openrouter' };
    } catch (e) {
        errorLog('[APIProxy] OpenRouter error:', e.message);
        throw e;
    }
}

/**
 * Stream token-by-token from an async iterable source,
 * writing SSE chunks to the response.
 */
async function streamResponse(res, sourceIterable, model, id) {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
    });

    let fullText = '';

    try {
        for await (const token of sourceIterable) {
            fullText += token;
            // OpenAI SSE format
            const chunk = {
                id,
                object: 'chat.completion.chunk',
                created: Math.floor(Date.now() / 1000),
                model,
                choices: [{
                    index: 0,
                    delta: { content: token },
                    finish_reason: null,
                }],
            };
            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        }
    } catch (e) {
        warnLog('[APIProxy] Stream error:', e.message);
    }

    // Send the final [DONE] chunk
    const finalChunk = {
        id,
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [{
            index: 0,
            delta: {},
            finish_reason: 'stop',
        }],
    };
    res.write(`data: ${JSON.stringify(finalChunk)}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
}

/**
 * Handle a chat completion request (OpenAI-compatible).
 * @param {object} req - Express request
 * @param {object} res - Express response
 */
async function handleChatCompletion(req, res) {
    if (!proxyConfig.enabled) {
        return res.status(503).json({
            error: { message: 'API Proxy is disabled. Enable it in .engine/engine-config.json', type: 'server_error' }
        });
    }

    // Auth check
    const auth = req.headers['authorization'];
    if (!verifyAuth(auth)) {
        return res.status(401).json({
            error: { message: 'Invalid or missing API key', type: 'auth_error' }
        });
    }

    const { model, messages, stream, temperature, max_tokens, top_p } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({
            error: { message: 'messages array is required', type: 'invalid_request' }
        });
    }

    const resolvedModel = model || proxyConfig.defaultModel || 'auto';
    const id = `chatcmpl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    if (stream) {
        // ── Streaming mode ───────────────────────────────────────────────
        try {
            const currentEngine = engineConfig.getCurrentEngine();

            if (currentEngine === 'openrouter') {
                // OpenRouter driver stream() writes FSD-native SSE format.
                // For proxy, we use run() to get full text then chunk it
                // into OpenAI-compatible SSE tokens.
                const driver = require('./drivers').getDriver('openrouter');
                if (!driver || !driver.run) throw new Error('OpenRouter driver unavailable');

                const prompt = messagesToPrompt(messages);
                const result = await driver.run(prompt, {
                    model: (resolvedModel !== 'auto' && !resolvedModel.includes('://auto')) ? resolvedModel : undefined,
                });

                res.writeHead(200, {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                    'X-Accel-Buffering': 'no',
                });

                const fullText = result || '';
                // Stream word-by-word for OpenAI-compatible SSE
                const tokens = fullText.split(/(?<=\s)/);
                for (const token of tokens) {
                    const chunk = {
                        id,
                        object: 'chat.completion.chunk',
                        created: Math.floor(Date.now() / 1000),
                        model: resolvedModel,
                        choices: [{ index: 0, delta: { content: token }, finish_reason: null }],
                    };
                    res.write(`data: ${JSON.stringify(chunk)}\n\n`);
                    await new Promise(r => setTimeout(r, 8)); // throttle
                }

                const finalChunk = {
                    id,
                    object: 'chat.completion.chunk',
                    created: Math.floor(Date.now() / 1000),
                    model: resolvedModel,
                    choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
                };
                res.write(`data: ${JSON.stringify(finalChunk)}\n\n`);
                res.write('data: [DONE]\n\n');
                res.end();
                return;
            } else {
                // Non-OpenRouter: collect response and stream the full text
                const result = await sendToEngine(messages, resolvedModel, { temperature, max_tokens, top_p });
                const fullText = result.content;

                res.writeHead(200, {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                    'X-Accel-Buffering': 'no',
                });

                // Stream character by character (or word by word for better UX)
                const words = fullText.split(/(?<=\s)/);
                for (const word of words) {
                    const chunk = {
                        id,
                        object: 'chat.completion.chunk',
                        created: Math.floor(Date.now() / 1000),
                        model: resolvedModel,
                        choices: [{ index: 0, delta: { content: word }, finish_reason: null }],
                    };
                    res.write(`data: ${JSON.stringify(chunk)}\n\n`);
                    await new Promise(r => setTimeout(r, 10)); // Small delay for flow
                }

                const finalChunk = {
                    id,
                    object: 'chat.completion.chunk',
                    created: Math.floor(Date.now() / 1000),
                    model: resolvedModel,
                    choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
                };
                res.write(`data: ${JSON.stringify(finalChunk)}\n\n`);
                res.write('data: [DONE]\n\n');
                res.end();
            }
        } catch (e) {
            errorLog('[APIProxy] Stream error:', e.message);
            if (!res.headersSent) {
                return res.status(500).json({
                    error: { message: e.message, type: 'server_error' }
                });
            }
            // Try to send error SSE
            try {
                const errChunk = {
                    id,
                    object: 'chat.completion.chunk',
                    created: Math.floor(Date.now() / 1000),
                    model: resolvedModel,
                    choices: [{ index: 0, delta: {}, finish_reason: 'error' }],
                };
                res.write(`data: ${JSON.stringify(errChunk)}\n\n`);
                res.end();
            } catch (_) { /* ignore write errors */ }
        }
    } else {
        // ── Non-streaming mode ────────────────────────────────────────────
        try {
            const result = await sendToEngine(messages, resolvedModel, { temperature, max_tokens, top_p });

            const response = {
                id,
                object: 'chat.completion',
                created: Math.floor(Date.now() / 1000),
                model: result.model || resolvedModel,
                choices: [{
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: result.content,
                    },
                    finish_reason: 'stop',
                }],
                usage: {
                    prompt_tokens: -1,
                    completion_tokens: -1,
                    total_tokens: -1,
                },
            };

            res.json(response);
        } catch (e) {
            errorLog('[APIProxy] Completion error:', e.message);
            res.status(500).json({
                error: { message: e.message, type: 'server_error' }
            });
        }
    }
}

/**
 * Handle model listing request.
 */
function handleListModels(req, res) {
    const models = getModelList();
    res.json({
        object: 'list',
        data: models,
    });
}

/**
 * Reload proxy configuration from disk.
 */
function reloadConfig() {
    loadConfig();
    serverLog('[APIProxy] Config reloaded');
}

module.exports = {
    handleChatCompletion,
    handleListModels,
    verifyAuth,
    getModelList,
    reloadConfig,
    get enabled() { return proxyConfig.enabled; },
    set enabled(v) { proxyConfig.enabled = v; },
    get config() { return { ...proxyConfig }; },
};
