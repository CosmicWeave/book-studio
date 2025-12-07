import React, { useState, useEffect } from 'react';
import { ICONS } from '../../constants';
import { useBookEditor } from '../../contexts/BookEditorContext';
import Icon from '../Icon';

const ImageSuggestionModal: React.FC = () => {
    const {
        suggestionToGenerate,
        closeImageSuggestionModal,
        book,
        isLoading,
        generateImageFromSuggestion
    } = useBookEditor();

    const [prompt, setPrompt] = useState('');

    useEffect(() => {
        if (suggestionToGenerate) {
            setPrompt(suggestionToGenerate.prompt);
        }
    }, [suggestionToGenerate]);

    if (!suggestionToGenerate || !book) return null;

    const handleGenerateClick = () => {
        if (prompt.trim()) {
            generateImageFromSuggestion(prompt);
        }
    };
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 animate-fade-in" onClick={closeImageSuggestionModal}>
            <div 
                className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-2xl max-h-[90vh] flex flex-col border border-gray-200 dark:border-gray-700"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Generate Image</h2>
                     <button onClick={closeImageSuggestionModal} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700" aria-label="Close modal">
                        <Icon name="CLOSE" className="w-6 h-6" />
                    </button>
                </div>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Book's Default Image Style</label>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-md border border-gray-200 dark:border-gray-600">
                            {book.imageGenerationInstructions}
                        </p>
                    </div>
                    <div>
                        <label htmlFor="prompt" className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                            Image Prompt
                        </label>
                         <textarea
                            id="prompt"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            rows={5}
                            className="mt-1 block w-full bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                            placeholder="e.g., A towering, moss-covered castle at sunset..."
                        />
                         <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Refine the AI's suggested prompt before generating the image.</p>
                    </div>
                </div>

                <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
                    <button onClick={closeImageSuggestionModal} disabled={isLoading} className="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 px-4 py-2 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors disabled:opacity-50">
                        Cancel
                    </button>
                    <button onClick={handleGenerateClick} disabled={isLoading} className="bg-blue-600 text-white px-6 py-2 rounded-lg shadow font-semibold hover:bg-blue-700 transition-colors flex items-center space-x-2 disabled:opacity-50">
                        <Icon name="WAND" className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                        <span>{isLoading ? 'Generating...' : 'Generate Image'}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ImageSuggestionModal;