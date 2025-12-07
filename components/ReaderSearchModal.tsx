
import React, { useState, useEffect, useMemo } from 'react';
import { Book } from '../types';
import Icon from './Icon';
import { READER_CONTENT_SELECTORS } from '../pages/Reader';

export interface SearchResult {
    chapterIndex: number;
    chapterTitle: string;
    snippet: string;
    matchIndex: number;
    elementIndex?: number; // DOM index within the chapter
}

interface ReaderSearchModalProps {
    isOpen: boolean;
    onClose: () => void;
    book: Book;
    onNavigate: (chapterIndex: number, elementIndex?: number, behavior?: ScrollBehavior) => void;
    query: string;
    setQuery: (q: string) => void;
    results: SearchResult[];
    setResults: (r: SearchResult[]) => void;
}

const ReaderSearchModal: React.FC<ReaderSearchModalProps> = ({ isOpen, onClose, book, onNavigate, query, setQuery, results, setResults }) => {
    const [isCaseSensitive, setIsCaseSensitive] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const inputRef = React.useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => {
                inputRef.current?.focus();
                inputRef.current?.select();
            }, 100);
        }
    }, [isOpen]);

    // Debounced search effect
    useEffect(() => {
        if (!query.trim()) {
            setResults([]);
            return;
        }

        const timer = setTimeout(() => {
            performSearch();
        }, 300);

        return () => clearTimeout(timer);
    }, [query, isCaseSensitive, book]);

    const performSearch = () => {
        setIsSearching(true);
        const searchResults: SearchResult[] = [];
        const cleanQuery = isCaseSensitive ? query : query.toLowerCase();

        book.content.forEach((chapter, index) => {
            if (!chapter || !chapter.htmlContent) return;

            // Parse HTML to find specific elements
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = chapter.htmlContent;
            const elements = tempDiv.querySelectorAll(READER_CONTENT_SELECTORS);
            
            elements.forEach((el, elIndex) => {
                const textContent = el.textContent || '';
                const searchSpace = isCaseSensitive ? textContent : textContent.toLowerCase();
                
                let position = searchSpace.indexOf(cleanQuery);
                
                // Only one match per element to avoid clutter
                if (position !== -1) {
                    const start = Math.max(0, position - 40);
                    const end = Math.min(textContent.length, position + cleanQuery.length + 40);
                    
                    let snippet = textContent.substring(start, end);
                    if (start > 0) snippet = '...' + snippet;
                    if (end < textContent.length) snippet = snippet + '...';

                    searchResults.push({
                        chapterIndex: index,
                        chapterTitle: chapter.title,
                        snippet: snippet,
                        matchIndex: position,
                        elementIndex: elIndex
                    });
                }
            });
        });

        setResults(searchResults);
        setIsSearching(false);
    };

    const handleResultClick = (chapterIndex: number, elementIndex?: number) => {
        // Pass 'auto' for instant jump instead of smooth scroll
        onNavigate(chapterIndex, elementIndex, 'auto');
        onClose();
    };

    // Helper to highlight text
    const HighlightedText = ({ text, highlight }: { text: string, highlight: string }) => {
        if (!highlight.trim()) {
            return <span>{text}</span>;
        }
        const regex = new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, isCaseSensitive ? 'g' : 'gi');
        const parts = text.split(regex);
        
        return (
            <span>
                {parts.map((part, i) => 
                    regex.test(part) ? (
                        <span key={i} className="bg-yellow-200 dark:bg-yellow-900/50 text-yellow-900 dark:text-yellow-100 font-semibold rounded-sm px-0.5">{part}</span>
                    ) : (
                        <span key={i}>{part}</span>
                    )
                )}
            </span>
        );
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
            
            <div className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-700 flex flex-col max-h-[80vh] animate-fade-in-up">
                
                {/* Header / Search Input */}
                <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-3">
                    <Icon name="SEARCH" className="w-5 h-5 text-zinc-400" />
                    <input 
                        ref={inputRef}
                        type="text" 
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search in book..."
                        className="flex-1 bg-transparent border-none focus:ring-0 text-lg text-zinc-800 dark:text-zinc-100 placeholder-zinc-400"
                    />
                    <div className="flex items-center gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400 border-l border-zinc-200 dark:border-zinc-800 pl-3">
                        <input 
                            type="checkbox" 
                            id="caseSensitive" 
                            checked={isCaseSensitive} 
                            onChange={(e) => setIsCaseSensitive(e.target.checked)}
                            className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                        />
                        <label htmlFor="caseSensitive" className="cursor-pointer select-none whitespace-nowrap">Match Case</label>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 transition-colors">
                        <kbd className="font-sans text-xs px-1.5 py-0.5 border border-zinc-300 dark:border-zinc-600 rounded bg-zinc-50 dark:bg-zinc-800">ESC</kbd>
                    </button>
                </div>

                {/* Results List */}
                <div className="flex-1 overflow-y-auto p-2 min-h-[300px]">
                    {isSearching ? (
                        <div className="flex flex-col items-center justify-center h-32 text-zinc-500">
                            <Icon name="ROTATE_CW" className="w-6 h-6 animate-spin mb-2" />
                            <p>Searching...</p>
                        </div>
                    ) : query.trim() === '' ? (
                        <div className="flex flex-col items-center justify-center h-full text-zinc-400 pb-10">
                            <Icon name="SEARCH" className="w-12 h-12 mb-2 opacity-50" />
                            <p>Type to search content across all chapters.</p>
                        </div>
                    ) : results.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-zinc-500 pb-10">
                            <p>No results found for "{query}"</p>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            <div className="px-3 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                                Found {results.length} matches
                            </div>
                            {results.map((result, idx) => (
                                <button
                                    key={`${result.chapterIndex}-${result.matchIndex}-${idx}`}
                                    onClick={() => handleResultClick(result.chapterIndex, result.elementIndex)}
                                    className="w-full text-left p-3 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors group"
                                >
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                                            Chapter {result.chapterIndex + 1}: {result.chapterTitle}
                                        </span>
                                        <Icon name="CHEVRON_RIGHT" className="w-4 h-4 text-zinc-300 dark:text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                    <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed font-serif">
                                        <HighlightedText text={result.snippet} highlight={query} />
                                    </p>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                
                {/* Footer */}
                <div className="p-2 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 rounded-b-xl text-center">
                    <p className="text-[10px] text-zinc-400">
                        Search looks through text content only. Formatting is ignored.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ReaderSearchModal;