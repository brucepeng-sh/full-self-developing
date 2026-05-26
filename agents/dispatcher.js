/**
 * dispatcher.js — Agent orchestrator: runs the full suggestion → review → plan pipeline
 */
'use strict';

const { createTask, updateTask, loadTasks, getTask, broadcast, appendStepLog } = require('./base');
const { generateSuggestion } = require('./optimizer');
const { review }             = require('./skeptic');
const { createPlan, refinePlan } = require('./planner');
const coder                  = require('./coder');
const testRunner             = require('./test-runner');
const logFixer               = require('./log-fixer');
const branchManager          = require('./branch-manager');
const summarizer             = require('./summarizer');
const { errorLog }           = require('../logger');

let running  = false;
const cancelledTasks = new Set();

function isCancelled(taskId) {
    if (cancelledTasks.has(taskId)) {
        cancelledTasks.delete(taskId); // clean up after detection
        return true;
    }
    return false;
}

let loopTimer = null;
const LOOP_INTERVAL_MS = 60_000; // 1 min between suggestions when idle

// ── Internal pipeline ────────────────────────────────────────────────────────

async function executeTaskFromStatus(taskId, startStatus) {
    let task = getTask(taskId);
    if (!task) return;

    if (isCancelled(taskId)) return updateTask(taskId, { status: 'cancelled' });

    try {
        let suggestion = task.suggestion;
        let reviewResult = task.review;
        let initialPlan = task.plan;

        // ── Phase 1: Optimizer ─────────────────────────────────────────────
        if (startStatus === 'generating') {
            updateTask(taskId, { status: 'generating' });
            broadcast('agent_step', { taskId, agent: 'optimizer', step: 'start' });
            try {
                suggestion = await generateSuggestion();
            } catch (err) {
                appendStepLog(taskId, { agent: 'optimizer', status: 'failed', error: err.message });
                return updateTask(taskId, { status: 'failed', error: `Optimizer: ${err.message}`, failed_step: 'generating' });
            }
            appendStepLog(taskId, { agent: 'optimizer', status: 'done', suggestion });
            updateTask(taskId, { suggestion });
            startStatus = 'reviewing';
        }

        // ── Phase 2: Skeptic ───────────────────────────────────────────────
        if (startStatus === 'reviewing') {
            updateTask(taskId, { status: 'reviewing' });
            broadcast('agent_step', { taskId, agent: 'skeptic', step: 'start' });
            try {
                reviewResult = await review(suggestion);
            } catch (err) {
                appendStepLog(taskId, { agent: 'skeptic', status: 'failed', error: err.message });
                return updateTask(taskId, { status: 'failed', error: `Skeptic: ${err.message}`, failed_step: 'reviewing' });
            }
            updateTask(taskId, { review: reviewResult });
            appendStepLog(taskId, { agent: 'skeptic', status: 'done', decision: reviewResult.decision, reason: reviewResult.reason });

            if (reviewResult.decision === 'REJECT') {
                console.log(`[Dispatcher] Task ${taskId} REJECTED: ${reviewResult.reason}`);
                appendStepLog(taskId, { agent: 'final', status: 'rejected', reason: reviewResult.reason });
                return updateTask(taskId, { status: 'rejected' });
            }

            if (reviewResult.decision === 'SPLIT') {
                console.log(`[Dispatcher] Task ${taskId} SPLIT into ${reviewResult.sub_tasks?.length || 0} sub-tasks`);
                updateTask(taskId, { status: 'split' });
                // Enqueue each sub-task as a new pipeline (max 3)
                const subs = (reviewResult.sub_tasks || []).slice(0, 3);
                for (const sub of subs) {
                    await runSubPipeline(sub);
                }
                return;
            }
            startStatus = 'planning';
        }

        // APPROVE → Phase 3: Planner
        if (startStatus === 'planning') {
            updateTask(taskId, { status: 'planning' });
            broadcast('agent_step', { taskId, agent: 'planner', step: 'start' });
            try {
                initialPlan = await createPlan(suggestion);
            } catch (err) {
                appendStepLog(taskId, { agent: 'planner', status: 'failed', error: err.message });
                return updateTask(taskId, { status: 'failed', error: `Planner: ${err.message}`, failed_step: 'planning' });
            }
            appendStepLog(taskId, { agent: 'planner', status: 'done', steps_count: initialPlan?.steps?.length ?? 0 });
            updateTask(taskId, { plan: initialPlan });
            startStatus = 'refining_plan';
        }

        // ── Phase 3b: Doc Skeptic ────────────────────
        if (startStatus === 'refining_plan') {
            updateTask(taskId, { status: 'refining_plan' });
            broadcast('agent_step', { taskId, agent: 'doc_skeptic', step: 'start' });
            let refined;
            try {
                refined = await refinePlan(taskId, initialPlan);
            } catch (err) {
                // Non-fatal: use initial plan if refinement fails
                console.warn(`[Dispatcher] Plan refinement failed, using initial: ${err.message}`);
                refined = { plan: initialPlan, review_log: [] };
            }

            // Halt for user approval
            updateTask(taskId, {
                plan:       refined.plan,
                review_log: refined.review_log,
                status:     'plan_ready'
            });
            broadcast('task_updated', { taskId, status: 'plan_ready' });
            console.log(`[Dispatcher] Task ${taskId} plan ready — awaiting user approval`);
        }

    } catch (err) {
        errorLog(`[Dispatcher] Unexpected error for task ${taskId}: ${err.message}`);
        updateTask(taskId, { status: 'failed', error: err.message });
    }
}

async function runSuggestionPipeline() {
    const task = createTask('loop');
    console.log(`[Dispatcher] Task created: ${task.id}`);
    await executeTaskFromStatus(task.id, 'generating');
}

// Run a pre-built suggestion through the planner (used after SPLIT)
async function runSubPipeline(suggestion) {
    const task = createTask('sub');
    updateTask(task.id, { suggestion, status: 'planning' });
    await executeTaskFromStatus(task.id, 'planning');
}

// ── Execution Pipeline (Post-Approval) ────────────────────────────────────────

async function startCodingProcess(taskId, startStatus = 'coding') {
    let task = getTask(taskId);
    if (!task) return;

    try {
        const steps = task.plan.steps;
        const codingLog = task.coding_log || [];

        // ── Step 5: Coder Agent ──────────────────────────────────────────────
        if (startStatus === 'coding') {
            updateTask(taskId, { status: 'coding' });
            broadcast('agent_step', { taskId, agent: 'coder', step: 'start' });

            let startIdx = 0;
            if (typeof task.failed_step_index === 'number') {
                startIdx = task.failed_step_index;
                console.log(`[Dispatcher] Resuming coding process from step ${startIdx + 1} for task ${taskId}`);
            }

            for (let i = startIdx; i < steps.length; i++) {
                console.log(`[Dispatcher] Executing step ${i+1}/${steps.length} for task ${taskId}...`);
                if (isCancelled(taskId)) return updateTask(taskId, { status: 'cancelled' });
                
                let result;
                try {
                    result = await coder.executeStep(task, i, false);
                } catch (err) {
                    appendStepLog(taskId, { agent: 'coder', step_index: i, action: steps[i].action, file: steps[i].file, status: 'failed', error: err.message });
                    updateTask(taskId, { status: 'failed', error: `Coder Step ${i+1}: ${err.message}`, failed_step: 'coding', failed_step_index: i });
                    return;
                }
                
                if (isCancelled(taskId)) return updateTask(taskId, { status: 'cancelled' });
                const logEntry = result.logEntry;
                codingLog.push(logEntry);
                
                const file = Array.isArray(steps[i].file) ? steps[i].file[0] : steps[i].file;
                const relPath = file.replace(/\\/g, '/');
                const proposedChanges = { ...(task.proposed_changes || {}) };
                proposedChanges[relPath] = result.newContent;

                task = updateTask(taskId, { 
                    coding_log: [...codingLog],
                    proposed_changes: proposedChanges
                });
                appendStepLog(taskId, { agent: 'coder', step_index: i, action: steps[i].action, file: steps[i].file, status: logEntry.status || 'done' });
            }
            
            // Successfully completed coding, update status to patch_ready and stop flow
            updateTask(taskId, { 
                status: 'patch_ready',
                failed_step_index: null 
            });
            broadcast('task_updated', { taskId, status: 'patch_ready' });
            console.log(`[Dispatcher] Task ${taskId} code generated and patch ready — awaiting user confirmation`);
            return;
        }

        // ── Step 6: TestRunner Agent ─────────────────────────────────────────
        let retries = task.test_retries || 0;
        const MAX_TEST_RETRIES = 5;
        let testPassed = false;

        if (startStatus === 'testing' || startStatus === 'fixing') {
            while (retries < MAX_TEST_RETRIES) {
                if (startStatus === 'testing') {
                    if (isCancelled(taskId)) return updateTask(taskId, { status: 'cancelled' });
                    updateTask(taskId, { status: 'testing', test_retries: retries });
                    broadcast('agent_step', { taskId, agent: 'test_runner', step: 'start' });

                    let testResults;
                    try {
                        testResults = await testRunner.runTests(task);
                    } catch (err) {
                        appendStepLog(taskId, { agent: 'test_runner', status: 'failed', error: err.message });
                        updateTask(taskId, { status: 'failed', error: `Test Runner: ${err.message}`, failed_step: 'testing', test_retries: retries });
                        return;
                    }
                    
                    if (isCancelled(taskId)) return updateTask(taskId, { status: 'cancelled' });
                    updateTask(taskId, { test_results: testResults });
                    appendStepLog(taskId, { agent: 'test_runner', try: retries + 1, passed: testResults.passed });

                    if (testResults.passed) {
                        testPassed = true;
                        break;
                    }

                    console.log(`[Dispatcher] Tests failed on try ${retries+1}. Invoking LogFixer...`);
                    startStatus = 'fixing';
                }

                // ── Step 7: LogFixer Agent ───────────────────────────────────────
                if (startStatus === 'fixing') {
                    updateTask(taskId, { status: 'fixing' });
                    broadcast('agent_step', { taskId, agent: 'log_fixer', step: 'start' });

                    const testResults = task.test_results;
                    let fix;
                    try {
                        fix = await logFixer.suggestFix(task, testResults.unit.output);
                    } catch (err) {
                        appendStepLog(taskId, { agent: 'log_fixer', status: 'failed', error: err.message });
                        updateTask(taskId, { status: 'failed', error: `Log Fixer: ${err.message}`, failed_step: 'fixing', test_retries: retries });
                        return;
                    }
                    
                    if (isCancelled(taskId)) return updateTask(taskId, { status: 'cancelled' });
                    console.log(`[Dispatcher] LogFixer suggests fixing file: ${fix.file}. Reason: ${fix.reason}`);

                    // Trigger Coder Agent to apply the fix
                    const fixStep = {
                        action: 'modify',
                        file: fix.file,
                        description: `Fix failed test: ${fix.instructions}`
                    };
                    
                    // Add temporary step and execute it
                    const tempPlan = { steps: [fixStep], branch_name: task.plan.branch_name };
                    if (isCancelled(taskId)) return updateTask(taskId, { status: 'cancelled' });
                    
                    let fixLog;
                    try {
                        const fixResult = await coder.executeStep({ plan: tempPlan, coding_log: [] }, 0, true);
                        fixLog = fixResult.logEntry;
                    } catch (err) {
                        appendStepLog(taskId, { agent: 'log_fixer', status: 'failed', error: `Applying fix failed: ${err.message}` });
                        updateTask(taskId, { status: 'failed', error: `Log Fixer Apply: ${err.message}`, failed_step: 'fixing', test_retries: retries });
                        return;
                    }
                    
                    appendStepLog(taskId, { agent: 'log_fixer', try: retries + 1, fix_file: fix.file, reason: fix.reason });
                    
                    codingLog.push({ ...fixLog, step: `fix_${retries+1}` });
                    updateTask(taskId, { coding_log: [...codingLog] });

                    retries++;
                    updateTask(taskId, { test_retries: retries });
                    startStatus = 'testing';
                }
            }

            if (!testPassed && retries >= MAX_TEST_RETRIES) {
                appendStepLog(taskId, { agent: 'final', status: 'failed', error: 'Test execution failed after 5 retries.' });
                updateTask(taskId, { status: 'failed', error: 'Test execution failed after 5 retries.', failed_step: 'testing', test_retries: retries });
                return;
            }
            
            updateTask(taskId, { test_retries: null });
            startStatus = 'archiving';
        }

        // ── Step 8: BranchManager Agent ──────────────────────────────────────
        if (startStatus === 'archiving') {
            if (isCancelled(taskId)) return updateTask(taskId, { status: 'cancelled' });
            updateTask(taskId, { status: 'archiving' });
            broadcast('agent_step', { taskId, agent: 'branch_mgr', step: 'start' });

            let archiveResult;
            try {
                archiveResult = await branchManager.archiveTask(task);
            } catch (err) {
                appendStepLog(taskId, { agent: 'branch_mgr', status: 'failed', error: err.message });
                return updateTask(taskId, { status: 'failed', error: `Branch Manager: ${err.message}`, failed_step: 'archiving' });
            }
            
            if (isCancelled(taskId)) return updateTask(taskId, { status: 'cancelled' });
            updateTask(taskId, { archive_result: archiveResult });
            startStatus = 'summarizing';
        }

        // ── Step 9: Summarizer Agent ─────────────────────────────────────────
        if (startStatus === 'summarizing') {
            updateTask(taskId, { status: 'summarizing' });
            broadcast('agent_step', { taskId, agent: 'summarizer', step: 'start' });

            let summary;
            try {
                summary = await summarizer.generateSummary(task);
            } catch (err) {
                appendStepLog(taskId, { agent: 'summarizer', status: 'failed', error: err.message });
                return updateTask(taskId, { status: 'failed', error: `Summarizer: ${err.message}`, failed_step: 'summarizing' });
            }
            
            if (isCancelled(taskId)) return updateTask(taskId, { status: 'cancelled' });

            updateTask(taskId, {
                status: 'done',
                summary,
                failed_step: null,
                failed_step_index: null,
                test_retries: null
            });

            appendStepLog(taskId, { agent: 'final', status: 'done', summary: summary?.substring?.(0, 200) });
            console.log(`[Dispatcher] Task ${taskId} completed successfully!`);

            // ── Step 10: Trigger next task automatically if loop is running ──────
            if (running) {
                console.log('[Dispatcher] Scheduling next suggestion...');
                loopTimer = setTimeout(runSuggestionPipeline, LOOP_INTERVAL_MS);
            }
        }

    } catch (err) {
        errorLog(`[Dispatcher] Coding process error for task ${taskId}: ${err.message}`);
        appendStepLog(taskId, { agent: 'final', status: 'crashed', error: err.message });
        updateTask(taskId, { status: 'failed', error: err.message, failed_step: startStatus });
    }
}

// ── User-triggered actions ────────────────────────────────────────────────────

/**
 * User clicked "▶ Start Coding" — transition plan_ready → coding
 */
function approveTask(taskId) {
    const task = loadTasks().find(t => t.id === taskId);
    if (!task || task.status !== 'plan_ready') {
        throw new Error(`Task ${taskId} is not in plan_ready state (current: ${task?.status})`);
    }
    
    // Start asynchronous programming workflow so request returns immediately
    updateTask(taskId, { status: 'coding', approved_at: new Date().toISOString() });
    broadcast('coding_started', { taskId });
    
    startCodingProcess(taskId).catch(err =>
        errorLog(`[Dispatcher] Async coding process crash: ${err.message}`)
    );
}

function approvePatch(taskId) {
    const task = getTask(taskId);
    if (!task) {
        throw new Error(`Task ${taskId} not found`);
    }
    if (task.status !== 'patch_ready') {
        throw new Error(`Task ${taskId} is not in patch_ready state (current: ${task?.status})`);
    }

    const { getProjectCWD } = require('./base');
    const { enforceBoundary } = require('./path-validator');
    const fs = require('fs');
    const path = require('path');
    const cwd = getProjectCWD();

    // 1. Write the proposed changes to disk
    if (task.proposed_changes) {
        for (const [relPath, content] of Object.entries(task.proposed_changes)) {
            const absPath = path.resolve(cwd, relPath);
            enforceBoundary(cwd, relPath);
            fs.mkdirSync(path.dirname(absPath), { recursive: true });
            fs.writeFileSync(absPath, content, 'utf8');
        }
    }

    // 2. Resume the programming workflow in testing phase
    updateTask(taskId, { status: 'testing', patch_approved_at: new Date().toISOString() });
    broadcast('testing_started', { taskId });

    startCodingProcess(taskId, 'testing').catch(err =>
        errorLog(`[Dispatcher] Async testing process crash: ${err.message}`)
    );
}

function rejectTask(taskId) {
    const task = loadTasks().find(t => t.id === taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);
    updateTask(taskId, { status: 'rejected', rejected_at: new Date().toISOString() });
    broadcast('task_updated', { taskId, status: 'rejected' });
}

function cancelTask(taskId) {
    const task = loadTasks().find(t => t.id === taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);
    // Mark as cancelled
    cancelledTasks.add(taskId);
    updateTask(taskId, { status: 'cancelled', cancelled_at: new Date().toISOString() });
    broadcast('task_updated', { taskId, status: 'cancelled' });
    console.log(`[Dispatcher] Task ${taskId} cancelled by user`);
}

// ── Loop control ──────────────────────────────────────────────────────────────

function startLoop() {
    if (running) return;
    running = true;
    console.log('[Dispatcher] Loop started');
    broadcast('loop_status', { running: true });

    const tick = async () => {
        if (!running) return;
        await runSuggestionPipeline().catch(e => errorLog(`[Dispatcher] Pipeline error: ${e.message}`));
    };
    tick();
}

function stopLoop() {
    running = false;
    if (loopTimer) { clearTimeout(loopTimer); loopTimer = null; }
    console.log('[Dispatcher] Loop stopped');
    broadcast('loop_status', { running: false });
}

function isRunning() { return running; }

// Trigger a single suggestion immediately (without starting the timed loop)
async function triggerOnce() {
    return runSuggestionPipeline();
}

// ── Retry a failed task ──────────────────────────────────────────────────────────────────

async function retryTask(taskId) {
    const task = getTask(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);
    if (task.status !== 'failed' && task.status !== 'cancelled') throw new Error(`Task ${taskId} is not failed/cancelled (current: ${task.status})`);

    // Remove cancellation flag so the pipeline won't immediately stop again
    cancelledTasks.delete(taskId);

    // Get the step where it failed
    const failedStep = task.failed_step || (task.plan && task.suggestion ? 'coding' : 'generating');

    // Clear error, reset status
    updateTask(taskId, { status: 'pending', error: null });

    process.nextTick(async () => {
        try {
            if (failedStep === 'coding' || failedStep === 'testing' || failedStep === 'fixing' || failedStep === 'archiving' || failedStep === 'summarizing') {
                await startCodingProcess(taskId, failedStep);
            } else {
                await executeTaskFromStatus(taskId, failedStep);
            }
        } catch (err) {
            errorLog(`[Dispatcher] Retry unexpected error: ${err.message}`);
            updateTask(taskId, { status: 'failed', error: err.message, failed_step: failedStep });
        }
    });
}

module.exports = { startLoop, stopLoop, isRunning, approveTask, approvePatch, rejectTask, triggerOnce, retryTask, cancelTask };
