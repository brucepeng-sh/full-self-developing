import React, { useState, useEffect } from 'react';
import { Folder, ChevronUp, X, Check } from 'lucide-react';
import { apiFetch } from '../api';

export default function FolderPicker({
    isOpen,
    onClose,
    onSelect,
    initialPath
}) {
    const [currentPath, setCurrentPath] = useState('/');
    const [inputPath, setInputPath] = useState('/');
    const [parentPath, setParentPath] = useState(null);
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedPath, setSelectedPath] = useState(null);
    const [currentGit, setCurrentGit] = useState(false);
    const [currentPkg, setCurrentPkg] = useState(false);
    const [error, setError] = useState(null);

    const loadDirectory = async (path) => {
        setLoading(true);
        setError(null);
        try {
            const data = await apiFetch(`/api/fs/browse?path=${encodeURIComponent(path)}`);
            setCurrentPath(data.path);
            setInputPath(data.path);
            setParentPath(data.parentPath);
            setEntries(data.entries || []);
            setCurrentGit(!!data.hasGit);
            setCurrentPkg(!!data.hasPackageJson);
            setSelectedPath(null); // Reset selection on navigate
        } catch (err) {
            console.error('Failed to load directory', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const initPath = async () => {
            if (isOpen) {
                let startPath = initialPath;
                if (!startPath) {
                    try {
                        const data = await apiFetch('/api/workspace');
                        startPath = data.workspace || data.defaultPath || '/';
                    } catch (e) {
                        startPath = '/';
                    }
                }
                loadDirectory(startPath);
            }
        };
        initPath();
    }, [isOpen, initialPath]);

    if (!isOpen) return null;

    // Find selected entry to read its badges, or fallback to current directory
    const selectedEntry = entries.find(e => e.path === selectedPath);
    const hasGitBadge = selectedPath ? selectedEntry?.hasGit : (currentPath !== '/' && currentGit);
    const hasPkgBadge = selectedPath ? selectedEntry?.hasPackageJson : (currentPath !== '/' && currentPkg);
    const pathToOpen = selectedPath || (currentPath !== '/' ? currentPath : null);

    return (
        <div id="folder-picker-overlay" role="dialog" aria-modal="true" aria-label="Select project folder" className="fixed inset-0 bg-black/50 z-[1000] flex items-center justify-center backdrop-blur-sm p-4">
            <div id="folder-picker-modal" className="w-full max-w-[600px] h-full max-h-[85vh] md:max-h-[500px] flex flex-col rounded-xl overflow-hidden border border-gray-200 dark:border-white/10 bg-white/90 dark:bg-zinc-950/90 shadow-2xl backdrop-blur-md">
                <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-white/10">
                    <div className="flex items-center gap-2 font-medium text-gray-900 dark:text-white">
                        <Folder size={16} />
                        <span>Select Project Folder</span>
                    </div>
                    <button 
                        type="button" 
                        onClick={onClose} 
                        aria-label="Close folder picker"
                        className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>

                <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-zinc-900/50 border-b border-gray-200 dark:border-white/10">
                    <button 
                        type="button"
                        onClick={() => parentPath && loadDirectory(parentPath)} 
                        disabled={!parentPath}
                        aria-label="Go to parent directory"
                        className={`flex items-center gap-1 px-2.5 py-1 rounded border shrink-0 ${parentPath ? 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-800 cursor-pointer' : 'border-gray-200 dark:border-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-50'} transition-colors`}
                    >
                        <ChevronUp size={14} /> <span className="text-xs">Go Up</span>
                    </button>
                    <div className="flex-1 flex items-center gap-1.5">
                        <input
                            type="text"
                            value={inputPath}
                            onChange={(e) => setInputPath(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    loadDirectory(inputPath);
                                }
                            }}
                            className="text-xs font-mono flex-1 px-2.5 py-1 rounded border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="Paste or enter absolute path..."
                        />
                        <button
                            type="button"
                            onClick={() => loadDirectory(inputPath)}
                            className="px-2.5 py-1 text-xs font-semibold text-gray-750 hover:text-gray-950 bg-white dark:bg-zinc-800 dark:text-gray-250 dark:hover:text-white border border-gray-305 dark:border-zinc-705 rounded hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                            title="Go to path"
                            aria-label="Go to path"
                        >
                            Go
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="mx-4 mt-3 p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/50 text-xs text-red-655 dark:text-red-400 flex items-start justify-between gap-2 shadow-sm shrink-0">
                        <span className="flex-1 whitespace-pre-wrap font-medium">{error}</span>
                        <button 
                            type="button"
                            onClick={() => setError(null)} 
                            aria-label="Dismiss error"
                            className="shrink-0 p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-400 hover:text-red-605 dark:text-red-500 dark:hover:text-red-400 transition-colors cursor-pointer"
                        >
                            <X size={14} />
                        </button>
                    </div>
                )}

                <div className="flex-1 overflow-y-auto p-2">
                    {loading ? (
                        <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">⏳ Loading...</div>
                    ) : entries.length === 0 ? (
                        <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">Folder is empty</div>
                    ) : (
                        entries.map(entry => (
                            <button 
                                type="button"
                                key={entry.path}
                                onClick={() => setSelectedPath(entry.path)}
                                onDoubleClick={() => loadDirectory(entry.path)}
                                className={`w-full text-left flex items-center justify-between p-2 rounded-md border ${selectedPath === entry.path ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' : 'border-transparent hover:bg-gray-100 dark:hover:bg-zinc-800'} transition-colors mb-0.5`}
                            >
                                <span className="flex items-center gap-2 min-w-0">
                                    <Folder size={16} className={selectedPath === entry.path ? 'text-blue-500' : 'text-gray-400 dark:text-gray-500'} />
                                    <span className="text-sm text-gray-800 dark:text-gray-200 truncate">{entry.name}</span>
                                </span>
                                <span className="flex gap-1.5 shrink-0 select-none">
                                    {entry.hasGit && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded border border-purple-500/20 bg-purple-500/5 text-purple-600 dark:text-purple-400 font-mono font-semibold">git</span>
                                    )}
                                    {entry.hasPackageJson && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded border border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 font-mono font-semibold">npm</span>
                                    )}
                                </span>
                            </button>
                        ))
                    )}
                </div>

                <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-zinc-900/50 border-t border-gray-200 dark:border-white/10">
                    <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">Selected:</span>
                    <span className={`text-xs font-mono flex-1 whitespace-nowrap overflow-hidden text-ellipsis ${pathToOpen ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400 dark:text-gray-650'}`}>
                        {pathToOpen || '(None)'}
                    </span>
                    <div className="flex gap-1.5 shrink-0 select-none">
                        {hasGitBadge && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded border border-purple-500/20 bg-purple-500/5 text-purple-600 dark:text-purple-400 font-mono font-semibold">git</span>
                        )}
                        {hasPkgBadge && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded border border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 font-mono font-semibold">npm</span>
                        )}
                    </div>
                </div>

                <div className="flex justify-end gap-2 p-4 border-t border-gray-200 dark:border-white/10">
                    <button 
                        type="button"
                        className="px-4 py-1.5 rounded-md text-sm font-medium border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 dark:border-gray-600 dark:bg-zinc-800 dark:text-gray-300 dark:hover:bg-zinc-700 transition-colors" 
                        onClick={onClose}
                    >
                        Cancel
                    </button>
                    <button 
                        type="button"
                        className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium text-white transition-colors ${pathToOpen ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-400 cursor-not-allowed opacity-50 dark:bg-blue-800'}`}
                        onClick={() => onSelect(pathToOpen)}
                        disabled={!pathToOpen}
                    >
                        <Check size={14} /> Open
                    </button>
                </div>
            </div>
        </div>
    );
}
