'use strict';

const fs = require('fs');
const path = require('path');
const engineConfig = require('./engine-config');

/**
 * Common system-level rules applied to AI prompts to enforce boundary and dependency checks.
 */
const SYSTEM_RULES = `
【CRITICAL SYSTEM RULES】
1. SPATIAL CONFINEMENT (Workspace Boundary):
   - You MUST use ONLY relative paths from the repository root.
   - NEVER use or generate absolute paths like C:\\..., /usr/..., /home/... 
   - All file modifications must remain strictly within the project folder.

2. NO BLIND API GUESSING (Dependency-backed Behavior):
   - Do NOT guess API endpoints, function names, or file structures.
   - Assume nothing. If you are uncertain about a file's existence or structure, state what you need to check first.
   - Write code based on explicit instructions and known project context.

3. EXECUTABLE PLAN STEPS:
   - The "steps" array is executed by a file-writing coder.
   - Include ONLY concrete file modification steps with action "modify" or "create".
   - Do NOT include read, investigate, verify, benchmark, research, or empty-file steps in "steps".
   - Put non-editing checks and validation work in "test_plan", notes, or descriptions instead.
`;

const skillsManager = require('./skills-manager');

function getDynamicSkillsPrompt() {
    try {
        const settings = engineConfig.loadSettings();
        const enabledSkills = settings.enabledSkills || [];
        if (enabledSkills.length === 0) return '';
        
        let skillsPrompt = '\n【ACTIVE SYSTEM SKILLS】\nThe following skills are currently enabled. Follow these instructions closely:\n';
        for (const skillId of enabledSkills) {
            const content = skillsManager.getSkillContent(skillId);
            if (content) {
                skillsPrompt += `\n--- SKILL: ${skillId} ---\n${content}\n------------------------\n`;
            }
        }
        if (skillsPrompt === '\n【ACTIVE SYSTEM SKILLS】\nThe following skills are currently enabled. Follow these instructions closely:\n') return '';
        return skillsPrompt;
    } catch (e) {
        console.error('[PromptManager] Failed to load dynamic skills:', e.message);
        return '';
    }
}

function getPlannerPrompt(suggestion) {
    const dynamicSkills = getDynamicSkillsPrompt();
    return `You are an expert Technical Planner for this project.
Based on the following optimization suggestions, generate a detailed step-by-step implementation plan.
${SYSTEM_RULES}
${dynamicSkills}

Suggestions:
${JSON.stringify(suggestion, null, 2)}

Output ONLY the following JSON, without any additional text:
{
  "title": "PR Title",
  "branch_name": "feat/optimize-xxx-${new Date().toISOString().slice(0,10).replace(/-/g,'')}",
  "steps": [
    {
      "step": 1,
      "action": "modify|create",
      "file": "Relative path (Must be a single file string path. If multiple files are involved, split into multiple steps)",
      "description": "Specific modifications (methods, logic)",
      "test_required": true
    }
  ],
  "test_plan": {
    "unit": ["tests/Unit/XxxTest.php::testYyy"],
    "api":  ["POST /api/xxx/list (explain validation point)"],
    "e2e":  ["User scenario description"]
  },
  "rollback_steps": ["git revert <commit>", "..."],
  "estimated_time": "30min",
  "quality_score": 60
}`;
}

function getSkepticPrompt(plan, round) {
    const dynamicSkills = getDynamicSkillsPrompt();
    return `You are a meticulous Technical Documentation Review Expert, conducting round ${round} of plan challenging.
${SYSTEM_RULES}
${dynamicSkills}

Current Implementation Plan:
${JSON.stringify(plan, null, 2)}

Please raise exactly 1 specific challenging question from each of the following 10 dimensions, and score the plan's completeness (0-100):
1. Boundary & Exception Handling  2. Concurrency & Transaction Safety  3. Backward Compatibility
4. Test Coverage Completeness     5. Rollback & Risk Mitigation        6. Performance Impact Assessment
7. Security Vulnerability Check   8. Missing File Dependencies         9. Data Migration Impact   10. User Experience Impact

Output ONLY the following JSON:
{
  "score": Integer,
  "questions": [
    {"dimension": "Dimension Name", "question": "Specific question", "severity": "high|medium|low"}
  ]
}`;
}

function getRevisePrompt(plan, questions) {
    const dynamicSkills = getDynamicSkillsPrompt();
    return `Refine the implementation plan based on the following challenging questions (Keep the same JSON structure, update quality_score):
${SYSTEM_RULES}
${dynamicSkills}

Challenging Questions:
${JSON.stringify(questions, null, 2)}

Current Plan:
${JSON.stringify(plan, null, 2)}

Output ONLY the complete revised plan JSON:`;
}

function getCoderPrompt(plan, stepIndex, currentLog, currentContent) {
    const dynamicSkills = getDynamicSkillsPrompt();
    const step = plan.steps[stepIndex];
    const file = step.file || '';
    // Infer language from file extension for code fence
    const extMatch = file.match(/\.([a-zA-Z0-9]+)$/);
    let lang = extMatch ? extMatch[1] : '';
    if (lang === 'js') lang = 'javascript';
    if (lang === 'ts') lang = 'typescript';
    if (lang === 'jsx') lang = 'javascript';
    if (lang === 'tsx') lang = 'typescript';

    const fenceExample = lang === 'php' ? '```php\n<?php\n...\n```' : `\`\`\`${lang}\n...\n\`\`\``;
    const contentSection = currentContent
        ? `\nCurrent file content (Please modify based on this):\n\`\`\`${lang}\n${currentContent}\n\`\`\``
        : `\nThe file does not exist yet, please create it from scratch.`;

    return `You are an expert Full-Stack Senior Programming Agent.
Current active branch: ${plan.branch_name}
Task step: ${stepIndex + 1} / ${plan.steps.length}

${SYSTEM_RULES}
${dynamicSkills}

Step Objective:
- Action: ${step.action}
- Target File: ${step.file}
- Description: ${step.description}

Execution History Log:
${JSON.stringify(currentLog, null, 2)}
${contentSection}

Please modify or generate the file content based on the step description.
Note: Follow industry standard practices and ensure proper exception handling and security.

Output ONLY the complete file code wrapped in the format below, without any other explanations:
${fenceExample}
`;
}

module.exports = {
    getPlannerPrompt,
    getSkepticPrompt,
    getRevisePrompt,
    getCoderPrompt
};
