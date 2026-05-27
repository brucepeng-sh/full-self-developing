const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const net = require('net');
const { v4: uuidv4 } = require('uuid');
const { serverLog, warnLog, errorLog } = require('./logger');
const engineConfig = require('./agents/engine-config');
const mcpManager   = require('./agents/mcp-client-manager');
const { getWorkspacePath, setWorkspacePath } = engineConfig;

// ── Loop Agent System ─────────────────────────────────────────────────────────
const dispatcher = require('./agents/dispatcher');
const { loadTasks, getTask, registerSSEClient, getProjectCWD, updateTask } = require('./agents/base');
const { getDriver } = require('./agents/drivers');

const app = express();

const recentErrors = [];
function logErrorToStatus(context, error) {
    const errorMsg = error ? (error.message || String(error)) : 'Unknown error';
    recentErrors.unshift({
        timestamp: new Date().toISOString(),
        context,
        message: errorMsg
    });
    if (recentErrors.length > 20) {
        recentErrors.pop();
    }
}

function sendErrorResponse(res, statusCode, code, message) {
    logErrorToStatus(`${res.req?.method || 'API'} ${res.req?.path || ''}`, `${code}: ${message}`);
    return res.status(statusCode).json({
        error: true,
        code,
        message
    });
}

// Secure high-entropy token generated on boot to prevent CSRF / Remote Code Execution
const APP_TOKEN = crypto.randomBytes(32).toString('hex');
serverLog(`[Security] Generated Startup Token: ${APP_TOKEN}`);

// Store reference to the active AbortController for stream cancellation
let activeAbortController = null;
let activeSessionId = null;

// Track requests inside a sliding window of 60 seconds to monitor RPM limits
const requestTimestamps = [];
function recordRequestAndGetRPM() {
    const now = Date.now();
    requestTimestamps.push(now);
    
    // Clear out timestamps older than 60 seconds
    const threshold = now - 60000;
    while(requestTimestamps.length > 0 && requestTimestamps[0] < threshold) {
        requestTimestamps.shift();
    }
    
    return requestTimestamps.length;
}

// Heartbeat Tracker (Auto-shutdown server on browser window close)
let lastHeartbeat = Date.now();
setInterval(() => {
    if (Date.now() - lastHeartbeat > 600000) {
        // Bypass auto-shutdown during development to prevent ECONNREFUSED in Vite
        warnLog('[System] No heartbeat received for 10 minutes. (Auto-shutdown bypassed during development)');
        lastHeartbeat = Date.now(); // reset to prevent spamming
        // process.exit(0); // Disabled to prevent backend from crashing during dev
    }
}, 5000);

app.use(cors());
app.use(express.json());

// Token Verification Middleware for all /api endpoints
// Exempt: heartbeat and quota endpoints (internal browser calls without full token flow)
// NOTE: inside app.use('/api', ...), Express strips the /api prefix from req.path,
//       so /api/heartbeat becomes /heartbeat, /api/quota/rpm becomes /quota/rpm
const TOKEN_WHITELIST = ['/quota/rpm', '/token/handshake', '/loop/stream', '/heartbeat'];
app.use('/api', (req, res, next) => {
    recordRequestAndGetRPM();
    if (TOKEN_WHITELIST.some(p => req.path === p || req.path.startsWith(p))) {
        return next();
    }
    const clientToken = req.headers['x-app-token'] || req.query.token;
    if (clientToken !== APP_TOKEN) {
        warnLog(`[Security Alert] Blocked ${req.method} /api${req.path} from origin: ${req.headers.origin || 'Unknown'}`);
        return sendErrorResponse(res, 403, 'UNAUTHORIZED', 'Unauthorized: Invalid app token.');
    }
    next();
});

// Backend is now purely an API server. Frontend is served by Vite Dev Server on port 5173.

// Retrieve log file path dynamically (external — Antigravity compat)
function getLogPath(uuid) {
    const homeDir = process.env.USERPROFILE || process.env.HOME || 'C:\\Users\\Administrator';
    return path.join(homeDir, `.gemini/antigravity/brain/${uuid}/.system_generated/logs/overview.txt`);
}

// Project-local chat log path (persisted inside project/logs/chat/)
const isGlobal = process.env.FSD_GLOBAL === 'true' || __dirname.includes('node_modules');
const PROJECT_CHAT_LOGS_DIR = isGlobal
    ? path.join(require('os').homedir(), '.fsd', 'logs', 'chat')
    : path.join(__dirname, 'logs', 'chat');
function getProjectChatLogPath(uuid) {
    return path.join(PROJECT_CHAT_LOGS_DIR, uuid, 'overview.jsonl');
}

// Helper: append a log entry to the project-local chat log
function appendProjectChatLog(uuid, entry) {
    try {
        const logPath = getProjectChatLogPath(uuid);
        fs.mkdirSync(path.dirname(logPath), { recursive: true });
        fs.appendFileSync(logPath, JSON.stringify(entry) + '\n');
    } catch (e) {
        errorLog('[ChatLog] Failed to write project chat log:', e.message);
    }
}

function listSessionsLocal() {
    const homeDir = process.env.USERPROFILE || process.env.HOME || 'C:\\Users\\Administrator';
    const brainDir = path.join(homeDir, '.gemini/antigravity/brain');
    if (!fs.existsSync(brainDir)) return [];
    
    const dirs = fs.readdirSync(brainDir).filter(name => {
        try {
            const stat = fs.statSync(path.join(brainDir, name));
            return stat.isDirectory() && /^[0-9a-fA-F-]{36}$/.test(name);
        } catch (_) {
            return false;
        }
    });
    
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    // Single-pass: collect all session metadata in one traversal
    const sessions = dirs.map((uuid, idx) => {
        const logPath = path.join(brainDir, uuid, '.system_generated/logs/overview.txt');
        let mtime = 0;
        let timeStr = 'Just now';
        let title = '';
        
        if (fs.existsSync(logPath)) {
            const stat = fs.statSync(logPath);
            mtime = stat.mtimeMs;
            const date = stat.mtime;
            timeStr = `${monthNames[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
            
            // Extract title from log file (single read)
            try {
                const data = fs.readFileSync(logPath, 'utf8');
                const lines = data.split('\n');
                for (const line of lines) {
                    if (!line.trim()) continue;
                    const json = JSON.parse(line);
                    if (json.type === 'USER_INPUT' && json.content) {
                        let text = json.content;
                        const reqMatch = text.match(/<USER_REQUEST>([\s\S]*?)<\/USER_REQUEST>/);
                        if (reqMatch) {
                            text = reqMatch[1];
                        }
                        text = text.trim();
                        if (text) {
                            title = text.substring(0, 30) + (text.length > 30 ? '...' : '');
                        }
                        break; // Only need first user input
                    }
                }
            } catch (_) {
                // Ignore error and fall back
            }
        } else {
            mtime = fs.statSync(path.join(brainDir, uuid)).mtimeMs;
        }
        
        const index = String(idx + 1);
        return {
            index,
            id: uuid,
            title: title || `Session ${uuid.substring(0, 8)}`,
            time: timeStr,
            mtime  // keep for sorting
        };
    });
    
    sessions.sort((a, b) => b.mtime - a.mtime);
    // Re-index after sort
    sessions.forEach((s, i) => { s.index = String(i + 1); });
    // Strip internal mtime field from output
    return sessions.map(({ mtime, ...rest }) => rest);
}

// API: List Sessions
app.get('/api/sessions', (req, res) => {
    try {
        const sessions = listSessionsLocal();
        res.json({ sessions });
    } catch (e) {
        sendErrorResponse(res, 500, 'INTERNAL_SERVER_ERROR', `Failed to retrieve sessions: ${e.message}`);
    }
});

// API: Get Session Chat History
app.get('/api/sessions/:id/history', (req, res) => {
    const sessionId = req.params.id;
    const logPath = getLogPath(sessionId);
    
    if (!fs.existsSync(logPath)) {
        return res.json({ history: [] });
    }
    
    try {
        const fileContent = fs.readFileSync(logPath, 'utf8');
        const lines = fileContent.split('\n');
        const history = [];
        let sessionUsage = null;
        
        for (const line of lines) {
            if (!line.trim()) continue;
            const stepObj = JSON.parse(line);
            
            // Reconstruct User prompt
            if (stepObj.type === 'USER_INPUT') {
                let text = stepObj.content;
                const reqMatch = text.match(/<USER_REQUEST>([\s\S]*?)<\/USER_REQUEST>/);
                if (reqMatch) {
                    text = reqMatch[1];
                }
                history.push({
                    role: 'user',
                    text: text.trim(),
                    timestamp: stepObj.created_at
                });
            }
            
            // Reconstruct Model response & Tool activities
            if (stepObj.type === 'PLANNER_RESPONSE' || stepObj.type === 'MODEL_RESPONSE') {
                const item = {
                    role: 'model',
                    text: stepObj.content || '',
                    timestamp: stepObj.created_at
                };
                if (stepObj.usage) {
                    item.usage = stepObj.usage;
                    sessionUsage = stepObj.usage;
                }
                if (stepObj.tool_calls && stepObj.tool_calls.length > 0) {
                    item.tool_calls = stepObj.tool_calls.map(tc => {
                        let parsedArgs = tc.args;
                        if (typeof parsedArgs === 'string') {
                            try {
                                parsedArgs = JSON.parse(parsedArgs);
                            } catch (e) {}
                        }
                        return {
                            name: tc.name,
                            args: parsedArgs,
                            toolAction: tc.args.toolAction || '',
                            toolSummary: tc.args.toolSummary || ''
                        };
                    });
                }
                history.push(item);
            }
        }
        res.json({ history, usage: sessionUsage });
    } catch (e) {
        sendErrorResponse(res, 500, 'INTERNAL_SERVER_ERROR', `Failed to parse session log history: ${e.message}`);
    }
});

// API: Delete Session (Soft Delete)
app.post('/api/sessions/delete', (req, res) => {
    const { index } = req.body;
    if (!index) {
        return sendErrorResponse(res, 400, 'BAD_REQUEST', 'Session index is required.');
    }
    
    try {
        const sessions = listSessionsLocal();
        const session = sessions.find(s => s.index === String(index));
        if (!session) {
            return sendErrorResponse(res, 404, 'NOT_FOUND', `Session index ${index} not found.`);
        }
        
        const homeDir = process.env.USERPROFILE || process.env.HOME || 'C:\\Users\\Administrator';
        const sessionDir = path.join(homeDir, '.gemini/antigravity/brain', session.id);
        const trashDir = path.join(homeDir, '.gemini/antigravity/brain', '.trash');
        
        if (fs.existsSync(sessionDir)) {
            fs.mkdirSync(trashDir, { recursive: true });
            const targetTrashDir = path.join(trashDir, session.id);
            if (fs.existsSync(targetTrashDir)) {
                fs.rmSync(targetTrashDir, { recursive: true, force: true });
            }
            fs.renameSync(sessionDir, targetTrashDir);
        }
        res.json({ success: true, message: 'Session moved to trash', sessionId: session.id });
    } catch (e) {
        sendErrorResponse(res, 500, 'INTERNAL_SERVER_ERROR', `Failed to delete session: ${e.message}`);
    }
});

// API: Restore Session
app.post('/api/sessions/restore', (req, res) => {
    const { id } = req.body;
    if (!id) {
        return sendErrorResponse(res, 400, 'BAD_REQUEST', 'Session ID is required.');
    }
    
    try {
        const homeDir = process.env.USERPROFILE || process.env.HOME || 'C:\\Users\\Administrator';
        const trashDir = path.join(homeDir, '.gemini/antigravity/brain', '.trash', id);
        const sessionDir = path.join(homeDir, '.gemini/antigravity/brain', id);
        
        if (!fs.existsSync(trashDir)) {
            return sendErrorResponse(res, 404, 'NOT_FOUND', `Session ${id} not found in trash.`);
        }
        
        if (fs.existsSync(sessionDir)) {
            fs.rmSync(sessionDir, { recursive: true, force: true });
        }
        
        fs.renameSync(trashDir, sessionDir);
        res.json({ success: true, message: 'Session restored successfully' });
    } catch (e) {
        sendErrorResponse(res, 500, 'INTERNAL_SERVER_ERROR', `Failed to restore session: ${e.message}`);
    }
});

// API: List Trash Sessions
app.get('/api/sessions/trash', (req, res) => {
    try {
        const homeDir = process.env.USERPROFILE || process.env.HOME || 'C:\\Users\\Administrator';
        const trashDir = path.join(homeDir, '.gemini/antigravity/brain', '.trash');
        if (!fs.existsSync(trashDir)) {
            return res.json({ sessions: [] });
        }
        
        const dirs = fs.readdirSync(trashDir).filter(name => {
            try {
                const stat = fs.statSync(path.join(trashDir, name));
                return stat.isDirectory() && /^[0-9a-fA-F-]{36}$/.test(name);
            } catch (_) {
                return false;
            }
        });
        
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const sessions = dirs.map((uuid, idx) => {
            const logPath = path.join(trashDir, uuid, '.system_generated/logs/overview.txt');
            let mtime = 0;
            let timeStr = 'Just now';
            let title = '';
            
            if (fs.existsSync(logPath)) {
                const stat = fs.statSync(logPath);
                mtime = stat.mtimeMs;
                const date = stat.mtime;
                timeStr = `${monthNames[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
                
                try {
                    const data = fs.readFileSync(logPath, 'utf8');
                    const lines = data.split('\n');
                    for (const line of lines) {
                        if (!line.trim()) continue;
                        const json = JSON.parse(line);
                        if (json.type === 'USER_INPUT' && json.content) {
                            let text = json.content;
                            const reqMatch = text.match(/<USER_REQUEST>([\s\S]*?)<\/USER_REQUEST>/);
                            if (reqMatch) {
                                text = reqMatch[1];
                            }
                            text = text.trim();
                            if (text) {
                                title = text.substring(0, 30) + (text.length > 30 ? '...' : '');
                            }
                            break;
                        }
                    }
                } catch (_) {}
            } else {
                mtime = fs.statSync(path.join(trashDir, uuid)).mtimeMs;
            }
            
            return {
                id: uuid,
                title: title || `Deleted Session ${uuid.substring(0, 8)}`,
                time: timeStr,
                mtime
            };
        });
        
        sessions.sort((a, b) => b.mtime - a.mtime);
        res.json({ sessions });
    } catch (e) {
        sendErrorResponse(res, 500, 'INTERNAL_SERVER_ERROR', `Failed to retrieve trash sessions: ${e.message}`);
    }
});

// API: Active Streaming Prompt Session (SSE)
app.get('/api/chat/stream', (req, res) => {
    const { prompt, resumeId } = req.query;
    
    if (!prompt) {
        return sendErrorResponse(res, 400, 'BAD_REQUEST', 'Prompt is required.');
    }
    
    // Set headers for Server-Sent Events (SSE)
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
    });
    
    // Check local sliding RPM metric
    const activeRPM = recordRequestAndGetRPM();
    res.write(`event: rpm\ndata: ${JSON.stringify({ rpmActive: activeRPM })}\n\n`);

    // Check engine selection (default to configured engine)
    const engine = req.query.engine || engineConfig.getCurrentEngine();

    let sessionId = null;
    if (resumeId && resumeId.trim()) {
        const idStr = resumeId.trim();
        if (/^[0-9a-fA-F-]{36}$/.test(idStr)) {
            sessionId = idStr;
        } else {
            const sessions = listSessionsLocal();
            const session = sessions.find(s => s.index === idStr);
            if (session) {
                sessionId = session.id;
            }
        }
    }
    if (!sessionId) {
        sessionId = uuidv4();
    }

    // Route to engine driver for unified streaming
    const driver = getDriver(engine);

    // ── Session history loading (applies to all engines) ─────────────
    const homeDir = process.env.USERPROFILE || process.env.HOME || 'C:\\Users\\Administrator';
    const logDir = path.join(homeDir, `.gemini/antigravity/brain/${sessionId}/.system_generated/logs`);
    const logPath = path.join(logDir, 'overview.txt');
    fs.mkdirSync(logDir, { recursive: true });

    let stepIndex = 0;
    const messages = [];
    if (fs.existsSync(logPath)) {
        try {
            const data = fs.readFileSync(logPath, 'utf8');
            const lines = data.split('\n');
            for (const line of lines) {
                if (!line.trim()) continue;
                stepIndex++;
                try {
                    const json = JSON.parse(line);
                    if (json.type === 'USER_INPUT') {
                        let text = json.content;
                        const reqMatch = text.match(/<USER_REQUEST>([\s\S]*?)<\/USER_REQUEST>/);
                        if (reqMatch) {
                            text = reqMatch[1];
                        }
                        messages.push({ role: 'user', content: text.trim() });
                    } else if (json.type === 'MODEL_RESPONSE' || json.type === 'PLANNER_RESPONSE') {
                        messages.push({ role: 'assistant', content: json.content });
                    }
                } catch (e) {
                    // ignore malformed lines
                }
            }
        } catch (e) {
            errorLog('Error reading session history log:', e);
        }
    }

    // Add new user prompt to conversation history
    messages.push({ role: 'user', content: prompt });

    // Write new user input log line
    const userContent = `<USER_REQUEST>\n${prompt}\n</USER_REQUEST>`;
    const userInputLog = {
        step_index: stepIndex,
        source: 'USER_EXPLICIT',
        type: 'USER_INPUT',
        status: 'DONE',
        created_at: new Date().toISOString(),
        content: userContent,
    };
    fs.appendFileSync(logPath, JSON.stringify(userInputLog) + '\n');
    appendProjectChatLog(sessionId, userInputLog);

    // ── Execute stream via engine driver ────────────────────────────
    const ac = new AbortController();
    activeAbortController = ac;

    const executeStreamLoop = async (currentMessages, isFollowUp = false) => {
        try {
            const streamResult = await driver.stream({ 
                prompt: isFollowUp ? '' : prompt, 
                history: isFollowUp ? currentMessages : messages, 
                res, 
                signal: ac.signal, 
                model: req.query.model 
            });
            if (!streamResult) return; // aborted

            const content = typeof streamResult === 'string' ? streamResult : streamResult.content;
            const usage = typeof streamResult === 'object' ? streamResult.usage : null;
            const tool_calls = typeof streamResult === 'object' ? streamResult.tool_calls : null;

            // Write model response log line
            const modelResponseLog = {
                step_index: stepIndex + 1,
                source: 'MODEL',
                type: 'MODEL_RESPONSE',
                status: 'DONE',
                created_at: new Date().toISOString(),
                content: content,
            };
            if (usage) {
                modelResponseLog.usage = usage;
            }
            if (tool_calls && tool_calls.length > 0) {
                modelResponseLog.tool_calls = tool_calls;
            }
            fs.appendFileSync(logPath, JSON.stringify(modelResponseLog) + '\n');
            appendProjectChatLog(sessionId, modelResponseLog);

            if (tool_calls && tool_calls.length > 0) {
                const mcpManager = require('./agents/mcp-client-manager');
                const nextMessages = [...(isFollowUp ? currentMessages : messages)];
                nextMessages.push({ role: 'assistant', content: content || null, tool_calls });

                for (const tc of tool_calls) {
                    if (tc.function?.name) {
                        let serverName, toolName;
                        if (tc.function.name.includes('__')) {
                            [serverName, toolName] = tc.function.name.split('__');
                        } else {
                            serverName = 'unknown';
                            toolName = tc.function.name;
                        }
                        
                        let args = {};
                        try { args = JSON.parse(tc.function.arguments || '{}'); } catch(e) {}
                        
                        let result;
                        try {
                            res.write(`event: status\ndata: ${JSON.stringify({ status: `Executing tool ${toolName}...` })}\n\n`);
                            result = await mcpManager.callTool(serverName, toolName, args);
                        } catch(e) {
                            result = { error: e.message };
                        }
                        
                        // Write tool result log
                        const toolLog = {
                            step_index: stepIndex + 1,
                            source: 'TOOL',
                            type: 'TOOL_RESPONSE',
                            status: 'DONE',
                            created_at: new Date().toISOString(),
                            tool_call_id: tc.id,
                            name: tc.function.name,
                            result: result
                        };
                        fs.appendFileSync(logPath, JSON.stringify(toolLog) + '\n');
                        appendProjectChatLog(sessionId, toolLog);
                        
                        nextMessages.push({
                            role: 'tool',
                            tool_call_id: tc.id,
                            name: tc.function.name,
                            content: typeof result === 'string' ? result : JSON.stringify(result)
                        });
                    }
                }
                // Recursively call for the next response
                return executeStreamLoop(nextMessages, true);
            } else {
                res.write(`event: done\ndata: ${JSON.stringify({ code: 0, usage })}\n\n`);
                res.end();
            }
        } catch (err) {
            if (err.message.includes('aborted')) {
                res.write(`event: done\ndata: ${JSON.stringify({ code: -1, message: 'aborted' })}\n\n`);
            } else {
                errorLog(`[${driver.name} Stream Error] ${err && err.stack ? err.stack : err.message || err}`);
                res.write(`event: error\ndata: ${JSON.stringify({ error: true, code: 'STREAM_FAILED', message: `${driver.name} stream failed: ${err.message}` })}\n\n`);
            }
            res.end();
        }
    };

    executeStreamLoop().finally(() => {
        activeAbortController = null;
    });
});

// API: Send interactive confirmation input into Stdin (No-op — OpenRouter is API-based)
app.post('/api/chat/input', (req, res) => {
    res.json({ success: true, message: 'No active spawned child CLI to send input to.' });
});

// API: Stop Execution Task (Abort task tree safely)
app.post('/api/chat/stop', (req, res) => {
    if (activeAbortController) {
        serverLog('[System] Aborting active stream...');
        activeAbortController.abort();
        activeAbortController = null;
        res.json({ success: true, message: 'Stream aborted.' });
    } else {
        sendErrorResponse(res, 400, 'BAD_REQUEST', 'No active stream is currently running.');
    }
});

// API: Heartbeat ping (whitelisted — no token required)
app.post('/api/heartbeat', (req, res) => {
    lastHeartbeat = Date.now();
    res.sendStatus(200);
});

// API: RPM Quota status (whitelisted — polled every 5s by frontend)
app.get('/api/quota/rpm', (req, res) => {
    const now = Date.now();
    const threshold = now - 60000;
    const activeRPM = requestTimestamps.filter(t => t >= threshold).length;
    res.json({ rpmActive: activeRPM, rpmLimit: 15 });
});

// API: Get Security Token (only internally mapped during dynamic launch)
app.get('/api/token/handshake', (req, res) => {
    res.json({ token: APP_TOKEN });
});

// GET settings
app.get('/api/settings', (req, res) => {
    try {
        const settings = engineConfig.loadSettings();
        res.json({ settings });
    } catch (e) {
        sendErrorResponse(res, 500, 'INTERNAL_SERVER_ERROR', `Failed to load settings: ${e.message}`);
    }
});

// POST settings
app.post('/api/settings', (req, res) => {
    const { settings } = req.body;
    if (!settings) {
        return sendErrorResponse(res, 400, 'BAD_REQUEST', 'settings object is required');
    }
    try {
        engineConfig.saveSettings(settings);
        try {
            const openrouter = require('./agents/drivers/openrouter');
            if (openrouter && typeof openrouter.clearCache === 'function') {
                openrouter.clearCache();
            }
        } catch (_) {}
        res.json({ success: true });
    } catch (e) {
        sendErrorResponse(res, 500, 'INTERNAL_SERVER_ERROR', `Failed to save settings: ${e.message}`);
    }
});

// =============================================================================
// Engine Configuration API
// =============================================================================

// GET engine status — returns availability of each engine + current selection
app.get('/api/engine/status', (req, res) => {
    const current = engineConfig.getCurrentEngine();
    const geminiCliAvailable = engineConfig.checkGeminiCliAvailable();
    const currentModel = engineConfig.getActiveModel();
    res.json({
        openrouter: true,
        'gemini-cli': geminiCliAvailable,
        currentEngine: current,
        currentModel,
    });
});

// POST switch engine
app.post('/api/engine/switch', (req, res) => {
    const { engine } = req.body;
    if (!engineConfig.VALID_ENGINES.includes(engine)) {
        return sendErrorResponse(res, 400, 'BAD_REQUEST', `Invalid engine. Must be one of: ${engineConfig.VALID_ENGINES.join(', ')}`);
    }
    engineConfig.saveEngineConfig(engine);
    res.json({ ok: true, engine });
});

// POST switch model
app.post('/api/engine/model', (req, res) => {
    const { model } = req.body;
    if (!model || typeof model !== 'string') {
        return sendErrorResponse(res, 400, 'BAD_REQUEST', 'model is required and must be a string');
    }
    engineConfig.saveActiveModel(model);
    res.json({ ok: true, model });
});

// GET dynamic model list for the current engine
app.get('/api/engine/models', async (req, res) => {
    const engine = engineConfig.getCurrentEngine();
    try {
        let models = [];
        if (engine === 'openrouter') {
            const { fetchModels } = require('./agents/drivers/openrouter');
            models = await fetchModels();
        } else if (engine === 'gemini-cli') {
            models = engineConfig.getGeminiCliModels();
        }
        res.json({ engine, models });
    } catch (e) {
        errorLog('[API /engine/models] Error:', e.message);
        sendErrorResponse(res, 500, 'INTERNAL_SERVER_ERROR', `Failed to retrieve model list: ${e.message}`);
    }
});

// GET active tools / skills for the current engine
app.get('/api/engine/tools', async (req, res) => {
    const engine = engineConfig.getCurrentEngine();
    try {
        const skillsManager = require('./agents/skills-manager');
        const skills = await skillsManager.getSystemSkillsAsync();
        
        let mcp_servers = [];
        
        // Map enabled state
        const settings = engineConfig.loadSettings();
        const enabledSkills = settings.enabledSkills || [];
        const mappedSkills = skills.map(skill => ({
            ...skill,
            enabled: enabledSkills.includes(skill.id)
        }));
        
        const workspacePath = engineConfig.getWorkspacePath();
        res.json({ engine, skills: mappedSkills, mcp_servers, tools: [], workspacePath });
    } catch (e) {
        errorLog('[API /engine/tools] Error:', e.message);
        sendErrorResponse(res, 500, 'INTERNAL_SERVER_ERROR', `Failed to retrieve tool list: ${e.message}`);
    }
});

// POST toggle a skill's enabled status
app.post('/api/engine/skills/toggle', (req, res) => {
    const { skillId, enabled } = req.body;
    if (!skillId) {
        return sendErrorResponse(res, 400, 'BAD_REQUEST', 'skillId is required');
    }
    
    try {
        const settings = engineConfig.loadSettings();
        let enabledSkills = settings.enabledSkills || [];
        
        if (enabled) {
            if (!enabledSkills.includes(skillId)) {
                enabledSkills.push(skillId);
            }
        } else {
            enabledSkills = enabledSkills.filter(id => id !== skillId);
        }
        
        settings.enabledSkills = enabledSkills;
        engineConfig.saveSettings(settings);
        
        res.json({ success: true, enabledSkills });
    } catch (e) {
        errorLog('[API /engine/skills/toggle] Error:', e.message);
        sendErrorResponse(res, 500, 'INTERNAL_SERVER_ERROR', `Failed to toggle skill: ${e.message}`);
    }
});

// POST create a new skill
app.post('/api/engine/skills/create', (req, res) => {
    const { name, description } = req.body;
    if (!name || !description) {
        return sendErrorResponse(res, 400, 'BAD_REQUEST', 'name and description are required');
    }
    
    try {
        const workspacePath = engineConfig.getWorkspacePath();
        if (!workspacePath) {
            return sendErrorResponse(res, 400, 'NO_WORKSPACE', 'No workspace connected');
        }

        const skillId = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        if (!skillId) {
            return sendErrorResponse(res, 400, 'INVALID_NAME', 'Invalid skill name');
        }

        const fs = require('fs');
        const path = require('path');
        const skillDir = path.join(workspacePath, 'skills', skillId);

        if (fs.existsSync(skillDir)) {
            return sendErrorResponse(res, 400, 'ALREADY_EXISTS', 'A skill with a similar name already exists');
        }

        fs.mkdirSync(skillDir, { recursive: true });

        const skillContent = `---
name: "${name.replace(/"/g, '\\"')}"
description: "${description.replace(/"/g, '\\"')}"
---

# ${name}
Type your skill instructions here...
`;

        fs.writeFileSync(path.join(skillDir, 'SKILL.md'), skillContent, 'utf8');

        // Automatically enable it
        const settings = engineConfig.loadSettings();
        let enabledSkills = settings.enabledSkills || [];
        if (!enabledSkills.includes(skillId)) {
            enabledSkills.push(skillId);
            settings.enabledSkills = enabledSkills;
            engineConfig.saveSettings(settings);
        }

        res.json({ success: true, skillId });
    } catch (e) {
        errorLog('[API /engine/skills/create] Error:', e.message);
        sendErrorResponse(res, 500, 'INTERNAL_SERVER_ERROR', `Failed to create skill: ${e.message}`);
    }
});

// =============================================================================
// AI Configuration & Connection API
// =============================================================================

// POST test AI connection
app.post('/api/ai/test-connection', (req, res) => {
    const { provider, baseUrl, apiKey, executionMode, overrideCliPath } = req.body;
    
    if (executionMode === 'Local CLI Driver') {
        let cmd = overrideCliPath || provider;
        if (cmd === 'gemini-cli') cmd = 'gemini';
        if (!cmd) {
            return sendErrorResponse(res, 400, 'BAD_REQUEST', 'CLI Tool or Override Path is required.');
        }

        const validClis = ['gemini-cli', 'claude-cli', 'opencode', 'codex', 'openshell', 'tts-local-cli', 'skill-workshop', 'gemini'];
        if (!overrideCliPath && !validClis.includes(cmd)) {
             return sendErrorResponse(res, 400, 'INVALID_CLI_PROVIDER', `Invalid CLI Provider selected: '${provider}'. Please select a valid CLI tool.`);
        }

        const { spawnSync } = require('child_process');
        try {
            const result = spawnSync(`${cmd} --version`, {
                timeout: 5000,
                stdio: ['ignore', 'pipe', 'pipe'],
                windowsHide: true,
                shell: true
            });
            if (result.status === 0) {
                return res.json({ success: true, message: `CLI (${cmd}) is reachable.` });
            } else {
                return sendErrorResponse(res, 500, 'CLI_EXECUTION_ERROR', `CLI error: ${result.stderr ? result.stderr.toString() : 'Unknown error'}`);
            }
        } catch (e) {
            return sendErrorResponse(res, 500, 'CLI_SPAWN_ERROR', e.message);
        }
    } else {
        // HTTP API
        if (!baseUrl) {
             return sendErrorResponse(res, 400, 'BAD_REQUEST', 'Base URL is required for HTTP API.');
        }
        let url = baseUrl;
        if (!url.endsWith('/models') && !url.endsWith('/v1/models')) {
            url = url.endsWith('/') ? `${url}v1/models` : `${url}/v1/models`;
        }
        const https = require('https');
        const http = require('http');
        const client = url.startsWith('https') ? https : http;
        
        const reqOpts = {
            method: 'GET',
            headers: {}
        };
        if (apiKey) {
            reqOpts.headers['Authorization'] = `Bearer ${apiKey}`;
        }
        
        const request = client.request(url, reqOpts, (response) => {
            if (response.statusCode >= 200 && response.statusCode < 400) {
                res.json({ success: true, message: 'API is reachable.' });
            } else {
                sendErrorResponse(res, response.statusCode, 'HTTP_ERROR', `HTTP Error: ${response.statusCode}`);
            }
        });
        
        request.on('error', (err) => {
            sendErrorResponse(res, 500, 'CONNECTION_ERROR', err.message);
        });
        
        request.end();
    }
});

// POST refresh models
app.post('/api/ai/models', (req, res) => {
    const { provider, baseUrl, apiKey, executionMode, overrideCliPath } = req.body;
    
    if (executionMode === 'Local CLI Driver') {
        const cmd = overrideCliPath || provider;
        if (!cmd) {
            return sendErrorResponse(res, 400, 'BAD_REQUEST', 'CLI Tool or Override Path is required.');
        }
        
        // Serve known CLI models from config
        if (cmd === 'gemini-cli' || cmd === 'gemini') {
            const models = engineConfig.getGeminiCliModels().map(m => m.id || m.name);
            return res.json({ success: true, models });
        }


        // Check external config file for other CLIs
        try {
            const fs = require('fs');
            const path = require('path');
            const cliModelsPath = path.join(__dirname, 'agents', 'cli-models.json');
            if (fs.existsSync(cliModelsPath)) {
                const cliModels = JSON.parse(fs.readFileSync(cliModelsPath, 'utf8'));
                if (cliModels[cmd] && Array.isArray(cliModels[cmd])) {
                    const models = cliModels[cmd].map(m => m.id || m.name);
                    return res.json({ success: true, models });
                }
            }
        } catch (e) {
            // Ignore config read errors, fallback to spawn
        }

        const validClis = ['gemini-cli', 'claude-cli', 'opencode', 'codex', 'openshell', 'tts-local-cli', 'skill-workshop', 'gemini'];
        if (!overrideCliPath && !validClis.includes(cmd)) {
             return sendErrorResponse(res, 400, 'INVALID_CLI_PROVIDER', `Invalid CLI Provider selected: '${provider}'. Please select a valid CLI tool.`);
        }

        const { spawnSync } = require('child_process');
        try {
            const result = spawnSync(`${cmd} models --json`, {
                timeout: 5000,
                stdio: ['ignore', 'pipe', 'pipe'],
                windowsHide: true,
                shell: true
            });
            if (result.status === 0) {
                try {
                    let models = JSON.parse(result.stdout.toString());
                    // some CLIs might wrap models in { data: [] }
                    if (models.data && Array.isArray(models.data)) models = models.data;
                    const formattedModels = (Array.isArray(models) ? models : []).map(m => m.id || m.name || (typeof m === 'string' ? m : null)).filter(Boolean);
                    return res.json({ success: true, models: formattedModels });
                } catch (e) {
                    return sendErrorResponse(res, 500, 'PARSE_ERROR', `Failed to parse CLI models output: ${e.message}`);
                }
            } else {
                return sendErrorResponse(res, 500, 'CLI_EXECUTION_ERROR', `CLI error: ${result.stderr ? result.stderr.toString() : 'Unknown error'}`);
            }
        } catch (e) {
            return sendErrorResponse(res, 500, 'CLI_SPAWN_ERROR', e.message);
        }
    } else {
        // HTTP API
        if (!baseUrl) {
             return sendErrorResponse(res, 400, 'BAD_REQUEST', 'Base URL is required for HTTP API.');
        }
        let url = baseUrl;
        if (!url.endsWith('/models') && !url.endsWith('/v1/models')) {
            url = url.endsWith('/') ? `${url}v1/models` : `${url}/v1/models`;
        }
        const https = require('https');
        const http = require('http');
        const client = url.startsWith('https') ? https : http;
        
        const reqOpts = {
            method: 'GET',
            headers: {}
        };
        if (apiKey) {
            reqOpts.headers['Authorization'] = `Bearer ${apiKey}`;
        }
        
        const request = client.request(url, reqOpts, (response) => {
            let data = '';
            response.on('data', chunk => data += chunk);
            response.on('end', () => {
                if (response.statusCode >= 200 && response.statusCode < 400) {
                    try {
                        const parsed = JSON.parse(data);
                        let models = parsed.data || parsed;
                        if (!Array.isArray(models)) {
                            models = [];
                        }
                        const formattedModels = models.map(m => m.id || m.name || (typeof m === 'string' ? m : null)).filter(Boolean);
                        res.json({ success: true, models: formattedModels });
                    } catch (e) {
                        sendErrorResponse(res, 500, 'PARSE_ERROR', `Failed to parse API output: ${e.message}`);
                    }
                } else {
                    sendErrorResponse(res, response.statusCode, 'HTTP_ERROR', `HTTP Error: ${response.statusCode}`);
                }
            });
        });
        
        request.on('error', (err) => {
            sendErrorResponse(res, 500, 'CONNECTION_ERROR', err.message);
        });
        
        request.end();
    }
});

// POST test AI model
app.post('/api/ai/test-model', (req, res) => {
    const { provider, baseUrl, apiKey, executionMode, overrideCliPath, model } = req.body;
    
    if (executionMode === 'Local CLI Driver') {
        let cmd = overrideCliPath || provider;
        if (cmd === 'gemini-cli') cmd = 'gemini';
        if (!cmd) {
            return sendErrorResponse(res, 400, 'BAD_REQUEST', 'CLI Tool is required.');
        }
        
        if (cmd === 'codex' || provider === 'codex') {
            return res.json({ success: true, reply: `Model '${model || 'default'}' selected for Codex. (Codex requires a terminal, skipping test prompt).` });
        }
        
        const { spawnSync } = require('child_process');
        try {
            const result = spawnSync(`${cmd} ask "Hello" --model "${model || ''}"`, {
                timeout: 15000,
                stdio: ['ignore', 'pipe', 'pipe'],
                windowsHide: true,
                shell: true
            });
            if (result.status === 0) {
                return res.json({ success: true, reply: result.stdout.toString().trim() });
            } else {
                return sendErrorResponse(res, 500, 'CLI_EXECUTION_ERROR', `CLI error: ${result.stderr ? result.stderr.toString() : 'Unknown error'}`);
            }
        } catch (e) {
            return sendErrorResponse(res, 500, 'CLI_SPAWN_ERROR', e.message);
        }
    } else {
        if (!baseUrl) {
             return sendErrorResponse(res, 400, 'BAD_REQUEST', 'Base URL is required for HTTP API.');
        }
        let url = baseUrl;
        if (!url.endsWith('/chat/completions') && !url.endsWith('/v1/chat/completions')) {
            url = url.endsWith('/') ? `${url}v1/chat/completions` : `${url}/v1/chat/completions`;
        }
        const https = require('https');
        const http = require('http');
        const client = url.startsWith('https') ? https : http;
        
        const reqOpts = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        };
        if (apiKey) {
            reqOpts.headers['Authorization'] = `Bearer ${apiKey}`;
        }
        
        const request = client.request(url, reqOpts, (response) => {
            let data = '';
            response.on('data', chunk => data += chunk);
            response.on('end', () => {
                if (response.statusCode >= 200 && response.statusCode < 400) {
                    try {
                        const parsed = JSON.parse(data);
                        const reply = parsed.choices?.[0]?.message?.content || 'Success';
                        res.json({ success: true, reply });
                    } catch (e) {
                        res.json({ success: true, reply: 'Success' });
                    }
                } else {
                    sendErrorResponse(res, response.statusCode, 'HTTP_ERROR', `HTTP Error: ${response.statusCode}. ${data.substring(0, 100)}`);
                }
            });
        });
        
        request.on('error', (err) => {
            sendErrorResponse(res, 500, 'CONNECTION_ERROR', err.message);
        });
        
        request.write(JSON.stringify({
            model: model,
            messages: [{ role: 'user', content: 'Hello' }],
            max_tokens: 15
        }));
        request.end();
    }
});

// =============================================================================
// OpenAI-compatible API Proxy (reverse proxy over FSD engines)
// =============================================================================

const apiProxy = require('./agents/api-proxy');

// GET /v1/models — list available models
app.get('/v1/models', (req, res) => {
    apiProxy.handleListModels(req, res);
});

// POST /v1/chat/completions — chat completion (streaming or non-streaming)
app.post('/v1/chat/completions', async (req, res) => {
    await apiProxy.handleChatCompletion(req, res);
});

// GET /api/proxy/status — proxy configuration + enabled status
app.get('/api/proxy/status', (req, res) => {
    res.json({
        enabled: apiProxy.enabled,
        config: apiProxy.config,
        currentEngine: engineConfig.getCurrentEngine(),
    });
});

// POST /api/proxy/reload — reload proxy config from disk
app.post('/api/proxy/reload', (req, res) => {
    try {
        apiProxy.reloadConfig();
        res.json({ success: true, enabled: apiProxy.enabled });
    } catch (e) {
        sendErrorResponse(res, 500, 'INTERNAL_SERVER_ERROR', e.message);
    }
});

// =============================================================================
// MCP (Model Context Protocol) Management API
// =============================================================================

// GET /api/mcp/tools — list all MCP tools from all connected servers
app.get('/api/mcp/tools', (req, res) => {
    try {
        const tools = mcpManager.listAllTools();
        res.json({ tools, count: tools.length });
    } catch (e) {
        sendErrorResponse(res, 500, 'INTERNAL_SERVER_ERROR', e.message);
    }
});

// GET /api/mcp/servers — list connected MCP servers
app.get('/api/mcp/servers', (req, res) => {
    try {
        const servers = mcpManager.listServers();
        res.json({ servers, count: servers.length });
    } catch (e) {
        sendErrorResponse(res, 500, 'INTERNAL_SERVER_ERROR', e.message);
    }
});

// POST /api/mcp/call — call an MCP tool
app.post('/api/mcp/call', async (req, res) => {
    try {
        const { server, tool, args } = req.body;
        if (!server || !tool) {
            return sendErrorResponse(res, 400, 'BAD_REQUEST', 'server and tool are required');
        }
        const result = await mcpManager.callTool(server, tool, args || {});
        res.json({ success: true, result });
    } catch (e) {
        sendErrorResponse(res, 500, 'INTERNAL_SERVER_ERROR', e.message);
    }
});

// POST /api/mcp/connect — dynamically connect an MCP server
app.post('/api/mcp/connect', async (req, res) => {
    try {
        const { name, command, args, url } = req.body;
        if (!name) {
            return sendErrorResponse(res, 400, 'BAD_REQUEST', 'name is required');
        }
        if (!command && !url) {
            return sendErrorResponse(res, 400, 'BAD_REQUEST', 'command or url is required');
        }
        const result = await mcpManager.addServer({ name, command, args: args || [], url });
        res.json({ success: true, ...result });
    } catch (e) {
        sendErrorResponse(res, 500, 'INTERNAL_SERVER_ERROR', e.message);
    }
});

// POST /api/mcp/disconnect — disconnect an MCP server
app.post('/api/mcp/disconnect', async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) {
            return sendErrorResponse(res, 400, 'BAD_REQUEST', 'name is required');
        }
        await mcpManager.removeServer(name);
        res.json({ success: true });
    } catch (e) {
        sendErrorResponse(res, 500, 'INTERNAL_SERVER_ERROR', e.message);
    }
});

// =============================================================================
// Filesystem Browser API (for folder picker UI)
// =============================================================================

// GET /api/fs/browse?path=<dir>  — list subdirectories at <dir>
// If path is omitted or '/', return Windows drive roots (C:\, D:\, …)
app.get('/api/fs/browse', (req, res) => {
    const reqPath = (req.query.path || '').trim();

    // Windows: list logical drives when at root level
    if (!reqPath || reqPath === '/' || reqPath === '\\') {
        try {
            const { execSync } = require('child_process');
            const raw = execSync('wmic logicaldisk get caption', { encoding: 'utf8', timeout: 3000 });
            const drives = raw.split(/\r?\n/)
                .map(l => l.trim())
                .filter(l => /^[A-Z]:$/.test(l))
                .map(d => ({ name: d + '\\', path: d + '\\', isDir: true }));
            return res.json({ path: '/', entries: drives });
        } catch (_) {
            // Fallback: common drives
            const fallback = ['C:\\', 'D:\\'].map(d => ({ name: d, path: d, isDir: true }));
            return res.json({ path: '/', entries: fallback });
        }
    }

    // List contents of a specific directory
    const absPath = path.resolve(reqPath);
    if (!fs.existsSync(absPath)) {
        return sendErrorResponse(res, 404, 'NOT_FOUND', `Path not found: ${absPath}`);
    }

    try {
        const stat = fs.statSync(absPath);
        if (!stat.isDirectory()) {
            return sendErrorResponse(res, 400, 'BAD_REQUEST', 'Path is not a directory');
        }
        const entries = fs.readdirSync(absPath, { withFileTypes: true })
            .filter(e => e.isDirectory() && !e.name.startsWith('.') && e.name !== '$RECYCLE.BIN' && e.name !== 'System Volume Information')
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(e => {
                const entryPath = path.join(absPath, e.name);
                let hasGit = false;
                let hasPackageJson = false;
                try {
                    hasGit = fs.existsSync(path.join(entryPath, '.git'));
                    hasPackageJson = fs.existsSync(path.join(entryPath, 'package.json'));
                } catch (_) {}
                return {
                    name: e.name,
                    path: entryPath,
                    isDir: true,
                    hasGit,
                    hasPackageJson
                };
            });

        // Compute parent path for "up" navigation
        const parent = path.dirname(absPath);
        const parentPath = parent === absPath ? null : parent; // at drive root, parent === self

        let hasGit = false;
        let hasPackageJson = false;
        try {
            hasGit = fs.existsSync(path.join(absPath, '.git'));
            hasPackageJson = fs.existsSync(path.join(absPath, 'package.json'));
        } catch (_) {}

        res.json({ path: absPath, parentPath, entries, hasGit, hasPackageJson });
    } catch (e) {
        sendErrorResponse(res, 500, 'INTERNAL_SERVER_ERROR', `Cannot read directory: ${e.message}`);
    }
});

// =============================================================================
// Workspace (Target Project) API
// =============================================================================

// GET current workspace path
app.get('/api/workspace', (req, res) => {
    const workspace = getWorkspacePath();
    res.json({ 
        workspace: workspace || null,
        defaultPath: process.cwd()
    });
});

// POST set workspace path
app.post('/api/workspace', (req, res) => {
    const { path: dirPath } = req.body;
    if (!dirPath || typeof dirPath !== 'string') {
        return sendErrorResponse(res, 400, 'BAD_REQUEST', 'path is required and must be a string');
    }
    try {
        setWorkspacePath(dirPath.trim());
        res.json({ ok: true, workspace: dirPath.trim() });
    } catch (err) {
        sendErrorResponse(res, 400, 'BAD_REQUEST', err.message);
    }
});

// DELETE clear workspace path
app.delete('/api/workspace', (req, res) => {
    try {
        setWorkspacePath('');
        res.json({ ok: true, workspace: null });
    } catch (err) {
        sendErrorResponse(res, 400, 'BAD_REQUEST', err.message);
    }
});

// POST validate workspace path
app.post('/api/workspace/validate', (req, res) => {
    const { path: dirPath } = req.body;
    if (!dirPath || typeof dirPath !== 'string') {
        return sendErrorResponse(res, 400, 'BAD_REQUEST', 'path is required and must be a string');
    }
    
    try {
        const absPath = path.resolve(dirPath.trim());
        
        if (!fs.existsSync(absPath)) {
            return res.json({ valid: false, error: 'Path does not exist' });
        }
        
        const stat = fs.statSync(absPath);
        if (!stat.isDirectory()) {
            return res.json({ valid: false, error: 'Path is not a directory' });
        }
        
        const markers = [];
        if (fs.existsSync(path.join(absPath, '.git'))) markers.push('git');
        if (fs.existsSync(path.join(absPath, 'package.json'))) markers.push('package.json');
        if (fs.existsSync(path.join(absPath, 'composer.json'))) markers.push('composer.json');
        if (fs.existsSync(path.join(absPath, 'go.mod'))) markers.push('go.mod');
        if (fs.existsSync(path.join(absPath, 'Cargo.toml')) || fs.existsSync(path.join(absPath, 'cargo.toml'))) markers.push('cargo.toml');
        if (fs.existsSync(path.join(absPath, 'requirements.txt')) || fs.existsSync(path.join(absPath, 'pyproject.toml'))) markers.push('python');
        
        res.json({
            valid: true,
            path: absPath,
            markers
        });
    } catch (err) {
        sendErrorResponse(res, 500, 'INTERNAL_SERVER_ERROR', err.message);
    }
});

// GET list of local system drive letters (mainly for Windows)
app.get('/api/system/drives', (req, res) => {
    const isWindows = process.platform === 'win32';
    if (isWindows) {
        try {
            const { execSync } = require('child_process');
            const raw = execSync('wmic logicaldisk get caption', { encoding: 'utf8', timeout: 3000 });
            const drives = raw.split(/\r?\n/)
                .map(l => l.trim())
                .filter(l => /^[A-Z]:$/.test(l))
                .map(d => d + '\\');
            res.json({ drives });
        } catch (_) {
            // Fallback for Windows
            res.json({ drives: ['C:\\', 'D:\\'] });
        }
    } else {
        // Unix-like systems
        res.json({ drives: ['/'] });
    }
});


// =============================================================================
// Loop Agent API
// =============================================================================

// SSE: real-time task event stream
app.get('/api/loop/stream', (req, res) => {
    res.writeHead(200, {
        'Content-Type':  'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection':    'keep-alive',
        'Access-Control-Allow-Origin': '*',
    });
    res.write('event: connected\ndata: {}\n\n');
    registerSSEClient(res);
});

// GET all tasks
app.get('/api/loop/tasks', (req, res) => {
    res.json({ tasks: loadTasks() });
});

// GET single task
app.get('/api/loop/tasks/:id', (req, res) => {
    const task = getTask(req.params.id);
    if (!task) return sendErrorResponse(res, 404, 'NOT_FOUND', 'Task not found');
    res.json(task);
});

// Helper: Run Git command
async function runGit(args, cwd) {
    return new Promise((resolve, reject) => {
        const { spawn } = require('child_process');
        const child = spawn('git', args, { cwd, shell: false });
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', d => stdout += d.toString());
        child.stderr.on('data', d => stderr += d.toString());
        child.on('close', code => {
            if (code === 0) resolve(stdout);
            else reject(new Error(stderr || `Exit code ${code}`));
        });
    });
}

// Helper: Get task modified file contents (before & after)
async function getTaskFileContents(task) {
    const cwd = getProjectCWD();
    const branchName = task.archive_result?.branch || task.plan?.branch_name;
    
    const files = [];
    if (task.plan && Array.isArray(task.plan.steps)) {
        for (const step of task.plan.steps) {
            const stepFiles = Array.isArray(step.file) ? step.file : [step.file];
            for (const f of stepFiles) {
                if (f && typeof f === 'string') {
                    files.push(f);
                }
            }
        }
    }
    if (task.suggestion && Array.isArray(task.suggestion.files)) {
        for (const f of task.suggestion.files) {
            if (f && typeof f === 'string') {
                files.push(f);
            }
        }
    }
    if (task.coding_log && Array.isArray(task.coding_log)) {
        for (const log of task.coding_log) {
            if (log.file && typeof log.file === 'string') {
                files.push(log.file);
            }
        }
    }
    
    const uniqueFiles = [...new Set(files)];
    const results = [];
    
    for (const file of uniqueFiles) {
        let oldContent = '';
        let newContent = '';
        const fullPath = path.resolve(cwd, file);
        let relativeFile = file;
        if (path.isAbsolute(file)) {
            relativeFile = path.relative(cwd, file);
        }
        const gitPath = relativeFile.replace(/\\/g, '/');
        
        try {
            if (task.status === 'done' && branchName) {
                // Task is done. Compare master with the branch.
                oldContent = await runGit(['show', `master:${gitPath}`], cwd)
                    .catch(() => runGit(['show', `main:${gitPath}`], cwd))
                    .catch(() => runGit(['show', `${branchName}~1:${gitPath}`], cwd))
                    .catch(() => '');
                newContent = await runGit(['show', `${branchName}:${gitPath}`], cwd).catch(() => '');
            } else {
                // Task is in progress or failed. Compare HEAD with workspace/proposed changes.
                oldContent = await runGit(['show', `HEAD:${gitPath}`], cwd).catch(() => '');
                if (task.proposed_changes && task.proposed_changes[gitPath] !== undefined) {
                    newContent = task.proposed_changes[gitPath];
                } else if (fs.existsSync(fullPath)) {
                    newContent = fs.readFileSync(fullPath, 'utf8');
                }
            }
            
            if (oldContent !== newContent) {
                results.push({
                    file: gitPath,
                    oldContent,
                    newContent
                });
            }
        } catch (e) {
            console.error(`Error reading diff contents for file ${file}:`, e.message);
        }
    }
    return results;
}

// GET task diff contents
app.get('/api/loop/tasks/:id/diff', async (req, res) => {
    try {
        const task = getTask(req.params.id);
        if (!task) return sendErrorResponse(res, 404, 'NOT_FOUND', 'Task not found');
        
        const diffs = await getTaskFileContents(task);
        res.json({ diffs });
    } catch (err) {
        errorLog(`[API /loop/tasks/:id/diff] Error:`, err.message);
        sendErrorResponse(res, 500, 'INTERNAL_SERVER_ERROR', `Failed to retrieve task diffs: ${err.message}`);
    }
});

// POST start auto loop
app.post('/api/loop/start', (req, res) => {
    if (dispatcher.isRunning()) {
        return res.json({ ok: false, message: 'Loop already running' });
    }
    dispatcher.startLoop();
    res.json({ ok: true, message: 'Loop started' });
});

// POST stop auto loop
app.post('/api/loop/stop', (req, res) => {
    dispatcher.stopLoop();
    res.json({ ok: true, message: 'Loop stopped' });
});

// POST trigger one suggestion immediately
app.post('/api/loop/trigger', (req, res) => {
    res.json({ ok: true, message: 'Suggestion pipeline triggered' });
    dispatcher.triggerOnce().catch(err =>
        errorLog('[Loop] triggerOnce error:', err)
    );
});

// POST approve task (user clicks "▶ Start Coding")
app.post(['/api/loop/tasks/:id/approve', '/api/task/:id/approve'], (req, res) => {
    try {
        dispatcher.approveTask(req.params.id);
        res.json({ ok: true });
    } catch (err) {
        sendErrorResponse(res, 400, 'BAD_REQUEST', err.message);
    }
});

// POST approve patch (user confirms code generation changes)
app.post(['/api/loop/tasks/:id/approve_patch', '/api/task/:id/approve_patch'], (req, res) => {
    try {
        dispatcher.approvePatch(req.params.id);
        res.json({ ok: true, message: 'Patch approved and written to disk' });
    } catch (err) {
        sendErrorResponse(res, 400, 'BAD_REQUEST', err.message);
    }
});

// POST reject task manually
app.post(['/api/loop/tasks/:id/reject', '/api/task/:id/reject'], (req, res) => {
    try {
        dispatcher.rejectTask(req.params.id);
        res.json({ ok: true });
    } catch (err) {
        sendErrorResponse(res, 400, 'BAD_REQUEST', err.message);
    }
});

// POST retry a failed task
app.post(['/api/loop/tasks/:id/retry', '/api/task/:id/retry'], async (req, res) => {
    try {
        const { resetCoding } = req.body || {};
        if (resetCoding) {
            const task = getTask(req.params.id);
            if (task) {
                updateTask(req.params.id, {
                    failed_step_index: 0,
                    failed_step: 'coding',
                    coding_log: [],
                    error: null
                });
            }
        }
        await dispatcher.retryTask(req.params.id);
        res.json({ ok: true, message: 'Task retry initiated' });
    } catch (err) {
        sendErrorResponse(res, 400, 'BAD_REQUEST', err.message);
    }
});

// POST stop a running task
app.post(['/api/loop/tasks/:id/stop', '/api/task/:id/stop'], (req, res) => {
    try {
        dispatcher.cancelTask(req.params.id);
        res.json({ ok: true, message: 'Task cancelled' });
    } catch (err) {
        sendErrorResponse(res, 400, 'BAD_REQUEST', err.message);
    }
});

// GET single task alias
app.get('/api/task/:id', (req, res) => {
    const task = getTask(req.params.id);
    if (!task) return sendErrorResponse(res, 404, 'NOT_FOUND', 'Task not found');
    res.json(task);
});

// GET task diff alias
app.get('/api/task/:id/diff', async (req, res) => {
    try {
        const task = getTask(req.params.id);
        if (!task) return sendErrorResponse(res, 404, 'NOT_FOUND', 'Task not found');
        const diffs = await getTaskFileContents(task);
        res.json({ diffs });
    } catch (err) {
        errorLog(`[API /task/:id/diff] Error:`, err.message);
        sendErrorResponse(res, 500, 'INTERNAL_SERVER_ERROR', `Failed to retrieve task diffs: ${err.message}`);
    }
});

// GET system status
app.get('/api/system/status', (req, res) => {
    try {
        const tasks = loadTasks();
        res.json({
            workspace: getWorkspacePath() || null,
            engine: {
                currentEngine: engineConfig.getCurrentEngine(),
                currentModel: engineConfig.getActiveModel(),
                settings: engineConfig.loadSettings()
            },
            loop: {
                running: dispatcher.isRunning(),
                tasksCount: tasks.length,
                pendingTasksCount: tasks.filter(t => t.status === 'pending').length,
                failedTasksCount: tasks.filter(t => t.status === 'failed').length,
                activeTasksCount: tasks.filter(t => ['generating', 'planning', 'refining_plan', 'plan_ready', 'coding', 'testing', 'fixing', 'archiving', 'summarizing'].includes(t.status)).length
            },
            rpm: requestTimestamps.length,
            recentErrors,
            status: 'healthy'
        });
    } catch (err) {
        errorLog(`[API /system/status] Error:`, err.message);
        sendErrorResponse(res, 500, 'INTERNAL_SERVER_ERROR', `Failed to retrieve system status: ${err.message}`);
    }
});

// PUT /api/engine/config - hot-reload engine configuration
app.put('/api/engine/config', (req, res) => {
    try {
        const { engine, model, settings } = req.body;
        const effectiveSettings = settings ? {
            ...settings,
            ai: { ...(settings.ai || {}) }
        } : null;
        
        if (model && effectiveSettings.ai) {
            effectiveSettings.ai.model = model;
        }
        
        if (engine && effectiveSettings.ai) {
            if (engine === 'gemini-cli') {
                effectiveSettings.ai.executionMode = 'Local CLI Driver';
                effectiveSettings.ai.provider = 'gemini-cli';
            } else if (engine === 'openrouter') {
                effectiveSettings.ai.executionMode = 'HTTP API';
                if (effectiveSettings.ai.provider === 'gemini-cli') {
                    effectiveSettings.ai.provider = 'OpenRouter';
                }
            }
        }
        
        // 1. Switch engine if provided
        if (engine) {
            if (!engineConfig.VALID_ENGINES.includes(engine)) {
                return sendErrorResponse(res, 400, 'BAD_REQUEST', `Invalid engine. Must be one of: ${engineConfig.VALID_ENGINES.join(', ')}`);
            }
            engineConfig.saveEngineConfig(engine);
        }
        
        // 2. Save settings if provided. Keep the explicit model in sync so older
        // settings payloads cannot overwrite a fresh model selection.
        if (effectiveSettings) {
            engineConfig.saveSettings(effectiveSettings);
        }
        
        // 3. Switch model after settings save so root config stays authoritative.
        if (model) {
            engineConfig.saveActiveModel(model);
        }
        
        // 4. Hot reload drivers: clear caches & re-initialize
        try {
            const openrouter = require('./agents/drivers/openrouter');
            if (openrouter && typeof openrouter.clearCache === 'function') {
                openrouter.clearCache();
            }
        } catch (_) {}
        
        res.json({
            ok: true,
            currentEngine: engineConfig.getCurrentEngine(),
            currentModel: engineConfig.getActiveModel(),
            settings: engineConfig.loadSettings()
        });
    } catch (err) {
        errorLog(`[API PUT /api/engine/config] Error:`, err.message);
        sendErrorResponse(res, 500, 'INTERNAL_SERVER_ERROR', `Failed to update engine config: ${err.message}`);
    }
});

// DELETE single task (soft delete)
app.delete(['/api/loop/tasks/:id', '/api/task/:id'], (req, res) => {
    try {
        const taskId = req.params.id;
        const task = getTask(taskId);
        if (!task) {
            return sendErrorResponse(res, 404, 'NOT_FOUND', 'Task not found');
        }
        
        updateTask(taskId, {
            deleted: true,
            deleted_at: new Date().toISOString()
        });
        
        res.json({ success: true, message: 'Task soft-deleted successfully', taskId });
    } catch (err) {
        sendErrorResponse(res, 500, 'INTERNAL_SERVER_ERROR', `Failed to delete task: ${err.message}`);
    }
});

// POST restore soft-deleted task
app.post(['/api/loop/tasks/:id/restore', '/api/task/:id/restore'], (req, res) => {
    try {
        const taskId = req.params.id;
        const task = loadTasks(true).find(t => t.id === taskId);
        if (!task) {
            return sendErrorResponse(res, 404, 'NOT_FOUND', 'Task not found');
        }
        
        updateTask(taskId, {
            deleted: false
        });
        
        res.json({ success: true, message: 'Task restored successfully', taskId });
    } catch (err) {
        sendErrorResponse(res, 500, 'INTERNAL_SERVER_ERROR', `Failed to restore task: ${err.message}`);
    }
});

// GET loop status
app.get('/api/loop/status', (req, res) => {
    res.json({ running: dispatcher.isRunning(), tasks: loadTasks().length });
});

// Serve static frontend assets from client/dist if the directory exists
const clientDistPath = path.join(__dirname, 'client', 'dist');
if (fs.existsSync(clientDistPath)) {
    app.use(express.static(clientDistPath));
    // Wildcard route to redirect to index.html for client-side routing fallback
    app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api')) {
            return next();
        }
        res.sendFile(path.join(clientDistPath, 'index.html'));
    });
}

// Dynamic Port Scan & Startup
function startServer(startPort) {
    const server = net.createServer();
    server.once('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            serverLog(`Port ${startPort} in use, scanning port ${startPort + 1}...`);
            startServer(startPort + 1);
        }
    });
    server.once('listening', () => {
        server.close(() => {
            // Start Express listening on loopback interface
            app.listen(startPort, '127.0.0.1', () => {
                serverLog(`=============================================================`);
                serverLog(`   Full-Self-Developing is running!                          `);
                serverLog(`   Local Server: http://127.0.0.1:${startPort}/  `);
                serverLog(`=============================================================`);
                
                // Write active port and token to temp file for Launcher access
                const confPath = path.join(__dirname, '.boot-conf.json');
                fs.writeFileSync(confPath, JSON.stringify({ port: startPort, token: APP_TOKEN }));

                // Initialize MCP connections
                mcpManager.initialize(engineConfig.getMcpServers()).catch(e => {
                    errorLog('[Server] MCP init error:', e.message);
                });
            });
        });
    });
    server.listen(startPort, '127.0.0.1');
}

startServer(8033); // Touch to trigger restart for new MCP settings
