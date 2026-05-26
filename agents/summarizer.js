/**
 * summarizer.js — Agent 9: Creates summary of entire lifecycle
 */
'use strict';

const { runGemini } = require('./base');

function buildPrompt(task) {
    return `你是一个技术总结 Agent。请用 Markdown 编写一份本次优化任务的复盘总结报告。
内容包括：
1. 任务方向与优化目的
2. 代码修改的文件与行数
3. 单元测试与 API 集成测试结果
4. 修复过程中出现的错误与解决方案
5. 遗留问题与建议

任务内容：
${JSON.stringify({
    suggestion: task.suggestion,
    plan: task.plan,
    coding_log: task.coding_log,
    test_results: task.test_results
}, null, 2)}

仅输出最终的 Markdown 内容，不要有其他包裹前缀。`;
}

async function generateSummary(task) {
    const prompt = buildPrompt(task);
    const summary = await runGemini(prompt, 'gemini-2.5-flash');
    return summary;
}

module.exports = { generateSummary };
