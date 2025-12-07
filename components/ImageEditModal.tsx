import React, { useState } from 'react';
import { ICONS } from '../constants';
import Loader from './Loader';
import { toastService } from '../services/toastService';
import Icon from './Icon';

interface ImageEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentImageUrl: string;
  imageGenerationInstructions: string;
  onRegenerate: (newInstructions: string) => Promise<void>;
  isGenerating: boolean;
}

const ImageEditModal: React.FC<ImageEditModalProps> = ({
  isOpen,
  onClose,
  currentImageUrl,
  imageGenerationInstructions,
  onRegenerate,
  isGenerating,
}) => {
    const [newInstructions, setNewInstructions] = useState('');

    if (!isOpen) return null;

    const handleRegenerateClick = () => {
        if (!newInstructions.trim()) {
            toastService.info("Please provide some instructions to regenerate the image.");
            return;
        }
        onRegenerate(newInstructions);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 animate-fade-in" onClick={onClose}>
            {isGenerating && <Loader message="Regenerating image..." />}
            <div 
                className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-3xl max-h-[90vh] flex flex-col border border-gray-200 dark:border-gray-700"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Edit Image</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700" aria-label="Close modal">
                        <Icon name="CLOSE" className="w-6 h-6" />
                    </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto pr-2 -mr-2">
                    <div className="flex flex-col items-center">
                        <p className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-2">Current Image</p>
                        <img src={currentImageUrl} alt="Current image" className="rounded-lg shadow-md w-full object-contain" />
                    </div>

                    <div className="flex flex-col space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Book's Default Image Style</label>
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-md border border-gray-200 dark:border-gray-600">
                                {imageGenerationInstructions}
                            </p>
                        </div>
                        <div>
                            <label htmlFor="newInstructions" className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                                New Instructions
                            </label>
                             <textarea
                                id="newInstructions"
                                value={newInstructions}
                                onChange={(e) => setNewInstructions(e.target.value)}
                                rows={5}
                                className="mt-1 block w-full bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                placeholder="e.g., Change the person's shirt to red, add a tree in the background."
                            />
                             <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Describe the new image you want or the changes to make. This will be combined with the default style.</p>
                        </div>
                    </div>
                </div>

                <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
                    <button onClick={onClose} disabled={isGenerating} className="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 px-4 py-2 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors disabled:opacity-50">
                        Cancel
                    </button>
                    <button onClick={handleRegenerateClick} disabled={isGenerating} className="bg-blue-600 text-white px-6 py-2 rounded-lg shadow font-semibold hover:bg-blue-700 transition-colors flex items-center space-x-2 disabled:opacity-50">
                        <Icon name="WAND" className={`w-5 h-5 ${isGenerating ? 'animate-spin' : ''}`} />
                        <span>{isGenerating ? 'Generating...' : 'Regenerate Image'}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ImageEditModal;
