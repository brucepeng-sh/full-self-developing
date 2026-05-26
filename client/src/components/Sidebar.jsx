import React, { useState } from 'react';
import { 
    FolderOpen, 
    PanelLeftClose,
    PanelLeftOpen,
    Plus,
    X,
    MessageSquare,
    RefreshCcw,
    ChevronDown,
    ChevronRight,
    Settings,
    Sparkles,
    Trash2,
    RotateCcw
} from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import ConfirmationModal from './ConfirmationModal';

function classNames(...classes) {
  return classes.filter(Boolean).join(' ')
}

export default function Sidebar({
    isSidebarOpen,
    toggleSidebar,
    activeTab,
    onSwitchTab,
    onNewSession,
    onOpenProject,
    projectPath,
    onCloseProject,
    engine,
    setEngine,
    models,
    sessions,
    trashSessions = [],
    isLoadingSessions,
    activeSessionId,
    onSelectSession,
    onDeleteSession,
    onRestoreSession,
    rpmActive,
    rpdActive,
    serverConnected,
    proxyEnabled,
    mcpToolsCount
}) {
    const { settings } = useSettings();
    const [isHistoryOpen, setIsHistoryOpen] = useState(true);
    const [isTrashOpen, setIsTrashOpen] = useState(false);
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);
    
    const displayModel = settings?.ai?.model || 'AI Model';

    if (!isSidebarOpen) {
        return (
            <div className="flex h-full w-16 shrink-0 flex-col items-center border-r border-gray-200 bg-[#f9f8f6] pt-5 dark:bg-zinc-900 dark:border-white/10 transition-all">
                <button 
                    type="button"
                    className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-[#ecece5] hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white" 
                    onClick={toggleSidebar} 
                    title="Expand Sidebar"
                    aria-label="Expand Sidebar"
                >
                    <PanelLeftOpen className="size-5" />
                </button>
            </div>
        );
    }

    return (
        <div className="flex h-full w-72 shrink-0 flex-col transition-all border-r border-gray-200 bg-[#f9f8f6] dark:bg-zinc-900 dark:border-white/10">
            {/* TOP FIXED SECTION */}
            <div className="flex shrink-0 flex-col px-3 pb-2">
                <div className="flex h-14 shrink-0 items-center justify-between px-2 mt-1">
                    <div className="flex items-center gap-x-2 text-gray-900 dark:text-white">
                        <span className="text-[22px] font-serif tracking-tight font-medium">FSD</span>
                    </div>
                    <div className="flex items-center gap-x-1">
                        <button 
                            type="button"
                            className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-[#ecece5] hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white" 
                            onClick={toggleSidebar} 
                            title="Collapse Sidebar"
                            aria-label="Collapse Sidebar"
                        >
                            <PanelLeftClose className="size-5" />
                        </button>
                    </div>
                </div>

                <ul role="list" className="flex flex-col gap-y-0.5 mt-2">
                    <li className="relative group">
                        <button 
                            type="button"
                            className={classNames(
                                activeTab === 'chat' ? 'bg-[#ecece5] text-gray-900 dark:bg-white/10 dark:text-white pr-8' : 'text-gray-800 hover:bg-[#ecece5] dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white',
                                'flex w-full items-center gap-x-2.5 rounded-md py-1.5 px-2 text-[14px] font-normal text-left'
                            )}
                            onClick={() => onSwitchTab('chat')}
                        >
                            <MessageSquare className={classNames(
                                activeTab === 'chat' ? 'text-gray-900 dark:text-white' : 'text-gray-600 group-hover:text-gray-900 dark:text-gray-400 dark:group-hover:text-white',
                                'size-[18px] shrink-0'
                            )} />
                            Chat
                        </button>
                        {activeTab === 'chat' && (
                            <button 
                                type="button"
                                aria-label="New Chat"
                                title="New Chat"
                                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 hover:bg-black/5 dark:hover:bg-white/20 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white cursor-pointer z-10"
                                onClick={(e) => { e.stopPropagation(); onNewSession(); }}
                            >
                                <Plus className="size-[16px]" />
                            </button>
                        )}
                    </li>
                    <li>
                        <button 
                            type="button"
                            className={classNames(
                                activeTab === 'loop' ? 'bg-[#ecece5] text-gray-900 dark:bg-white/10 dark:text-white' : 'text-gray-800 hover:bg-[#ecece5] dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white',
                                'group flex w-full items-center gap-x-2.5 rounded-md py-1.5 px-2 text-[14px] font-normal'
                            )}
                            onClick={() => onSwitchTab('loop')}
                        >
                            <RefreshCcw className={classNames(
                                activeTab === 'loop' ? 'text-gray-900 dark:text-white' : 'text-gray-600 group-hover:text-gray-900 dark:text-gray-400 dark:group-hover:text-white',
                                'size-[18px] shrink-0'
                            )} />
                            FSD
                        </button>
                    </li>
                </ul>
            </div>

            {/* MIDDLE SCROLLABLE SECTION (History) */}
            <div className="flex min-h-0 flex-1 flex-col px-3 overflow-y-auto">
                {activeTab !== 'loop' && (
                    <div className="flex flex-col flex-1">
                        <button 
                            type="button"
                            className="flex items-center gap-x-1 text-[11px] font-medium text-gray-500 dark:text-gray-400 px-2 py-1 mb-1 hover:text-gray-700 dark:hover:text-gray-200 text-left w-full"
                            onClick={() => setIsHistoryOpen(!isHistoryOpen)}
                            aria-label="Toggle chat history list"
                        >
                            {isHistoryOpen ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
                            History
                        </button>
                        
                        {isHistoryOpen && (
                            <ul role="list" className="flex-1 space-y-0.5 pb-4">
                                {isLoadingSessions ? (
                                    <div className="space-y-3.5 px-2 animate-pulse mt-2">
                                        {[1, 2, 3].map(n => (
                                            <div key={n} className="h-4.5 bg-gray-200 dark:bg-zinc-800/60 rounded w-11/12"></div>
                                        ))}
                                    </div>
                                ) : sessions.length === 0 ? (
                                    <li className="px-2 pt-2 text-center text-[13px] italic text-gray-400 dark:text-gray-500">No active sessions</li>
                                ) : (
                                    sessions.map(s => {
                                        const isCurrent = activeSessionId === s.id;
                                        return (
                                            <li key={s.id} className="relative group">
                                                <button
                                                    type="button"
                                                    className={classNames(
                                                        isCurrent ? 'bg-[#ecece5] text-gray-900 dark:bg-white/10 dark:text-white' : 'text-gray-800 hover:bg-[#ecece5] dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white',
                                                        'flex w-full items-center justify-between gap-x-2 rounded-md py-1.5 px-2 text-[14px] font-normal transition-colors text-left pr-8'
                                                    )}
                                                    onClick={() => onSelectSession(s.id)}
                                                >
                                                    <span className="truncate">{s.title}</span>
                                                </button>
                                                <button 
                                                    type="button"
                                                    aria-label={`Delete chat session ${s.title}`}
                                                    className={classNames(
                                                        isCurrent ? 'block' : 'hidden group-hover:block',
                                                        'absolute right-1 top-1/2 -translate-y-1/2 rounded p-1 hover:bg-black/5 dark:hover:bg-white/20 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white cursor-pointer z-10'
                                                    )}
                                                    onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(s.id); }}
                                                >
                                                    <X className="size-3.5" />
                                                </button>
                                            </li>
                                        );
                                    })
                                )}
                            </ul>
                        )}
                        
                        {/* TRASH SECTION */}
                        <div className="mt-4 border-t border-gray-200 dark:border-white/5 pt-3">
                            <button 
                                type="button"
                                className="flex items-center gap-x-1 text-[11px] font-medium text-gray-500 dark:text-gray-400 px-2 py-1 mb-1 hover:text-gray-700 dark:hover:text-gray-200 text-left w-full cursor-pointer"
                                onClick={() => setIsTrashOpen(!isTrashOpen)}
                                aria-label="Toggle trash sessions list"
                            >
                                {isTrashOpen ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
                                <Trash2 className="size-3 mr-1" /> Trash ({trashSessions.length})
                            </button>
                            
                            {isTrashOpen && (
                                <ul role="list" className="space-y-0.5 pb-2">
                                    {trashSessions.length === 0 ? (
                                        <li className="px-2 pt-1 text-center text-[12px] italic text-gray-405 dark:text-gray-500">Trash is empty</li>
                                    ) : (
                                        trashSessions.map(s => (
                                            <li key={s.id} className="relative group">
                                                <div className="flex w-full items-center justify-between gap-x-2 rounded-md py-1.5 px-2 text-[13px] text-gray-500 dark:text-gray-400 text-left pr-8 select-none">
                                                    <span className="truncate" title={s.title}>{s.title}</span>
                                                </div>
                                                <button 
                                                    type="button"
                                                    aria-label={`Restore chat session ${s.title}`}
                                                    title="Restore Session"
                                                    className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1 hover:bg-black/5 dark:hover:bg-white/20 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white cursor-pointer z-10"
                                                    onClick={(e) => { e.stopPropagation(); onRestoreSession(s.id); }}
                                                >
                                                    <RotateCcw className="size-3.5" />
                                                </button>
                                            </li>
                                        ))
                                    )}
                                </ul>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* BOTTOM FIXED SECTION */}
            <div className="flex shrink-0 flex-col px-3 pt-4 pb-4 border-t border-gray-200 dark:border-white/10 bg-[#f9f8f6] dark:bg-zinc-900">
                <ul role="list" className="flex flex-col gap-y-0.5">
                    <li className="relative group">
                        <button 
                            type="button"
                            className={classNames(
                                projectPath ? 'bg-[#ecece5] text-gray-900 dark:bg-white/10 dark:text-white pr-8' : 'text-gray-800 hover:bg-[#ecece5] dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white',
                                'flex w-full items-center gap-x-2.5 rounded-md py-1.5 px-2 text-[14px] font-normal text-left'
                            )}
                            onClick={onOpenProject}
                        >
                            <FolderOpen aria-hidden="true" className={classNames(
                                projectPath ? 'text-gray-900 dark:text-white' : 'text-gray-600 group-hover:text-gray-900 dark:text-gray-400 dark:group-hover:text-white',
                                'size-[18px] shrink-0'
                            )} />
                            <span className="truncate flex-1">
                                {projectPath ? projectPath : 'Open Project'}
                            </span>
                        </button>
                        {projectPath && (
                            <button 
                                type="button"
                                aria-label="Close project"
                                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 hover:bg-black/5 dark:hover:bg-white/20 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white cursor-pointer z-10"
                                onClick={(e) => { e.stopPropagation(); onCloseProject(); }}
                            >
                                <X className="size-4 shrink-0" />
                            </button>
                        )}
                    </li>
                    
                    <li>
                        <button 
                            type="button"
                            className="group flex w-full items-center gap-x-2.5 rounded-md py-1.5 px-2 text-[14px] font-normal text-gray-800 hover:bg-[#ecece5] dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white transition-colors"
                            onClick={() => onSwitchTab('settings', 'ai')}
                        >
                            <Sparkles aria-hidden="true" className="size-[18px] shrink-0 text-gray-600 group-hover:text-gray-900 dark:text-gray-400 dark:group-hover:text-white" />
                            <span className="truncate flex-1 text-left" title={displayModel}>
                                {displayModel}
                            </span>
                        </button>
                    </li>

                    <li>
                        <button 
                            type="button"
                            className={classNames(
                                activeTab === 'settings' ? 'bg-[#ecece5] text-gray-900 dark:bg-white/10 dark:text-white' : 'text-gray-800 hover:bg-[#ecece5] dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white',
                                'group flex w-full items-center gap-x-2.5 rounded-md py-1.5 px-2 text-[14px] font-normal'
                            )}
                            onClick={() => onSwitchTab('settings')}
                        >
                            <Settings aria-hidden="true" className={classNames(
                                activeTab === 'settings' ? 'text-gray-900 dark:text-white' : 'text-gray-600 group-hover:text-gray-900 dark:text-gray-400 dark:group-hover:text-white',
                                'size-[18px] shrink-0'
                            )} />
                            Setting
                        </button>
                    </li>
                </ul>
            </div>
            
            <ConfirmationModal
                isOpen={confirmDeleteId !== null}
                title="Delete Chat Session"
                message="Are you sure you want to delete this chat session? This will remove all message history for this session permanently."
                confirmText="Delete"
                cancelText="Cancel"
                onConfirm={() => {
                    onDeleteSession(confirmDeleteId);
                    setConfirmDeleteId(null);
                }}
                onCancel={() => setConfirmDeleteId(null)}
                isDestructive={true}
            />
        </div>
    );
}

