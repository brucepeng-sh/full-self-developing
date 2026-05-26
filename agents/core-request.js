const { spawn } = require('child_process');
const https = require('https');
const http = require('http');

/**
 * Core Request Module
 * Handles dynamic switching between HTTP API and CLI Driver execution modes.
 */
class CoreRequest {
    /**
     * @param {Object} options
     * @param {string} options.executionMode - 'HTTP API' or 'Local CLI Driver'
     * @param {string} [options.cliBinaryPath]
     * @param {string} [options.baseUrl]
     * @param {string} [options.apiKey]
     * @param {string} [options.model]
     */
    constructor(options) {
        this.options = options;
    }

    /**
     * Executes a chat completion request.
     * @param {Array} messages - Chat history
     * @param {Function} onChunk - Streaming callback
     * @returns {Promise<string>} Full response text
     */
    async streamChat(messages, onChunk) {
        if (this.options.executionMode === 'Local CLI Driver') {
            return this._runCliStreaming(messages, onChunk);
        } else {
            return this._runHttpStreaming(messages, onChunk);
        }
    }

    _runCliStreaming(messages, onChunk) {
        return new Promise((resolve, reject) => {
            const { cliBinaryPath, model } = this.options;
            if (!cliBinaryPath) {
                return reject(new Error('CLI Binary Path is required for Local CLI Driver mode.'));
            }

            // Map standard chat messages to CLI arguments or stdin payload
            // Here we assume a generic CLI interface that takes JSON via stdin
            const payload = JSON.stringify({
                model,
                messages
            });

            const child = spawn(cliBinaryPath, ['chat', '--stream'], {
                stdio: ['pipe', 'pipe', 'pipe'],
                windowsHide: true,
                shell: true
            });

            let fullText = '';

            child.stdout.on('data', (data) => {
                const text = data.toString();
                fullText += text;
                if (onChunk) onChunk(text);
            });

            let errorText = '';
            child.stderr.on('data', (data) => {
                errorText += data.toString();
            });

            child.on('error', (err) => {
                reject(new Error(`CLI Execution failed: ${err.message}`));
            });

            child.on('close', (code) => {
                if (code !== 0 && !fullText) {
                    reject(new Error(`CLI exited with code ${code}: ${errorText}`));
                } else {
                    resolve(fullText);
                }
            });

            // Send payload to stdin
            child.stdin.write(payload);
            child.stdin.end();
        });
    }

    _runHttpStreaming(messages, onChunk) {
        return new Promise((resolve, reject) => {
            const { baseUrl, apiKey, model } = this.options;
            if (!baseUrl) {
                return reject(new Error('Base URL is required for HTTP API mode.'));
            }

            let urlStr = baseUrl;
            if (!urlStr.endsWith('/chat/completions') && !urlStr.endsWith('/v1/chat/completions')) {
                urlStr = urlStr.endsWith('/') ? `${urlStr}v1/chat/completions` : `${urlStr}/v1/chat/completions`;
            }

            const parsedUrl = new URL(urlStr);
            const client = parsedUrl.protocol === 'https:' ? https : http;

            const postData = JSON.stringify({
                model: model,
                messages: messages,
                stream: true
            });

            const reqOpts = {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
                path: parsedUrl.pathname + parsedUrl.search,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                }
            };

            if (apiKey) {
                reqOpts.headers['Authorization'] = `Bearer ${apiKey}`;
            }

            const req = client.request(reqOpts, (res) => {
                let accumulated = '';
                let buffer = '';

                if (res.statusCode >= 400) {
                    let errData = '';
                    res.on('data', chunk => errData += chunk);
                    res.on('end', () => {
                        reject(new Error(`HTTP Error ${res.statusCode}: ${errData}`));
                    });
                    return;
                }

                res.on('data', (chunk) => {
                    buffer += chunk.toString();
                    const lines = buffer.split('\n');
                    buffer = lines.pop();

                    for (const line of lines) {
                        const clean = line.trim();
                        if (!clean || clean === 'data: [DONE]') continue;
                        if (clean.startsWith('data: ')) {
                            try {
                                const parsed = JSON.parse(clean.substring(6));
                                const content = parsed.choices?.[0]?.delta?.content;
                                if (content) {
                                    accumulated += content;
                                    if (onChunk) onChunk(content);
                                }
                            } catch (e) {
                                // ignore parse errors on chunks
                            }
                        }
                    }
                });

                res.on('end', () => {
                    resolve(accumulated);
                });
            });

            req.on('error', (err) => {
                reject(new Error(`HTTP Request failed: ${err.message}`));
            });

            req.write(postData);
            req.end();
        });
    }
}

module.exports = CoreRequest;
