import React, { useState, useRef } from 'react';
import { Send, Square, FolderOpen, Cpu, ShieldCheck, Play, ArrowRight, Sparkles, AlertCircle, RotateCcw } from 'lucide-react';
import ConfirmationModal from './ConfirmationModal';

export default function ChatPanel({
    messages,
    prompt,
    setPrompt,
    onSend,
    onStop,
    isStreaming,
    tokenConsumed,
    tokenTotal,
    tokenPercent,
    projectPath = '',
    onOpenProject,
    engine = 'gemini-cli',
    activeModel = '',
    requireApproval = true,
    loopState = 'idle',
    onRetry
}) {
    const [showStopConfirm, setShowStopConfirm] = useState(false);
    const textareaRef = useRef(null);

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSend();
        }
    };

    const handleQuickAction = (actionPrompt) => {
        setPrompt(actionPrompt);
        if (textareaRef.current) {
            textareaRef.current.focus();
        }
    };

    const handleStopClick = () => {
        setShowStopConfirm(true);
    };

    const handleConfirmStop = () => {
        onStop();
        setShowStopConfirm(false);
    };

    const quickActions = [
        {
            title: "Codebase Gap Analysis",
            description: "Perform a gap analysis of the codebase, search for architectural flaws, and propose improvements.",
            prompt: "Perform a gap analysis of the codebase, search for architectural flaws, and propose improvements."
        },
        {
            title: "Security & Vulnerability Audit",
            description: "Scan files in the workspace to identify security flaws, hardcoded credentials, and bug risks.",
            prompt: "Scan files in the workspace to identify security flaws, hardcoded credentials, and bug risks."
        },
        {
            title: "Generate Unit Tests",
            description: "Scan the codebase and write comprehensive unit tests for the primary logic files.",
            prompt: "Scan the codebase and write comprehensive unit tests for the primary logic files."
        }
    ];

    return (
        <div className="flex flex-col flex-1 h-full min-h-0 relative" id="chat-panel">
            <ConfirmationModal
                isOpen={showStopConfirm}
                title="Stop AI Generation"
                message="Are you sure you want to abort the current model generation? This will stop receiving the response immediately."
                confirmText="Stop Generation"
                cancelText="Continue"
                onConfirm={handleConfirmStop}
                onCancel={() => setShowStopConfirm(false)}
                isDestructive={true}
            />

            <div className="flex-1 overflow-y-auto p-4 md:p-8" id="chat-viewport">
                {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center min-h-full max-w-3xl mx-auto text-center px-4 py-8">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-500 mb-6 shadow-lg shadow-blue-500/20 flex items-center justify-center">
                            <Sparkles className="text-white size-8 animate-pulse" />
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">FSD Operational Workspace</h1>
                        <p className="text-gray-500 dark:text-gray-400 mb-8 text-sm md:text-base max-w-xl">
                            Your local autonomous software engineering agent is fully integrated with your workspace environment.
                        </p>
                        
                        {/* Status Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full mb-8">
                            <div className="p-4 rounded-xl border border-gray-200 dark:border-white/10 bg-white/50 dark:bg-white/5 backdrop-blur-sm text-left shadow-sm flex items-start gap-3">
                                <div className="p-2 bg-blue-50 dark:bg-blue-950/30 rounded-lg text-blue-500 shrink-0">
                                    <FolderOpen size={18} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h3 className="font-semibold text-gray-955 dark:text-white text-xs mb-1">Active Workspace</h3>
                                    {projectPath ? (
                                        <p className="text-xs text-gray-650 dark:text-gray-300 font-mono truncate">{projectPath}</p>
                                    ) : (
                                        <div className="flex flex-col items-start gap-1">
                                            <p className="text-xs text-red-500 dark:text-red-400 font-medium">No workspace selected</p>
                                            <button 
                                                onClick={onOpenProject}
                                                className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                                            >
                                                Select Workspace →
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="p-4 rounded-xl border border-gray-200 dark:border-white/10 bg-white/50 dark:bg-white/5 backdrop-blur-sm text-left shadow-sm flex items-start gap-3">
                                <div className="p-2 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg text-indigo-500 shrink-0">
                                    <Cpu size={18} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h3 className="font-semibold text-gray-955 dark:text-white text-xs mb-1">AI Engine & Model</h3>
                                    <p className="text-xs text-gray-650 dark:text-gray-300 truncate font-mono">
                                        {engine} / {activeModel || 'Default Model'}
                                    </p>
                                </div>
                            </div>

                            <div className="p-4 rounded-xl border border-gray-200 dark:border-white/10 bg-white/50 dark:bg-white/5 backdrop-blur-sm text-left shadow-sm flex items-start gap-3">
                                <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg text-emerald-500 shrink-0">
                                    <ShieldCheck size={18} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h3 className="font-semibold text-gray-955 dark:text-white text-xs mb-1">Safety Level</h3>
                                    <p className="text-xs text-gray-650 dark:text-gray-300">
                                        {requireApproval ? "Manual Confirmation Required" : "Auto-Pilot Execution"}
                                    </p>
                                </div>
                            </div>

                            <div className="p-4 rounded-xl border border-gray-200 dark:border-white/10 bg-white/50 dark:bg-white/5 backdrop-blur-sm text-left shadow-sm flex items-start gap-3">
                                <div className="p-2 bg-amber-50 dark:bg-amber-950/30 rounded-lg text-amber-500 shrink-0">
                                    <Play size={18} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h3 className="font-semibold text-gray-955 dark:text-white text-xs mb-1">Agent Loop Status</h3>
                                    <div className="flex items-center text-xs text-gray-650 dark:text-gray-300">
                                        {loopState === 'running' ? (
                                            <>
                                                <span className="relative flex h-2 w-2 mr-2">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                                </span>
                                                <span className="text-green-600 dark:text-green-400 font-medium animate-pulse">Running</span>
                                            </>
                                        ) : (
                                            <>
                                                <span className="w-2 h-2 rounded-full bg-gray-400 mr-2"></span>
                                                <span>Idle</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Quick Prompts */}
                        <div className="w-full text-left">
                            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 px-1">Quick Starter Prompts</h3>
                            <div className="grid grid-cols-1 gap-3">
                                {quickActions.map((action, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => handleQuickAction(action.prompt)}
                                        className="w-full p-3 text-left rounded-xl border border-gray-200 dark:border-white/10 hover:border-blue-500 dark:hover:border-blue-500/50 bg-white/40 dark:bg-white/5 hover:bg-blue-50/10 dark:hover:bg-blue-950/10 transition-all flex justify-between items-center group cursor-pointer"
                                    >
                                        <div className="pr-4">
                                            <h4 className="font-medium text-gray-900 dark:text-white text-xs md:text-sm mb-0.5">{action.title}</h4>
                                            <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-1">{action.description}</p>
                                        </div>
                                        <ArrowRight size={14} className="text-gray-500 dark:text-gray-400 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col gap-6 max-w-3xl mx-auto pb-6">
                        {messages.map((msg, idx) => (
                            <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                                <div className={`flex shrink-0 items-center justify-center w-8 h-8 rounded-full text-xs font-semibold shadow-sm ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-zinc-800 text-gray-800 dark:text-gray-200'}`}>
                                    {msg.role === 'user' ? 'U' : 'M'}
                                </div>
                                <div className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} max-w-[85%]`}>
                                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 ml-1 mr-1">
                                        {msg.role === 'user' ? 'You' : 'Model'}
                                    </div>
                                    <div className={`text-sm leading-relaxed px-4 py-3 rounded-2xl shadow-sm ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-white dark:bg-zinc-800 text-gray-800 dark:text-gray-200 border border-gray-100 dark:border-white/5 rounded-tl-sm'}`}>
                                        {msg.isError ? (
                                            <div className="flex flex-col gap-3 min-w-[280px] max-w-full">
                                                <div className="flex items-start gap-2.5 text-red-650 dark:text-red-400">
                                                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-500" />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-semibold text-sm">Generation Failed</div>
                                                        <div className="text-xs mt-1 text-red-500 dark:text-red-450 break-words font-mono whitespace-pre-wrap">{msg.error}</div>
                                                    </div>
                                                </div>
                                                <div className="flex justify-end border-t border-red-100 dark:border-red-900/30 pt-2 mt-1">
                                                    <button 
                                                        onClick={() => {
                                                            const prevUserMsg = messages[idx - 1];
                                                            if (prevUserMsg && prevUserMsg.role === 'user') {
                                                                onRetry && onRetry(prevUserMsg.content);
                                                            }
                                                        }}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-700 dark:text-red-300 transition-colors cursor-pointer"
                                                    >
                                                        <RotateCcw size={12} />
                                                        <span>Retry Request</span>
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="whitespace-pre-wrap">{msg.content}</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <footer className="shrink-0 p-4 border-t border-gray-200 dark:border-white/10 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md">
                <div className="max-w-3xl mx-auto w-full">
                    {tokenConsumed > 0 && (
                        <div className="flex flex-col mb-3">
                            <div className="flex justify-between text-[10px] text-gray-500 dark:text-gray-400 mb-1.5 font-medium px-1">
                                <span>Tokens Consumed: {tokenConsumed} / {tokenTotal}</span>
                                <span>Context Headroom: {tokenPercent}% remaining</span>
                            </div>
                            <div className="h-1 w-full bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500 dark:bg-blue-600 transition-all duration-300" style={{ width: `${100 - tokenPercent}%` }}></div>
                            </div>
                        </div>
                    )}

                    <div className="relative flex items-end gap-2 bg-white dark:bg-zinc-900 border border-gray-300 dark:border-white/10 rounded-xl shadow-sm focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all p-1.5">
                        <textarea 
                            ref={textareaRef}
                            className="flex-1 max-h-48 min-h-[44px] bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none resize-none py-2.5 px-3 leading-relaxed" 
                            rows="1" 
                            placeholder="Ask FSD a question or direct a coding task... (Enter to submit, Shift+Enter for new line)"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            onKeyDown={handleKeyDown}
                        ></textarea>
                        
                        <div className="flex shrink-0 items-center gap-1.5 p-1">
                            {isStreaming && (
                                <button className="flex items-center justify-center h-8 px-3 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 transition-colors text-xs font-medium cursor-pointer" onClick={handleStopClick} title="Abort active model generation execution">
                                    <Square size={14} className="mr-1.5" /> Stop
                                </button>
                            )}
                            <button 
                                className="flex items-center justify-center h-8 w-8 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer" 
                                onClick={onSend} 
                                disabled={isStreaming || !prompt.trim()}
                            >
                                <Send size={14} />
                            </button>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}

