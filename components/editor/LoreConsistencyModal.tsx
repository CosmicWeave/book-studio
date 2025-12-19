
import React from 'react';
import { LoreInconsistency } from '../../types';
import Icon from '../Icon';

interface LoreConsistencyModalProps {
    isOpen: boolean;
    onClose: () => void;
    results: LoreInconsistency[] | null;
    isLoading: boolean;
    onApplySuggestion: (original: string, replacement: string) => void;
}

const LoreConsistencyModal: React.FC<LoreConsistencyModalProps> = ({ isOpen, onClose, results, isLoading, onApplySuggestion }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[51] p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-4xl max-h-[90vh] flex flex-col border border-gray-200 dark:border-gray-700" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                        <Icon name="BRAIN" className="w-6 h-6 text-indigo-500" />
                        Lore Consistency Check
                    </h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700" aria-label="Close modal">
                        <Icon name="CLOSE" className="w-6 h-6" />
                    </button>
                </div>

                <div className="overflow-y-auto pr-2 -mr-2 flex-grow">
                    {isLoading ? (
                         <div className="flex flex-col items-center justify-center p-8 min-h-[300px]">
                            <div className="w-12 h-12 border-4 border-t-indigo-500 border-gray-200 rounded-full animate-spin"></div>
                            <p className="mt-4 font-semibold text-gray-700 dark:text-gray-300">Checking Knowledge Base...</p>
                        </div>
                    ) : results && results.length > 0 ? (
                        <div className="space-y-4">
                            {results.map((item, index) => (
                                <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                                    <div className="bg-zinc-50 dark:bg-zinc-700/30 p-3 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
                                        <span className="font-bold text-indigo-600 dark:text-indigo-400">Conflict with: {item.knowledgeSheetName}</span>
                                    </div>
                                    <div className="p-4 space-y-3">
                                        <div>
                                            <p className="text-xs font-bold text-zinc-500 uppercase mb-1">Passage</p>
                                            <p className="text-sm italic text-zinc-800 dark:text-zinc-200 bg-red-50 dark:bg-red-900/20 p-2 rounded border border-red-100 dark:border-red-900/30">
                                                "{item.passage}"
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-zinc-500 uppercase mb-1">Contradiction</p>
                                            <p className="text-sm text-zinc-600 dark:text-zinc-400">
                                                {item.contradiction}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-zinc-500 uppercase mb-1">Suggested Fix</p>
                                            <div className="flex items-start gap-2">
                                                <p className="flex-grow text-sm font-medium text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/20 p-2 rounded border border-green-100 dark:border-green-900/30">
                                                    {item.suggestion}
                                                </p>
                                                <button 
                                                    onClick={() => onApplySuggestion(item.passage, item.suggestion)}
                                                    className="bg-indigo-600 text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-indigo-700 transition-colors whitespace-nowrap shadow-sm"
                                                >
                                                    Fix
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12">
                            <div className="bg-green-100 dark:bg-green-900/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Icon name="CLOUD_CHECK" className="w-8 h-8 text-green-600 dark:text-green-400" />
                            </div>
                            <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-100">All Clear!</h3>
                            <p className="text-zinc-500 dark:text-zinc-400 mt-2 max-w-md mx-auto">
                                The AI didn't find any contradictions between this chapter and your Knowledge Base.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LoreConsistencyModal;
