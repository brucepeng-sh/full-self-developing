/**
 * branch-manager.js — Agent 8: Archives changes into isolation branch without junk files
 */
'use strict';

const { spawn } = require('child_process');
const path = require('path');
const { getProjectCWD } = require('./base');

/**
 * Run a git command in the given directory.
 * shell: false — Node passes each array element as a separate argv,
 * so spaces / Chinese chars / colons in commit messages are safe.
 */
function gitCmd(args, cwd) {
    return new Promise((resolve, reject) => {
        const child = spawn('git', args, { cwd, shell: false });
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', d => stdout += d.toString());
        child.stderr.on('data', d => stderr += d.toString());
        child.on('close', code => {
            if (code === 0) resolve(stdout.trim());
            else {
                const detail = [stderr.trim(), stdout.trim()].filter(Boolean).join(' | ');
                reject(new Error(`git ${args[0]} failed: ${detail || '(no output)'}`));
            }
        });
    });
}


async function archiveTask(task) {
    const branchName = task.plan?.branch_name || `feat/task-${task.id.slice(0, 8)}`;
    // Resolve at runtime so workspace changes are picked up without restart
    const projectCWD = getProjectCWD();
    console.log(`[BranchManager] Archiving to branch '${branchName}' in ${projectCWD}...`);

    // Convenience wrapper — binds projectCWD automatically
    const git = (...args) => gitCmd(args, projectCWD);

    try {
        // Step 1: Ensure we are on master/main before any branch operations.
        //   (prevents `branch -D` failing if a previous crash left us on the feature branch)
        const currentBranch = await git('rev-parse', '--abbrev-ref', 'HEAD');
        if (currentBranch !== 'master' && currentBranch !== 'main') {
            console.log(`[BranchManager] On '${currentBranch}', switching to master first...`);
            await git('checkout', '-f', 'master').catch(() => git('checkout', '-f', 'main'));
        }

        // Step 2: Delete the feature branch if it already exists (idempotent retry support)
        const existing = await git('branch', '--list', branchName);
        if (existing.trim()) {
            console.log(`[BranchManager] Branch '${branchName}' exists, removing for clean recreate...`);
            await git('branch', '-D', branchName);
        }

        // Step 3: Create and checkout the feature branch
        await git('checkout', '-b', branchName);

        // Step 4: Stage only files that git itself reports as modified/new,
        //   filtered to known code extensions — completely avoids .gitignore conflicts.
        const CODE_EXTS = new Set(['.php', '.js', '.css', '.html', '.vue', '.ts', '.json']);

        // `git status --short` lines: "XY filename" or "XY old -> new"
        const statusOut = await git('status', '--short');
        const changedFiles = statusOut
            .split('\n')
            .map(l => l.trim())
            .filter(Boolean)
            .map(l => {
                // Handle renames: "R old -> new"
                const parts = l.slice(2).trim().split(' -> ');
                return parts[parts.length - 1].replace(/^"|"$/g, '').trim();
            })
            .filter(f => CODE_EXTS.has(path.extname(f)));

        // Also always include the specific files from coding_log
        const logFiles = (task.coding_log || []).map(l => l.file).filter(Boolean);

        // Merge and deduplicate
        const toStage = [...new Set([...changedFiles, ...logFiles])];

        if (toStage.length === 0) {
            throw new Error('No modified code files to stage — git reports no changes in tracked code files.');
        }

        // Stage one by one so a single problem file doesn't abort the whole batch
        let staged = false;
        for (const f of toStage) {
            await git('add', '--', f).then(() => { staged = true; }).catch(e =>
                console.warn(`[BranchManager] Skipping '${f}': ${e.message}`)
            );
        }

        if (!staged) {
            throw new Error('All staging attempts failed — see warnings above.');
        }

        // Step 5: Commit only if there are actual staged changes.
        // Use `git diff --cached --quiet` — exits 0 if nothing staged, 1 if there are staged changes.
        // This is more reliable than parsing `status --porcelain` output.
        let hasStagedChanges = false;
        try {
            await git('diff', '--cached', '--quiet');
            // exit 0 = nothing staged
            hasStagedChanges = false;
        } catch (_) {
            // exit 1 = there ARE staged changes (this is the normal "has changes" signal)
            hasStagedChanges = true;
        }

        if (hasStagedChanges) {
            const commitMsg = `feat: ${task.plan?.title || 'auto optimize task'}`;
            await git('commit', '-m', commitMsg);
            console.log(`[BranchManager] Committed to '${branchName}': ${commitMsg}`);
        } else {
            console.log(`[BranchManager] No staged changes to commit (working tree already clean).`);
        }

        // Step 6: Return to master
        await git('checkout', 'master');
        return { branch: branchName, status: 'archived' };

    } catch (err) {
        console.error(`[BranchManager] Error:`, err.message);
        // Best-effort cleanup: switch back so repo isn't left in a bad state
        await gitCmd(['checkout', '-f', 'master'], projectCWD).catch(() =>
            gitCmd(['checkout', '-f', 'main'], projectCWD).catch(() => {})
        );
        throw err;
    }
}

module.exports = { archiveTask };
