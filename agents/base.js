/**
 * base.js — Shared utilities for all loop agents
 */
'use strict';

const fs   = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { serverLog, errorLog } = require('../logger');
const { getDriver }        = require('./drivers');
const { getCurrentEngine, getWorkspacePath } = require('./engine-config');

/**
 * FSD_ROOT — The directory where the FSD system itself lives.
 * Used for internal log/queue paths only.
 */
const FSD_ROOT = path.resolve(__dirname, '..');

/**
 * getProjectCWD() — Returns the absolute path of the TARGET project.
 * Priority:
 *  1. Workspace path saved in engine-config.json (set via UI "Open Project")
 *  2. Falls back to FSD_ROOT itself (original behaviour, useful during dev)
 */
function getProjectCWD() {
    return getWorkspacePath() || FSD_ROOT;
}

/**
 * CWD — legacy export kept for backward compat.
 * Always call getProjectCWD() in hot paths so workspace changes are picked up
 * without restarting the server.
 * @deprecated use getProjectCWD() for anything that depends on the workspace
 */
const CWD = FSD_ROOT;

const QUEUE_FILE     = path.join(FSD_ROOT, 'queue', 'tasks.json');
const LOOP_LOGS_DIR  = path.join(FSD_ROOT, 'logs', 'loop');

// ── SSE Broadcast ────────────────────────────────────────────────────────────
const sseClients = new Set();

function registerSSEClient(res) {
    sseClients.add(res);
    res.on('close', () => sseClients.delete(res));
}

function broadcast(event, data) {
    const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of sseClients) {
        try { client.write(msg); } catch (_) { sseClients.delete(client); }
    }
}

function enrichTask(task) {
    if (!task) return null;
    
    // 1. Error reason at top level
    const error_reason = task.error || null;
    
    // 2. Progress status at top level
    const progress_status = task.status || 'pending';
    
    // 3. Expose affected files
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
    const affected_files = [...new Set(files)].map(f => f.replace(/\\/g, '/'));

    return {
        ...task,
        error_reason,
        progress_status,
        affected_files
    };
}

// ── Task Store ───────────────────────────────────────────────────────────────
function loadTasks(includeDeleted = false) {
    try {
        if (fs.existsSync(QUEUE_FILE)) {
            const tasks = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
            if (includeDeleted) return tasks.map(enrichTask);
            return tasks.filter(t => !t.deleted).map(enrichTask);
        }
    } catch (_) {}
    return [];
}

function saveTasks(tasks) {
    fs.mkdirSync(path.dirname(QUEUE_FILE), { recursive: true });
    fs.writeFileSync(QUEUE_FILE, JSON.stringify(tasks, null, 2));
}

function createTask(type = 'loop') {
    const task = {
        id:          uuidv4(),
        type,
        status:      'pending',
        suggestion:  null,
        review:      null,
        plan:        null,
        review_log:  [],
        coding_log:  [],
        test_results: null,
        summary:     null,
        created_at:  new Date().toISOString(),
        updated_at:  new Date().toISOString(),
    };
    const tasks = loadTasks(true);
    tasks.unshift(task);
    saveTasks(tasks);
    const enriched = enrichTask(task);
    broadcast('task_created', enriched);
    return enriched;
}

function updateTask(id, patch) {
    const tasks = loadTasks(true);
    const idx   = tasks.findIndex(t => t.id === id);
    if (idx === -1) return null;
    
    const updatedTask = { ...tasks[idx], ...patch, updated_at: new Date().toISOString() };
    if (patch.deleted === false) {
        delete updatedTask.deleted;
        delete updatedTask.deleted_at;
    }
    
    tasks[idx] = enrichTask(updatedTask);
    saveTasks(tasks);
    broadcast('task_updated', tasks[idx]);

    // Persist task snapshot to project-local logs/loop/<task-id>/task.json
    try {
        const taskLogDir = path.join(LOOP_LOGS_DIR, id);
        fs.mkdirSync(taskLogDir, { recursive: true });
        fs.writeFileSync(
            path.join(taskLogDir, 'task.json'),
            JSON.stringify(tasks[idx], null, 2)
        );
    } catch (e) {
        // Non-fatal: don't crash the agent pipeline on log write failure
        console.error('[base] Failed to write task snapshot:', e.message);
    }

    return tasks[idx];
}

function getTask(id) {
    return loadTasks().find(t => t.id === id) || null;
}

/**
 * appendStepLog(taskId, stepData)
 * Appends a single step event line to logs/loop/<taskId>/steps.jsonl.
 * Call this from dispatcher after each agent phase completes.
 */
function appendStepLog(taskId, stepData) {
    try {
        const logDir  = path.join(LOOP_LOGS_DIR, taskId);
        fs.mkdirSync(logDir, { recursive: true });
        const logFile = path.join(logDir, 'steps.jsonl');
        const entry   = { ...stepData, recorded_at: new Date().toISOString() };
        fs.appendFileSync(logFile, JSON.stringify(entry) + '\n');
    } catch (e) {
        console.error('[base] Failed to append step log:', e.message);
    }
}

const DEFAULT_MODEL = 'deepseek/deepseek-chat:free';

// ── AI Model Runner ──────────────────────────────────────────────────────────

/**
 * runModel(prompt, model, options)
 * Unified AI model runner — routes to the appropriate driver via the registry.
 *
 * @param {string} prompt     - prompt text
 * @param {string} [model]    - model name (ignored by some drivers)
 * @param {object} [options]  - { engine, cwd, timeout }
 * @returns {Promise<string>}
 */
async function runModel(prompt, model = DEFAULT_MODEL, options = {}) {
    const engine = options.engine;
    const driver = getDriver(engine);
    const driverOptions = { ...options, model };
    serverLog(`[runModel] engine=${driver.name} model=${model || 'default'}`);
    return driver.run(prompt, driverOptions);
}

function getDefaultModelForEngine(engine) {
    if (engine === 'gemini-cli') return 'gemini-2.5-flash';
    if (engine === 'atomcode') return null;
    return 'deepseek/deepseek-chat:free';
}

/**
 * runGemini(prompt, model)
 * Universal agent model runner — uses the currently configured engine.
 * Reads engine selection from engine-config.json (set via UI toggle).
 * Delegates to runModel with the active engine.
 */
async function runGemini(prompt, model = null) {
    const engine = getCurrentEngine();
    const activeModel = require('./engine-config').getActiveModel();
    let resolvedModel = activeModel || model || getDefaultModelForEngine(engine);

    if (engine === 'atomcode') {
        // atomcode 引擎有自己的模型列表（来自 ~/.atomcode/config.toml）。
        // Agent 硬编码的 OpenRouter 模型名（gemini-2.5-flash, gemini-2.5-pro）
        // 对 atomcode 无意义。只透传 atomcode 已知的模型名，其余让 CLI 用默认。
        if (!resolvedModel) {
            resolvedModel = null;
        } else {
            // 检查是否属于 atomcode 已知模型
            const { getAtomCodeModels } = require('./engine-config');
            const known = getAtomCodeModels();
            if (!known.some(m => m.id === resolvedModel)) {
                resolvedModel = null; // 不是 atomcode 模型名 → 用 CLI 默认
            }
        }
    }
    return runModel(prompt, resolvedModel, { engine, cwd: getProjectCWD() });
}
function extractJSON(text) {
    // 1. Try ```json ... ``` code blocks
    const block = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (block) {
        try { return JSON.parse(block[1].trim()); } catch (_) {}
    }
    // 2. Try first {...} or [...] span
    const obj = text.match(/\{[\s\S]*\}/);
    if (obj) {
        try { return JSON.parse(obj[0]); } catch (_) {}
    }
    const arr = text.match(/\[[\s\S]*\]/);
    if (arr) {
        try { return JSON.parse(arr[0]); } catch (_) {}
    }
    errorLog('[extractJSON] Failed to parse JSON from agent output. Raw text:', text);
    throw new Error(`No valid JSON found in agent output. Raw output snippet: ${text.slice(0, 300)}`);
}

module.exports = {
    CWD,
    getProjectCWD,
    runGemini,
    runModel,
    extractJSON,
    loadTasks,
    saveTasks,
    createTask,
    updateTask,
    getTask,
    appendStepLog,
    registerSSEClient,
    broadcast,
};
