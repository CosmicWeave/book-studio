
import React, { useState } from 'react';
import { useBookEditor } from '../../../contexts/BookEditorContext';
import Icon from '../../Icon';
import { toastService } from '../../../services/toastService';

const FindReplacePanel: React.FC = () => {
    const { activeEditorInstance } = useBookEditor();
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [replaceTerm, setReplaceTerm] = useState('');
    const [matches, setMatches] = useState<{from: number, to: number}[]>([]);
    const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

    const findMatches = () => {
        if (!activeEditorInstance || !searchTerm) {
            setMatches([]);
            return;
        }

        const preciseMatches: {from: number, to: number}[] = [];
        activeEditorInstance.state.doc.descendants((node, pos) => {
            if (node.isText && node.text) {
                const nodeText = node.text;
                const regex = new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
                let innerMatch;
                while ((innerMatch = regex.exec(nodeText)) !== null) {
                    preciseMatches.push({
                        from: pos + innerMatch.index,
                        to: pos + innerMatch.index + innerMatch[0].length
                    });
                }
            }
        });

        setMatches(preciseMatches);
        setCurrentMatchIndex(0);
        if (preciseMatches.length > 0) {
            highlightMatch(preciseMatches[0]);
        } else {
            toastService.info("No matches found.");
        }
    };

    const highlightMatch = (match: {from: number, to: number}) => {
        if (!activeEditorInstance) return;
        activeEditorInstance.commands.setTextSelection({ from: match.from, to: match.to });
        activeEditorInstance.commands.scrollIntoView();
    };

    const handleNext = () => {
        if (matches.length === 0) return;
        const nextIndex = (currentMatchIndex + 1) % matches.length;
        setCurrentMatchIndex(nextIndex);
        highlightMatch(matches[nextIndex]);
    };

    const handlePrev = () => {
        if (matches.length === 0) return;
        const nextIndex = (currentMatchIndex - 1 + matches.length) % matches.length;
        setCurrentMatchIndex(nextIndex);
        highlightMatch(matches[nextIndex]);
    };

    const handleReplace = () => {
        if (!activeEditorInstance || matches.length === 0) return;
        const currentMatch = matches[currentMatchIndex];
        
        activeEditorInstance.commands.insertContentAt(
            { from: currentMatch.from, to: currentMatch.to }, 
            replaceTerm
        );
        
        // Re-run search to update indices
        findMatches();
    };

    const handleReplaceAll = () => {
        if (!activeEditorInstance || !searchTerm) return;
        
        // Create a transaction to replace all
        // We process matches in reverse order to not mess up indices
        const preciseMatches: {from: number, to: number}[] = [];
        activeEditorInstance.state.doc.descendants((node, pos) => {
            if (node.isText && node.text) {
                const nodeText = node.text;
                const regex = new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
                let innerMatch;
                while ((innerMatch = regex.exec(nodeText)) !== null) {
                    preciseMatches.push({
                        from: pos + innerMatch.index,
                        to: pos + innerMatch.index + innerMatch[0].length
                    });
                }
            }
        });
        
        if (preciseMatches.length === 0) {
             toastService.info("No matches found.");
             return;
        }
        
        let transaction = activeEditorInstance.state.tr;
        for (let i = preciseMatches.length - 1; i >= 0; i--) {
            const match = preciseMatches[i];
            transaction = transaction.replaceWith(match.from, match.to, activeEditorInstance.schema.text(replaceTerm));
        }
        
        activeEditorInstance.view.dispatch(transaction);
        setMatches([]);
        toastService.success(`Replaced ${preciseMatches.length} occurrences.`);
    };

    if (!activeEditorInstance) return null;

    return (
        <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 overflow-hidden transition-all duration-200 hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-900/50">
            <button 
                onClick={() => setIsPanelOpen(!isPanelOpen)} 
                className="w-full flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-700/30 transition-colors"
            >
                <div className="flex items-center space-x-3">
                    <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
                        <Icon name="SEARCH_REPLACE" className="w-4 h-4" />
                    </div>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-100 text-sm">Find & Replace</span>
                </div>
                <Icon name="CHEVRON_LEFT" className={`w-4 h-4 text-zinc-400 transform transition-transform duration-300 ${isPanelOpen ? '-rotate-90' : 'rotate-0'}`} />
            </button>
            
            {isPanelOpen && (
                <div className="p-4 pt-0 space-y-3 border-t border-zinc-100 dark:border-zinc-700/50 animate-slide-in-down bg-zinc-50/50 dark:bg-zinc-900/30">
                    <div className="flex flex-col space-y-2 mt-2">
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && findMatches()}
                                placeholder="Find..." 
                                className="flex-grow text-sm bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 focus:ring-1 focus:ring-indigo-500"
                            />
                            <button onClick={findMatches} className="px-3 py-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-md text-xs font-semibold hover:bg-zinc-300 dark:hover:bg-zinc-600">
                                Find
                            </button>
                        </div>
                        
                        <div className="flex gap-2">
                             <input 
                                type="text" 
                                value={replaceTerm}
                                onChange={(e) => setReplaceTerm(e.target.value)}
                                placeholder="Replace with..." 
                                className="flex-grow text-sm bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 focus:ring-1 focus:ring-indigo-500"
                            />
                        </div>

                        {matches.length > 0 && (
                            <div className="flex items-center justify-between text-xs text-zinc-500 mt-1">
                                <span>{currentMatchIndex + 1} / {matches.length}</span>
                                <div className="flex space-x-1">
                                    <button onClick={handlePrev} className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded"><Icon name="CHEVRON_LEFT" className="w-3 h-3" /></button>
                                    <button onClick={handleNext} className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded"><Icon name="CHEVRON_RIGHT" className="w-3 h-3" /></button>
                                </div>
                            </div>
                        )}
                        
                        <div className="flex gap-2 pt-2">
                            <button onClick={handleReplace} disabled={matches.length === 0} className="flex-1 py-1.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-md text-xs font-semibold hover:bg-indigo-200 dark:hover:bg-indigo-800 disabled:opacity-50">
                                Replace
                            </button>
                            <button onClick={handleReplaceAll} className="flex-1 py-1.5 bg-indigo-600 text-white rounded-md text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50">
                                Replace All
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FindReplacePanel;