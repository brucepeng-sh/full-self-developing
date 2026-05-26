/**
 * optimizer.js — Agent 1: Generates one concrete optimization suggestion
 */
'use strict';

const { runGemini, extractJSON } = require('./base');

const PROMPT = `你是 TheOMS（ThinkPHP 5.0 美容院订单管理系统）的资深代码优化专家。

当前代码库结构：
- application/api/        API 控制器
- application/common/     公共业务逻辑（Service/Model）
- application/admin/      后台管理模块
- tests/Unit/             PHPUnit 单元测试

请分析系统当前可能存在的 1 个典型问题（N+1 查询、缺少索引、安全漏洞、代码重复等），
提出 1 条具体可落地的优化建议。

严格约束：
- 涉及修改文件 ≤ 10 个
- 预计修改代码行数 ≤ 500 行
- 必须指定具体文件路径（相对项目根目录）
- 不得是"重构整个模块"类宏观建议

仅输出如下 JSON，不包含任何解释文字：
{
  "title": "简短标题（20字内）",
  "category": "performance|security|maintainability|ux",
  "files": ["application/xxx/yyy.php"],
  "description": "具体描述：在哪个文件的哪个方法里改什么",
  "expected_benefit": "预期收益说明",
  "estimated_lines_changed": 数字
}`;

async function generateSuggestion() {
    const raw  = await runGemini(PROMPT);
    const json = extractJSON(raw);

    // Validate required fields
    if (!json.title || !Array.isArray(json.files) || json.files.length === 0) {
        throw new Error(`Optimizer: invalid output — missing title or files. Raw: ${raw.slice(0, 200)}`);
    }
    if (json.files.length > 10) {
        throw new Error(`Optimizer: too many files (${json.files.length} > 10)`);
    }

    return {
        ...json,
        agent:      'optimizer',
        created_at: new Date().toISOString(),
    };
}

module.exports = { generateSuggestion };
