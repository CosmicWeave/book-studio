
import React, { useState } from 'react';
import { ICONS } from '../../../constants';
import { useBookEditor } from '../../../contexts/BookEditorContext';
import Icon from '../../Icon';

const VOICE_DESCRIPTIONS: Record<string, string> = {
    'Kore': 'Female • Calm & Soothing',
    'Puck': 'Male • Playful & Expressive',
    'Charon': 'Male • Deep & Authoritative',
    'Fenrir': 'Male • Intense & Gripping',
    'Zephyr': 'Female • Gentle & Soft',
};

const AudiobookPanel: React.FC = () => {
    const { 
        book, 
        activeChapterIndex,
        geminiTTSVoices,
        audiobookState,
        handlePlayFullBook,
        handlePlayChapter,
        handleSetVoice,
        handlePauseAudiobook,
        handleResumeAudiobook,
        handleStopAudiobook,
        handleSkipChapter,
        handleDownloadAudiobook
    } = useBookEditor();
    const [isPanelOpen, setIsPanelOpen] = useState(true);

    if (!book) return null;

    const { selectedVoiceName, isPlaying, isPaused, isLoading, currentChapterIndex, progress } = audiobookState;
    const isPlaybackActive = isPlaying || isPaused || isLoading;

    const currentChapterHasContent = book.content[activeChapterIndex]?.htmlContent?.trim().length > 0;
    const currentPlayingChapter = book?.outline[currentChapterIndex];

    const playerButtonClass = "p-2 rounded-full text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50";

    return (
        <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 overflow-hidden transition-all duration-200 hover:shadow-md hover:border-fuchsia-200 dark:hover:border-fuchsia-900/50 group">
            <button 
                onClick={() => setIsPanelOpen(!isPanelOpen)} 
                className="w-full flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-700/30 transition-colors"
            >
                <div className="flex items-center space-x-3">
                    <div className="p-2 bg-fuchsia-100 dark:bg-fuchsia-900/30 rounded-lg text-fuchsia-600 dark:text-fuchsia-400 group-hover:scale-110 transition-transform">
                        <Icon name="HEADPHONES" className="w-4 h-4" />
                    </div>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-100 text-sm">Audiobook</span>
                </div>
                <Icon name="CHEVRON_LEFT" className={`w-4 h-4 text-zinc-400 transform transition-transform duration-300 ${isPanelOpen ? '-rotate-90' : 'rotate-0'}`} />
            </button>
            
            {isPanelOpen && (
                <div className="p-4 pt-0 space-y-4 border-t border-zinc-100 dark:border-zinc-700/50 animate-slide-in-down bg-zinc-50/50 dark:bg-zinc-900/30">
                    {isPlaybackActive ? (
                        <div className="space-y-4 mt-4">
                            <div className="bg-white dark:bg-zinc-800 p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                                        {isLoading ? 'Buffering...' : isPlaying ? 'Now Playing' : 'Paused'}
                                    </span>
                                    {isPlaying && (
                                        <div className="flex space-x-0.5 h-3 items-end">
                                            <div className="w-1 bg-indigo-500 animate-music-bar-1 h-full"></div>
                                            <div className="w-1 bg-indigo-500 animate-music-bar-2 h-2"></div>
                                            <div className="w-1 bg-indigo-500 animate-music-bar-3 h-3"></div>
                                        </div>
                                    )}
                                </div>
                                <p className="font-semibold text-sm text-zinc-800 dark:text-zinc-100 truncate" title={currentPlayingChapter?.title}>
                                    {currentPlayingChapter?.title || 'Audiobook'}
                                </p>
                                <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-1.5 mt-3 overflow-hidden">
                                    <div className="bg-indigo-500 h-full rounded-full transition-all duration-300 ease-linear" style={{ width: `${progress}%` }}></div>
                                </div>
                            </div>
                            
                            <div className="flex items-center justify-between px-4">
                                <button onClick={() => handleSkipChapter('prev')} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors" title="Previous Chapter">
                                    <Icon name="SKIP_BACK" className="w-5 h-5" />
                                </button>
                                <button 
                                    onClick={isPlaying ? handlePauseAudiobook : handleResumeAudiobook} 
                                    className="w-12 h-12 flex items-center justify-center bg-indigo-600 text-white rounded-full shadow-md hover:bg-indigo-700 transition-transform hover:scale-105 active:scale-95" 
                                    title={isPlaying ? 'Pause' : 'Play'}
                                >
                                    <Icon name={isPlaying ? 'PAUSE' : 'PLAY'} className="w-6 h-6 fill-current" />
                                </button>
                                <button onClick={() => handleSkipChapter('next')} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors" title="Next Chapter">
                                    <Icon name="SKIP_FORWARD" className="w-5 h-5" />
                                </button>
                            </div>
                            
                            <button onClick={handleStopAudiobook} className="w-full py-2 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors font-medium">
                                Stop Playback
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4 mt-4">
                            <div>
                                <label className="block text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mb-2">Narrator Voice</label>
                                <div className="grid grid-cols-1 gap-2">
                                    {geminiTTSVoices.map((voice) => {
                                        const isSelected = selectedVoiceName === voice;
                                        return (
                                            <button
                                                key={voice}
                                                onClick={() => handleSetVoice(voice)}
                                                className={`flex items-center justify-between p-3 rounded-lg border text-left transition-all ${
                                                    isSelected 
                                                        ? 'bg-white dark:bg-zinc-800 border-indigo-500 ring-1 ring-indigo-500 shadow-sm' 
                                                        : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-zinc-50 dark:hover:bg-zinc-700/50'
                                                }`}
                                            >
                                                <div>
                                                    <span className={`block text-sm font-bold ${isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-700 dark:text-zinc-300'}`}>{voice}</span>
                                                    <span className="block text-[10px] text-zinc-500 dark:text-zinc-400">{VOICE_DESCRIPTIONS[voice] || 'Standard Voice'}</span>
                                                </div>
                                                {isSelected && <div className="w-2 h-2 bg-indigo-500 rounded-full shadow-sm"></div>}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2 pt-2">
                                <button
                                    onClick={() => handlePlayChapter(activeChapterIndex)}
                                    disabled={!currentChapterHasContent}
                                    className="flex flex-col items-center justify-center p-3 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed group"
                                >
                                    <Icon name="PLAY" className="w-5 h-5 text-zinc-400 dark:text-zinc-500 mb-1 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors" />
                                    <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">Current Chapter</span>
                                </button>
                                <button
                                    onClick={handlePlayFullBook}
                                    className="flex flex-col items-center justify-center p-3 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors group"
                                >
                                    <Icon name="HEADPHONES" className="w-5 h-5 text-zinc-400 dark:text-zinc-500 mb-1 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors" />
                                    <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">Full Book</span>
                                </button>
                            </div>
                            
                            <button
                                onClick={() => handleDownloadAudiobook(undefined)}
                                className="w-full flex justify-center items-center space-x-2 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors text-xs font-semibold"
                            >
                                <Icon name="DOWNLOAD" className="w-3 h-3" />
                                <span>Advanced Download Options...</span>
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AudiobookPanel;
