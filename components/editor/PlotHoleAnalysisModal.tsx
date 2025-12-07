
import React from 'react';
import { PlotHole } from '../../types';
import Icon from '../Icon';

interface PlotHoleAnalysisModalProps {
    isOpen: boolean;
    onClose: () => void;
    results: PlotHole[] | null;
    isLoading: boolean;
}

const PlotHoleAnalysisModal: React.FC<PlotHoleAnalysisModalProps> = ({ isOpen, onClose, results, isLoading }) => {
    if (!isOpen) return null;

    const getSeverityColor = (severity: 'High' | 'Medium' | 'Low') => {
        switch (severity) {
            case 'High': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800';
            case 'Medium': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800';
            case 'Low': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[51] p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-4xl max-h-[90vh] flex flex-col border border-gray-200 dark:border-gray-700" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                        <Icon name="ALERT_TRIANGLE" className="w-6 h-6 text-amber-500" />
                        Plot Hole Detector
                    </h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700" aria-label="Close modal">
                        <Icon name="CLOSE" className="w-6 h-6" />
                    </button>
                </div>

                <div className="overflow-y-auto pr-2 -mr-2 flex-grow">
                    {isLoading ? (
                         <div className="flex flex-col items-center justify-center p-8 min-h-[300px]">
                            <div className="w-12 h-12 border-4 border-t-amber-500 border-gray-200 rounded-full animate-spin"></div>
                            <p className="mt-4 font-semibold text-gray-700 dark:text-gray-300">Scanning for plot inconsistencies...</p>
                        </div>
                    ) : results && results.length > 0 ? (
                        <div className="space-y-4">
                            {results.map((item, index) => (
                                <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                                    <div className="bg-zinc-50 dark:bg-zinc-700/30 p-3 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
                                        <span className="font-bold text-zinc-800 dark:text-zinc-100">{item.issue}</span>
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${getSeverityColor(item.severity)}`}>{item.severity} Priority</span>
                                    </div>
                                    <div className="p-4 space-y-3">
                                        <div>
                                            <p className="text-xs font-bold text-zinc-500 uppercase mb-1">Location</p>
                                            <p className="text-sm italic text-zinc-800 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-800 p-2 rounded border border-zinc-200 dark:border-zinc-700">
                                                "{item.location}"
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-zinc-500 uppercase mb-1">Explanation</p>
                                            <p className="text-sm text-zinc-600 dark:text-zinc-400">
                                                {item.explanation}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-zinc-500 uppercase mb-1">Suggestion</p>
                                            <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900/30 rounded-md">
                                                 <p className="text-sm text-green-800 dark:text-green-200">
                                                    {item.suggestion}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12">
                            <div className="bg-green-100 dark:bg-green-900/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Icon name="CLOUD_CHECK" className="w-8 h-8 text-green-600 dark:text-green-400" />
                            </div>
                            <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-100">Solid Plot!</h3>
                            <p className="text-zinc-500 dark:text-zinc-400 mt-2 max-w-md mx-auto">
                                The AI didn't detect any major logical inconsistencies or contradictions in this chapter.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PlotHoleAnalysisModal;
