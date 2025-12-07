import React, { useState, useRef } from 'react';
import { Book } from '../types';
import { ICONS } from '../constants';
import { generateCoverImage, editCoverImage } from '../services/gemini';
import Loader from './Loader';
import Icon from './Icon';
import { toastService } from '../services/toastService';

interface CoverGenerationModalProps {
    book: Book;
    allBooks: Book[];
    onClose: () => void;
    onCoverGenerated: (bookId: string, coverImage: string) => void;
}

const CoverGenerationModal: React.FC<CoverGenerationModalProps> = ({ book, allBooks, onClose, onCoverGenerated }) => {
    const [description, setDescription] = useState(book.topic);
    const [style, setStyle] = useState(book.imageGenerationInstructions || 'Photorealistic, cinematic lighting, epic fantasy');
    
    // History State for Undo/Redo
    const [history, setHistory] = useState<string[]>(book.coverImage ? [book.coverImage] : []);
    const [historyIndex, setHistoryIndex] = useState(book.coverImage ? 0 : -1);
    
    const [refinementPrompt, setRefinementPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const currentImage = historyIndex >= 0 ? history[historyIndex] : null;
    const otherBooks = allBooks.filter(b => b.id !== book.id);

    const addToHistory = (newImage: string) => {
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(newImage);
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
    };

    const handleUndo = () => {
        if (historyIndex > 0) {
            setHistoryIndex(historyIndex - 1);
        }
    };

    const handleRedo = () => {
        if (historyIndex < history.length - 1) {
            setHistoryIndex(historyIndex + 1);
        }
    };

    const handleGenerate = async () => {
        if (!description.trim() || !style.trim()) {
            setError('Please provide both a description and a style.');
            return;
        }
        setIsLoading(true);
        setError('');
        try {
            const image = await generateCoverImage(description, style);
            addToHistory(image);
        } catch (e: any) {
            setError(e.message || 'Failed to generate cover image.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRefine = async () => {
        if (!currentImage || !refinementPrompt.trim()) return;
        setIsLoading(true);
        setError('');
        try {
            const newImage = await editCoverImage(currentImage, refinementPrompt);
            addToHistory(newImage);
            setRefinementPrompt('');
        } catch (e: any) {
            setError(e.message || 'Failed to refine image.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = () => {
        if (currentImage) {
            onCoverGenerated(book.id, currentImage);
        }
    };

    const handleStyleCopy = (selectedBookId: string) => {
        if (!selectedBookId) return;

        const sourceBook = allBooks.find(b => b.id === selectedBookId);
        if (sourceBook && sourceBook.imageGenerationInstructions) {
            setStyle(sourceBook.imageGenerationInstructions);
            toastService.info(`Style copied from "${sourceBook.topic}"`);
        } else {
            toastService.error("Could not find style instructions for the selected book.");
        }
    };

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const result = event.target?.result as string;
                if (result) {
                    addToHistory(result);
                    toastService.success("Cover uploaded successfully.");
                }
            };
            reader.readAsDataURL(file);
        }
        // Reset input so same file can be selected again if needed
        e.target.value = '';
    };

    const handleDownload = () => {
        if (!currentImage) return;
        const a = document.createElement('a');
        a.href = currentImage;
        a.download = `${book.topic.replace(/[^a-z0-9]/gi, '_')}_cover.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 animate-fade-in" onClick={onClose}>
            <div 
                className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-4xl max-h-[90vh] flex flex-col border border-gray-200 dark:border-gray-700"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Generate Book Cover for "{book.topic}"</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700" aria-label="Close modal">
                        <Icon name="CLOSE" className="w-6 h-6" />
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-grow overflow-y-auto pr-2 -mr-2">
                    {/* Left Panel: Inputs */}
                    <div className="flex flex-col space-y-4">
                        <div>
                            <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Cover Description</label>
                            <textarea
                                id="description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={4}
                                className="mt-1 block w-full bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                placeholder="A lone knight standing on a cliff overlooking a stormy sea..."
                            />
                        </div>
                        <div>
                            <label htmlFor="style" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Art Style</label>
                            <textarea
                                id="style"
                                value={style}
                                onChange={(e) => setStyle(e.target.value)}
                                rows={4}
                                className="mt-1 block w-full bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                placeholder="e.g., minimalist, photographic, watercolor, vintage sci-fi"
                            />
                        </div>
                        {otherBooks.length > 0 && (
                            <div className="mt-2">
                                <label htmlFor="copy-style" className="block text-xs font-medium text-gray-500 dark:text-gray-400">Or copy style from another book</label>
                                <select
                                    id="copy-style"
                                    onChange={(e) => handleStyleCopy(e.target.value)}
                                    defaultValue=""
                                    className="mt-1 block w-full bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
                                >
                                    <option value="">-- Select a book --</option>
                                    {otherBooks.map(b => (
                                        <option key={b.id} value={b.id}>{b.topic}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        
                        {currentImage && (
                            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-600">
                                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">Fine Tune Current Image</h3>
                                <label htmlFor="refinement" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Adjustment Instructions</label>
                                <textarea
                                    id="refinement"
                                    value={refinementPrompt}
                                    onChange={(e) => setRefinementPrompt(e.target.value)}
                                    rows={3}
                                    className="mt-1 block w-full bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="e.g., Remove the tree, make the title text larger, change the background to sunset..."
                                />
                                <button
                                    onClick={handleRefine}
                                    disabled={isLoading || !refinementPrompt.trim()}
                                    className="mt-2 w-full bg-indigo-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:bg-indigo-400"
                                >
                                    Apply Changes
                                </button>
                            </div>
                        )}

                        {error && <p className="text-sm text-red-500">{error}</p>}
                    </div>

                    {/* Right Panel: Preview */}
                    <div className="flex flex-col h-full">
                        <div className="bg-gray-100 dark:bg-gray-900/50 rounded-lg flex items-center justify-center p-4 flex-grow min-h-[300px] relative">
                            {isLoading ? (
                                <div className="flex flex-col items-center text-gray-500 dark:text-gray-400">
                                    <div className="w-12 h-12 border-4 border-t-blue-500 border-gray-200 rounded-full animate-spin"></div>
                                    <p className="mt-3 font-semibold">Generating cover...</p>
                                </div>
                            ) : currentImage ? (
                                <img src={currentImage} alt="Generated cover" className="max-h-full w-auto object-contain rounded-md shadow-lg" />
                            ) : (
                                <div className="text-center text-gray-500 dark:text-gray-400">
                                    <Icon name="IMAGE" className="w-16 h-16" />
                                    <p className="mt-2">Cover preview will appear here</p>
                                </div>
                            )}
                        </div>
                        
                        {/* Image Toolbar */}
                        <div className="flex items-center justify-between mt-3 px-1">
                            <div className="flex space-x-2">
                                <button 
                                    onClick={handleUndo} 
                                    disabled={historyIndex <= 0 || isLoading}
                                    className="p-2 rounded-md bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-600 disabled:opacity-40 transition-colors"
                                    title="Undo"
                                >
                                    <Icon name="UNDO" className="w-4 h-4" />
                                </button>
                                <button 
                                    onClick={handleRedo} 
                                    disabled={historyIndex >= history.length - 1 || isLoading}
                                    className="p-2 rounded-md bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-600 disabled:opacity-40 transition-colors"
                                    title="Redo"
                                >
                                    <Icon name="REDO" className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="flex space-x-2">
                                <input 
                                    type="file" 
                                    ref={fileInputRef} 
                                    onChange={handleFileChange} 
                                    className="hidden" 
                                    accept="image/*" 
                                />
                                <button 
                                    onClick={handleUploadClick}
                                    disabled={isLoading}
                                    className="p-2 rounded-md bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-600 disabled:opacity-40 transition-colors"
                                    title="Upload Custom Cover"
                                >
                                    <Icon name="UPLOAD" className="w-4 h-4" />
                                </button>
                                <button 
                                    onClick={handleDownload} 
                                    disabled={!currentImage || isLoading}
                                    className="p-2 rounded-md bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-600 disabled:opacity-40 transition-colors"
                                    title="Download Cover"
                                >
                                    <Icon name="DOWNLOAD" className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
                    <div>
                         {currentImage && (
                            <button onClick={handleGenerate} disabled={isLoading} className="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 px-4 py-2 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors disabled:opacity-50">
                                Regenerate New
                            </button>
                         )}
                    </div>
                    <div className="flex space-x-3">
                        <button onClick={onClose} disabled={isLoading} className="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 px-4 py-2 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors disabled:opacity-50">
                            Cancel
                        </button>
                        {!currentImage ? (
                            <button onClick={handleGenerate} disabled={isLoading} className="bg-blue-600 text-white px-6 py-2 rounded-lg shadow font-semibold hover:bg-blue-700 transition-colors flex items-center space-x-2 disabled:opacity-50">
                                <Icon name="WAND" className="w-5 h-5" />
                                <span>Generate</span>
                            </button>
                        ) : (
                             <button onClick={handleSave} disabled={isLoading} className="bg-green-600 text-white px-6 py-2 rounded-lg shadow font-semibold hover:bg-green-700 transition-colors flex items-center space-x-2 disabled:opacity-50">
                                <Icon name="SAVE" className="w-5 h-5" />
                                <span>Save Cover</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CoverGenerationModal;