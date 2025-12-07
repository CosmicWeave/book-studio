
import React, { useState, useEffect, useMemo } from 'react';
import { useBookEditor } from '../../contexts/BookEditorContext';
import Icon from '../Icon';

const wordCounter = (text: string): number => {
    if (!text || !text.trim()) return 0;
    // This regex handles various whitespace characters and counts sequences of non-whitespace as words.
    return text.trim().split(/\s+/).filter(Boolean).length;
};

const EditorFooter: React.FC = () => {
    const { book, activeEditorInstance, activeChapterIndex } = useBookEditor();
    const [chapterWords, setChapterWords] = useState(0);

    // Effect for the live word count of the currently active editor instance
    useEffect(() => {
        if (!activeEditorInstance) {
            // When no editor is active, try to calculate from book state as a fallback
            const fallbackContent = book?.content[activeChapterIndex]?.htmlContent || '';
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = fallbackContent;
            setChapterWords(wordCounter(tempDiv.textContent || ''));
            return;
        }

        const updateWordCount = () => {
            const text = activeEditorInstance.state.doc.textContent;
            setChapterWords(wordCounter(text));
        };

        // Set initial count and subscribe to updates
        updateWordCount();
        activeEditorInstance.on('update', updateWordCount);

        // Cleanup listener when the component unmounts or the editor instance changes
        return () => {
            activeEditorInstance.off('update', updateWordCount);
        };
    }, [activeEditorInstance, activeChapterIndex, book?.content]);

    // Memoized calculation for the total word count of the entire book
    const totalWords = useMemo(() => {
        if (!book || !book.content) return 0;
        return book.content.reduce((acc, chapter) => {
            if (!chapter) return acc; // Defensively handle null entries
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = chapter.htmlContent;
            const text = tempDiv.textContent || "";
            return acc + wordCounter(text);
        }, 0);
    }, [book?.content]);

    if (!book || book.outline.length === 0) {
        return null;
    }

    const goal = book.wordCountGoal || 0;
    const goalProgress = goal > 0 ? ` / ${goal.toLocaleString()}` : '';

    const handleChapterJump = (index: number) => {
        const element = document.getElementById(`chapter-${index}`);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    const handlePrevChapter = () => {
        if (activeChapterIndex > 0) {
            handleChapterJump(activeChapterIndex - 1);
        }
    };

    const handleNextChapter = () => {
        if (activeChapterIndex < book.outline.length - 1) {
            handleChapterJump(activeChapterIndex + 1);
        }
    };

    return (
        <div className="flex-shrink-0 bg-white/90 dark:bg-zinc-800/90 backdrop-blur-md border-t border-zinc-200 dark:border-zinc-700 z-30">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-12 text-sm text-zinc-600 dark:text-zinc-400">
                    
                    {/* Left: Chapter Navigation */}
                    <div className="flex items-center space-x-2">
                        <button 
                            onClick={handlePrevChapter}
                            disabled={activeChapterIndex === 0}
                            className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-30"
                            title="Previous Chapter"
                        >
                            <Icon name="CHEVRON_LEFT" className="w-4 h-4" />
                        </button>
                        
                        <div className="relative group">
                            <select 
                                value={activeChapterIndex} 
                                onChange={(e) => handleChapterJump(parseInt(e.target.value))} 
                                className="appearance-none bg-transparent border-none py-1 pl-2 pr-8 text-sm font-semibold focus:ring-0 cursor-pointer text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-md transition-colors max-w-[12rem] sm:max-w-xs truncate"
                            >
                                {book.outline.map((ch, i) => (
                                    <option key={i} value={i}>
                                        {i + 1}. {ch.title}
                                    </option>
                                ))}
                            </select>
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                                <Icon name="CHEVRON_LEFT" className="w-3 h-3 transform -rotate-90 opacity-50" />
                            </div>
                        </div>

                        <button 
                            onClick={handleNextChapter}
                            disabled={activeChapterIndex === book.outline.length - 1}
                            className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-30"
                            title="Next Chapter"
                        >
                            <Icon name="CHEVRON_RIGHT" className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Right: Stats */}
                    <div className="flex items-center space-x-4">
                        <span className="hidden sm:inline text-xs">
                            Chapter: <span className="font-medium text-zinc-800 dark:text-zinc-200">{chapterWords.toLocaleString()}</span> words
                        </span>
                        <div className="h-4 w-px bg-zinc-300 dark:bg-zinc-600 hidden sm:block"></div>
                        <span className="text-xs">
                            Total: <span className="font-medium text-zinc-800 dark:text-zinc-200">{totalWords.toLocaleString()}</span>{goalProgress} words
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EditorFooter;
