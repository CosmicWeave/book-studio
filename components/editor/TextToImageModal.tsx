
import React, { useState, useEffect } from 'react';
import { useBookEditor } from '../../contexts/BookEditorContext';
import { ICONS } from '../../constants';
import Icon from '../Icon';
import { generateIllustration, editImage } from '../../services/gemini';
import { toastService } from '../../services/toastService';
import Loader from '../Loader';

const TextToImageModal: React.FC = () => {
    const { 
        isTextToImageModalOpen, 
        setIsTextToImageModalOpen, 
        textToImageContext, 
        book, 
        handleInsertGeneratedImage 
    } = useBookEditor();

    const [prompt, setPrompt] = useState('');
    const [style, setStyle] = useState('');
    const [aspectRatio, setAspectRatio] = useState('16:9');
    
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    
    // Refining
    const [refinementPrompt, setRefinementPrompt] = useState('');
    const [isRefining, setIsRefining] = useState(false);

    useEffect(() => {
        if (isTextToImageModalOpen && textToImageContext && book) {
            setPrompt(textToImageContext.text);
            setStyle(book.imageGenerationInstructions || 'Photorealistic, cinematic lighting');
            setGeneratedImage(null);
            setRefinementPrompt('');
        }
    }, [isTextToImageModalOpen, textToImageContext, book]);

    if (!isTextToImageModalOpen || !textToImageContext) return null;

    const handleGenerate = async () => {
        if (!prompt.trim()) return;
        setIsGenerating(true);
        try {
            const imageUrl = await generateIllustration(prompt, style, aspectRatio);
            setGeneratedImage(imageUrl);
        } catch (e: any) {
            toastService.error(`Generation failed: ${e.message}`);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleRefine = async () => {
        if (!generatedImage || !refinementPrompt.trim()) return;
        setIsRefining(true);
        try {
            const newImage = await editImage(generatedImage, refinementPrompt);
            setGeneratedImage(newImage);
            setRefinementPrompt('');
            toastService.success("Image refined.");
        } catch (e: any) {
            toastService.error(`Refinement failed: ${e.message}`);
        } finally {
            setIsRefining(false);
        }
    };

    const handleInsert = () => {
        if (generatedImage) {
            // Use current prompt as alt text
            handleInsertGeneratedImage(generatedImage, prompt);
        }
    };

    const handleClose = () => {
        setIsTextToImageModalOpen(false);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[2000] p-4 animate-fade-in" onClick={handleClose}>
            <div 
                className="bg-white dark:bg-zinc-800 rounded-xl shadow-2xl p-6 w-full max-w-4xl max-h-[90vh] flex flex-col border border-zinc-200 dark:border-zinc-700"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-4 pb-4 border-b border-zinc-200 dark:border-zinc-700 flex-shrink-0">
                    <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
                        <Icon name="IMAGE_PLUS" className="w-6 h-6 text-indigo-500" />
                        Generate Illustration from Text
                    </h2>
                    <button onClick={handleClose} className="p-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700" aria-label="Close">
                        <Icon name="CLOSE" className="w-6 h-6" />
                    </button>
                </div>

                <div className="flex-grow overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-6 pr-2">
                    {/* Left Column: Controls */}
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-1">Image Description</label>
                            <textarea
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                rows={4}
                                className="w-full bg-white dark:bg-zinc-700 border border-zinc-300 dark:border-zinc-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                placeholder="Describe the scene..."
                            />
                        </div>
                        
                        <div>
                            <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-1">Art Style</label>
                            <textarea
                                value={style}
                                onChange={(e) => setStyle(e.target.value)}
                                rows={2}
                                className="w-full bg-white dark:bg-zinc-700 border border-zinc-300 dark:border-zinc-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                placeholder="e.g. Watercolor, Photorealistic..."
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-1">Aspect Ratio</label>
                            <select 
                                value={aspectRatio}
                                onChange={(e) => setAspectRatio(e.target.value)}
                                className="w-full bg-white dark:bg-zinc-700 border border-zinc-300 dark:border-zinc-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm p-2"
                            >
                                <option value="16:9">Landscape (16:9)</option>
                                <option value="1:1">Square (1:1)</option>
                                <option value="4:3">Standard (4:3)</option>
                                <option value="3:4">Portrait (3:4)</option>
                            </select>
                        </div>

                        <button 
                            onClick={handleGenerate}
                            disabled={isGenerating || !prompt.trim()}
                            className="w-full bg-indigo-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-indigo-700 transition-colors flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isGenerating ? (
                                <><Icon name="ROTATE_CW" className="w-5 h-5 animate-spin" /><span>Generating...</span></>
                            ) : (
                                <><Icon name="WAND" className="w-5 h-5" /><span>{generatedImage ? 'Regenerate' : 'Generate'}</span></>
                            )}
                        </button>

                        {generatedImage && (
                            <div className="pt-4 border-t border-zinc-200 dark:border-zinc-700">
                                <h3 className="text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">Fine-Tune Image</h3>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={refinementPrompt}
                                        onChange={(e) => setRefinementPrompt(e.target.value)}
                                        placeholder="e.g. Make it brighter, remove the tree..."
                                        className="flex-grow bg-white dark:bg-zinc-700 border border-zinc-300 dark:border-zinc-600 rounded-md shadow-sm text-sm px-3 py-2"
                                    />
                                    <button 
                                        onClick={handleRefine}
                                        disabled={isRefining || !refinementPrompt.trim()}
                                        className="bg-zinc-200 dark:bg-zinc-600 text-zinc-800 dark:text-zinc-100 px-3 py-2 rounded-md hover:bg-zinc-300 dark:hover:bg-zinc-500 transition-colors disabled:opacity-50 text-sm font-medium"
                                    >
                                        {isRefining ? '...' : 'Refine'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right Column: Preview */}
                    <div className="flex flex-col items-center justify-center bg-zinc-100 dark:bg-zinc-900/50 rounded-lg border border-zinc-200 dark:border-zinc-700 min-h-[300px] relative overflow-hidden">
                        {isGenerating ? (
                            <Loader message="Creating your illustration..." />
                        ) : generatedImage ? (
                            <img src={generatedImage} alt="Generated illustration" className="max-w-full max-h-full object-contain shadow-lg rounded-md" />
                        ) : (
                            <div className="text-center text-zinc-400 dark:text-zinc-600 p-8">
                                <Icon name="IMAGE" className="w-16 h-16 mx-auto mb-2 opacity-50" />
                                <p>Preview will appear here</p>
                            </div>
                        )}
                    </div>
                </div>

                {generatedImage && (
                    <div className="pt-4 mt-4 border-t border-zinc-200 dark:border-zinc-700 flex justify-end space-x-3">
                        <button onClick={handleClose} className="px-4 py-2 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg transition-colors">
                            Cancel
                        </button>
                        <button onClick={handleInsert} className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-green-700 shadow-md transition-colors flex items-center space-x-2">
                            <Icon name="CHECK_SQUARE" className="w-5 h-5" />
                            <span>Insert Image</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TextToImageModal;
