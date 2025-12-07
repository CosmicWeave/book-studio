
import React, { useState, useEffect } from 'react';
import { useBookEditor } from '../../contexts/BookEditorContext';
import { ICONS } from '../../constants';
import Icon from '../Icon';
import * as gemini from '../../services/gemini';
import { toastService } from '../../services/toastService';
import VoicePromptHelpModal from '../VoicePromptHelpModal';
import { audiobookGenerator } from '../../services/audiobookGenerator';

// --- Audio Helper Functions for Preview (still needed locally) ---
function decode(base64: string) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

function createWavBlob(pcmData: Uint8Array, sampleRate: number, numChannels: number, bitsPerSample: number): Blob {
    const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
    const blockAlign = numChannels * (bitsPerSample / 8);
    const dataSize = pcmData.length;
    const chunkSize = 36 + dataSize;
    
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    // RIFF header
    view.setUint8(0, 'R'.charCodeAt(0)); view.setUint8(1, 'I'.charCodeAt(0)); view.setUint8(2, 'F'.charCodeAt(0)); view.setUint8(3, 'F'.charCodeAt(0));
    view.setUint32(4, chunkSize, true);
    view.setUint8(8, 'W'.charCodeAt(0)); view.setUint8(9, 'A'.charCodeAt(0)); view.setUint8(10, 'V'.charCodeAt(0)); view.setUint8(11, 'E'.charCodeAt(0));
    // fmt sub-chunk
    view.setUint8(12, 'f'.charCodeAt(0)); view.setUint8(13, 'm'.charCodeAt(0)); view.setUint8(14, 't'.charCodeAt(0)); view.setUint8(15, ' '.charCodeAt(0));
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    // data sub-chunk
    view.setUint8(36, 'd'.charCodeAt(0)); view.setUint8(37, 'a'.charCodeAt(0)); view.setUint8(38, 't'.charCodeAt(0)); view.setUint8(39, 'a'.charCodeAt(0));
    view.setUint32(40, dataSize, true);

    const pcmAsUint8 = new Uint8Array(pcmData.buffer);
    for (let i = 0; i < dataSize; i++) {
        view.setUint8(44 + i, pcmAsUint8[i]);
    }

    return new Blob([view], { type: 'audio/wav' });
}


const AudiobookDownloadModal: React.FC = () => {
    const { isDownloadModalOpen, setIsDownloadModalOpen, book, geminiTTSVoices, downloadModalInitialSelection, handleUpdateVoiceStyle } = useBookEditor();
    
    const [selectedVoice, setSelectedVoice] = useState(geminiTTSVoices[0] || 'Kore');
    const [isPreviewing, setIsPreviewing] = useState(false);
    const [voiceInstructions, setVoiceInstructions] = useState('');
    const [isGeneratingInstructions, setIsGeneratingInstructions] = useState(false);
    const [showHelpModal, setShowHelpModal] = useState(false);
    
    // Download options
    const [downloadMode, setDownloadMode] = useState<'all' | 'selection'>('all');
    const [selectedChapters, setSelectedChapters] = useState<Set<number>>(new Set());

    useEffect(() => {
        if (isDownloadModalOpen && book) {
            if (book.voiceStyleInstructions) {
                setVoiceInstructions(book.voiceStyleInstructions);
            }

            if (downloadModalInitialSelection && downloadModalInitialSelection.length > 0) {
                setDownloadMode('selection');
                setSelectedChapters(new Set(downloadModalInitialSelection));
            } else {
                setDownloadMode('all');
                setSelectedChapters(new Set());
            }
        }
    }, [isDownloadModalOpen, downloadModalInitialSelection, book]);

    if (!isDownloadModalOpen || !book) return null;

    const handleClose = () => {
        // Persist instructions on close
        if (voiceInstructions !== book.voiceStyleInstructions) {
            handleUpdateVoiceStyle(voiceInstructions);
        }
        setIsDownloadModalOpen(false);
    }

    const handlePreviewVoice = async () => {
        if (isPreviewing) return;
        setIsPreviewing(true);
        try {
            const text = `This is a preview of the ${selectedVoice} voice. ${voiceInstructions ? 'Checking style instructions.' : ''}`;
            const base64Audio = await gemini.generateSpeech(text, selectedVoice, voiceInstructions);
            const pcmData = decode(base64Audio);
            const wavBlob = createWavBlob(pcmData, 24000, 1, 16);
            const url = URL.createObjectURL(wavBlob);
            const audio = new Audio(url);
            await audio.play();
        } catch (e: any) {
            toastService.error(`Preview failed: ${e.message}`);
        } finally {
            setIsPreviewing(false);
        }
    };

    const handleGenerateInstructions = async () => {
        if (!book) return;
        setIsGeneratingInstructions(true);
        try {
            // Get a sample of content
            const sampleChapter = book.content.find(c => c && c.htmlContent.length > 100);
            let contentSample = '';
            
            if (sampleChapter) {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = sampleChapter.htmlContent;
                contentSample = tempDiv.textContent || '';
            } else {
                contentSample = book.description || book.instructions;
            }

            const suggestion = await gemini.generateVoiceInstructions(book.topic, contentSample);
            setVoiceInstructions(suggestion);
            toastService.success("Voice instructions generated!");
        } catch (e: any) {
            toastService.error("Failed to generate instructions.");
        } finally {
            setIsGeneratingInstructions(false);
        }
    };

    const toggleChapterSelection = (index: number) => {
        const newSet = new Set(selectedChapters);
        if (newSet.has(index)) {
            newSet.delete(index);
        } else {
            newSet.add(index);
        }
        setSelectedChapters(newSet);
    };

    const toggleAllSelection = () => {
        if (selectedChapters.size === book.content.length) {
            setSelectedChapters(new Set());
        } else {
            setSelectedChapters(new Set(book.content.map((_, i) => i)));
        }
    };

    const handleStartDownload = async () => {
        if (voiceInstructions !== book.voiceStyleInstructions) {
            handleUpdateVoiceStyle(voiceInstructions);
        }

        // Prepare tasks
        let chaptersToDownload = [];
        if (downloadMode === 'all') {
            chaptersToDownload = book.content.map((c, i) => ({ content: c, index: i })).filter(item => item.content && item.content.htmlContent.trim());
        } else {
            chaptersToDownload = book.content.map((c, i) => ({ content: c, index: i }))
                .filter(item => selectedChapters.has(item.index) && item.content && item.content.htmlContent.trim());
        }

        if (chaptersToDownload.length === 0) {
            toastService.info("No chapters selected or content is empty.");
            return;
        }

        const chapterTasks = chaptersToDownload.map(({ content, index }) => ({
            chapterIndex: index + 1,
            title: content.title,
            htmlContent: content.htmlContent
        }));

        // Hand off to background service
        await audiobookGenerator.startDownload(book.topic, chapterTasks, selectedVoice, voiceInstructions);
        
        toastService.success("Download started in background.");
        setIsDownloadModalOpen(false);
    };

    return (
        <>
            <VoicePromptHelpModal isOpen={showHelpModal} onClose={() => setShowHelpModal(false)} />
            <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[10002] p-4 animate-fade-in" onClick={handleClose}>
                <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-2xl p-6 w-full max-w-lg border border-zinc-200 dark:border-zinc-700 flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-center mb-4 pb-4 border-b border-zinc-200 dark:border-zinc-700 flex-shrink-0">
                        <h2 className="text-2xl font-bold text-zinc-800 dark:text-zinc-100">Download Audiobook</h2>
                        <button onClick={handleClose} className="p-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700" aria-label="Close modal">
                            <Icon name="CLOSE" className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="flex-grow overflow-y-auto pr-1 space-y-5">
                        {/* Voice Selection */}
                        <div>
                            <label htmlFor="voice-select" className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">Narrator Voice</label>
                            <div className="flex gap-2">
                                <select
                                    id="voice-select"
                                    value={selectedVoice}
                                    onChange={(e) => setSelectedVoice(e.target.value)}
                                    className="flex-grow block w-full bg-white dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                                >
                                    {geminiTTSVoices.map(voice => (
                                        <option key={voice} value={voice}>{voice}</option>
                                    ))}
                                </select>
                                <button
                                    onClick={handlePreviewVoice}
                                    disabled={isPreviewing}
                                    className="px-3 py-2 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-200 rounded-md hover:bg-indigo-200 dark:hover:bg-indigo-800 transition-colors flex items-center disabled:opacity-50"
                                    title="Preview Voice with current instructions"
                                >
                                    {isPreviewing ? <Icon name="ROTATE_CW" className="w-4 h-4 animate-spin" /> : <Icon name="PLAY" className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        {/* Voice Instructions */}
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <div className="flex items-center gap-2">
                                    <label htmlFor="voice-instructions" className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Voice Style Instructions</label>
                                    <button 
                                        onClick={() => setShowHelpModal(true)}
                                        className="text-zinc-400 hover:text-indigo-500 transition-colors"
                                        title="How to write voice prompts"
                                    >
                                        <Icon name="INFO" className="w-4 h-4" />
                                    </button>
                                </div>
                                <button 
                                    onClick={handleGenerateInstructions}
                                    disabled={isGeneratingInstructions}
                                    className="flex items-center space-x-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 disabled:opacity-50"
                                    title="Generate instructions based on book content"
                                >
                                    <Icon name="WAND" className={`w-3 h-3 ${isGeneratingInstructions ? 'animate-spin' : ''}`} />
                                    <span>Auto-Generate</span>
                                </button>
                            </div>
                            <textarea
                                id="voice-instructions"
                                value={voiceInstructions}
                                onChange={(e) => setVoiceInstructions(e.target.value)}
                                rows={3}
                                className="w-full bg-white dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm placeholder-zinc-400"
                                placeholder='e.g., "A deep, gravelly voice, slow and ominous."'
                            />
                        </div>

                        {/* Scope Selection */}
                        <div>
                            <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">Download Scope</label>
                            <div className="flex space-x-4 mb-3">
                                <label className="flex items-center cursor-pointer">
                                    <input 
                                        type="radio" 
                                        name="downloadMode" 
                                        checked={downloadMode === 'all'} 
                                        onChange={() => setDownloadMode('all')}
                                        className="text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span className="ml-2 text-sm text-zinc-700 dark:text-zinc-300">Full Book</span>
                                </label>
                                <label className="flex items-center cursor-pointer">
                                    <input 
                                        type="radio" 
                                        name="downloadMode" 
                                        checked={downloadMode === 'selection'} 
                                        onChange={() => setDownloadMode('selection')}
                                        className="text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span className="ml-2 text-sm text-zinc-700 dark:text-zinc-300">Specific Chapters</span>
                                </label>
                            </div>

                            {downloadMode === 'selection' && (
                                <div className="border border-zinc-200 dark:border-zinc-700 rounded-md p-2 max-h-48 overflow-y-auto bg-zinc-50 dark:bg-zinc-900/50">
                                    <div className="flex justify-between items-center px-2 pb-2 mb-2 border-b border-zinc-200 dark:border-zinc-700">
                                        <span className="text-xs font-semibold text-zinc-500 uppercase">Select Chapters</span>
                                        <button onClick={toggleAllSelection} className="text-xs text-indigo-600 hover:underline">
                                            {selectedChapters.size === book.content.length ? 'Deselect All' : 'Select All'}
                                        </button>
                                    </div>
                                    <div className="space-y-1">
                                        {book.outline.map((chapter, idx) => (
                                            <label key={idx} className="flex items-center space-x-3 p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded cursor-pointer">
                                                <input 
                                                    type="checkbox" 
                                                    checked={selectedChapters.has(idx)} 
                                                    onChange={() => toggleChapterSelection(idx)}
                                                    className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                                                />
                                                <span className="text-sm text-zinc-700 dark:text-zinc-300 truncate">
                                                    {idx + 1}. {chapter.title}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <p className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-700/30 p-3 rounded-md">
                            Audiobook generation will run in the background. You can continue working while it downloads.
                        </p>
                    </div>
                    
                    <div className="mt-6 pt-4 border-t border-zinc-200 dark:border-zinc-700 flex justify-end space-x-3 flex-shrink-0">
                        <button onClick={handleClose} className="bg-zinc-200 dark:bg-zinc-600 text-zinc-800 dark:text-zinc-100 px-4 py-2 rounded-lg font-semibold hover:bg-zinc-300 dark:hover:bg-zinc-500 transition-colors">
                            Cancel
                        </button>
                        <button onClick={handleStartDownload} disabled={downloadMode === 'selection' && selectedChapters.size === 0} className="bg-teal-600 text-white px-6 py-2 rounded-lg shadow font-semibold hover:bg-teal-700 transition-colors flex items-center space-x-2 disabled:opacity-50 disabled:bg-teal-800">
                            <Icon name="DOWNLOAD" className="w-5 h-5" />
                            <span>Start Background Download</span>
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default AudiobookDownloadModal;
