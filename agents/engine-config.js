/**
 * engine-config.js — Engine configuration persistence
/**
 * engine-config.js — Engine configuration persistence
 *
 * Manages the current AI engine selection (openrouter | atomcode).
 * Persisted to disk so Agent Loop pipeline can read it without cross-process IPC.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync, exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
const { serverLog, errorLog } = require('../logger');

const CONFIG_DIR = path.join(__dirname, '..', '.engine');
const CONFIG_FILE = path.join(CONFIG_DIR, 'engine-config.json');
const DEFAULTS_FILE = path.join(CONFIG_DIR, 'default-settings.json');

const VALID_ENGINES = ['openrouter', 'gemini-cli'];
const DEFAULT_ENGINE = 'openrouter';

/**
 * Load default settings from JSON file.
 */
function loadDefaultSettings() {
    try {
        if (fs.existsSync(DEFAULTS_FILE)) {
            return JSON.parse(fs.readFileSync(DEFAULTS_FILE, 'utf8'));
        }
    } catch (e) {
        errorLog('[EngineConfig] Failed to load defaults from file:', e.message);
    }
    // Fallback if file missing or corrupt
    return {
        ai: { executionMode: 'HTTP API', provider: 'OpenRouter', model: 'Claude 3.5 Sonnet' },
        ui: { theme: 'Light', language: 'English' },
        fsd: { reviewRounds: 1, concurrency: 1, manualConfirm: true, requireApproval: true }
    };
}

/** Absolute path to the config file that also stores the active workspace */
const WORKSPACE_KEY = 'workspace';

/**
 * Load the current engine configuration from disk.
 * @returns {{ engine: string }}
 */
function loadEngineConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
            const cfg = JSON.parse(raw);
            if (VALID_ENGINES.includes(cfg.engine)) {
                return cfg;
            }
        }
    } catch (e) {
        errorLog('[EngineConfig] Failed to load config, using default:', e.message);
    }
    return { engine: DEFAULT_ENGINE };
}

/**
 * List all valid engine names.
 * @returns {string[]}
 */
function listValidEngines() {
    return VALID_ENGINES.slice();
}

/**
 * Save engine configuration to disk.
 * @param {string} engine - 'openrouter' | 'atomcode' | 'gemini-cli'
 */
function saveEngineConfig(engine) {
    try {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
        const existing = loadEngineConfig();
        existing.engine = engine;
        existing.updated_at = new Date().toISOString();
        
        if (!existing.settings) existing.settings = {};
        if (!existing.settings.ai) existing.settings.ai = {};
        if (engine === 'gemini-cli') {
            existing.settings.ai.executionMode = 'Local CLI Driver';
            existing.settings.ai.provider = 'gemini-cli';
        } else {
            existing.settings.ai.executionMode = 'HTTP API';
            if (existing.settings.ai.provider === 'gemini-cli') {
                existing.settings.ai.provider = 'OpenRouter';
            }
        }
        
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(existing, null, 2));
        serverLog(`[EngineConfig] Engine switched to: ${engine}`);
    } catch (e) {
        errorLog('[EngineConfig] Failed to save config:', e.message);
    }
}

/**
 * Get the currently configured workspace (target project) path.
 * Returns null if no workspace has been set.
 * @returns {string|null}
 */
function getWorkspacePath() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
            const cfg = JSON.parse(raw);
            if (cfg.workspace && fs.existsSync(cfg.workspace)) {
                return cfg.workspace;
            }
        }
    } catch (e) {
        errorLog('[EngineConfig] Failed to read workspace path:', e.message);
    }
    return null;
}

/**
 * Persist a workspace (target project) path to the config file.
 * @param {string} dirPath - Absolute path to the target project root
 */
function setWorkspacePath(dirPath) {
    try {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
        const existing = loadEngineConfig();
        // Empty path = clear workspace
        if (!dirPath || !dirPath.trim()) {
            delete existing.workspace;
            delete existing.workspace_updated_at;
            fs.writeFileSync(CONFIG_FILE, JSON.stringify(existing, null, 2));
            serverLog('[EngineConfig] Workspace cleared');
            return;
        }
        if (!fs.existsSync(dirPath)) {
            throw new Error(`Directory not found: ${dirPath}`);
        }
        fs.writeFileSync(CONFIG_FILE, JSON.stringify({
            ...existing,
            workspace: dirPath,
            workspace_updated_at: new Date().toISOString()
        }, null, 2));
        serverLog(`[EngineConfig] Workspace set to: ${dirPath}`);
    } catch (e) {
        errorLog('[EngineConfig] Failed to save workspace path:', e.message);
        throw e;
    }
}

/**
 * Get the current engine name.
 * @returns {string} 'openrouter' | 'atomcode'
 */
function getCurrentEngine() {
    return loadEngineConfig().engine;
}

/**
 * Save active model selection to config.
 * @param {string} model
 */
function saveActiveModel(model) {
    try {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
        const existing = loadEngineConfig();
        existing.model = model;
        existing.updated_at = new Date().toISOString();
        
        if (!existing.settings) existing.settings = {};
        if (!existing.settings.ai) existing.settings.ai = {};
        existing.settings.ai.model = model;
        
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(existing, null, 2));
        serverLog(`[EngineConfig] Model switched to: ${model}`);
    } catch (e) {
        errorLog('[EngineConfig] Failed to save model config:', e.message);
    }
}

/**
 * Get active model selection from config.
 * @returns {string|null}
 */
function getActiveModel() {
    return loadEngineConfig().model || null;
}



/**
 * Check if Gemini CLI is available in PATH.
 * @returns {boolean}
 */
function checkGeminiCliAvailable() {
    const { spawnSync } = require('child_process');
    try {
        const result = spawnSync('gemini', ['--version'], {
            timeout: 5000,
            stdio: ['ignore', 'pipe', 'pipe'],
            windowsHide: true,
            shell: true,  // Required on Windows for .cmd/.bat npm-global scripts
        });
        return result.status === 0;
    } catch (e) {
        return false;
    }
}

// ── Gemini CLI Skills & MCP Discovery ────────────────────────────────────────

/**
 * Parse `gemini skills list` stdout into structured skill objects.
 * @returns {{ name:string, status:string, description:string }[]}
 */
function getGeminiSkills() {
    try {
        const result = spawnSync('gemini', ['skills', 'list'], {
            timeout: 10000,
            stdio: ['ignore', 'pipe', 'pipe'],
            windowsHide: true,
            encoding: 'utf8',
        });
        if (result.status !== 0 || !result.stdout) return [];
        const lines = result.stdout.split('\n');
        const skills = [];
        let current = null;
        for (const raw of lines) {
            const line = raw.trimEnd();
            // Skill header: "<name> [Status]" at indent 0
            const headerMatch = line.match(/^([\w-]+)\s+\[(\w+)\]/);
            if (headerMatch) {
                if (current) skills.push(current);
                current = { name: headerMatch[1], status: headerMatch[2], description: '' };
                continue;
            }
            // Description sub-line
            const descMatch = line.match(/^\s+Description:\s*(.+)/);
            if (descMatch && current) {
                current.description = descMatch[1].trim();
            }
        }
        if (current) skills.push(current);
        return skills;
    } catch (e) {
        errorLog('[EngineConfig] getGeminiSkills error:', e.message);
        return [];
    }
}


/**
 * Parse `gemini skills list` stdout asynchronously.
 * @returns {Promise<{ name:string, status:string, description:string }[]>}
 */
async function getGeminiSkillsAsync() {
    try {
        const { stdout } = await execAsync('gemini skills list', { timeout: 10000, windowsHide: true });
        if (!stdout) return [];
        const lines = stdout.split('\n');
        const skills = [];
        let current = null;
        for (const raw of lines) {
            const line = raw.trimEnd();
            const headerMatch = line.match(/^([\w-]+)\s+\[(\w+)\]/);
            if (headerMatch) {
                if (current) skills.push(current);
                current = { name: headerMatch[1], status: headerMatch[2], description: '' };
                continue;
            }
            const descMatch = line.match(/^\s+Description:\s*(.+)/);
            if (descMatch && current) {
                current.description = descMatch[1].trim();
            }
        }
        if (current) skills.push(current);
        return skills;
    } catch (e) {
        errorLog('[EngineConfig] getGeminiSkillsAsync error:', e.message);
        return [];
    }
}





// ── OpenRouter Gemini CLI fallback models ─────────────────────────────────────

/** Static Gemini models used when engine is gemini-cli */
const GEMINI_CLI_MODELS = [
    { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro Preview', context: 2000000 },
    { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash Preview', context: 1048576 },
    { id: 'gemini-3.1-flash-lite' + '-preview', name: 'Gemini 3.1 Flash-Lite Preview', context: 1048576 },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', context: 2000000 },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', context: 1000000 },
    { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash-Lite', context: 1000000 },
    { id: 'gemma-4-31b-it', name: 'Gemma 4 31B IT', context: 32768 },
    { id: 'gemma-4-26b-a4b-it', name: 'Gemma 4 26B A4B IT', context: 32768 },
];

function getGeminiCliModels() {
    return GEMINI_CLI_MODELS;
}

// ── MCP Server Configuration ──────────────────────────────────────────────────

/**
 * Read MCP server configs from .engine/engine-config.json (mcpServers array).
 * Each entry may have:
 *   name, command?, args?, url?, env?
 *
 * @returns {object[]}
 */
function getMcpServers() {
    try {
        const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
        const cfg = JSON.parse(raw);
        const servers = cfg.mcpServers;
        if (!Array.isArray(servers) || servers.length === 0) return [];
        return servers.filter(s => s && s.name);
    } catch (e) {
        // File missing or parse error: no MCP servers configured
        return [];
    }
}

/**
 * Save MCP server configs to .engine/engine-config.json.
 * @param {object[]} servers
 */
function saveMcpServers(servers) {
    try {
        const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
        const cfg = JSON.parse(raw);
        cfg.mcpServers = Array.isArray(servers) ? servers : [];
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');
        serverLog(`[EngineConfig] Saved ${cfg.mcpServers.length} MCP server(s)`);
    } catch (e) {
        errorLog('[EngineConfig] saveMcpServers error:', e.message);
        throw e;
    }
}

function loadSettings() {
    try {
        const config = loadEngineConfig();
        const settings = config.settings || {};
        const defaults = loadDefaultSettings();
        
        // Deep merge with defaults to ensure new fields are present
        const merged = {
            ...defaults,
            ...settings,
            ai: { ...defaults.ai, ...(settings.ai || {}) },
            ui: { ...defaults.ui, ...(settings.ui || {}) },
            fsd: { ...defaults.fsd, ...(settings.fsd || {}) },
            memory: { ...defaults.memory, ...(settings.memory || {}) },
            safety: { ...defaults.safety, ...(settings.safety || {}) },
            advanced: { ...defaults.advanced, ...(settings.advanced || {}) }
        };
        
        // Ensure model in settings matches the active model in root config
        if (config.model) {
            merged.ai.model = config.model;
        } else if (merged.ai.model) {
            config.model = merged.ai.model;
        }
        
        // Ensure engine matches setting executionMode / provider
        if (config.engine === 'gemini-cli') {
            merged.ai.executionMode = 'Local CLI Driver';
            merged.ai.provider = 'gemini-cli';
        } else if (config.engine === 'openrouter') {
            merged.ai.executionMode = 'HTTP API';
            if (merged.ai.provider === 'gemini-cli') {
                merged.ai.provider = 'OpenRouter';
            }
        }
        
        return merged;
    } catch (e) {
        errorLog('[EngineConfig] Failed to load settings, using defaults:', e.message);
        return loadDefaultSettings();
    }
}

function saveSettings(newSettings) {
    try {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
        const config = loadEngineConfig();
        
        config.settings = newSettings;
        config.updated_at = new Date().toISOString();
        
        // Synchronize settings model and execution mode to root config
        if (newSettings.ai) {
            if (newSettings.ai.model) {
                config.model = newSettings.ai.model;
            }
            if (newSettings.ai.executionMode === 'Local CLI Driver') {
                config.engine = 'gemini-cli';
            } else if (newSettings.ai.executionMode === 'HTTP API') {
                config.engine = 'openrouter';
            }
        }
        
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
        serverLog(`[EngineConfig] Saved settings to backend config`);
    } catch (e) {
        errorLog('[EngineConfig] Failed to save settings:', e.message);
        throw e;
    }
}

module.exports = {
    loadEngineConfig,
    saveEngineConfig,
    getCurrentEngine,
    getWorkspacePath,
    setWorkspacePath,
    checkGeminiCliAvailable,
    listValidEngines,
    DEFAULT_ENGINE,
    VALID_ENGINES,
    // Dynamic discovery
    getGeminiSkills,
    getGeminiSkillsAsync,
    getGeminiCliModels,
    saveActiveModel,
    getActiveModel,
    getMcpServers,
    saveMcpServers,
    loadSettings,
    saveSettings,
};
