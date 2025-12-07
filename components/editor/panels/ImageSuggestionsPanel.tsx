import React, { useState } from 'react';
import { ICONS } from '../../../constants';
import { useBookEditor } from '../../../contexts/BookEditorContext';
import Icon from '../../Icon';

const ImageSuggestionsPanel: React.FC = () => {
    const { book, imageSuggestions, openImageSuggestionModal } = useBookEditor();
    const [isPanelOpen, setIsPanelOpen] = useState(true);

    if (!book || !imageSuggestions || imageSuggestions.length === 0) return null;

    const handleJumpToSuggestion = (id: string) => {
        const element = document.querySelector(`span[data-suggestion-id="${id}"]`) as HTMLElement;
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // Add a temporary highlight effect
            const originalColor = element.style.backgroundColor;
            element.style.transition = 'background-color 0.5s ease-in-out';
            element.style.backgroundColor = 'rgba(79, 70, 229, 0.3)'; // Indigo-500 with opacity
            setTimeout(() => {
                element.style.backgroundColor = originalColor;
            }, 1500);
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
            <button onClick={() => setIsPanelOpen(!isPanelOpen)} className="w-full text-left font-bold text-xl flex justify-between items-center text-gray-800 dark:text-gray-100">
                <span className="flex items-center space-x-2">
                    <Icon name="IMAGE" className="w-6 h-6" />
                    <span>Image Suggestions ({imageSuggestions.length})</span>
                </span>
                <Icon name="CHEVRON_LEFT" className={`w-6 h-6 transform transition-transform duration-300 ${isPanelOpen ? 'rotate-180' : 'rotate-0'}`} />
            </button>
            {isPanelOpen && (
                <div className="mt-4 space-y-3 max-h-64 overflow-y-auto pr-2 -mr-2 animate-fade-in">
                    {imageSuggestions.map(suggestion => {
                        const chapter = book.outline[suggestion.chapterIndex];
                        return (
                            <div key={suggestion.id} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-700">
                                <p 
                                    className="text-sm text-gray-600 dark:text-gray-400 cursor-pointer hover:underline"
                                    onClick={() => handleJumpToSuggestion(suggestion.id)}
                                    title="Click to jump to location"
                                >
                                    In Chapter {suggestion.chapterIndex + 1}: "{chapter?.title || 'Unknown Chapter'}"
                                </p>
                                <p className="mt-2 text-xs font-mono p-2 bg-white dark:bg-gray-800 rounded-md">
                                    {suggestion.prompt}
                                </p>
                                <div className="mt-2 flex justify-end">
                                    <button 
                                        onClick={() => openImageSuggestionModal(suggestion)}
                                        className="px-3 py-1 text-xs font-semibold rounded-md bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                                    >
                                        Generate...
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default ImageSuggestionsPanel;
