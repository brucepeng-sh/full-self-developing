/**
 * planner.js — Agent 3: Creates plan + Agent 4: 5-round doc skeptic
 */
'use strict';

const { runGemini, extractJSON, broadcast, updateTask } = require('./base');
const promptManager = require('./prompt-manager');

const PASS_SCORE   = 85;
const MAX_ROUNDS   = 1;

function normalizePlan(plan) {
    if (!plan || !Array.isArray(plan.steps)) return plan;
    const newSteps = [];
    let stepNum = 1;
    for (const step of plan.steps) {
        if (Array.isArray(step.file)) {
            for (const f of step.file) {
                newSteps.push({
                    ...step,
                    step: stepNum++,
                    file: String(f).trim()
                });
            }
        } else {
            newSteps.push({
                ...step,
                step: stepNum++,
                file: step.file ? String(step.file).trim() : ''
            });
        }
    }
    plan.steps = newSteps;
    return plan;
}

// ── Public API ───────────────────────────────────────────────────────────────

async function createPlan(suggestion) {
    const raw  = await runGemini(promptManager.getPlannerPrompt(suggestion));
    const plan = normalizePlan(extractJSON(raw));

    if (!plan.title || !Array.isArray(plan.steps) || plan.steps.length === 0) {
        throw new Error('Planner: invalid plan structure');
    }
    plan.quality_score = plan.quality_score || 60;
    return plan;
}

async function refinePlan(taskId, initialPlan) {
    let plan       = initialPlan;
    const log      = [];

    for (let round = 1; round <= MAX_ROUNDS; round++) {
        broadcast('plan_review_round', { taskId, round, score: plan.quality_score });

        const sRaw    = await runGemini(promptManager.getSkepticPrompt(plan, round));
        const sResult = extractJSON(sRaw);

        log.push({ round, score: sResult.score, questions: sResult.questions });

        if (sResult.score >= PASS_SCORE) {
            plan.quality_score = sResult.score;
            updateTask(taskId, { plan, review_log: log });
            broadcast('plan_review_passed', { taskId, round, score: sResult.score });
            break;
        }

        // Revise with AI
        const rRaw = await runGemini(promptManager.getRevisePrompt(plan, sResult.questions));
        plan = normalizePlan(extractJSON(rRaw));
        plan.quality_score = sResult.score; // carry forward latest score

        // Persist round progress
        updateTask(taskId, { plan, review_log: log });
    }

    return { plan, review_log: log };
}

module.exports = { createPlan, refinePlan };
