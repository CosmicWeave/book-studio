
import React from 'react';
import { useBookEditor } from '../../../contexts/BookEditorContext';
import Icon from '../../Icon';

const KnowledgeBasePanel: React.FC = () => {
    const { book, setIsKnowledgeBaseOpen } = useBookEditor();

    if (!book) return null;
    const count = book.knowledgeBase ? book.knowledgeBase.length : 0;

    return (
        <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 overflow-hidden transition-all duration-200 hover:shadow-md hover:border-violet-200 dark:hover:border-violet-900/50 group">
            <button 
                onClick={() => setIsKnowledgeBaseOpen(true)} 
                className="w-full flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-700/30 transition-colors"
            >
                <div className="flex items-center space-x-3">
                    <div className="p-2 bg-violet-100 dark:bg-violet-900/30 rounded-lg text-violet-600 dark:text-violet-400 group-hover:scale-110 transition-transform">
                        <Icon name="BRAIN" className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                        <span className="block font-semibold text-zinc-800 dark:text-zinc-100 text-sm">Knowledge Base</span>
                        <span className="block text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{count} {count === 1 ? 'entry' : 'entries'} defined</span>
                    </div>
                </div>
                <div className="flex items-center space-x-2">
                    {count === 0 && <span className="text-[10px] font-bold text-violet-600 bg-violet-50 dark:bg-violet-900/20 px-2 py-1 rounded-full">SETUP</span>}
                    <Icon name="CHEVRON_RIGHT" className="w-4 h-4 text-zinc-300 group-hover:text-violet-500 transition-colors" />
                </div>
            </button>
        </div>
    );
};

export default KnowledgeBasePanel;
