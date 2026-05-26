/**
 * log-fixer.js — Agent 7: Reads test output log and debugs failures
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { runGemini, CWD, extractJSON } = require('./base');

// Files the LogFixer is NEVER allowed to modify (system infrastructure)
const PROTECTED_PREFIXES = [
    'agents/',
    'agents\\',
    'public/',
    'public\\',
    'node_modules/',
];

function isSafeFile(filePath) {
    if (!filePath || typeof filePath !== 'string') return false;
    const normalised = filePath.replace(/\\/g, '/');
    // Must target application code only
    if (!normalised.startsWith('application/')) return false;
    // Reject any path traversal attempt
    if (normalised.includes('..')) return false;
    return true;
}

function buildPrompt(task, testOutput) {
    return `你是一个高级调试与错误修复 Agent。
当前任务在运行测试时失败了。

计划说明：
${JSON.stringify(task.plan, null, 2)}

测试失败日志：
${testOutput.slice(0, 4000)}

请分析失败原因，并指出 application/ 目录下需要修改哪个文件以修复它。
注意：只允许修复 application/ 目录下的 PHP 文件，不允许修改 agents/ 或 node_modules/ 等系统文件。
仅输出如下 JSON 格式，不要包含任何额外字符：
{
  "file": "application/...",
  "reason": "故障原因分析",
  "instructions": "具体的代码级修复指导建议"
}
`;
}

async function suggestFix(task, testOutput) {
    // If there are no application files in the plan at all, skip fixing
    const appFiles = (task.plan?.steps || []).map(s => s.file).filter(f => f && f.startsWith('application'));
    if (appFiles.length === 0) {
        throw new Error('[LogFixer] No application/ files in plan — cannot suggest a meaningful fix. Aborting retry loop.');
    }

    const prompt = buildPrompt(task, testOutput);
    const response = await runGemini(prompt, 'gemini-2.5-pro');
    const json = extractJSON(response);

    // Safety check: reject fixes targeting system/agent files
    if (!isSafeFile(json.file)) {
        throw new Error(
            `[LogFixer] AI suggested fixing a protected/invalid file: "${json.file}". ` +
            `Only application/ PHP files may be fixed. Aborting.`
        );
    }

    return json;
}

module.exports = { suggestFix };
