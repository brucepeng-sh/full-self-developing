import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

export default function ConfirmationModal({
    isOpen,
    title,
    message,
    confirmText,
    cancelText,
    onConfirm,
    onCancel,
    isDestructive = true
}) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-[2000] flex items-center justify-center backdrop-blur-sm p-4">
            <div className="w-full max-w-md flex flex-col rounded-xl overflow-hidden border border-gray-200 dark:border-white/10 bg-white/95 dark:bg-zinc-950/95 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150">
                <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-zinc-900/20">
                    <div className="flex items-center gap-2 font-semibold text-gray-900 dark:text-white">
                        <AlertTriangle size={18} className={isDestructive ? 'text-red-500 dark:text-red-400' : 'text-yellow-500 dark:text-yellow-400'} />
                        <span>{title}</span>
                    </div>
                    <button 
                        type="button"
                        onClick={onCancel} 
                        aria-label="Close modal"
                        className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>

                <div className="p-5 flex-1 text-sm text-gray-650 dark:text-gray-300 leading-relaxed">
                    {message}
                </div>

                <div className="flex justify-end gap-2 p-4 border-t border-gray-200 dark:border-white/10 bg-gray-50/30 dark:bg-zinc-900/10">
                    <button 
                        type="button"
                        className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 dark:border-zinc-700 text-gray-700 bg-white hover:bg-gray-50 dark:bg-zinc-800 dark:text-gray-300 dark:hover:bg-zinc-700 transition-colors" 
                        onClick={onCancel}
                    >
                        {cancelText || 'Cancel'}
                    </button>
                    <button 
                        type="button"
                        className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors ${
                            isDestructive 
                                ? 'bg-red-650 hover:bg-red-750 dark:bg-red-600 dark:hover:bg-red-700' 
                                : 'bg-blue-650 hover:bg-blue-750 dark:bg-blue-600 dark:hover:bg-blue-700'
                        }`}
                        onClick={onConfirm}
                    >
                        {confirmText || 'Confirm'}
                    </button>
                </div>
            </div>
        </div>
    );
}
