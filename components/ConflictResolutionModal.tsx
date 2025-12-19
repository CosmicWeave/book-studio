
import React, { useState, useEffect } from 'react';
import { conflictService, ConflictResolutionStrategy } from '../services/conflictService';
import { ICONS } from '../constants';
import Icon from './Icon';

const ConflictResolutionModal: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [diff, setDiff] = useState<any>(null);
    const [remoteDate, setRemoteDate] = useState<Date | null>(null);
    const [localDate, setLocalDate] = useState<Date | null>(null);

    useEffect(() => {
        const unsubscribe = conflictService.subscribe(state => {
            setIsOpen(state.isConflict);
            if (state.isConflict) {
                setDiff(conflictService.getDiffSummary());
                setRemoteDate(new Date(state.remoteTimestamp));
                setLocalDate(new Date(state.localTimestamp));
            }
        });
        return unsubscribe;
    }, []);

    const handleResolve = (strategy: ConflictResolutionStrategy) => {
        conflictService.resolve(strategy);
    };

    if (!isOpen || !diff) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[10005] p-4 animate-fade-in">
            <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-2xl w-full max-w-4xl border border-red-200 dark:border-red-900 overflow-hidden flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="p-6 bg-red-50 dark:bg-red-900/20 border-b border-red-100 dark:border-red-800 flex items-center gap-4">
                    <div className="p-3 bg-red-100 dark:bg-red-800/50 rounded-full text-red-600 dark:text-red-200">
                        <Icon name="ALERT_TRIANGLE" className="w-8 h-8" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-red-700 dark:text-red-300">Sync Conflict Detected</h2>
                        <p className="text-red-600 dark:text-red-400 text-sm mt-1">
                            The server has a newer version of your data than the last time you synced.
                        </p>
                    </div>
                </div>

                {/* Comparison Body */}
                <div className="flex-grow overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-8 relative">
                    
                    {/* Local Column */}
                    <div className="space-y-4">
                        <div className="bg-zinc-100 dark:bg-zinc-700/50 p-4 rounded-xl border border-zinc-200 dark:border-zinc-600">
                            <h3 className="font-bold text-lg text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
                                <Icon name="EDIT" className="w-5 h-5 text-indigo-500" />
                                On This Device (Local)
                            </h3>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                                Last Active: {localDate?.toLocaleString()}
                            </p>
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm p-2 bg-zinc-50 dark:bg-zinc-800 rounded border border-zinc-200 dark:border-zinc-700">
                                <span>Total Books:</span>
                                <span className="font-bold">{diff.localCount}</span>
                            </div>
                            {diff.newerInLocal.length > 0 && (
                                <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                                    <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase mb-2">Newer Locally ({diff.newerInLocal.length})</p>
                                    <ul className="text-sm space-y-1 list-disc list-inside">
                                        {diff.newerInLocal.map((b: any) => (
                                            <li key={b.id} className="truncate">{b.topic}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {diff.booksOnlyInLocal.length > 0 && (
                                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                                    <p className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase mb-2">Only on this device ({diff.booksOnlyInLocal.length})</p>
                                    <ul className="text-sm space-y-1 list-disc list-inside">
                                        {diff.booksOnlyInLocal.map((b: any) => (
                                            <li key={b.id} className="truncate">{b.topic}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="hidden md:block absolute left-1/2 top-6 bottom-6 w-px bg-zinc-200 dark:bg-zinc-700"></div>

                    {/* Remote Column */}
                    <div className="space-y-4">
                        <div className="bg-zinc-100 dark:bg-zinc-700/50 p-4 rounded-xl border border-zinc-200 dark:border-zinc-600">
                            <h3 className="font-bold text-lg text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
                                <Icon name="CLOUD" className="w-5 h-5 text-sky-500" />
                                In The Cloud (Remote)
                            </h3>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                                Last Active: {remoteDate?.toLocaleString()}
                            </p>
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm p-2 bg-zinc-50 dark:bg-zinc-800 rounded border border-zinc-200 dark:border-zinc-700">
                                <span>Total Books:</span>
                                <span className="font-bold">{diff.remoteCount}</span>
                            </div>
                            {diff.newerInRemote.length > 0 && (
                                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                                    <p className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase mb-2">Newer on Server ({diff.newerInRemote.length})</p>
                                    <ul className="text-sm space-y-1 list-disc list-inside">
                                        {diff.newerInRemote.map((b: any) => (
                                            <li key={b.id} className="truncate">{b.topic}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {diff.booksOnlyInRemote.length > 0 && (
                                <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg">
                                    <p className="text-xs font-bold text-indigo-700 dark:text-indigo-400 uppercase mb-2">Only on Server ({diff.booksOnlyInRemote.length})</p>
                                    <ul className="text-sm space-y-1 list-disc list-inside">
                                        {diff.booksOnlyInRemote.map((b: any) => (
                                            <li key={b.id} className="truncate">{b.topic}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-6 bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row gap-4 justify-between items-center">
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 italic">
                        Tip: Smart Merge combines books from both sides, keeping the latest version of each book.
                    </div>
                    <div className="flex gap-3 w-full sm:w-auto">
                        <button 
                            onClick={() => handleResolve('use_local')}
                            className="flex-1 sm:flex-none px-4 py-2 rounded-lg border border-red-300 dark:border-red-800 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm font-semibold transition-colors"
                        >
                            Overwrite Server
                        </button>
                        <button 
                            onClick={() => handleResolve('use_remote')}
                            className="flex-1 sm:flex-none px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-sm font-semibold transition-colors"
                        >
                            Overwrite Local
                        </button>
                        <button 
                            onClick={() => handleResolve('smart_merge')}
                            className="flex-1 sm:flex-none px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-md transition-colors flex items-center justify-center gap-2"
                        >
                            <Icon name="SYNTHESIZE" className="w-4 h-4" />
                            Smart Merge
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConflictResolutionModal;
