/**
 * coder.js — Agent 5: Programming Agent
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { runGemini, getProjectCWD } = require('./base');
const promptManager = require('./prompt-manager');
const { enforceBoundary } = require('./path-validator');

/** Detect the fenced code block language tag from a file extension */
function langTag(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const map = { '.php': 'php', '.js': 'javascript', '.ts': 'typescript', '.json': 'json', '.css': 'css', '.html': 'html', '.md': 'markdown' };
    return map[ext] || '';
}

/** Return true if text looks like source code (not AI prose) */
function looksLikeCode(text, filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const trimmed = text.trim();
    if (ext === '.php') {
        // Accept <?php or <? (short tags), case-insensitive, possibly with leading whitespace
        if (!/^<\?/i.test(trimmed)) return false;
    }
    if (ext === '.js' && /^[\u4e00-\u9fff]/.test(trimmed)) return false; // starts with CJK char → prose
    // Reject if the content is overwhelmingly prose (no curly braces / semicolons / keywords)
    const codeIndicators = (text.match(/[{};]|function |class |const |let |var |require\(|module\.exports|<\?php/gi) || []).length;
    const lines = text.split('\n').length;
    if (lines > 5 && codeIndicators === 0) return false;
    return true;
}

function buildPrompt(plan, stepIndex, currentLog, currentContent) {
    return promptManager.getCoderPrompt(plan, stepIndex, currentLog, currentContent);
}

async function executeStep(task, stepIndex, writeToDisk = false) {
    const plan = task.plan;
    const step = plan.steps[stepIndex];
    const action = String(step.action || '').toLowerCase();
    if (!['modify', 'create'].includes(action)) {
        return {
            logEntry: {
                step: stepIndex + 1,
                file: step.file || '',
                status: 'skipped',
                reason: `Action "${step.action || ''}" is not a coding action`,
                timestamp: new Date().toISOString()
            },
            newContent: ''
        };
    }

    let file = step.file;
    if (Array.isArray(file)) {
        console.warn(`[Coder] Warning: step.file is an array. Using first element.`, file);
        file = file[0];
    }
    file = file ? String(file).trim() : '';
    if (!file) {
        throw new Error(`[Coder] Missing target file for ${action} step`);
    }

    const cwd = getProjectCWD();
    let filePath;
    try {
        filePath = enforceBoundary(cwd, file);
    } catch (err) {
        throw new Error(`[Coder] Path validation failed: ${err.message}`);
    }
    console.log(`[Coder] Targeting file: ${filePath} (workspace: ${cwd})`);

    // Read current content if modifying, checking in-memory proposed changes first
    let currentContent = '';
    const relPath = path.relative(cwd, filePath).replace(/\\/g, '/');
    if (task.proposed_changes && task.proposed_changes[relPath] !== undefined) {
        currentContent = task.proposed_changes[relPath];
    } else if (fs.existsSync(filePath)) {
        const stat = fs.statSync(filePath);
        if (!stat.isFile()) {
            throw new Error(`[Coder] Target path is not a file: ${file}`);
        }
        currentContent = fs.readFileSync(filePath, 'utf8');
    }

    // Build prompt (include current content inline for gemini-flash non-interactive mode)
    const prompt = buildPrompt(plan, stepIndex, task.coding_log, currentContent);
    // Use flash — pro triggers interactive agent mode via stdin (exits with code null)
    const response = await runGemini(prompt, 'gemini-2.5-flash');

    // Extract code block — prefer language-specific fence, fall back to any fence
    const lang = langTag(file);
    // Group 1: everything after the optional lang tag on the opening fence line, up to closing ```
    const langPattern = lang ? new RegExp('```' + lang + '[^\\n]*\\n([\\s\\S]*?)\\n?```', 'i') : null;
    // Fallback: any fenced block — skip the first line (lang tag), capture the rest
    const fallbackPattern = /```[^\n]*\n([\s\S]*?)\n?```/;
    const codeMatch = (langPattern && response.match(langPattern))
        || response.match(fallbackPattern);
    // If no fence found at all, use the raw response as a last resort
    const newContent = codeMatch ? codeMatch[1] : response;

    // Safety guard: refuse to write AI prose / markdown chat responses as code
    if (!looksLikeCode(newContent, file)) {
        throw new Error(
            `[Coder] Extracted content for "${file}" does not look like source code. ` +
            `Refusing to overwrite. AI may have returned chat text instead of code.`
        );
    }

    // Write file back
    if (writeToDisk) fs.mkdirSync(path.dirname(filePath), { recursive: true });
    if (writeToDisk) fs.writeFileSync(filePath, newContent, 'utf8');

    // Update log
    const logEntry = {
        step: stepIndex + 1,
        file: step.file,
        status: 'done',
        lines_changed: newContent.split('\n').length,
        timestamp: new Date().toISOString()
    };
    
    return { logEntry, newContent };
}

module.exports = { executeStep };
