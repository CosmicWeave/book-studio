import React from 'react';
import { AnalysisResult } from '../../types';
import { ICONS } from '../../constants';
import Loader from '../Loader';
import Icon from '../Icon';

interface ChapterAnalysisModalProps {
    isOpen: boolean;
    onClose: () => void;
    chapterTitle: string;
    analysisResult: AnalysisResult | null;
    isLoading: boolean;
    onExecuteAction: (prompt: string) => void;
}

const ChapterAnalysisModal: React.FC<ChapterAnalysisModalProps> = ({ isOpen, onClose, chapterTitle, analysisResult, isLoading, onExecuteAction }) => {
    if (!isOpen) return null;

    const renderLoading = () => (
        <div className="flex flex-col items-center justify-center p-8 min-h-[300px]">
            <div className="w-12 h-12 border-4 border-t-indigo-500 border-gray-200 rounded-full animate-spin"></div>
            <p className="mt-4 font-semibold text-gray-700 dark:text-gray-300">Analyzing chapter...</p>
        </div>
    );

    const renderResult = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
                <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100 mb-2">Editor's Feedback</h3>
                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg max-h-80 overflow-y-auto">
                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{analysisResult?.feedback}</p>
                </div>
            </div>
            <div>
                <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100 mb-2">Suggested Actions</h3>
                <div className="space-y-3 max-h-80 overflow-y-auto">
                    {analysisResult?.suggestions.map((suggestion, index) => (
                        <button 
                            key={index}
                            onClick={() => onExecuteAction(suggestion.prompt)}
                            className="w-full text-left p-4 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/50 hover:border-indigo-500 transition-all group"
                        >
                            <h4 className="font-semibold text-indigo-700 dark:text-indigo-300 flex items-center">
                                <Icon name="WAND" className="w-5 h-5 mr-2" />
                                {suggestion.title}
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{suggestion.description}</p>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-4xl max-h-[90vh] flex flex-col border border-gray-200 dark:border-gray-700" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Chapter Analysis</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{chapterTitle}</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700" aria-label="Close modal">
                        <Icon name="CLOSE" className="w-6 h-6" />
                    </button>
                </div>
                <div className="overflow-y-auto pr-2 -mr-2">
                    {isLoading || !analysisResult ? renderLoading() : renderResult()}
                </div>
            </div>
        </div>
    );
};

export default ChapterAnalysisModal;
