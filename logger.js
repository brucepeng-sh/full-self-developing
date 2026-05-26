'use strict';
/**
 * logger.js — File-based logger with daily rotation
 *
 * Writes to:
 *   logs/server/server-YYYY-MM-DD.log  — all server runtime info
 *   logs/server/error-YYYY-MM-DD.log   — errors only
 *
 * Also mirrors output to stdout / stderr so existing console behaviour is preserved.
 */

const fs   = require('fs');
const os   = require('os');
const path = require('path');

const isGlobal = process.env.FSD_GLOBAL === 'true' || __dirname.includes('node_modules');
const LOGS_DIR = isGlobal
    ? path.join(os.homedir(), '.fsd', 'logs', 'server')
    : path.join(__dirname, 'logs', 'server');

// ── Helpers ──────────────────────────────────────────────────────────────────

function getDateStr() {
    return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function openStream(prefix, dateStr) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
    const file = path.join(LOGS_DIR, `${prefix}-${dateStr}.log`);
    return fs.createWriteStream(file, { flags: 'a', encoding: 'utf8' });
}

// ── Internal state ────────────────────────────────────────────────────────────

let _currentDate   = getDateStr();
let _serverStream  = openStream('server', _currentDate);
let _errorStream   = openStream('error',  _currentDate);

function checkRotate() {
    const today = getDateStr();
    if (today !== _currentDate) {
        _currentDate  = today;
        _serverStream = openStream('server', today);
        _errorStream  = openStream('error',  today);
    }
}

function formatLine(level, args) {
    const ts  = new Date().toISOString();
    const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
    return `[${ts}] [${level}] ${msg}\n`;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * serverLog(...args) — info-level, mirrors to stdout + server log file
 */
function serverLog(...args) {
    checkRotate();
    const line = formatLine('INFO', args);
    process.stdout.write(line);
    _serverStream.write(line);
}

/**
 * warnLog(...args) — warn-level, mirrors to stdout + server log file
 */
function warnLog(...args) {
    checkRotate();
    const line = formatLine('WARN', args);
    process.stdout.write(line);
    _serverStream.write(line);
}

/**
 * errorLog(...args) — error-level, mirrors to stderr + both log files
 */
function errorLog(...args) {
    checkRotate();
    const line = formatLine('ERROR', args);
    process.stderr.write(line);
    _serverStream.write(line);
    _errorStream.write(line);
}

module.exports = { serverLog, warnLog, errorLog };
