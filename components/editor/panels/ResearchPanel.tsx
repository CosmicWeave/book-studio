
import React, { useState } from 'react';
import { performResearch } from '../../../services/gemini';
import { GroundingChunk } from '../../../types';
import { toastService } from '../../../services/toastService';
import Icon from '../../Icon';

const ResearchPanel: React.FC = () => {
    const [isResearchOpen, setIsResearchOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<{ text: string; sources: GroundingChunk[] } | null>(null);
    const [error, setError] = useState('');

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim()) return;
        setIsLoading(true);
        setError('');
        setResult(null);
        try {
            const researchResult = await performResearch(query);
            setResult(researchResult);
        } catch (err: any) {
            const message = err.message || 'An error occurred during research.';
            setError(message);
            toastService.error(message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 overflow-hidden transition-all duration-200 hover:shadow-md">
            <button 
                onClick={() => setIsResearchOpen(!isResearchOpen)} 
                className="w-full flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-700/30 transition-colors group"
            >
                <div className="flex items-center space-x-3">
                    <div className="p-2 bg-sky-100 dark:bg-sky-900/30 rounded-lg text-sky-600 dark:text-sky-400 group-hover:scale-110 transition-transform">
                        <Icon name="SEARCH" className="w-4 h-4" />
                    </div>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-100 text-sm">Research Assistant</span>
                </div>
                <Icon name="CHEVRON_LEFT" className={`w-4 h-4 text-zinc-400 transform transition-transform duration-300 ${isResearchOpen ? '-rotate-90' : 'rotate-0'}`} />
            </button>
            
            {isResearchOpen && (
                <div className="p-4 pt-0 space-y-4 border-t border-zinc-100 dark:border-zinc-700/50 animate-slide-in-down bg-zinc-50/50 dark:bg-zinc-900/30">
                    <form onSubmit={handleSearch} className="flex gap-2 mt-4">
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Ask a question..."
                            className="flex-grow w-full text-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                            disabled={isLoading}
                        />
                        <button 
                            type="submit" 
                            className="bg-indigo-600 text-white px-3 py-2 rounded-lg shadow-sm font-semibold hover:bg-indigo-700 transition-colors disabled:bg-indigo-400 text-sm flex-shrink-0" 
                            disabled={isLoading || !query.trim()}
                        >
                            {isLoading ? <Icon name="ROTATE_CW" className="w-4 h-4 animate-spin" /> : 'Ask'}
                        </button>
                    </form>

                    {error && <p className="text-red-500 text-xs p-2 bg-red-50 dark:bg-red-900/20 rounded-md border border-red-100 dark:border-red-900">{error}</p>}
                    
                    {result && (
                        <div className="space-y-3">
                            <div className="p-3 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg max-h-60 overflow-y-auto shadow-sm">
                                <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">{result.text}</p>
                            </div>
                            {result.sources.length > 0 && (
                                <div className="bg-zinc-100 dark:bg-zinc-700/30 p-2 rounded-md">
                                    <h4 className="font-bold text-[10px] text-zinc-500 dark:text-zinc-400 uppercase mb-1.5 tracking-wider">Sources</h4>
                                    <ul className="space-y-1">
                                        {result.sources.map((source, index) => (
                                            <li key={index} className="truncate">
                                                <a href={source.web.uri} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline dark:text-blue-400 flex items-center">
                                                    <Icon name="LINK" className="w-3 h-3 mr-1.5 flex-shrink-0 opacity-70" />
                                                    <span className="truncate">{source.web.title || source.web.uri}</span>
                                                </a>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ResearchPanel;
