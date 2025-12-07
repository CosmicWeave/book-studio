
import React from 'react';
import { ICONS } from '../../constants';
import Icon from '../Icon';

interface DiffModalProps {
    isOpen: boolean;
    onClose: () => void;
    chapterTitle: string;
    changeDescription: string;
    newContent: string;
    onApply: () => void;
}

const DiffModal: React.FC<DiffModalProps> = ({ isOpen, onClose, chapterTitle, changeDescription, newContent, onApply }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[70] p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-2xl p-6 w-full max-w-4xl max-h-[90vh] flex flex-col border border-gray-200 dark:border-gray-700" onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div className="flex justify-between items-start mb-4 pb-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                            <Icon name="EDIT" className="w-5 h-5 text-indigo-500" />
                            Review Changes
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">For Chapter: <span className="font-semibold text-gray-700 dark:text-gray-300">{chapterTitle}</span></p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700" aria-label="Close modal">
                        <Icon name="CLOSE" className="w-6 h-6" />
                    </button>
                </div>

                {/* Summary */}
                <div className="bg-indigo-50 dark:bg-indigo-900/30 p-3 rounded-lg border border-indigo-100 dark:border-indigo-800 mb-4 flex-shrink-0">
                    <h4 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide mb-1">Change Summary</h4>
                    <p className="text-sm text-indigo-900 dark:text-indigo-100">{changeDescription}</p>
                </div>

                {/* Content Preview */}
                <div className="flex-grow overflow-y-auto bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 p-6 shadow-inner">
                    <div 
                        className="prose prose-sm max-w-none dark:prose-invert font-serif"
                        dangerouslySetInnerHTML={{ __html: newContent }}
                    />
                </div>

                {/* Footer Actions */}
                <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3 flex-shrink-0">
                    <button 
                        onClick={onClose} 
                        className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                    >
                        Discard
                    </button>
                    <button 
                        onClick={onApply} 
                        className="px-6 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 shadow-md transition-colors flex items-center space-x-2"
                    >
                        <Icon name="CLOUD_CHECK" className="w-5 h-5" />
                        <span>Apply Changes</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DiffModal;
