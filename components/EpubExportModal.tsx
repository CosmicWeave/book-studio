

import React, { useState } from 'react';
import { Book, EpubExportOptions } from '../types';
import { ICONS } from '../constants';
import Icon from './Icon';

interface EpubExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onExport: (options: EpubExportOptions) => void;
    book: Book;
}

const EpubExportModal: React.FC<EpubExportModalProps> = ({ isOpen, onClose, onExport, book }) => {
    const [options, setOptions] = useState<EpubExportOptions>({
        includeToc: true,
        includeCover: !!book.coverImage,
        customCss: ''
    });

    if (!isOpen) return null;

    const handleOptionChange = (field: keyof EpubExportOptions, value: string | boolean) => {
        setOptions(prev => ({ ...prev, [field]: value }));
    };

    const handleExportClick = () => {
        onExport(options);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 animate-fade-in" onClick={onClose}>
            <div 
                className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-lg max-h-[90vh] flex flex-col border border-gray-200 dark:border-gray-700"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Advanced ePub Export</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700" aria-label="Close modal">
                        <Icon name="CLOSE" className="w-6 h-6" />
                    </button>
                </div>

                <div className="space-y-4 overflow-y-auto pr-2 -mr-2">
                    <div className="flex items-center">
                        <input
                            id="includeCover"
                            type="checkbox"
                            checked={options.includeCover}
                            onChange={(e) => handleOptionChange('includeCover', e.target.checked)}
                            disabled={!book.coverImage}
                            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="includeCover" className="ml-3 block text-sm text-gray-900 dark:text-gray-200">
                            Include Cover Image
                            {!book.coverImage && <span className="text-xs text-gray-500"> (No cover generated)</span>}
                        </label>
                    </div>

                    <div className="flex items-center">
                        <input
                            id="includeToc"
                            type="checkbox"
                            checked={options.includeToc}
                            onChange={(e) => handleOptionChange('includeToc', e.target.checked)}
                            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="includeToc" className="ml-3 block text-sm text-gray-900 dark:text-gray-200">
                            Include Table of Contents
                        </label>
                    </div>
                    
                    <div>
                        <label htmlFor="customCss" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Custom CSS
                        </label>
                        <textarea
                            id="customCss"
                            value={options.customCss}
                            onChange={(e) => handleOptionChange('customCss', e.target.value)}
                            rows={6}
                            className="mt-1 block w-full bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 font-mono text-xs"
                            placeholder={`/* Your custom CSS will be added here */\n\nbody {\n  font-size: 1.1em;\n}\n\nh2 {\n  color: #005588;\n}`}
                        />
                         <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Add your own CSS to override the default ePub styles.</p>
                    </div>
                </div>

                <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
                    <button onClick={onClose} className="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 px-4 py-2 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors">
                        Cancel
                    </button>
                    <button onClick={handleExportClick} className="bg-purple-600 text-white px-6 py-2 rounded-lg shadow font-semibold hover:bg-purple-700 transition-colors flex items-center space-x-2">
                        <Icon name="DOWNLOAD" className="w-5 h-5" />
                        <span>Start Export</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EpubExportModal;
