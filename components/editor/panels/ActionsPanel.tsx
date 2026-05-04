
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { ICONS } from '../../../constants';
import { useBookEditor } from '../../../contexts/BookEditorContext';
import { modalService } from '../../../services/modalService';
import { toastService } from '../../../services/toastService';
import { RuntimeAiProvider, getAiRuntimeSelection, setAiRuntimeSelection } from '../../../services/gemini';
import Icon from '../../Icon';

interface ActionsPanelProps {
    onSaveAndClose: () => void;
}

const wordCounter = (text: string): number => {
    if (!text || !text.trim()) return 0;
    return text.trim().split(/\s+/).filter(Boolean).length;
};

const ActionsPanel: React.FC<ActionsPanelProps> = ({ onSaveAndClose }) => {
    const {
        book,
        snapshots,
        handleGenerateChapters,
        handleGenerateFullBook,
        handleGenerateSpecificChapter,
        handleStopGenerateFullBook,
        generationMode,
        setGenerationMode,
        setIsSnapshotsPanelOpen,
        handleExportPdf,
        setIsEpubModalOpen,
        createSnapshot,
        isGeneratingChapter,
        isGeneratingRemainingBook,
        isAiEnabled,
        handleRebuildOutline,
        isRebuildingOutline,
        handleInputChange
    } = useBookEditor();

    // State for session tracking
    const initialWordsRef = useRef<number | null>(null);
    const [sessionWords, setSessionWords] = useState(0);
    const [showRebuildPrompt, setShowRebuildPrompt] = useState(false);
    const [rebuildCountInput, setRebuildCountInput] = useState('');
    const [showWordGoalInput, setShowWordGoalInput] = useState(false);
    const [wordGoalInput, setWordGoalInput] = useState('');
    const [chapterGenPopover, setChapterGenPopover] = useState<{ index: number; wordCount: string } | null>(null);
    const [runtimeProvider, setRuntimeProvider] = useState<RuntimeAiProvider | 'default'>('default');
    const [runtimeModel, setRuntimeModel] = useState('');

    useEffect(() => {
        const current = getAiRuntimeSelection();
        setRuntimeProvider(current.provider ?? 'default');
        setRuntimeModel(current.model ?? '');

        const onRuntimeChange = (e: Event) => {
            const detail = (e as CustomEvent<{ provider?: RuntimeAiProvider; model?: string }>).detail;
            setRuntimeProvider(detail?.provider ?? 'default');
            setRuntimeModel(detail?.model ?? '');
        };

        window.addEventListener('ai-runtime-selection-changed', onRuntimeChange);
        return () => window.removeEventListener('ai-runtime-selection-changed', onRuntimeChange);
    }, []);

    const applyRuntimeSelection = () => {
        setAiRuntimeSelection(runtimeProvider === 'default' ? undefined : runtimeProvider, runtimeModel.trim() || undefined);
        toastService.success(runtimeProvider === 'default'
            ? 'AI provider reset to Settings default.'
            : `AI provider set to ${runtimeProvider}${runtimeModel.trim() ? ` (${runtimeModel.trim()})` : ''}.`);
    };

            if (!book) return null;

    // Calculations
    const totalChapters = book.outline.length;
    const writtenChapters = book.content.filter(c => c?.htmlContent?.trim()).length;
    const nextChapterIndex = book.content.findIndex(c => !c?.htmlContent?.trim());
    const isComplete = book.status === 'complete';
    const progressPercentage = Math.round((writtenChapters / totalChapters) * 100) || 0;

    const totalWords = useMemo(() => {
        return book.content.reduce((acc, chapter) => {
            if (!chapter) return acc;
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = chapter.htmlContent;
            const text = tempDiv.textContent || "";
            return acc + wordCounter(text);
        }, 0);
    }, [book.content]);

    // Initialize session start word count
    useEffect(() => {
        if (initialWordsRef.current === null && totalWords > 0) {
            initialWordsRef.current = totalWords;
        }
        if (initialWordsRef.current !== null) {
            setSessionWords(Math.max(0, totalWords - initialWordsRef.current));
        }
    }, [totalWords]);

    const wordCountGoal = book.wordCountGoal || 0;
    const wordCountPercentage = wordCountGoal > 0 ? Math.min(100, Math.round((totalWords / wordCountGoal) * 100)) : 0;
    
    // Reading time: ~250 words per minute
    const readingTimeMinutes = Math.ceil(totalWords / 250);
    const readingTimeDisplay = readingTimeMinutes > 60 
        ? `${Math.floor(readingTimeMinutes / 60)}h ${readingTimeMinutes % 60}m` 
        : `${readingTimeMinutes} min`;

    const handleCreateSnapshotClick = async () => {
        const name = await modalService.prompt({
            title: 'Create Snapshot',
            message: 'Enter a name for this snapshot to easily identify it later.',
            inputLabel: 'Snapshot Name',
            initialValue: `Snapshot ${new Date().toLocaleString()}`
        });
        if (name) {
            await createSnapshot(name);
        }
    };

    const handleChapterJump = (index: number) => {
        const element = document.getElementById(`chapter-${index}`);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    const handleCopyToClipboard = () => {
        const fullText = book.content.map(c => {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = c.htmlContent;
            return tempDiv.textContent || "";
        }).join('\n\n');

        navigator.clipboard.writeText(fullText).then(() => {
            toastService.success("Full book text copied to clipboard!");
        }).catch(() => {
            toastService.error("Failed to copy text.");
        });
    };

    return (
        <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-md border border-zinc-200 dark:border-zinc-700 overflow-hidden flex flex-col">
            {/* Header & Stats */}
            <div className="p-5 border-b border-zinc-100 dark:border-zinc-700/50 bg-zinc-50/50 dark:bg-zinc-800/50">
                <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-100 mb-4 flex items-center">
                    <Icon name="GRID" className="w-5 h-5 mr-2 text-indigo-500" />
                    Project Status
                </h2>
                
                {/* Metrics Grid */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-white dark:bg-zinc-700/50 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700">
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1">Words</p>
                        <p className="text-lg font-bold text-zinc-800 dark:text-zinc-100">{totalWords.toLocaleString()}</p>
                    </div>
                    <div className="bg-white dark:bg-zinc-700/50 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700">
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1">Reading Time</p>
                        <p className="text-lg font-bold text-zinc-800 dark:text-zinc-100">{readingTimeDisplay}</p>
                    </div>
                    <div className="bg-indigo-50 dark:bg-indigo-900/20 p-2.5 rounded-lg border border-indigo-100 dark:border-indigo-900/30">
                        <p className="text-xs text-indigo-600 dark:text-indigo-300 uppercase tracking-wide mb-1">Session</p>
                        <p className="text-lg font-bold text-indigo-700 dark:text-indigo-200">+{sessionWords.toLocaleString()}</p>
                    </div>
                    <div className="bg-white dark:bg-zinc-700/50 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700">
                        <div className="flex items-center justify-between mb-1">
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Goal</p>
                            <button
                                onClick={() => { setWordGoalInput(String(book.wordCountGoal || '')); setShowWordGoalInput(v => !v); }}
                                className="text-zinc-400 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors"
                                title="Set word count goal"
                            >
                                <Icon name="EDIT" className="w-3 h-3" />
                            </button>
                        </div>
                        {showWordGoalInput ? (
                            <div className="flex items-center gap-1 mt-1">
                                <input
                                    type="number"
                                    min={1}
                                    value={wordGoalInput}
                                    onChange={e => setWordGoalInput(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                            const val = parseInt(wordGoalInput);
                                            if (!isNaN(val) && val > 0) {
                                                handleInputChange({ target: { name: 'wordCountGoal', value: String(val), type: 'number' } } as any);
                                            }
                                            setShowWordGoalInput(false);
                                        } else if (e.key === 'Escape') {
                                            setShowWordGoalInput(false);
                                        }
                                    }}
                                    className="w-full text-sm font-bold bg-transparent border-b border-indigo-400 outline-none text-zinc-800 dark:text-zinc-100"
                                    autoFocus
                                    placeholder="e.g. 80000"
                                />
                                <button
                                    onClick={() => {
                                        const val = parseInt(wordGoalInput);
                                        if (!isNaN(val) && val > 0) {
                                            handleInputChange({ target: { name: 'wordCountGoal', value: String(val), type: 'number' } } as any);
                                        }
                                        setShowWordGoalInput(false);
                                    }}
                                    className="text-indigo-500 hover:text-indigo-700 flex-shrink-0 text-sm font-bold"
                                    title="Confirm"
                                >✓</button>
                            </div>
                        ) : (
                            <p className="text-lg font-bold text-zinc-800 dark:text-zinc-100">
                                {wordCountGoal > 0 ? `${wordCountPercentage}%` : <span className="text-sm text-zinc-400">—</span>}
                            </p>
                        )}
                    </div>
                </div>

                <div className="space-y-2">
                    {/* Chapter Progress Bar */}
                    <div className="relative pt-1">
                        <div className="flex mb-1 items-center justify-between">
                            <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300 py-1">
                                Chapter Completion
                            </span>
                            <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300 py-1">
                                {writtenChapters}/{totalChapters}
                            </span>
                        </div>
                        <div className="overflow-hidden h-2 mb-1 text-xs flex rounded-full bg-zinc-200 dark:bg-zinc-700">
                            <div style={{ width: `${progressPercentage}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-indigo-500 transition-all duration-500"></div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-5 space-y-6 flex-grow flex flex-col">
                {/* Generation Actions */}
                {isAiEnabled && !isComplete ? (
                    <div className="space-y-2">
                        <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/40 p-2.5 space-y-2">
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">AI Provider (Runtime)</div>
                            <div className="grid grid-cols-1 gap-2">
                                <select
                                    value={runtimeProvider}
                                    onChange={(e) => setRuntimeProvider(e.target.value as RuntimeAiProvider | 'default')}
                                    className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 dark:bg-zinc-800 text-sm px-2 py-1.5"
                                    aria-label="Runtime AI provider"
                                >
                                    <option value="default">Use Settings Default</option>
                                    <option value="gemini">Gemini</option>
                                    <option value="ollama">Ollama</option>
                                    <option value="anythingllm">AnythingLLM</option>
                                    <option value="openai">OpenAI</option>
                                </select>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={runtimeModel}
                                        onChange={(e) => setRuntimeModel(e.target.value)}
                                        placeholder="Optional model override"
                                        className="flex-1 rounded-md border border-zinc-300 dark:border-zinc-600 dark:bg-zinc-800 text-sm px-2 py-1.5"
                                        aria-label="Runtime AI model"
                                    />
                                    <button
                                        onClick={applyRuntimeSelection}
                                        className="px-3 py-1.5 rounded-md bg-zinc-200 dark:bg-zinc-700 text-xs font-semibold text-zinc-800 dark:text-zinc-100 hover:bg-zinc-300 dark:hover:bg-zinc-600"
                                    >
                                        Apply
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-1 p-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/40">
                            <button
                                onClick={() => setGenerationMode('full')}
                                disabled={isGeneratingChapter !== null}
                                className={`px-2 py-1.5 rounded-md text-xs font-semibold transition-colors ${generationMode === 'full' ? 'bg-indigo-600 text-white' : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
                                title="Generate with an extra validation and polish pass"
                            >
                                Full Validation
                            </button>
                            <button
                                onClick={() => setGenerationMode('budget')}
                                disabled={isGeneratingChapter !== null}
                                className={`px-2 py-1.5 rounded-md text-xs font-semibold transition-colors ${generationMode === 'budget' ? 'bg-amber-600 text-white' : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
                                title="Single-pass generation to save tokens"
                            >
                                Budget Mode
                            </button>
                        </div>

                        <button 
                            onClick={() => handleGenerateChapters()} 
                            disabled={isGeneratingChapter !== null} 
                            className="w-full bg-indigo-600 text-white px-4 py-3 rounded-lg shadow-md font-bold hover:bg-indigo-700 transition-all transform active:scale-[0.98] disabled:bg-indigo-400 dark:disabled:bg-indigo-900 disabled:cursor-not-allowed flex items-center justify-center space-x-2 border border-transparent"
                        >
                            {isGeneratingChapter ? (
                                <><Icon name="ROTATE_CW" className="animate-spin w-5 h-5" /><span>Writing...</span></>
                            ) : (
                                <><Icon name="WAND" className="w-5 h-5" /><span>Write Next Chapter</span></>
                            )}
                        </button>
                        {isGeneratingRemainingBook ? (
                            <button
                                onClick={() => handleStopGenerateFullBook()}
                                className="w-full text-xs font-semibold text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 hover:underline py-1 transition-colors text-center"
                            >
                                Stop Auto-Generation
                            </button>
                        ) : (
                            <button 
                                onClick={() => handleGenerateFullBook()} 
                                disabled={isGeneratingChapter !== null} 
                                className="w-full text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:underline py-1 transition-colors text-center"
                            >
                                Auto-Generate Remaining Chapters
                            </button>
                        )}
                    </div>
                ) : isComplete && (
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900 rounded-lg p-4 text-center">
                        <Icon name="SPARKLES" className="w-8 h-8 mx-auto text-emerald-500 mb-2" />
                        <p className="text-emerald-700 dark:text-emerald-400 font-bold">Book Draft Complete!</p>
                        <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-1">Time to edit and polish.</p>
                    </div>
                )}

                {/* Chapter List */}
                <div className="border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden flex-grow max-h-64 flex flex-col">
                    <div className="bg-zinc-50 dark:bg-zinc-900/50 px-3 py-2 border-b border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex-shrink-0 flex items-center justify-between">
                        <span>Outline</span>
                        {isAiEnabled && (
                            <button
                                onClick={() => {
                                    setRebuildCountInput(String(totalChapters));
                                    setShowRebuildPrompt(v => !v);
                                }}
                                title="Rebuild outline with different chapter count"
                                className="p-0.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                                disabled={isRebuildingOutline || isGeneratingChapter !== null}
                            >
                                {isRebuildingOutline
                                    ? <Icon name="ROTATE_CW" className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                                    : <Icon name="EDIT" className="w-3.5 h-3.5 text-zinc-400 hover:text-indigo-500" />}
                            </button>
                        )}
                    </div>
                    {showRebuildPrompt && (
                        <div className="px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 flex items-center gap-2">
                            <input
                                type="number"
                                min={1}
                                max={200}
                                value={rebuildCountInput}
                                onChange={e => setRebuildCountInput(e.target.value)}
                                aria-label="Target chapter count"
                                placeholder={String(totalChapters)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                        const n = parseInt(rebuildCountInput, 10);
                                        if (n >= 1 && n <= 200) { setShowRebuildPrompt(false); handleRebuildOutline(n); }
                                        else toastService.error('Enter a number between 1 and 200.');
                                    }
                                    if (e.key === 'Escape') setShowRebuildPrompt(false);
                                }}
                                className="w-16 text-xs bg-white dark:bg-zinc-800 border border-amber-300 dark:border-amber-700 rounded px-2 py-1 font-semibold text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                                autoFocus
                            />
                            <button
                                onClick={() => {
                                    const n = parseInt(rebuildCountInput, 10);
                                    if (n >= 1 && n <= 200) { setShowRebuildPrompt(false); handleRebuildOutline(n); }
                                    else toastService.error('Enter a number between 1 and 200.');
                                }}
                                className="flex-1 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white rounded px-2 py-1 transition-colors whitespace-nowrap"
                            >
                                Rebuild
                            </button>
                            <button onClick={() => setShowRebuildPrompt(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 text-xs px-1">
                                ✕
                            </button>
                        </div>
                    )}
                    <ul className="overflow-y-auto bg-white dark:bg-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-700/50 flex-grow">
                        {book.outline.map((ch, index) => {
                            const isWritten = !!(book.content[index]?.htmlContent?.trim());
                            const isGeneratingThis = isGeneratingChapter === index;
                            const isExpanded = chapterGenPopover?.index === index;
                            const defaultWordCount = book.wordCountGoal && book.outline.length
                                ? Math.round(book.wordCountGoal / book.outline.length)
                                : 1000;
                            return (
                                <li key={index} className="text-sm transition-colors">
                                    <div
                                        onClick={() => isWritten && !isExpanded && handleChapterJump(index)}
                                        className={`px-3 py-2 flex items-center space-x-2 transition-colors group ${isWritten && !isExpanded ? 'cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-700/50' : 'cursor-default'}`}
                                    >
                                        <span className={`flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-medium ${isWritten ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300' : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-700'}`}>
                                            {isGeneratingThis
                                                ? <Icon name="ROTATE_CW" className="w-3 h-3 animate-spin text-indigo-500" />
                                                : isWritten ? '✓' : index + 1}
                                        </span>
                                        <span className={`truncate flex-grow ${isWritten ? 'text-zinc-700 dark:text-zinc-200' : 'text-zinc-500 dark:text-zinc-400'}`}>
                                            {ch.title}
                                        </span>
                                        {isAiEnabled && !isGeneratingThis && (
                                            <button
                                                onClick={e => {
                                                    e.stopPropagation();
                                                    if (isExpanded) {
                                                        setChapterGenPopover(null);
                                                    } else {
                                                        setChapterGenPopover({ index, wordCount: String(defaultWordCount) });
                                                    }
                                                }}
                                                disabled={isGeneratingChapter !== null}
                                                title={isWritten ? 'Regenerate chapter' : 'Generate chapter'}
                                                className={`flex-shrink-0 p-1 rounded transition-colors ${
                                                    isExpanded
                                                        ? 'opacity-100 text-indigo-500 bg-indigo-50 dark:bg-indigo-900/30'
                                                        : 'opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-indigo-500'
                                                } disabled:opacity-30`}
                                            >
                                                <Icon name="WAND" className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                    {isExpanded && (
                                        <div className="px-3 pb-2 pt-1.5 bg-indigo-50 dark:bg-indigo-900/20 border-t border-indigo-100 dark:border-indigo-800">
                                            <div className="flex items-center gap-1.5">
                                                <label className="text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap">Words:</label>
                                                <input
                                                    type="number"
                                                    min={100}
                                                    max={10000}
                                                    aria-label="Target word count for this chapter"
                                                    value={chapterGenPopover?.wordCount ?? String(defaultWordCount)}
                                                    onChange={e => setChapterGenPopover(prev => prev ? { ...prev, wordCount: e.target.value } : null)}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') {
                                                            const wc = parseInt(chapterGenPopover?.wordCount || '', 10);
                                                            setChapterGenPopover(null);
                                                            handleGenerateSpecificChapter(index, isNaN(wc) ? defaultWordCount : wc);
                                                        }
                                                        if (e.key === 'Escape') setChapterGenPopover(null);
                                                    }}
                                                    className="w-16 text-xs bg-white dark:bg-zinc-800 border border-indigo-200 dark:border-indigo-700 rounded px-2 py-1 font-semibold text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                                    autoFocus
                                                />
                                                <button
                                                    onClick={() => {
                                                        const wc = parseInt(chapterGenPopover?.wordCount || '', 10);
                                                        setChapterGenPopover(null);
                                                        handleGenerateSpecificChapter(index, isNaN(wc) ? defaultWordCount : wc);
                                                    }}
                                                    disabled={isGeneratingChapter !== null}
                                                    className="flex-1 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded px-2 py-1 transition-colors whitespace-nowrap flex items-center justify-center gap-1 disabled:opacity-40"
                                                >
                                                    <Icon name="WAND" className="w-3 h-3" />
                                                    {isWritten ? 'Regenerate' : 'Generate'}
                                                </button>
                                                <button
                                                    onClick={() => setChapterGenPopover(null)}
                                                    title="Cancel"
                                                    className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 flex-shrink-0 text-xs"
                                                >✕</button>
                                            </div>
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </div>

                {/* Tools Grid */}
                <div>
                    <h4 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3">Tools & Export</h4>
                    <div className="grid grid-cols-4 gap-2">
                        <button onClick={handleCreateSnapshotClick} className="flex flex-col items-center justify-center p-2 rounded-lg bg-zinc-50 dark:bg-zinc-700/30 hover:bg-zinc-100 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 transition-all group" title="Create Snapshot">
                            <Icon name="SAVE" className="w-5 h-5 text-zinc-600 dark:text-zinc-400 group-hover:text-indigo-500 mb-1" />
                            <span className="text-[10px] font-medium text-zinc-600 dark:text-zinc-300">Snap</span>
                        </button>
                        <button onClick={() => setIsSnapshotsPanelOpen(true)} className="flex flex-col items-center justify-center p-2 rounded-lg bg-zinc-50 dark:bg-zinc-700/30 hover:bg-zinc-100 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 transition-all group" title="View History">
                            <div className="relative">
                                <Icon name="HISTORY" className="w-5 h-5 text-zinc-600 dark:text-zinc-400 group-hover:text-indigo-500 mb-1" />
                                {snapshots.length > 0 && <span className="absolute -top-1 -right-1 bg-indigo-500 text-[8px] w-3 h-3 flex items-center justify-center rounded-full text-white">{snapshots.length}</span>}
                            </div>
                            <span className="text-[10px] font-medium text-zinc-600 dark:text-zinc-300">History</span>
                        </button>
                        <button onClick={handleExportPdf} className="flex flex-col items-center justify-center p-2 rounded-lg bg-zinc-50 dark:bg-zinc-700/30 hover:bg-zinc-100 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 transition-all group" title="Export PDF">
                            <Icon name="DOWNLOAD" className="w-5 h-5 text-zinc-600 dark:text-zinc-400 group-hover:text-indigo-500 mb-1" />
                            <span className="text-[10px] font-medium text-zinc-600 dark:text-zinc-300">PDF</span>
                        </button>
                        <button onClick={() => setIsEpubModalOpen(true)} className="flex flex-col items-center justify-center p-2 rounded-lg bg-zinc-50 dark:bg-zinc-700/30 hover:bg-zinc-100 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 transition-all group" title="Export ePub">
                            <Icon name="BOOK" className="w-5 h-5 text-zinc-600 dark:text-zinc-400 group-hover:text-indigo-500 mb-1" />
                            <span className="text-[10px] font-medium text-zinc-600 dark:text-zinc-300">ePub</span>
                        </button>
                    </div>
                    <button onClick={handleCopyToClipboard} className="w-full mt-3 flex items-center justify-center space-x-2 p-2 rounded-lg bg-zinc-50 dark:bg-zinc-700/30 hover:bg-zinc-100 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 transition-all text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-300">
                        <Icon name="COPY" className="w-4 h-4" />
                        <span>Copy Full Text</span>
                    </button>
                </div>

                <button 
                    onClick={onSaveAndClose} 
                    className="w-full bg-zinc-800 dark:bg-zinc-100 text-zinc-100 dark:text-zinc-900 px-4 py-3 rounded-lg font-bold shadow-sm hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-colors flex items-center justify-center space-x-2 mt-auto"
                >
                    <Icon name="SAVE" className="w-5 h-5" />
                    <span>Save & Exit</span>
                </button>
            </div>
        </div>
    );
};

export default ActionsPanel;
