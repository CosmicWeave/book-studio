
import React from 'react';
import { useBookEditor } from '../../../contexts/BookEditorContext';
import Icon from '../../Icon';

const MetadataPanel: React.FC = () => {
    const { book, handleInputChange, isMetadataOpen, setIsMetadataOpen } = useBookEditor();

    if (!book) return null;

    return (
        <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 overflow-hidden transition-all duration-200 hover:shadow-md">
            <button 
                onClick={() => setIsMetadataOpen(!isMetadataOpen)} 
                className="w-full flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-700/30 transition-colors group"
            >
                <div className="flex items-center space-x-3">
                    <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform">
                        <Icon name="INFO" className="w-4 h-4" />
                    </div>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-100 text-sm">Metadata</span>
                </div>
                <Icon name="CHEVRON_LEFT" className={`w-4 h-4 text-zinc-400 transform transition-transform duration-300 ${isMetadataOpen ? '-rotate-90' : 'rotate-0'}`} />
            </button>
            
            {isMetadataOpen && (
                <div className="p-4 pt-0 space-y-4 border-t border-zinc-100 dark:border-zinc-700/50 animate-slide-in-down bg-zinc-50/50 dark:bg-zinc-900/30">
                    <div className="space-y-3 mt-4">
                        <div>
                            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1.5">Book Title</label>
                            <div className="relative">
                                <input 
                                    type="text" 
                                    id="topic" 
                                    name="topic" 
                                    value={book.topic} 
                                    onChange={handleInputChange} 
                                    className="w-full text-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2.5 pl-9 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                    placeholder="Enter book title"
                                />
                                <Icon name="BOOK" className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1.5">Subtitle</label>
                            <input 
                                type="text" 
                                id="subtitle" 
                                name="subtitle" 
                                value={book.subtitle || ''} 
                                onChange={handleInputChange} 
                                className="w-full text-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                placeholder="Enter book subtitle"
                            />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1.5">Author</label>
                                <input 
                                    type="text" 
                                    id="author" 
                                    name="author" 
                                    value={book.author || ''} 
                                    onChange={handleInputChange} 
                                    className="w-full text-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                    placeholder="Author Name"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1.5">Publisher</label>
                                <input 
                                    type="text" 
                                    id="publisher" 
                                    name="publisher" 
                                    value={book.publisher || ''} 
                                    onChange={handleInputChange} 
                                    className="w-full text-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                                    placeholder="Publisher"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1.5">Description</label>
                            <textarea 
                                id="description" 
                                name="description" 
                                value={book.description || ''} 
                                onChange={handleInputChange} 
                                rows={3} 
                                className="w-full text-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
                                placeholder="Brief synopsis or back cover text..."
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MetadataPanel;
