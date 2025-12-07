import React from 'react';
import { PacingAnalysisResult, ShowTellAnalysisResult } from '../../types';
import { ICONS } from '../../constants';
import Icon from '../Icon';

type DeepAnalysisModalProps = {
    isOpen: boolean;
    onClose: () => void;
    chapterTitle: string;
    analysisType: 'pacing' | 'show_tell' | null;
    analysisData: any; // PacingAnalysisResult | ShowTellAnalysisResult[] | null
    onApplySuggestion: (original: string, replacement: string) => void;
};

const DeepAnalysisModal: React.FC<DeepAnalysisModalProps> = ({ isOpen, onClose, chapterTitle, analysisType, analysisData, onApplySuggestion }) => {
    if (!isOpen) return null;

    const renderPacingAnalysis = (data: PacingAnalysisResult) => (
        <div>
            <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100 mb-2">Pacing & Flow Analysis</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">Sentence Length Distribution</h4>
                    <div className="space-y-2 text-sm">
                        {data.sentenceLengthHistogram.map((item, i) => {
                            const maxCount = Math.max(...data.sentenceLengthHistogram.map(h => h.count));
                            const percentage = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
                            return (
                                <div key={i} className="flex items-center">
                                    <div className="w-24 flex-shrink-0 text-gray-600 dark:text-gray-400">{item.range}</div>
                                    <div className="flex-grow bg-gray-200 dark:bg-gray-700 rounded-full h-4">
                                        <div className="bg-blue-500 h-4 rounded-full text-white text-xs flex items-center justify-end pr-2" style={{ width: `${percentage}%` }}>
                                            {item.count}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
                <div>
                    <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">Dialogue Ratio</h4>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-6 flex items-center text-xs font-bold">
                        <div className="bg-green-500 h-6 rounded-l-full flex items-center justify-center" style={{ width: `${data.dialogueRatio * 100}%` }}>
                            {Math.round(data.dialogueRatio * 100)}%
                        </div>
                        <div className="bg-purple-500 h-6 rounded-r-full flex-grow flex items-center justify-center text-white" >
                            {100 - Math.round(data.dialogueRatio * 100)}%
                        </div>
                    </div>
                    <div className="flex justify-between text-xs mt-1">
                        <span className="text-green-700 dark:text-green-300">Dialogue</span>
                        <span className="text-purple-700 dark:text-purple-300">Narration</span>
                    </div>

                    <h4 className="font-semibold text-gray-700 dark:text-gray-300 mt-4 mb-2">AI Pacing Feedback</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{data.pacingFeedback}</p>
                </div>
            </div>
        </div>
    );
    
    const renderShowTellAnalysis = (data: ShowTellAnalysisResult[]) => (
         <div>
            <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100 mb-4">"Show, Don't Tell" Analysis</h3>
            <div className="space-y-4">
                {data.length > 0 ? data.map((item, index) => (
                    <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                        <div className="p-3 bg-red-50 dark:bg-red-900/30">
                            <h4 className="font-semibold text-sm text-red-700 dark:text-red-300">Telling Passage:</h4>
                            <p className="italic text-gray-600 dark:text-gray-400 text-sm mt-1">"{item.passage}"</p>
                        </div>
                        <div className="p-3 bg-green-50 dark:bg-green-900/30">
                            <h4 className="font-semibold text-sm text-green-700 dark:text-green-300">Showing Suggestion:</h4>
                            <p className="text-gray-700 dark:text-gray-300 text-sm mt-1">{item.suggestion}</p>
                        </div>
                        <div className="p-2 bg-gray-50 dark:bg-gray-700/50 flex justify-end">
                            <button 
                                onClick={() => onApplySuggestion(item.passage, item.suggestion)}
                                className="px-3 py-1 text-xs font-semibold rounded-md bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                            >
                                Apply Suggestion
                            </button>
                        </div>
                    </div>
                )) : <p className="text-center text-gray-500">No "telling" passages found. Great job!</p>}
            </div>
        </div>
    );
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[51] p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-4xl max-h-[90vh] flex flex-col border border-gray-200 dark:border-gray-700" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Deep Analysis</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{chapterTitle}</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700" aria-label="Close modal">
                        <Icon name="CLOSE" className="w-6 h-6" />
                    </button>
                </div>
                <div className="overflow-y-auto pr-2 -mr-2">
                    {!analysisData ? (
                         <div className="flex flex-col items-center justify-center p-8 min-h-[300px]">
                            <div className="w-12 h-12 border-4 border-t-indigo-500 border-gray-200 rounded-full animate-spin"></div>
                            <p className="mt-4 font-semibold text-gray-700 dark:text-gray-300">Performing deep analysis...</p>
                        </div>
                    ) : analysisType === 'pacing' ? (
                        renderPacingAnalysis(analysisData)
                    ) : analysisType === 'show_tell' ? (
                        renderShowTellAnalysis(analysisData)
                    ) : (
                        <p>Unknown analysis type.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DeepAnalysisModal;