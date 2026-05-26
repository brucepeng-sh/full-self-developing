/**
 * driver-registry.js — Central registry for AI engine drivers
 *
 * Maps engine names to driver modules that implement the unified interface:
 *   driver.run(prompt, options)     → Promise<string>
 *   driver.stream({ prompt, history, res }) → Promise<string>
 *
 * Add new engines here by registering their driver module.
 */
'use strict';

const { errorLog } = require('../../logger');

// ── Registry ─────────────────────────────────────────────────────────────────

const engines = {
    openrouter:  require('./openrouter'),
    atomcode:    require('./atomcode'),
    'gemini-cli': require('./gemini-cli'),
};

const ENGINE_NAMES = Object.keys(engines);

// ── Lookup ───────────────────────────────────────────────────────────────────

/**
 * Get the driver for the given engine name.
 * Falls back to openrouter if the engine is unknown.
 *
 * @param {string} engine - 'openrouter' | 'atomcode'
 * @returns {object} driver module
 */
function getDriver(engine) {
    if (engines[engine]) {
        return engines[engine];
    }
    errorLog(`[DriverRegistry] Unknown engine "${engine}", falling back to openrouter`);
    return engines.openrouter;
}

/**
 * List all registered engine names.
 * @returns {string[]}
 */
function listDrivers() {
    return ENGINE_NAMES.slice();
}

/**
 * Check if an engine name is registered.
 * @param {string} engine
 * @returns {boolean}
 */
function isValidEngine(engine) {
    return !!engines[engine];
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
    getDriver,
    listDrivers,
    isValidEngine,
    ENGINE_NAMES,
};
