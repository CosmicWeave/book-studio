import React from 'react';
import { MacroResult, PacingAnalysisResult, ShowTellAnalysisResult, SeriesInconsistency } from '../../types';
import { ICONS } from '../../constants';
import Icon from '../Icon';

type MacroResultModalProps = {
    isOpen: boolean;
    onClose: () => void;
    results: MacroResult[];
    onApplyShowTellSuggestion: (original: string, replacement: string) => void;
    onApplyOpeningSuggestion: (replacement: string) => void;
};

const PacingAnalysisView: React.FC<{ data: PacingAnalysisResult }> = ({ data }) => (
    <div>
        <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">Pacing & Flow Analysis</h4>
        <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
            <h5 className="font-semibold text-sm mb-2">Sentence Length</h5>
            <div className="space-y-1 text-xs">
                {data.sentenceLengthHistogram.map((item, i) => {
                    const maxCount = Math.max(...data.sentenceLengthHistogram.map(h => h.count));
                    const percentage = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
                    return (
                        <div key={i} className="flex items-center">
                            <div className="w-20 flex-shrink-0 text-gray-600 dark:text-gray-400">{item.range}</div>
                            <div className="flex-grow bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                                <div className="bg-blue-500 h-3 rounded-full text-white text-xs flex items-center justify-end pr-1" style={{ width: `${percentage}%` }}>
                                    {item.count}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
            <h5 className="font-semibold text-sm mt-3 mb-2">AI Feedback</h5>
            <p className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{data.pacingFeedback}</p>
        </div>
    </div>
);

const ShowTellAnalysisView: React.FC<{ data: ShowTellAnalysisResult[], onApply: (original: string, replacement: string) => void }> = ({ data, onApply }) => (
    <div>
        <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">"Show, Don't Tell" Analysis</h4>
        <div className="space-y-3">
            {data.map((item, index) => (
                <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg">
                    <p className="p-2 text-xs italic bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-300">"{item.passage}"</p>
                    <div className="p-2 border-t border-gray-200 dark:border-gray-700 bg-green-50 dark:bg-green-900/30">
                        <p className="text-xs text-green-800 dark:text-green-300">{item.suggestion}</p>
                        <div className="flex justify-end mt-1">
                            <button onClick={() => onApply(item.passage, item.suggestion)} className="text-xs font-semibold text-indigo-600 hover:underline">Apply</button>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    </div>
);

const AltOpeningsView: React.FC<{ data: string[], onApply: (replacement: string) => void }> = ({ data, onApply }) => (
    <div>
        <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">Alternative Openings</h4>
        <div className="space-y-2">
            {data.map((item, index) => (
                <div key={index} className="p-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900/50">
                    <p className="text-xs text-gray-700 dark:text-gray-300">{item}</p>
                    <div className="flex justify-end mt-1">
                        <button onClick={() => onApply(item)} className="text-xs font-semibold text-indigo-600 hover:underline">Use this opening</button>
                    </div>
                </div>
            ))}
        </div>
    </div>
);

const SeriesConsistencyView: React.FC<{ data: SeriesInconsistency[] }> = ({ data }) => (
    <div>
        <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">Series Consistency Analysis</h4>
        {data.length > 0 ? (
            <div className="space-y-3">
                {data.map((item, index) => (
                    <div key={index} className="border border-yellow-300 dark:border-yellow-700 rounded-lg">
                        <div className="p-2 bg-yellow-50 dark:bg-yellow-900/30">
                            <p className="text-xs italic text-yellow-800 dark:text-yellow-300">"{item.inconsistentPassage}"</p>
                        </div>
                        <div className="p-2 border-t border-yellow-300 dark:border-yellow-700 text-xs">
                            <p><strong className="text-gray-600 dark:text-gray-400">Source of Contradiction:</strong> {item.contradictionSource}</p>
                            <p className="mt-1"><strong className="text-gray-600 dark:text-gray-400">Explanation:</strong> {item.explanation}</p>
                        </div>
                    </div>
                ))}
            </div>
        ) : (
            <p className="text-sm text-green-600 dark:text-green-400">✓ No inconsistencies found.</p>
        )}
    </div>
);

const MacroResultModal: React.FC<MacroResultModalProps> = ({ isOpen, onClose, results, onApplyShowTellSuggestion, onApplyOpeningSuggestion }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[51] p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-4xl max-h-[90vh] flex flex-col border border-gray-200 dark:border-gray-700" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Macro Results</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700" aria-label="Close modal">
                        <Icon name="CLOSE" className="w-6 h-6" />
                    </button>
                </div>
                <div className="overflow-y-auto pr-2 -mr-2 space-y-4">
                    {results.map(res => (
                        <div key={res.actionId}>
                            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-1 mb-2">{res.actionName}</h3>
                            {res.error ? (
                                <p className="text-red-500 text-sm">Error: {res.error}</p>
                            ) : res.type === 'analyze_pacing' ? (
                                <PacingAnalysisView data={res.result as PacingAnalysisResult} />
                            ) : res.type === 'analyze_show_dont_tell' ? (
                                <ShowTellAnalysisView data={res.result as ShowTellAnalysisResult[]} onApply={onApplyShowTellSuggestion} />
                            ) : res.type === 'generate_alt_openings' ? (
                                <AltOpeningsView data={res.result as string[]} onApply={onApplyOpeningSuggestion} />
                            ) : res.type === 'analyze_series_consistency' ? (
                                <SeriesConsistencyView data={res.result as SeriesInconsistency[]} />
                            ) : res.type === 'rewrite_with_prompt' ? (
                                <p className="text-sm text-green-600 dark:text-green-400">✓ {res.result as string}</p>
                            ) : (
                                <p className="text-sm text-gray-500">No viewable result for this action.</p>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default MacroResultModal;