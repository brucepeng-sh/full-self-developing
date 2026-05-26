/**
 * skeptic.js — Agent 2: Reviews and filters optimization suggestions
 */
'use strict';

const { runGemini, extractJSON } = require('./base');

const LIMITS = {
    MAX_FILES: 10,
    MAX_LINES: 1000,
};

function buildPrompt(suggestion) {
    return `你是一个严格的技术评审专家，负责过滤不合理的 TheOMS 系统优化任务。

收到如下优化建议：
${JSON.stringify(suggestion, null, 2)}

评审规则（满足以下任一条件则拒绝或拆分）：
- estimated_lines_changed > ${LIMITS.MAX_LINES} → REJECT
- files 数量 > ${LIMITS.MAX_FILES} → REJECT
- description 描述过于模糊（没有明确的文件路径或方法名）→ REJECT
- 任务过于宏观（如"优化整个系统性能"）→ REJECT 或 SPLIT
- 与 ThinkPHP 5.0 框架不兼容 → REJECT

若任务合理但规模偏大，可选 SPLIT：拆分为 2-3 个更小的子任务。
每个子任务须满足同样的约束条件。

仅输出如下 JSON，不含其他文字：
{
  "decision": "APPROVE|REJECT|SPLIT",
  "reason": "决策原因（1-2句）",
  "score": 0到100之间的整数,
  "sub_tasks": []
}

注意：sub_tasks 仅在 decision=SPLIT 时填写，每个元素的结构与原始建议相同。`;
}

async function review(suggestion) {
    // Hard rule checks before calling gemini (fast path)
    if (Array.isArray(suggestion.files) && suggestion.files.length > LIMITS.MAX_FILES) {
        return {
            decision:  'REJECT',
            reason:    `涉及文件 ${suggestion.files.length} 个，超过限制 ${LIMITS.MAX_FILES}`,
            score:     0,
            sub_tasks: [],
            agent:     'skeptic',
            reviewed_at: new Date().toISOString(),
        };
    }
    if (typeof suggestion.estimated_lines_changed === 'number' &&
        suggestion.estimated_lines_changed > LIMITS.MAX_LINES) {
        return {
            decision:  'REJECT',
            reason:    `预计修改 ${suggestion.estimated_lines_changed} 行，超过限制 ${LIMITS.MAX_LINES}`,
            score:     0,
            sub_tasks: [],
            agent:     'skeptic',
            reviewed_at: new Date().toISOString(),
        };
    }

    // AI-powered review for nuanced cases
    const raw  = await runGemini(buildPrompt(suggestion));
    const json = extractJSON(raw);

    if (!['APPROVE', 'REJECT', 'SPLIT'].includes(json.decision)) {
        throw new Error(`Skeptic: invalid decision "${json.decision}"`);
    }

    return {
        ...json,
        agent:       'skeptic',
        reviewed_at: new Date().toISOString(),
    };
}

module.exports = { review };
