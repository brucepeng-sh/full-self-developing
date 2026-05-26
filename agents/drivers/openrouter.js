/**
 * openrouter.js — OpenRouter HTTPS API Driver
 *
 * Implements the unified driver interface:
 *   run(prompt, options)    — non-streaming (Agent pipeline)
 *   stream({ prompt, history, res }) — streaming SSE (Chat UI)
 *
 * Built-in retry with exponential backoff on 429 rate limits
 * and fallback through multiple models.
 */
'use strict';

const https = require('https');
const { serverLog, errorLog } = require('../../logger');
const mcpManager = require('../mcp-client-manager');

function getMcpToolsSchema() {
    try {
        const tools = mcpManager.listAllTools();
        if (!tools || tools.length === 0) return undefined;
        return tools.map(t => ({
            type: 'function',
            function: {
                name: `${t.serverName}__${t.name}`.replace(/[^a-zA-Z0-9_-]/g, '_'),
                description: t.description || `Tool ${t.name} from ${t.serverName}`,
                parameters: t.inputSchema || { type: 'object', properties: {} }
            }
        }));
    } catch (e) {
        errorLog('[OpenRouter] Failed to build MCP tools schema:', e.message);
        return undefined;
    }
}

// ── Configuration ─────────────────────────────────────────────────────────────

const API_KEY = process.env.OPENROUTER_API_KEY || '';
const DEFAULT_MODEL = 'deepseek/deepseek-v4-flash:free';
const FALLBACK_MODELS = [
    'deepseek/deepseek-r1-distill-llama-70b:free',
    'meta-llama/llama-3.3-70b-instruct:free',
    'qwen/qwq-32b:free',
];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── Dynamic Model Discovery ────────────────────────────────────────────────────

/** 12-hour in-memory model cache */
let cachedModels = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;

/** Hardcoded fallback shown when the OpenRouter /models API is unreachable */
const MODEL_LIST_FALLBACK = [
    { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro', context: 2000000, free: false },
    { id: 'google/gemini-2.5-flash-preview-05-20', name: 'Gemini 2.5 Flash', context: 1000000, free: false },
    { id: 'deepseek/deepseek-v4-flash:free', name: 'DeepSeek V4 Flash (Free)', context: 128000, free: true },
    { id: 'deepseek/deepseek-r1:free', name: 'DeepSeek R1 (Free)', context: 128000, free: true },
    { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B (Free)', context: 128000, free: true },
    { id: 'qwen/qwq-32b:free', name: 'QwQ 32B (Free)', context: 32768, free: true },
    { id: 'mistralai/mistral-7b-instruct:free', name: 'Mistral 7B Instruct (Free)', context: 32768, free: true },
];

/**
 * Fetch the full model list from OpenRouter with 12-hour caching.
 * Falls back to MODEL_LIST_FALLBACK on network/parse errors.
 * @returns {Promise<{id:string, name:string, context:number, free:boolean}[]>}
 */
async function fetchModels() {
    const now = Date.now();
    if (cachedModels && (now - lastFetchTime) < CACHE_TTL_MS) {
        return cachedModels;
    }

    return new Promise((resolve) => {
        const opts = {
            hostname: 'openrouter.ai',
            port: 443,
            path: '/api/v1/models',
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'HTTP-Referer': 'http://localhost:8033',
                'X-Title': 'FSD Agent',
            },
        };

        const req = https.request(opts, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    const raw = Array.isArray(parsed.data) ? parsed.data : [];
                    const models = raw
                        .filter(m => m.id && m.context_length)
                        .map(m => ({
                            id: m.id,
                            name: m.name || m.id,
                            context: m.context_length,
                            free: m.id.endsWith(':free'),
                        }))
                        .sort((a, b) => {
                            // Free models first, then by context descending
                            if (a.free !== b.free) return a.free ? -1 : 1;
                            return b.context - a.context;
                        });

                    if (models.length > 0) {
                        cachedModels = models;
                        lastFetchTime = Date.now();
                        serverLog(`[OpenRouter] Fetched ${models.length} models from API`);
                        resolve(models);
                    } else {
                        serverLog('[OpenRouter] Empty model list from API, using fallback');
                        resolve(MODEL_LIST_FALLBACK);
                    }
                } catch (e) {
                    errorLog('[OpenRouter] Failed to parse model list:', e.message);
                    resolve(MODEL_LIST_FALLBACK);
                }
            });
        });

        req.on('error', (err) => {
            errorLog('[OpenRouter] Model list fetch error:', err.message);
            resolve(MODEL_LIST_FALLBACK);
        });

        req.setTimeout(15000, () => {
            req.destroy();
            errorLog('[OpenRouter] Model list fetch timed out, using fallback');
            resolve(MODEL_LIST_FALLBACK);
        });

        req.end();
    });
}

// ── Non-streaming run (Agent pipeline) ───────────────────────────────────────

/**
 * Send a prompt to OpenRouter with automatic retry on 429 and fallback models.
 *
 * @param {string} prompt
 * @param {object} [options]       - { model, cwd, timeout } (cwd unused here)
 * @returns {Promise<string>}
 */
async function run(prompt, options = {}) {
    const model = options.model || DEFAULT_MODEL;
    const modelsToTry = [model, ...FALLBACK_MODELS.filter(m => m !== model)];
    const BACKOFF = [15000, 30000, 60000, 120000, 240000];

    for (const modelName of modelsToTry) {
        for (let attempt = 0; attempt <= BACKOFF.length; attempt++) {
            try {
                const result = await callAPI(prompt, modelName);
                if (attempt > 0 || modelName !== model) {
                    serverLog(`[OpenRouter] Success with model=${modelName} attempt=${attempt}`);
                }
                return result;
            } catch (err) {
                const is429 = err.statusCode === 429 || (err.message && err.message.includes('429'));
                if (is429 && attempt < BACKOFF.length) {
                    const delay = BACKOFF[attempt];
                    serverLog(`[OpenRouter] 429 rate-limit on ${modelName}. Retry in ${delay / 1000}s (${attempt + 1}/${BACKOFF.length})`);
                    await sleep(delay);
                    continue;
                }
                errorLog(`[OpenRouter] Model ${modelName} failed (attempt ${attempt}): ${err.message.slice(0, 200)}`);
                break;
            }
        }
    }
    throw new Error(`All OpenRouter models exhausted. Tried: ${modelsToTry.join(', ')}`);
}

/**
 * Low-level HTTPS POST to OpenRouter non-streaming endpoint.
 *
 * @param {string} prompt
 * @param {string} modelName
 * @returns {Promise<string>}
 */
function callAPI(prompt, modelName) {
    return new Promise((resolve, reject) => {
        const payload = {
            model: modelName,
            messages: [{ role: 'user', content: prompt }],
        };
        const tools = getMcpToolsSchema();
        if (tools) payload.tools = tools;

        const postData = JSON.stringify(payload);

        const opts = {
            hostname: 'openrouter.ai',
            port: 443,
            path: '/api/v1/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`,
                'HTTP-Referer': 'http://localhost:8033',
                'X-Title': 'FSD Agent',
                'Content-Length': Buffer.byteLength(postData),
            },
        };

        const req = https.request(opts, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.choices?.[0]?.message?.content) {
                            resolve(parsed.choices[0].message.content);
                        } else {
                            reject(new Error(`OpenRouter unexpected format: ${data.slice(0, 300)}`));
                        }
                    } catch (e) {
                        reject(new Error(`Failed to parse OpenRouter JSON: ${data.slice(0, 300)}`));
                    }
                } else {
                    const err = new Error(`OpenRouter HTTP ${res.statusCode}: ${data}`);
                    err.statusCode = res.statusCode;
                    reject(err);
                }
            });
        });

        req.on('error', reject);
        req.setTimeout(90000, () => {
            req.destroy();
            reject(new Error('OpenRouter API request timed out'));
        });
        req.write(postData);
        req.end();
    });
}

// ── Streaming SSE (Chat UI) ──────────────────────────────────────────────────

/**
 * Stream a chat conversation via OpenRouter SSE.
 * Writes SSE events to `res` and resolves with the full response text.
 *
 * @param {object} opts
 * @param {string}          opts.prompt   - new user prompt
 * @param {Array<object>}   opts.history  - previous messages [{role, content}]
 * @param {object}          opts.res      - Express SSE response object
 * @returns {Promise<string>} full accumulated response text
 */
function stream({ prompt, history = [], res, signal, model }) {
    const activeModel = model || DEFAULT_MODEL;
    const messages = [...history, { role: 'user', content: prompt }];

    const payload = {
        model: activeModel,
        messages,
        stream: true,
        stream_options: {
            include_usage: true
        }
    };
    const tools = getMcpToolsSchema();
    if (tools) payload.tools = tools;

    const postData = JSON.stringify(payload);

    const options = {
        hostname: 'openrouter.ai',
        port: 443,
        path: '/api/v1/chat/completions',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_KEY}`,
            'HTTP-Referer': 'http://localhost:8033',
            'X-Title': 'TheOMS AI Client',
            'Content-Length': Buffer.byteLength(postData),
        },
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, (apiRes) => {
            if (apiRes.statusCode < 200 || apiRes.statusCode >= 300) {
                let errBody = '';
                apiRes.on('data', (c) => errBody += c.toString());
                apiRes.on('end', () => {
                    reject(new Error(`OpenRouter HTTP ${apiRes.statusCode}: ${errBody || 'Unknown Error'}`));
                });
                return;
            }
            let buffer = '';
            let accumulated = '';
            let accumulatedUsage = null;

            apiRes.on('data', (chunk) => {
                buffer += chunk.toString();
                const lines = buffer.split('\n');
                buffer = lines.pop();

                for (const line of lines) {
                    const clean = line.trim();
                    if (!clean || clean === 'data: [DONE]') continue;
                    if (clean.startsWith('data: ')) {
                        try {
                            const jsonStr = clean.substring(6);
                            const parsed = JSON.parse(jsonStr);
                            const content = parsed.choices?.[0]?.delta?.content;
                            if (content) {
                                accumulated += content;
                                res.write(`event: message\ndata: ${JSON.stringify({ text: content })}\n\n`);
                            }
                            if (parsed.usage) {
                                accumulatedUsage = {
                                    prompt_tokens: parsed.usage.prompt_tokens || 0,
                                    completion_tokens: parsed.usage.completion_tokens || 0,
                                    total_tokens: parsed.usage.total_tokens || 0
                                };
                            }
                        } catch (_) {
                            // skip malformed lines
                        }
                    }
                }
            });

            apiRes.on('end', () => {
                resolve({ content: accumulated, usage: accumulatedUsage });
            });
        });

        req.on('error', (err) => {
            reject(err);
        });

        req.setTimeout(90000, () => {
            req.destroy();
            reject(new Error('OpenRouter stream request timed out'));
        });

        // Support abort via signal
        if (signal) {
            signal.addEventListener('abort', () => {
                req.destroy();
                reject(new Error('OpenRouter stream aborted'));
            }, { once: true });
        }

        req.write(postData);
        req.end();
    });
}

function clearCache() {
    cachedModels = null;
    lastFetchTime = 0;
    serverLog('[OpenRouter] Model cache cleared');
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
    name: 'openrouter',
    run,
    stream,
    fetchModels,
    DEFAULT_MODEL,
    clearCache,
};
