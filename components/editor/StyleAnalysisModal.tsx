import React from 'react';
import { StyleSuggestion } from '../../types';
import { ICONS } from '../../constants';
import Icon from '../Icon';

type StyleAnalysisModalProps = {
    isOpen: boolean;
    onClose: () => void;
    chapterTitle: string;
    analysisResult: StyleSuggestion[] | null;
    isLoading: boolean;
    onApplySuggestion: (original: string, replacement: string) => void;
};

const StyleAnalysisModal: React.FC<StyleAnalysisModalProps> = ({ isOpen, onClose, chapterTitle, analysisResult, isLoading, onApplySuggestion }) => {
    if (!isOpen) return null;

    const renderLoading = () => (
        <div className="flex flex-col items-center justify-center p-8 min-h-[300px]">
            <div className="w-12 h-12 border-4 border-t-indigo-500 border-gray-200 rounded-full animate-spin"></div>
            <p className="mt-4 font-semibold text-gray-700 dark:text-gray-300">Analyzing style and tone...</p>
        </div>
    );

    const renderResult = () => (
        <div className="space-y-4">
            {analysisResult && analysisResult.length > 0 ? analysisResult.map((item, index) => (
                <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                    <div className="p-3 bg-red-50 dark:bg-red-900/30">
                        <h4 className="font-semibold text-sm text-red-700 dark:text-red-300">Original Passage:</h4>
                        <p className="italic text-gray-600 dark:text-gray-400 text-sm mt-1">"{item.originalPassage}"</p>
                    </div>
                    <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-green-50 dark:bg-green-900/30">
                        <h4 className="font-semibold text-sm text-green-700 dark:text-green-300">Suggested Rewrite:</h4>
                        <p className="text-gray-700 dark:text-gray-300 text-sm mt-1">{item.suggestedRewrite}</p>
                    </div>
                    <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                        <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300">Explanation:</h4>
                        <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">{item.explanation}</p>
                    </div>
                    <div className="p-2 bg-gray-100 dark:bg-gray-700/50 flex justify-end">
                        <button 
                            onClick={() => onApplySuggestion(item.originalPassage, item.suggestedRewrite)}
                            className="px-3 py-1 text-xs font-semibold rounded-md bg-indigo-600 text-white hover:bg-indigo-700 transition-colors flex items-center space-x-1"
                        >
                            <Icon name="WAND" className="w-3 h-3"/>
                            <span>Apply Suggestion</span>
                        </button>
                    </div>
                </div>
            )) : (
                <div className="text-center py-10">
                    <Icon name="CLOUD_CHECK" className="w-16 h-16 mx-auto text-green-500"/>
                    <p className="mt-4 font-semibold text-gray-700 dark:text-gray-300">Great work!</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">The AI found no major style or tone inconsistencies with your instructions.</p>
                </div>
            )}
        </div>
    );

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[51] p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-4xl max-h-[90vh] flex flex-col border border-gray-200 dark:border-gray-700" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Style & Tone Analysis</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{chapterTitle}</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700" aria-label="Close modal">
                        <Icon name="CLOSE" className="w-6 h-6" />
                    </button>
                </div>
                <div className="overflow-y-auto pr-2 -mr-2">
                    {isLoading ? renderLoading() : renderResult()}
                </div>
            </div>
        </div>
    );
};

export default StyleAnalysisModal;
