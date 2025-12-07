
import React, { useState, useEffect, useCallback } from 'react';
import { Book, ChapterOutline } from '../../types';
import { ICONS, FRAMEWORKS } from '../../constants';
import { generateBookAngles, generateBookParts, generateDetailedOutline, synthesizeBookAngles, synthesizeBookParts } from '../../services/gemini';
import Icon from '../Icon';
import { toastService } from '../../services/toastService';

interface BrainstormModalProps {
    isOpen: boolean;
    onClose: () => void;
    book: Book;
    onOutlineGenerated: (outline: ChapterOutline[], finalTitle: string) => void;
}

type BrainstormStep = 'framework' | 'angles' | 'parts' | 'generating' | 'error';

const BrainstormModal: React.FC<BrainstormModalProps> = ({ isOpen, onClose, book, onOutlineGenerated }) => {
    const [step, setStep] = useState<BrainstormStep>('framework');
    const [selectedFramework, setSelectedFramework] = useState<string>('none');
    const [sourceMaterial, setSourceMaterial] = useState('');
    const [writingStyle, setWritingStyle] = useState('');
    const [angles, setAngles] = useState<string[]>([]);
    const [lockedAngles, setLockedAngles] = useState<boolean[]>([]);
    const [selectedAngles, setSelectedAngles] = useState<boolean[]>([]);
    const [selectedAngle, setSelectedAngle] = useState('');
    const [parts, setParts] = useState<string[]>([]);
    const [lockedParts, setLockedParts] = useState<boolean[]>([]);
    const [selectedParts, setSelectedParts] = useState<boolean[]>([]);
    const [chapterCounts, setChapterCounts] = useState<number[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [error, setError] = useState('');

    const resetState = useCallback(() => {
        setStep('framework');
        setSelectedFramework('none');
        setSourceMaterial('');
        setWritingStyle('');
        setAngles([]);
        setLockedAngles([]);
        setSelectedAngles([]);
        setSelectedAngle('');
        setParts([]);
        setLockedParts([]);
        setSelectedParts([]);
        setChapterCounts([]);
        setIsLoading(false);
        setLoadingMessage('');
        setError('');
    }, []);
    
    const fetchAngles = useCallback(async () => {
        setIsLoading(true);
        setLoadingMessage('Brainstorming creative angles...');
        setError('');
        try {
            const result = await generateBookAngles(book.topic, book.instructions, selectedFramework, sourceMaterial, writingStyle);
            setAngles(result);
            setLockedAngles(new Array(result.length).fill(false));
            setSelectedAngles(new Array(result.length).fill(false));
        } catch (e: any) {
            setError(e.message);
            setStep('error');
        } finally {
            setIsLoading(false);
        }
    }, [book.topic, book.instructions, selectedFramework, sourceMaterial, writingStyle]);

    const handleRegenerateAngles = async () => {
        setIsLoading(true);
        setLoadingMessage('Brainstorming new angles...');
        setError('');
        try {
            const locked = angles.filter((_, i) => lockedAngles[i]);
            const unlockedCount = angles.length - locked.length;

            if (unlockedCount <= 0) {
                toastService.info("All angles are locked. Nothing to regenerate.");
                setIsLoading(false);
                return;
            }

            const newSuggestions = await generateBookAngles(book.topic, book.instructions, selectedFramework, sourceMaterial, writingStyle, locked, unlockedCount);
            
            let suggestionIndex = 0;
            const newAngles = angles.map((oldAngle, i) => {
                if (lockedAngles[i]) {
                    return oldAngle;
                } else {
                    return newSuggestions[suggestionIndex++] || "Failed to generate new angle";
                }
            });
            setAngles(newAngles);

        } catch (e: any) {
            setError(e.message);
            setStep('error');
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleGenerateMoreAngles = async () => {
        setIsLoading(true);
        setLoadingMessage('Brainstorming more angles...');
        try {
            const newSuggestions = await generateBookAngles(book.topic, book.instructions, selectedFramework, sourceMaterial, writingStyle, angles, 3);
            setAngles(prev => [...prev, ...newSuggestions]);
            setLockedAngles(prev => [...prev, ...new Array(newSuggestions.length).fill(false)]);
            setSelectedAngles(prev => [...prev, ...new Array(newSuggestions.length).fill(false)]);
        } catch (e: any) { setError(e.message); setStep('error'); }
        finally { setIsLoading(false); }
    };
    
    const handleSynthesizeAngles = async () => {
        const anglesToSynthesize = angles.filter((_, i) => selectedAngles[i]);
        if (anglesToSynthesize.length < 2) {
            toastService.info("Please select at least two angles to synthesize.");
            return;
        }
        setIsLoading(true);
        setLoadingMessage('Synthesizing selected angles...');
        try {
            const newAngle = await synthesizeBookAngles(book.topic, book.instructions, selectedFramework, sourceMaterial, writingStyle, anglesToSynthesize);
            setAngles(prev => [...prev, newAngle]);
            setLockedAngles(prev => [...prev, false]);
            setSelectedAngles(prev => [...prev, false]);
            // Deselect after synthesis
            setSelectedAngles(prev => prev.map(() => false));
        } catch (e: any) { setError(e.message); setStep('error'); }
        finally { setIsLoading(false); }
    };

    const fetchParts = useCallback(async () => {
        if (!selectedAngle) return;
        setIsLoading(true);
        setLoadingMessage('Structuring high-level parts...');
        setError('');
        try {
            const result = await generateBookParts(book.topic, book.instructions, selectedAngle, selectedFramework, sourceMaterial, writingStyle);
            setParts(result);
            setLockedParts(new Array(result.length).fill(false));
            setSelectedParts(new Array(result.length).fill(false));

            const totalChapters = book.wordCountGoal ? Math.ceil(book.wordCountGoal / 2500) : 12;
            const numParts = result.length > 0 ? result.length : 1;
            const chaptersPerPart = Math.floor(totalChapters / numParts);
            const remainder = totalChapters % numParts;
            const initialCounts = result.map((_, index) => chaptersPerPart + (index < remainder ? 1 : 0));
            setChapterCounts(initialCounts);
        } catch (e: any) {
            setError(e.message);
            setStep('error');
        } finally {
            setIsLoading(false);
        }
    }, [book.topic, book.instructions, book.wordCountGoal, selectedAngle, selectedFramework, sourceMaterial, writingStyle]);

    const handleRegenerateParts = async () => {
        if (!selectedAngle) return;
        setIsLoading(true);
        setLoadingMessage('Generating new parts...');
        setError('');
        try {
            const locked = parts.filter((_, i) => lockedParts[i]);
            const unlockedCount = parts.length - locked.length;

            if (unlockedCount <= 0) {
                toastService.info("All parts are locked. Nothing to regenerate.");
                setIsLoading(false);
                return;
            }

            const newSuggestions = await generateBookParts(book.topic, book.instructions, selectedAngle, selectedFramework, sourceMaterial, writingStyle, locked, unlockedCount);
            
            let suggestionIndex = 0;
            const newParts = parts.map((oldPart, i) => {
                if (lockedParts[i]) {
                    return oldPart;
                } else {
                    return newSuggestions[suggestionIndex++] || "Failed to generate new part";
                }
            });
            setParts(newParts);

        } catch (e: any) {
            setError(e.message);
            setStep('error');
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleGenerateMoreParts = async () => {
        setIsLoading(true);
        setLoadingMessage('Brainstorming more parts...');
        try {
            const newSuggestions = await generateBookParts(book.topic, book.instructions, selectedAngle, selectedFramework, sourceMaterial, writingStyle, parts, 3);
            setParts(prev => [...prev, ...newSuggestions]);
            setLockedParts(prev => [...prev, ...new Array(newSuggestions.length).fill(false)]);
            setSelectedParts(prev => [...prev, ...new Array(newSuggestions.length).fill(false)]);
            setChapterCounts(prev => [...prev, ...new Array(newSuggestions.length).fill(3)]);
        } catch (e: any) { setError(e.message); setStep('error'); }
        finally { setIsLoading(false); }
    };
    
    const handleSynthesizeParts = async () => {
        const partsToSynthesize = parts.filter((_, i) => selectedParts[i]);
        if (partsToSynthesize.length < 2) {
            toastService.info("Please select at least two parts to synthesize.");
            return;
        }
        setIsLoading(true);
        setLoadingMessage('Synthesizing selected parts...');
        try {
            const newPart = await synthesizeBookParts(book.topic, book.instructions, selectedAngle, selectedFramework, sourceMaterial, writingStyle, partsToSynthesize);
            setParts(prev => [...prev, newPart]);
            setLockedParts(prev => [...prev, false]);
            setSelectedParts(prev => [...prev, false]);
            setChapterCounts(prev => [...prev, 3]);
            setSelectedParts(prev => prev.map(() => false));
        } catch (e: any) { setError(e.message); setStep('error'); }
        finally { setIsLoading(false); }
    };

    useEffect(() => {
        if (isOpen) {
            resetState();
        }
    }, [isOpen, resetState]);
    
    useEffect(() => {
        if (step === 'parts' && selectedAngle && parts.length === 0) {
            fetchParts();
        }
    }, [step, selectedAngle, parts.length, fetchParts]);

    const handleAngleSelect = (angle: string) => {
        setSelectedAngle(angle);
        setStep('parts');
    };

    const handleAngleChange = (index: number, value: string) => {
        const newAngles = [...angles];
        newAngles[index] = value;
        setAngles(newAngles);
    };

    const handleDeleteAngle = (index: number) => {
        setAngles(prev => prev.filter((_, i) => i !== index));
        setLockedAngles(prev => prev.filter((_, i) => i !== index));
        setSelectedAngles(prev => prev.filter((_, i) => i !== index));
    };

    const handleAddAngle = () => {
        setAngles(prev => [...prev, 'A new custom angle']);
        setLockedAngles(prev => [...prev, false]);
        setSelectedAngles(prev => [...prev, false]);
    };

    const toggleAngleLock = (index: number) => {
        setLockedAngles(prev => {
            const newLocked = [...prev];
            newLocked[index] = !newLocked[index];
            return newLocked;
        });
    };
    
    const toggleAngleSelection = (index: number) => {
        setSelectedAngles(prev => {
            const newSelected = [...prev];
            newSelected[index] = !newSelected[index];
            return newSelected;
        });
    };
    
    const handlePartChange = (index: number, value: string) => {
        const newParts = [...parts];
        newParts[index] = value;
        setParts(newParts);
    };

    const handleChapterCountChange = (index: number, value: number) => {
        if (isNaN(value) || value < 1) return;
        const newCounts = [...chapterCounts];
        newCounts[index] = value;
        setChapterCounts(newCounts);
    };

    const handleDeletePart = (index: number) => {
        setParts(prev => prev.filter((_, i) => i !== index));
        setChapterCounts(prev => prev.filter((_, i) => i !== index));
        setLockedParts(prev => prev.filter((_, i) => i !== index));
        setSelectedParts(prev => prev.filter((_, i) => i !== index));
    };

    const handleAddPart = () => {
        setParts(prev => [...prev, 'New Custom Part']);
        setChapterCounts(prev => [...prev, 3]);
        setLockedParts(prev => [...prev, false]);
        setSelectedParts(prev => [...prev, false]);
    };
    
    const togglePartLock = (index: number) => {
        setLockedParts(prev => {
            const newLocked = [...prev];
            newLocked[index] = !newLocked[index];
            return newLocked;
        });
    };

    const togglePartSelection = (index: number) => {
        setSelectedParts(prev => {
            const newSelected = [...prev];
            newSelected[index] = !newSelected[index];
            return newSelected;
        });
    };

    const handleFinalize = async () => {
        if (!selectedAngle || parts.length === 0) return;
        setIsLoading(true);
        setStep('generating');
        setLoadingMessage('Generating the full, detailed outline...');
        setError('');
        try {
            const partsWithCounts = parts.map((title, index) => ({
                title,
                chapters: chapterCounts[index] || 3 // Fallback
            }));
            const outline = await generateDetailedOutline(book.topic, book.instructions, selectedAngle, selectedFramework, partsWithCounts, sourceMaterial, writingStyle);
            
            let finalTitle = book.topic;
            if (outline && outline.length > 0) {
                const introTitle = outline[0].title;
                const titleParts = introTitle.split(': ');
                if (titleParts.length > 1) {
                    finalTitle = titleParts.slice(1).join(': ').trim();
                }
            }
            onOutlineGenerated(outline, finalTitle);
        } catch (e: any) {
            setError(e.message);
            setStep('error');
        } finally {
            setIsLoading(false);
        }
    };

    const renderLoading = () => (
        <div className="flex flex-col items-center justify-center p-8 min-h-[300px]">
            <div className="w-12 h-12 border-4 border-t-indigo-500 border-gray-200 rounded-full animate-spin"></div>
            <p className="mt-4 font-semibold text-gray-700 dark:text-gray-300">{loadingMessage}</p>
        </div>
    );
    
    const renderError = () => (
        <div className="p-4">
            <h3 className="text-xl font-bold text-red-600 dark:text-red-400">An Error Occurred</h3>
            <p className="my-4 text-gray-600 dark:text-gray-400">{error}</p>
            <div className="flex justify-end space-x-2">
                <button onClick={onClose} className="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 px-4 py-2 rounded-lg font-semibold">Close</button>
                <button onClick={() => { setStep('angles'); fetchAngles(); }} className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-semibold">Try Again</button>
            </div>
        </div>
    );

    const renderFrameworkStep = () => (
        <>
            <h3 className="text-lg font-semibold mb-1 text-gray-800 dark:text-gray-100">Step 1: Provide Context (Optional)</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Guide the AI with a structural framework, source material, or a stylistic influence.</p>
            
            <div>
                <label htmlFor="framework" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Structural Framework</label>
                <select
                    id="framework"
                    value={selectedFramework}
                    onChange={(e) => setSelectedFramework(e.target.value)}
                    className="mt-1 block w-full bg-white dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                >
                    <option value="none">None (Freestyle Brainstorm)</option>
                    {Object.entries(FRAMEWORKS).map(([group, options]) => (
                        <optgroup label={group} key={group}>
                            {(options as string[]).map(option => (
                                <option key={option} value={option}>{option}</option>
                            ))}
                        </optgroup>
                    ))}
                </select>
            </div>

            <div className="mt-4">
                <label htmlFor="source-material" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Source Material</label>
                <textarea
                    id="source-material"
                    value={sourceMaterial}
                    onChange={(e) => setSourceMaterial(e.target.value)}
                    rows={6}
                    className="mt-1 block w-full bg-white dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Paste research notes, articles, a rough draft, or other source material here..."
                />
            </div>
            <div className="mt-4">
                <label htmlFor="writing-style" className="block text-sm font-medium text-gray-700 dark:text-gray-300">"In The Style Of..."</label>
                <input
                    type="text"
                    id="writing-style"
                    value={writingStyle}
                    onChange={(e) => setWritingStyle(e.target.value)}
                    className="mt-1 block w-full bg-white dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="e.g., Malcolm Gladwell, Brené Brown, The Martian by Andy Weir"
                />
            </div>

            <div className="mt-6 flex justify-end">
                <button
                    onClick={() => {
                        setStep('angles');
                        fetchAngles();
                    }}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-semibold flex items-center space-x-2"
                >
                    <span>Continue to Angles</span>
                    <Icon name="CHEVRON_RIGHT" className="w-5 h-5" />
                </button>
            </div>
        </>
    );

    const renderAngleStep = () => (
        <>
            <h3 className="text-lg font-semibold mb-1 text-gray-800 dark:text-gray-100">Step 2: Choose or Refine a Creative Angle</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Select an angle to proceed, or edit the text to create your own.</p>
            <div className="space-y-3">
                {angles.map((angle, index) => (
                    <div key={index} className={`flex items-center space-x-2 group transition-colors p-1 -m-1 rounded-md ${lockedAngles[index] ? 'bg-zinc-100 dark:bg-zinc-700/50' : ''}`}>
                         <input
                            type="checkbox"
                            checked={selectedAngles[index]}
                            onChange={() => toggleAngleSelection(index)}
                            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <button
                            type="button"
                            onClick={() => toggleAngleLock(index)}
                            className="p-2 rounded-full text-zinc-400 hover:text-indigo-500 hover:bg-indigo-100 dark:hover:bg-zinc-700"
                            aria-label={lockedAngles[index] ? 'Unlock angle' : 'Lock angle'}
                        >
                            <Icon name={lockedAngles[index] ? 'LOCK' : 'UNLOCK'} className="w-4 h-4" />
                        </button>
                        <input
                            type="text"
                            value={angle}
                            onChange={(e) => handleAngleChange(index, e.target.value)}
                            className="flex-grow bg-white dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-zinc-100 dark:disabled:bg-zinc-700/50 disabled:cursor-not-allowed"
                            disabled={lockedAngles[index]}
                        />
                        <button
                            onClick={() => handleAngleSelect(angle)}
                            className="px-4 py-2 text-sm font-semibold rounded-md bg-indigo-600 text-white hover:bg-indigo-700 transition-colors flex-shrink-0"
                        >
                            Select
                        </button>
                        <button
                            onClick={() => handleDeleteAngle(index)}
                            className="p-2 rounded-full text-zinc-400 hover:text-red-500 hover:bg-red-100 dark:hover:bg-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                            aria-label="Delete angle"
                        >
                            <Icon name="TRASH" className="w-4 h-4" />
                        </button>
                    </div>
                ))}
            </div>
             <div className="mt-4 flex justify-between items-center">
                 <div className="flex items-center space-x-2">
                    <button onClick={() => setStep('framework')} className="text-sm font-semibold text-gray-600 dark:text-gray-400 hover:underline p-2">
                        &larr; Back
                    </button>
                    <button
                        onClick={handleAddAngle}
                        className="flex items-center justify-center space-x-2 text-sm font-semibold py-2 px-3 rounded-md bg-zinc-100 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-600"
                    >
                        <Icon name="PLUS" className="w-4 h-4" />
                        <span>Add Angle</span>
                    </button>
                </div>
                <div className="flex items-center space-x-2">
                    <button onClick={handleSynthesizeAngles} disabled={selectedAngles.filter(Boolean).length < 2} className="flex items-center space-x-2 text-sm font-semibold py-2 px-3 rounded-md bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed">
                        <Icon name="SYNTHESIZE" className="w-4 h-4" />
                        <span>Synthesize</span>
                    </button>
                    <button onClick={handleGenerateMoreAngles} className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
                        Generate 3 More
                    </button>
                    <button onClick={handleRegenerateAngles} className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
                        Regenerate Unlocked
                    </button>
                </div>
            </div>
        </>
    );

    const renderPartsStep = () => (
         <>
            <h3 className="text-lg font-semibold mb-1 text-gray-800 dark:text-gray-100">Step 3: Edit the Book Structure</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Adjust these high-level parts and their chapter counts. The AI will write chapters within this structure.</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-md"><strong>Selected Angle:</strong> {selectedAngle}</p>
            <div className="space-y-2">
                {parts.map((part, index) => (
                    <div key={index} className={`flex items-center space-x-2 group transition-colors p-1 -m-1 rounded-md ${lockedParts[index] ? 'bg-zinc-100 dark:bg-zinc-700/50' : ''}`}>
                         <input
                            type="checkbox"
                            checked={selectedParts[index]}
                            onChange={() => togglePartSelection(index)}
                            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                         <button
                            type="button"
                            onClick={() => togglePartLock(index)}
                            className="p-2 rounded-full text-zinc-400 hover:text-indigo-500 hover:bg-indigo-100 dark:hover:bg-zinc-700"
                            aria-label={lockedParts[index] ? 'Unlock part' : 'Lock part'}
                        >
                            <Icon name={lockedParts[index] ? 'LOCK' : 'UNLOCK'} className="w-4 h-4" />
                        </button>
                         <input
                            type="text"
                            value={part}
                            onChange={(e) => handlePartChange(index, e.target.value)}
                            className="flex-grow bg-white dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-zinc-100 dark:disabled:bg-zinc-700/50 disabled:cursor-not-allowed"
                            disabled={lockedParts[index]}
                        />
                        <input
                            type="number"
                            min="1"
                            value={chapterCounts[index] || ''}
                            onChange={(e) => handleChapterCountChange(index, parseInt(e.target.value, 10))}
                            className="w-20 text-center bg-white dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-zinc-100 dark:disabled:bg-zinc-700/50 disabled:cursor-not-allowed"
                            aria-label={`Number of chapters for ${part}`}
                            disabled={lockedParts[index]}
                        />
                        <span className="text-sm text-zinc-500 dark:text-zinc-400 flex-shrink-0">chapters</span>
                        <button
                            onClick={() => handleDeletePart(index)}
                            className="p-2 rounded-full text-zinc-400 hover:text-red-500 hover:bg-red-100 dark:hover:bg-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity"
                            aria-label="Delete part"
                        >
                            <Icon name="TRASH" className="w-4 h-4" />
                        </button>
                    </div>
                ))}
                <button
                    onClick={handleAddPart}
                    className="w-full flex items-center justify-center space-x-2 text-sm font-semibold py-2 px-3 rounded-md bg-zinc-100 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-600 mt-2"
                >
                    <Icon name="PLUS" className="w-4 h-4" />
                    <span>Add Part</span>
                </button>
            </div>
            <div className="mt-6 flex justify-between items-center">
                 <button onClick={() => { setParts([]); setStep('angles'); }} className="text-sm font-semibold text-gray-600 dark:text-gray-400 hover:underline">
                    &larr; Back to Angles
                </button>
                <div className="flex space-x-2">
                    <button onClick={handleSynthesizeParts} disabled={selectedParts.filter(Boolean).length < 2} className="flex items-center space-x-2 text-sm font-semibold py-2 px-3 rounded-md bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed">
                         <Icon name="SYNTHESIZE" className="w-4 h-4" />
                        <span>Synthesize</span>
                    </button>
                     <button onClick={handleGenerateMoreParts} className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
                        Generate 3 More
                    </button>
                    <button onClick={handleRegenerateParts} className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">Regenerate Unlocked</button>
                    <button onClick={handleFinalize} className="bg-green-600 text-white px-4 py-2 rounded-lg font-semibold flex items-center space-x-2">
                        <Icon name="WAND" />
                        <span>Approve & Generate Outline</span>
                    </button>
                </div>
            </div>
        </>
    );
    
    const renderContent = () => {
        if (isLoading) return renderLoading();
        if (step === 'error') return renderError();
        if (step === 'framework') return renderFrameworkStep();
        if (step === 'angles') return renderAngleStep();
        if (step === 'parts') return renderPartsStep();
        if (step === 'generating') return renderLoading();
        return null;
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-4xl max-h-[90vh] flex flex-col border border-gray-200 dark:border-gray-700" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Outline Brainstorm</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700" aria-label="Close modal">
                        <Icon name="CLOSE" className="w-6 h-6" />
                    </button>
                </div>
                <div className="overflow-y-auto pr-2 -mr-2">
                    {renderContent()}
                </div>
            </div>
        </div>
    );
};

export default BrainstormModal;
