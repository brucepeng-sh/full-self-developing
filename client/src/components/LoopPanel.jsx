import React, { useState, useEffect } from 'react';
import { Play, Square, Zap, Check, X, AlertTriangle, ChevronDown, ChevronRight, Copy, FileText, Code2, RefreshCw, PanelLeftOpen, PanelLeftClose } from 'lucide-react';
import ReactDiffViewerExport from 'react-diff-viewer';
const ReactDiffViewer = ReactDiffViewerExport.default || ReactDiffViewerExport;
import ConfirmationModal from './ConfirmationModal';
import { apiFetch } from '../api';

const stages = [
    { label: 'Analyze & Plan', desc: 'Skeptic review & planning' },
    { label: 'Plan Ready', desc: 'Awaiting user review' },
    { label: 'Coding', desc: 'Applying code updates' },
    { label: 'Validation', desc: 'Testing & log fixing' },
    { label: 'Finished', desc: 'Archived & Summarized' }
];

const getActiveStage = (status) => {
    if (['pending', 'generating', 'reviewing', 'planning', 'refining_plan'].includes(status)) return 0;
    if (status === 'plan_ready') return 1;
    if (['coding', 'patch_ready'].includes(status)) return 2;
    if (['testing', 'fixing'].includes(status)) return 3;
    if (['archiving', 'summarizing', 'done', 'failed', 'cancelled', 'rejected'].includes(status)) return 4;
    return 0;
};

export default function LoopPanel({
    loopState,
    tasks,
    isLoadingTasks,
    onStartLoop,
    onStopLoop,
    onStartAll,
    onStopAll,
    onTriggerLoop,
    activeTaskId,
    onSelectTask,
    onApproveTask,
    onApprovePatch,
    onRejectTask,
    onStopTask,
    onRetryTask,
    onDeleteTask
}) {
    const isRunning = loopState === 'running';

    const [confirmStopTaskId, setConfirmStopTaskId] = useState(null);
    const [confirmRejectTaskId, setConfirmRejectTaskId] = useState(null);
    const [confirmDeleteTaskId, setConfirmDeleteTaskId] = useState(null);
    const [showStopAllConfirm, setShowStopAllConfirm] = useState(false);

    const [isTaskListFolded, setIsTaskListFolded] = useState(window.innerWidth < 1024);

    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < 1024) {
                setIsTaskListFolded(true);
            } else {
                setIsTaskListFolded(false);
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const activeTask = tasks.find(t => t.id === activeTaskId);

    const [expandedSteps, setExpandedSteps] = useState({});
    const [showRaw, setShowRaw] = useState(false);
    const [copied, setCopied] = useState(false);

    const [activeTaskTab, setActiveTaskTab] = useState('plan'); // 'plan' or 'diff'
    const [diffs, setDiffs] = useState([]);
    const [isLoadingDiffs, setIsLoadingDiffs] = useState(false);
    const [expandedDiffs, setExpandedDiffs] = useState({});

    // Reset active tab to 'plan' when task changes
    useEffect(() => {
        setActiveTaskTab('plan');
    }, [activeTaskId]);

    const activeTaskStatus = activeTask?.status;

    // Fetch task diffs
    useEffect(() => {
        if (!activeTaskId) {
            setDiffs([]);
            return;
        }

        let isMounted = true;
        const fetchDiffs = async (isPolling = false) => {
            if (!isPolling) setIsLoadingDiffs(true);
            try {
                const data = await apiFetch(`/api/loop/tasks/${activeTaskId}/diff`);
                if (isMounted) {
                    setDiffs(data.diffs || []);
                }
            } catch (e) {
                console.error('Failed to fetch task diffs:', e);
                if (isMounted && !isPolling) {
                    setDiffs([]);
                }
            } finally {
                if (isMounted && !isPolling) {
                    setIsLoadingDiffs(false);
                }
            }
        };

        fetchDiffs(false);

        // Polling interval if the task is actively executing
        let intervalId;
        if (activeTaskStatus && ['coding', 'patch_ready', 'testing', 'fixing'].includes(activeTaskStatus)) {
            intervalId = setInterval(() => fetchDiffs(true), 5000);
        }

        return () => {
            isMounted = false;
            if (intervalId) clearInterval(intervalId);
        };
    }, [activeTaskId, activeTaskStatus]);

    const toggleStep = (idx) => {
        setExpandedSteps(prev => ({ ...prev, [idx]: !prev[idx] }));
    };

    const toggleDiff = (filePath) => {
        setExpandedDiffs(prev => ({ ...prev, [filePath]: !prev[filePath] }));
    };

    const handleCopy = (e, task) => {
        e.stopPropagation();
        navigator.clipboard.writeText(JSON.stringify(task, null, 2));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const isAbsolutePath = (path) => {
        if (!path) return false;
        return /^(?:\/|~|[a-zA-Z]:\\|[a-zA-Z]:\/)/.test(path);
    };

    const getTaskFilesList = (task) => {
        const files = [];
        if (task.plan && Array.isArray(task.plan.steps)) {
            for (const step of task.plan.steps) {
                const stepFiles = Array.isArray(step.file) ? step.file : [step.file];
                for (const f of stepFiles) {
                    if (f && typeof f === 'string') {
                        files.push({ path: f, action: step.action });
                    }
                }
            }
        }
        if (task.suggestion && Array.isArray(task.suggestion.files)) {
            for (const f of task.suggestion.files) {
                if (f && typeof f === 'string') {
                    files.push({ path: f, action: 'modify' });
                }
            }
        }
        // Deduplicate
        const seen = new Set();
        const unique = [];
        for (const f of files) {
            if (!seen.has(f.path)) {
                seen.add(f.path);
                unique.push(f);
            }
        }
        return unique;
    };

    const renderTaskDetails = (task) => {
        if (!task) return null;

        let hasOutOfBounds = false;
        let planSteps = null;
        
        if (task.plan && Array.isArray(task.plan.steps)) {
            planSteps = task.plan.steps;
            hasOutOfBounds = planSteps.some(step => {
                const files = Array.isArray(step.file) ? step.file : [step.file];
                return files.some(f => isAbsolutePath(f));
            });
        }

        const taskFiles = getTaskFilesList(task);
        const activeStageIdx = getActiveStage(task.status);
        const isDarkMode = document.documentElement.classList.contains('dark');

        return (
            <div className="flex-1 p-4 md:p-6 overflow-y-auto bg-white dark:bg-zinc-950 flex flex-col h-full">
                {/* Header Row */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 dark:border-white/10 pb-4 mb-6 shrink-0">
                    <div className="flex items-center gap-3">
                        {isTaskListFolded && (
                            <button
                                type="button"
                                onClick={() => setIsTaskListFolded(false)}
                                className="p-1.5 rounded-lg border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500 dark:text-gray-400 cursor-pointer"
                                aria-label="Expand task list sidebar"
                            >
                                <PanelLeftOpen size={18} />
                            </button>
                        )}
                        <div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1.5">{task.plan?.title || task.suggestion?.title || 'Untitled Task'}</h3>
                            <div className="flex items-center gap-2 text-xs">
                                <span className="text-gray-500 dark:text-gray-400 font-medium">Status:</span>
                                <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[10px] tracking-wider ${
                                    task.status === 'done' ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400' :
                                    task.status === 'failed' ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400' :
                                    task.status === 'cancelled' ? 'bg-gray-150 text-gray-700 dark:bg-zinc-800 dark:text-gray-400' :
                                    task.status === 'rejected' ? 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400' :
                                    task.status === 'plan_ready' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400' :
                                    task.status === 'patch_ready' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 font-bold' :
                                    'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 animate-pulse'
                                }`}>
                                    {task.status.replace('_', ' ')}
                                </span>
                            </div>
                        </div>
                    </div>
                    
                    {/* Task Actions Bar */}
                    <div className="flex flex-wrap gap-2">
                        {['pending', 'generating', 'reviewing', 'planning', 'refining_plan', 'coding', 'patch_ready', 'testing', 'fixing', 'archiving', 'summarizing'].includes(task.status) && (
                            <button 
                                type="button"
                                onClick={() => setConfirmStopTaskId(task.id)}
                                aria-label="Pause agent task"
                                className="flex items-center px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/30 dark:hover:bg-red-900/40 rounded transition-colors cursor-pointer"
                            >
                                <Square size={12} className="mr-1.5" /> 暂停任务
                            </button>
                        )}
                        {(task.status === 'failed' || task.status === 'cancelled') && (
                            <>
                                <button 
                                    type="button"
                                    onClick={() => onRetryTask(task.id)}
                                    aria-label="Retry task"
                                    className="flex items-center px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 rounded transition-colors shadow-sm cursor-pointer"
                                >
                                    <Play size={12} className="mr-1.5" /> 再次重试
                                </button>
                                <button 
                                    type="button"
                                    onClick={() => onRetryTask(task.id, { resetCoding: true })}
                                    aria-label="Re-code task"
                                    className="flex items-center px-3 py-1.5 text-xs font-semibold text-white bg-indigo-650 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-700 rounded transition-colors shadow-sm cursor-pointer"
                                >
                                    <Zap size={12} className="mr-1.5" /> 重新编码
                                </button>
                            </>
                        )}
                        {task.status === 'done' && (
                            <button 
                                type="button"
                                onClick={() => onRetryTask(task.id)}
                                aria-label="Re-execute task"
                                className="flex items-center px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 dark:bg-zinc-800 dark:border-white/10 dark:text-gray-200 dark:hover:bg-zinc-700 rounded transition-colors cursor-pointer"
                            >
                                <Zap size={12} className="mr-1.5" /> 重新执行
                            </button>
                        )}
                        {['done', 'failed', 'cancelled', 'rejected'].includes(task.status) && (
                            <button 
                                type="button"
                                onClick={() => setConfirmDeleteTaskId(task.id)}
                                aria-label="Delete task history"
                                className="flex items-center px-3 py-1.5 text-xs font-semibold text-red-650 bg-red-50 hover:bg-red-100 border border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/30 dark:hover:bg-red-900/40 rounded transition-colors cursor-pointer shadow-sm"
                            >
                                <X size={12} className="mr-1.5" /> 删除任务
                            </button>
                        )}
                    </div>
                </div>

                {/* Failure Warning Block */}
                {task.status === 'failed' && (
                    <div className="mb-6 p-4 border border-red-200 dark:border-red-900/30 rounded-xl bg-red-50/50 dark:bg-red-950/10 shadow-sm shrink-0">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="size-5 text-red-650 dark:text-red-400 shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-bold text-red-700 dark:text-red-400 mb-1">Task Execution Failed</h4>
                                <div className="text-xs text-red-650 dark:text-red-300 font-mono bg-white dark:bg-zinc-900 border border-red-100 dark:border-red-950/50 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap max-h-40 mb-3 shadow-inner">
                                    {String(task.error || 'Unknown error occurred during execution.')}
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        type="button"
                                        onClick={() => onRetryTask(task.id)}
                                        aria-label="Resume execution"
                                        className="flex items-center px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 rounded transition-colors shadow-sm cursor-pointer"
                                    >
                                        <Play size={12} className="mr-1.5" /> Resume (Retry step)
                                    </button>
                                    <button 
                                        onClick={() => onRetryTask(task.id, { resetCoding: true })}
                                        className="flex items-center px-3 py-1.5 text-xs font-semibold text-white bg-indigo-650 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-750 rounded transition-colors shadow-sm cursor-pointer"
                                    >
                                        <Zap size={12} className="mr-1.5" /> Re-code (From Step 1)
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Stage Timeline/Stepper */}
                <div className="mb-6 bg-gray-50 dark:bg-zinc-900/30 border border-gray-150 dark:border-white/5 rounded-xl p-4 shrink-0">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        {stages.map((stage, idx) => {
                            const isCompleted = idx < activeStageIdx;
                            const isActive = idx === activeStageIdx;
                            const isFailedStage = task.status === 'failed' && isActive;
                            
                            return (
                                <div key={idx} className="flex items-center gap-3 flex-1 w-full md:w-auto">
                                    <div className={`flex items-center justify-center size-8 rounded-full border text-xs font-bold shrink-0 transition-all ${
                                        isFailedStage ? 'bg-red-50 border-red-200 text-red-650 dark:bg-red-950/20 dark:border-red-900/30 dark:text-red-400' :
                                        isCompleted ? 'bg-green-500 border-green-500 text-white' :
                                        isActive ? 'bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-500/20 animate-pulse' :
                                        'bg-white border-gray-200 text-gray-400 dark:bg-zinc-800 dark:border-white/10 dark:text-gray-500'
                                    }`}>
                                        {isCompleted ? <Check size={14} /> : (idx + 1)}
                                    </div>
                                    <div className="min-w-0">
                                        <div className={`text-xs font-semibold truncate ${isActive ? 'text-blue-600 dark:text-blue-400' : isCompleted ? 'text-gray-900 dark:text-gray-250 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                                            {stage.label}
                                        </div>
                                        <div className="text-[10px] text-gray-400 dark:text-gray-500 truncate">
                                            {stage.desc}
                                        </div>
                                    </div>
                                    {idx < stages.length - 1 && (
                                        <div className="hidden md:block flex-1 h-[2px] mx-4 bg-gray-200 dark:bg-white/10 min-w-[20px]" />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Plan Ready Action Card */}
                {task.status === 'plan_ready' && (
                    <div className="p-4 md:p-5 mb-6 border border-blue-200 dark:border-blue-800 rounded-xl bg-blue-50/50 dark:bg-blue-900/10 shadow-sm backdrop-blur-sm shrink-0">
                        <h4 className="text-sm font-semibold text-blue-600 dark:text-blue-400 mb-3">Plan Ready for Review</h4>
                        {hasOutOfBounds ? (
                            <div className="flex items-start gap-3 p-3 mb-4 rounded-lg bg-red-50 text-red-650 dark:bg-red-900/20 dark:text-red-400 border border-red-100 dark:border-red-900/30">
                                <AlertTriangle className="size-5 shrink-0 mt-0.5" />
                                <div>
                                    <strong className="text-sm font-semibold block">Warning: Out-of-bounds (Absolute) path detected!</strong>
                                    <div className="text-xs mt-1 opacity-90">Approval is disabled to protect system files. Reject this task to force AI to rethink.</div>
                                </div>
                            </div>
                        ) : (
                            <div className="mb-4 text-sm text-gray-700 dark:text-gray-300">Please review the planned file modifications below.</div>
                        )}
                        
                        <div className="flex gap-3">
                            <button 
                                className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg text-white transition-colors ${hasOutOfBounds ? 'bg-blue-400 cursor-not-allowed opacity-50 dark:bg-blue-800' : 'bg-blue-600 hover:bg-blue-700 shadow-sm cursor-pointer'}`}
                                disabled={hasOutOfBounds} 
                                onClick={() => onApproveTask(task.id)}
                            >
                                <Check size={16} className="mr-2" /> Approve & Start Coding
                            </button>
                            <button 
                                className="flex items-center px-4 py-2 text-sm font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-zinc-800 dark:text-gray-300 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                                onClick={() => setConfirmRejectTaskId(task.id)}
                            >
                                <X size={16} className="mr-2" /> Reject & Redo
                            </button>
                        </div>
                    </div>
                )}

                {/* Patch Ready Action Card */}
                {task.status === 'patch_ready' && (
                    <div className="p-4 md:p-5 mb-6 border border-emerald-200 dark:border-emerald-800 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/10 shadow-sm backdrop-blur-sm shrink-0">
                        <h4 className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mb-3">Proposed Patch Ready</h4>
                        <div className="mb-4 text-sm text-gray-700 dark:text-gray-300">
                            The code changes have been generated in memory. Please review the diffs in the <strong>File Changes</strong> tab.
                        </div>
                        
                        <div className="flex gap-3">
                            <button 
                                className="flex items-center px-4 py-2 text-sm font-medium rounded-lg text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-colors cursor-pointer"
                                onClick={() => onApprovePatch(task.id)}
                            >
                                <Check size={16} className="mr-2" /> Approve & Write Patch to Disk
                            </button>
                            <button 
                                className="flex items-center px-4 py-2 text-sm font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-zinc-800 dark:text-gray-300 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                                onClick={() => setConfirmRejectTaskId(task.id)}
                            >
                                <X size={16} className="mr-2" /> Reject & Redo
                            </button>
                        </div>
                    </div>
                )}

                {/* Tab Navigation */}
                <div className="flex border-b border-gray-200 dark:border-white/10 mb-6 shrink-0">
                    <button
                        type="button"
                        onClick={() => setActiveTaskTab('plan')}
                        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
                            activeTaskTab === 'plan'
                                ? 'border-blue-500 text-blue-600 dark:text-blue-400 font-bold'
                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                        }`}
                    >
                        <FileText size={16} />
                        Plan & Steps
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTaskTab('diff')}
                        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all cursor-pointer ${
                            activeTaskTab === 'diff'
                                ? 'border-blue-500 text-blue-600 dark:text-blue-400 font-bold'
                                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                        }`}
                    >
                        <Code2 size={16} />
                        File Changes
                        {diffs.length > 0 && (
                            <span className="px-1.5 py-0.25 text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-350 rounded-full">
                                {diffs.length}
                            </span>
                        )}
                    </button>
                </div>

                {/* Tab Contents */}
                <div className="flex-1 min-h-0">
                    {activeTaskTab === 'plan' ? (
                        <div className="space-y-6">
                            {/* Modified Files List */}
                            {taskFiles.length > 0 && (
                                <div>
                                    <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Modified Files List</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {taskFiles.map((fileObj, idx) => {
                                            const isAbsolute = isAbsolutePath(fileObj.path);
                                            const action = fileObj.action;
                                            return (
                                                <div 
                                                    key={idx}
                                                    className={`flex items-center justify-between p-3 rounded-lg border bg-gray-50/50 dark:bg-zinc-900/40 ${
                                                        isAbsolute ? 'border-red-200 dark:border-red-900/30' : 'border-gray-200 dark:border-white/5'
                                                    }`}
                                                >
                                                    <span className={`text-xs font-mono truncate mr-2 ${isAbsolute ? 'text-red-650 dark:text-red-400 font-semibold' : 'text-gray-800 dark:text-gray-300'}`}>
                                                        {fileObj.path}
                                                    </span>
                                                    <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0 ${
                                                        action === 'delete' ? 'bg-red-50 text-red-650 dark:bg-red-950/30 dark:text-red-400' :
                                                        action === 'create' ? 'bg-green-50 text-green-655 dark:bg-green-950/30 dark:text-green-400' :
                                                        'bg-blue-50 text-blue-650 dark:bg-blue-950/30 dark:text-blue-400'
                                                    }`}>
                                                        {action || 'modify'}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Implementation Plan steps list */}
                            {planSteps ? (
                                <div>
                                    <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-4">Implementation Plan</h4>
                                    <ul className="space-y-3">
                                        {planSteps.map((step, idx) => {
                                            const file = Array.isArray(step.file) ? step.file[0] : step.file;
                                            const isAbsolute = isAbsolutePath(file);
                                            const isDelete = step.action === 'delete';
                                            const isCreate = step.action === 'create';
                                            const isExpanded = !!expandedSteps[idx];
                                            
                                            const log = task.coding_log?.find(l => l.step === step.step);
                                            
                                            let stepStatus = 'waiting';
                                            if (log) {
                                                stepStatus = log.status || 'done';
                                            } else if (task.status === 'coding' && task.failed_step_index === idx) {
                                                stepStatus = 'failed';
                                            } else if (task.status === 'coding' && idx < (task.failed_step_index || 0)) {
                                                stepStatus = 'done';
                                            } else if (['done', 'testing', 'fixing', 'archiving', 'summarizing'].includes(task.status)) {
                                                stepStatus = 'done';
                                            }

                                            return (
                                                <li key={idx}>
                                                    <button 
                                                        type="button"
                                                        onClick={() => toggleStep(idx)}
                                                        className={`w-full text-left p-4 rounded-xl bg-gray-50 dark:bg-zinc-900 border transition-colors hover:border-gray-300 dark:hover:border-zinc-700 ${isAbsolute ? 'border-red-500 shadow-sm shadow-red-500/10' : 'border-gray-200 dark:border-white/5'}`}
                                                        aria-expanded={isExpanded}
                                                        aria-label={`Toggle Step ${step.step} details`}
                                                    >
                                                        <span className="block flex items-start justify-between gap-4 mb-2">
                                                            <span className="flex items-center font-semibold text-xs md:text-sm">
                                                                <span className="text-gray-500 dark:text-gray-400 mr-2 shrink-0">Step {step.step}</span>
                                                                <span className={`px-2 py-0.5 rounded text-[10px] md:text-xs font-bold uppercase mr-2 ${isDelete ? 'bg-red-100 text-red-650 dark:bg-red-950/30 dark:text-red-400' : isCreate ? 'bg-green-100 text-green-655 dark:bg-green-950/30 dark:text-green-400' : 'bg-blue-100 text-blue-650 dark:bg-blue-950/30 dark:text-blue-400'}`}>
                                                                    {step.action}
                                                                </span>
                                                                <span className={`px-1.5 py-0.5 rounded text-[10px] md:text-xs font-semibold ${stepStatus === 'done' ? 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400' : stepStatus === 'failed' ? 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400' : 'bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-gray-400'}`}>
                                                                    {stepStatus === 'done' ? 'Completed' : stepStatus === 'failed' ? 'Failed' : 'Pending'}
                                                                </span>
                                                            </span>
                                                            <span className={`text-[10px] md:text-xs font-mono break-all text-right max-w-[50%] ${isAbsolute ? 'text-red-600 dark:text-red-400 font-bold' : 'text-gray-800 dark:text-gray-200'}`}>
                                                                {file}
                                                            </span>
                                                        </span>
                                                        <span className="block text-xs md:text-sm text-gray-650 dark:text-gray-405 leading-relaxed mt-2 flex items-center justify-between">
                                                            <span>{step.description}</span>
                                                            <span className="text-gray-400 dark:text-gray-500 shrink-0 ml-2">
                                                                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                            </span>
                                                        </span>

                                                        {isExpanded && (
                                                            <span className="block mt-3 pt-3 border-t border-gray-200 dark:border-white/5 text-xs text-gray-500 dark:text-gray-400 space-y-2">
                                                                <span className="flex justify-between">
                                                                    <span>Action: <span className="font-mono text-gray-700 dark:text-gray-300">{step.action}</span></span>
                                                                    {log?.lines_changed && <span>Lines modified: <span className="font-mono text-gray-700 dark:text-gray-300">+{log.lines_changed}</span></span>}
                                                                </span>
                                                                {log?.timestamp && (
                                                                    <span className="block">Completed at: <span className="font-mono text-gray-750 dark:text-gray-300">{new Date(log.timestamp).toLocaleString()}</span></span>
                                                                )}
                                                                {stepStatus === 'failed' && task.error && (
                                                                    <span className="block p-2.5 mt-1 bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400 rounded border border-red-100 dark:border-red-900/30 font-mono text-[10px] whitespace-pre-wrap break-all">
                                                                        <strong>Error log:</strong> {String(task.error)}
                                                                    </span>
                                                                )}
                                                            </span>
                                                        )}
                                                    </button>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            ) : null}
                        </div>
                    ) : (
                        /* Diff Tab */
                        <div className="space-y-6">
                            {isLoadingDiffs ? (
                                <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
                                    <RefreshCw size={24} className="animate-spin mb-3 text-blue-500" />
                                    <span className="text-xs font-semibold">Loading modified file diffs...</span>
                                </div>
                            ) : diffs.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 border border-dashed border-gray-200 dark:border-white/10 rounded-xl bg-gray-50/50 dark:bg-zinc-900/10">
                                    <Code2 size={36} className="text-gray-300 dark:text-gray-600 mb-3" />
                                    <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">No code changes recorded yet</span>
                                    <span className="text-xs text-gray-400 dark:text-gray-500 mt-1 max-w-xs text-center leading-relaxed">
                                        Changes will be generated dynamically once the coding process gets underway.
                                    </span>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {diffs.map((diff, index) => {
                                        const isExpanded = expandedDiffs[diff.file] !== false;
                                        const isNewFile = !diff.oldContent && diff.newContent;
                                        const isDeletedFile = diff.oldContent && !diff.newContent;
                                        
                                        return (
                                            <div 
                                                key={index} 
                                                className="border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden shadow-sm bg-white dark:bg-zinc-900"
                                            >
                                                {/* File Header */}
                                                <button 
                                                    type="button"
                                                    onClick={() => toggleDiff(diff.file)}
                                                    className="w-full text-left flex items-center justify-between px-4 py-3 bg-gray-50/80 dark:bg-zinc-900/80 border-b border-gray-200 dark:border-white/10 select-none cursor-pointer"
                                                    aria-expanded={isExpanded}
                                                    aria-label={`Toggle diff for ${diff.file}`}
                                                >
                                                    <span className="flex items-center gap-2 min-w-0">
                                                        {isExpanded ? <ChevronDown size={14} className="text-gray-500" /> : <ChevronRight size={14} className="text-gray-500" />}
                                                        <span className="text-xs font-bold font-mono text-gray-800 dark:text-gray-250 truncate">
                                                            {diff.file}
                                                        </span>
                                                        {isNewFile && (
                                                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-green-150 text-green-700 dark:bg-green-950/40 dark:text-green-400 uppercase tracking-wide shrink-0">
                                                                New File
                                                            </span>
                                                        )}
                                                        {isDeletedFile && (
                                                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-100 text-red-750 dark:bg-red-950/40 dark:text-red-400 uppercase tracking-wide shrink-0">
                                                                Deleted
                                                            </span>
                                                        )}
                                                    </span>
                                                    <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">
                                                        {isExpanded ? 'Collapse' : 'Expand'}
                                                    </span>
                                                </button>
                                                
                                                {/* ReactDiffViewer */}
                                                {isExpanded && (
                                                    <div className="overflow-x-auto text-[12px] font-mono">
                                                        <ReactDiffViewer
                                                            oldValue={typeof diff.oldContent === 'string' ? diff.oldContent : String(diff.oldContent || '')}
                                                            newValue={typeof diff.newContent === 'string' ? diff.newContent : String(diff.newContent || '')}
                                                            splitView={true}
                                                            useDarkTheme={isDarkMode}
                                                            leftTitle="Original"
                                                            rightTitle="Modified"
                                                            styles={{
                                                                variables: {
                                                                    dark: {
                                                                        diffViewerBackground: '#09090b',
                                                                        addedBackground: '#042f1a',
                                                                        addedColor: '#4ade80',
                                                                        removedBackground: '#4c0519',
                                                                        removedColor: '#f43f5e',
                                                                        wordAddedBackground: '#064e3b',
                                                                        wordRemovedBackground: '#881337',
                                                                    },
                                                                    light: {
                                                                        diffViewerBackground: '#ffffff',
                                                                        addedBackground: '#e6ffec',
                                                                        addedColor: '#24292e',
                                                                        removedBackground: '#ffeef0',
                                                                        removedColor: '#24292e',
                                                                    }
                                                                }
                                                            }}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Collapsible Developer Details */}
                <div className="mt-8 border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden bg-gray-50 dark:bg-zinc-900/20 shrink-0">
                    <div className="w-full flex items-center justify-between px-4 py-3 bg-transparent border-b border-gray-200 dark:border-white/5">
                        <button 
                            type="button"
                            onClick={() => setShowRaw(!showRaw)}
                            className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer"
                            aria-expanded={showRaw}
                            aria-label="Toggle developer details JSON"
                        >
                            {showRaw ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            Developer Details
                        </button>
                        {showRaw && (
                            <button 
                                type="button"
                                onClick={(e) => handleCopy(e, task)}
                                className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-white border border-gray-200 dark:bg-zinc-800 dark:border-white/10 rounded hover:bg-gray-50 dark:hover:bg-zinc-700 text-gray-600 dark:text-gray-300 shadow-sm transition-colors cursor-pointer"
                                aria-label="Copy developer details JSON"
                            >
                                <Copy size={12} />
                                {copied ? 'Copied!' : 'Copy JSON'}
                            </button>
                        )}
                    </div>
                    {showRaw && (
                        <pre className="text-[11px] whitespace-pre-wrap bg-gray-100 dark:bg-zinc-900 text-gray-800 dark:text-gray-350 p-4 overflow-x-auto border-t border-gray-200 dark:border-white/5 shadow-inner font-mono">
                            {JSON.stringify(task, null, 2)}
                        </pre>
                    )}
                </div>
            </div>
        );
    };

        return (
            <div className="flex h-full overflow-hidden bg-white dark:bg-zinc-950 w-full">
            <div className={`transition-all duration-300 flex flex-col border-r border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-zinc-900 overflow-hidden ${isTaskListFolded ? 'w-0 border-r-0' : 'w-[280px] md:w-[320px]'}`}>
                <div className="p-4 border-b border-gray-200 dark:border-white/10 bg-white/50 dark:bg-zinc-950/50 backdrop-blur-sm">
                    <div className="flex items-center justify-between gap-2 mb-4">
                        <div className="flex items-center gap-2">
                            <span className={`relative flex h-2.5 w-2.5`}>
                                {isRunning && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>}
                                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isRunning ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                            </span>
                            <span className="text-sm font-semibold text-gray-900 dark:text-white">{isRunning ? 'Loop is Running' : 'Loop is Idle'}</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsTaskListFolded(true)}
                            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-zinc-800 text-gray-500 dark:text-gray-400 cursor-pointer"
                            aria-label="Collapse task list sidebar"
                        >
                            <PanelLeftClose size={16} />
                        </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                        <button 
                            type="button"
                            className={`flex justify-center items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${isRunning ? 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-zinc-800 dark:text-gray-600' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm dark:bg-zinc-800 dark:border-white/10 dark:text-gray-200 dark:hover:bg-zinc-700'}`}
                            onClick={onStartAll} 
                            disabled={isRunning}
                            aria-label="Start all task loops"
                        >
                            <Play size={14} className="mr-1.5 text-green-500" /> 全部开始
                        </button>
                        <button 
                            type="button"
                            className={`flex justify-center items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer ${!isRunning ? 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-zinc-800 dark:text-gray-600' : 'bg-white border border-gray-200 text-red-650 hover:bg-red-50 shadow-sm dark:bg-zinc-800 dark:border-white/10 dark:text-red-400 dark:hover:bg-red-900/20'}`}
                            onClick={() => setShowStopAllConfirm(true)} 
                            disabled={!isRunning}
                            aria-label="Stop all task loops"
                        >
                            <Square size={14} className="mr-1.5 text-red-500" /> 全部停止
                        </button>
                    </div>
                    <button 
                        type="button"
                        className="flex w-full justify-center items-center px-3 py-1.5 rounded-md text-sm font-medium bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-zinc-800 dark:text-gray-200 dark:hover:bg-zinc-700 transition-colors shadow-sm cursor-pointer"
                        onClick={onTriggerLoop}
                        aria-label="Trigger single loop execution"
                    >
                        <Zap size={14} className="mr-1.5" /> Trigger Once
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {isLoadingTasks ? (
                        <div className="p-4 space-y-3 animate-pulse">
                            {[1, 2, 3, 4].map(n => (
                                <div key={n} className="p-3 border border-gray-150 dark:border-white/5 rounded-lg bg-white/40 dark:bg-zinc-800/40">
                                    <div className="h-4 bg-gray-250 dark:bg-zinc-700 rounded w-3/4 mb-2"></div>
                                    <div className="h-3 bg-gray-200 dark:bg-zinc-750 rounded w-1/2"></div>
                                </div>
                            ))}
                        </div>
                    ) : tasks.length === 0 ? (
                        <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                            <div className="text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">No active tasks</div>
                            <div className="text-xs leading-relaxed">Click "Trigger Once" to spawn a new agent task.</div>
                        </div>
                    ) : (
                        tasks.map(task => (
                            <button 
                                key={task.id} 
                                type="button"
                                onClick={() => onSelectTask(task.id)}
                                aria-label={`Select task: ${task.plan?.title || task.suggestion?.title || 'Untitled Task'}`}
                                className={`w-full text-left p-4 border-b border-gray-200 dark:border-white/10 cursor-pointer transition-colors ${activeTaskId === task.id ? 'bg-white dark:bg-zinc-950 border-l-4 border-l-blue-500' : 'hover:bg-gray-100 dark:hover:bg-zinc-800 border-l-4 border-l-transparent'}`}
                            >
                                <span className={`block text-sm mb-1.5 truncate ${activeTaskId === task.id ? 'font-semibold text-gray-900 dark:text-white' : 'font-medium text-gray-700 dark:text-gray-300'}`}>
                                    {task.plan?.title || task.suggestion?.title || 'Untitled Task'}
                                </span>
                                <span className="flex items-center text-xs font-medium">
                                    {task.status === 'plan_ready' ? (
                                        <><span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-2"></span><span className="text-blue-600 dark:text-blue-400">Awaiting Review</span></>
                                    ) : task.status === 'patch_ready' ? (
                                        <><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-2"></span><span className="text-emerald-600 dark:text-emerald-400 font-semibold">Patch Ready</span></>
                                    ) : task.status === 'coding' ? (
                                        <><span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mr-2 animate-pulse"></span><span className="text-indigo-600 dark:text-indigo-400">Coding...</span></>
                                    ) : task.status === 'failed' ? (
                                        <><span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-2"></span><span className="text-red-600 dark:text-red-400">Failed</span></>
                                    ) : task.status === 'done' ? (
                                        <><span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-2"></span><span className="text-green-600 dark:text-green-400">Completed</span></>
                                    ) : (
                                        <><span className="w-1.5 h-1.5 rounded-full bg-gray-400 mr-2"></span><span className="text-gray-500 dark:text-gray-400 capitalize">{task.status.replace('_', ' ')}</span></>
                                    )}
                                </span>
                            </button>
                        ))
                    )}
                </div>
            </div>
            
            {activeTask ? renderTaskDetails(activeTask) : (
                <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 dark:bg-zinc-950 text-gray-500 dark:text-gray-400 p-8 text-center relative">
                    {isTaskListFolded && (
                        <button
                            type="button"
                            onClick={() => setIsTaskListFolded(false)}
                            className="absolute top-4 left-4 p-1.5 rounded-lg border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500 dark:text-gray-400 cursor-pointer"
                            aria-label="Expand task list sidebar"
                        >
                            <PanelLeftOpen size={18} />
                        </button>
                    )}
                    <div className="p-6 bg-white dark:bg-zinc-900 rounded-full mb-6 shadow-sm border border-gray-100 dark:border-white/5">
                        <Zap size={32} className="text-gray-300 dark:text-gray-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">Select a task</h3>
                    <p className="text-sm max-w-sm leading-relaxed">Click on a task from the left sidebar to view its plan and progress.</p>
                </div>
            )}

            <ConfirmationModal
                isOpen={confirmStopTaskId !== null}
                title="Pause Agent Task"
                message="Are you sure you want to pause execution for this active task? You can resume or retry it later."
                confirmText="Pause Task"
                cancelText="Cancel"
                onConfirm={() => {
                    onStopTask(confirmStopTaskId);
                    setConfirmStopTaskId(null);
                }}
                onCancel={() => setConfirmStopTaskId(null)}
                isDestructive={true}
            />

            <ConfirmationModal
                isOpen={confirmRejectTaskId !== null}
                title="Reject Implementation Plan"
                message="Are you sure you want to reject this plan? The agent will discard this plan and attempt to rethink/redo the implementation."
                confirmText="Reject & Redo"
                cancelText="Cancel"
                onConfirm={() => {
                    onRejectTask(confirmRejectTaskId);
                    setConfirmRejectTaskId(null);
                }}
                onCancel={() => setConfirmRejectTaskId(null)}
                isDestructive={true}
            />

            <ConfirmationModal
                isOpen={showStopAllConfirm}
                title="Stop All Running Loops"
                message="Are you sure you want to stop all active task loops? This will interrupt any running agent processes immediately."
                confirmText="Stop All"
                cancelText="Cancel"
                onConfirm={() => {
                    onStopAll();
                    setShowStopAllConfirm(false);
                }}
                onCancel={() => setShowStopAllConfirm(false)}
                isDestructive={true}
            />
            <ConfirmationModal
                isOpen={confirmDeleteTaskId !== null}
                title="Delete Task History"
                message="Are you sure you want to delete this task? This will remove it from the active list. You can restore it later if needed."
                confirmText="Delete Task"
                cancelText="Cancel"
                onConfirm={() => {
                    onDeleteTask(confirmDeleteTaskId);
                    setConfirmDeleteTaskId(null);
                }}
                onCancel={() => setConfirmDeleteTaskId(null)}
                isDestructive={true}
            />
        </div>
    );
}
