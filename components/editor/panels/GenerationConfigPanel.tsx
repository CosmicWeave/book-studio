
import React, { useState } from 'react';
import { useBookEditor } from '../../../contexts/BookEditorContext';
import Icon from '../../Icon';

const GenerationConfigPanel: React.FC = () => {
    const { book } = useBookEditor();
    const [isConfigOpen, setIsConfigOpen] = useState(false);

    if (!book || !book.creationConfig) return null;

    const { creationConfig } = book;

    const renderValue = (value: any) => {
        if (typeof value === 'boolean') {
            return value ? 'Yes' : 'No';
        }
        if (typeof value === 'undefined' || value === null || value === '') {
            return <span className="italic text-zinc-400 dark:text-zinc-500">Not set</span>;
        }
        return value.toString();
    };

    return (
        <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 overflow-hidden transition-all duration-200 hover:shadow-md">
            <button 
                onClick={() => setIsConfigOpen(!isConfigOpen)} 
                className="w-full flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-700/30 transition-colors group"
            >
                <div className="flex items-center space-x-3">
                    <div className="p-2 bg-teal-100 dark:bg-teal-900/30 rounded-lg text-teal-600 dark:text-teal-400 group-hover:scale-110 transition-transform">
                        <Icon name="SETTINGS" className="w-4 h-4" />
                    </div>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-100 text-sm">Generation Config</span>
                </div>
                <Icon name="CHEVRON_LEFT" className={`w-4 h-4 text-zinc-400 transform transition-transform duration-300 ${isConfigOpen ? '-rotate-90' : 'rotate-0'}`} />
            </button>
            {isConfigOpen && (
                <div className="p-4 pt-0 space-y-3 border-t border-zinc-100 dark:border-zinc-700/50 animate-slide-in-down bg-zinc-50/50 dark:bg-zinc-900/30">
                    <div className="mt-4 grid grid-cols-2 gap-4">
                        <div>
                            <h4 className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1">Original Topic</h4>
                            <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200 truncate" title={creationConfig.topic}>{creationConfig.topic}</p>
                        </div>
                         <div>
                            <h4 className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1">Goal</h4>
                            <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200">{renderValue(creationConfig.wordCountGoal)} words</p>
                        </div>
                    </div>
                    
                    <div>
                        <h4 className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1">Instructions</h4>
                        <div className="text-xs text-zinc-600 dark:text-zinc-400 p-2 bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded-md max-h-20 overflow-y-auto scrollbar-thin">
                            {creationConfig.instructions}
                        </div>
                    </div>

                    {creationConfig.generateImages && (
                         <div>
                            <h4 className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1">Image Style</h4>
                            <div className="text-xs text-zinc-600 dark:text-zinc-400 p-2 bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 rounded-md max-h-20 overflow-y-auto scrollbar-thin">
                                {creationConfig.imageGenerationInstructions}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default GenerationConfigPanel;
