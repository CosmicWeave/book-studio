
import React, { useContext, useState, useRef, useEffect, useMemo } from 'react';
import { AppContext } from '../contexts/AppContext';
import Icon from './Icon';

const PLAYBACK_SPEEDS = [0.75, 1, 1.25, 1.5, 2];

const Visualizer = ({ isPlaying }: { isPlaying: boolean }) => (
  <div className="flex items-end space-x-0.5 h-4 w-5 justify-center overflow-hidden">
    <div className={`w-1 bg-indigo-500 rounded-t ${isPlaying ? 'animate-music-bar-1' : 'h-1'}`}></div>
    <div className={`w-1 bg-indigo-500 rounded-t ${isPlaying ? 'animate-music-bar-2' : 'h-2'}`}></div>
    <div className={`w-1 bg-indigo-500 rounded-t ${isPlaying ? 'animate-music-bar-3' : 'h-1.5'}`}></div>
  </div>
);

const FloatingAudioPlayer: React.FC = () => {
    const {
        audiobookState,
        books,
        pauseAudiobook,
        resumeAudiobook,
        stopAudiobook,
        skipAudiobookChapter,
        setPlaybackRate,
        setAudiobookVolume,
        jumpToParagraph,
        skipParagraph
    } = useContext(AppContext);

    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [volume, setVolume] = useState(1);
    const [showVolume, setShowVolume] = useState(false);
    
    const dragStartPos = useRef({ x: 0, y: 0 });
    const playerRef = useRef<HTMLDivElement>(null);
    const progressBarRef = useRef<HTMLDivElement>(null);

    const { playbackState, bookTitle, currentChapterTitle, chapterProgress, playbackRate, totalParagraphsInChapter, bookId } = audiobookState;

    const currentBook = useMemo(() => books.find(b => b.id === bookId), [books, bookId]);
    const isPlaying = playbackState === 'playing';

    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        // Prevent dragging when clicking on buttons or inputs
        if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input')) {
            return;
        }
        setIsDragging(true);
        dragStartPos.current = {
            x: e.clientX - position.x,
            y: e.clientY - position.y,
        };
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging || !playerRef.current) return;
            const x = e.clientX - dragStartPos.current.x;
            const y = e.clientY - dragStartPos.current.y;
            setPosition({ x, y });
        };

        const handleMouseUp = () => {
            if (isDragging && playerRef.current) {
                // Snap to edge logic
                const rect = playerRef.current.getBoundingClientRect();
                const windowWidth = window.innerWidth;
                
                // If released within 100px of left or right edge, snap
                const snapThreshold = 100;
                const distanceFromRight = windowWidth - (rect.left + rect.width);
                
                // Calculate relative X coordinate based on original fixed position style
                // The component uses 'translate' from a fixed bottom-right origin (based on CSS classes)
                // But state `position` stores the translation delta.
                // Let's simplify: if it's closer to left, snap to left.
                
                // NOTE: The component is `fixed bottom-24 right-6`. 
                // So x=0 means 24px from right. x < 0 moves left.
                // To snap to left edge (e.g. 24px from left), we need x to be roughly -(windowWidth - width - 48).
                
                // Actually, simpler snap logic:
                // If dragged mostly to the left side of screen
                if (rect.left + rect.width / 2 < windowWidth / 2) {
                     // Snap left
                     const targetX = -(windowWidth - rect.width - 48); 
                     // Soft snap
                     setPosition(prev => ({ ...prev, x: targetX }));
                } else {
                     // Snap right (default)
                     setPosition(prev => ({ ...prev, x: 0 }));
                }
            }
            setIsDragging(false);
        };

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging]);
    
    const handleScrub = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!progressBarRef.current || totalParagraphsInChapter === 0) return;
        const rect = progressBarRef.current.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const percentage = Math.max(0, Math.min(1, clickX / rect.width));
        const targetParagraph = Math.floor(totalParagraphsInChapter * percentage);
        jumpToParagraph(targetParagraph);
    };

    const handleCycleSpeed = () => {
        const currentIndex = PLAYBACK_SPEEDS.indexOf(playbackRate);
        const nextIndex = (currentIndex + 1) % PLAYBACK_SPEEDS.length;
        setPlaybackRate(PLAYBACK_SPEEDS[nextIndex]);
    };
    
    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVol = parseFloat(e.target.value);
        setVolume(newVol);
        setAudiobookVolume(newVol);
    };

    if (playbackState === 'stopped') {
        return null;
    }

    const coverImage = currentBook?.coverImage;

    // Minimized View
    if (isMinimized) {
        return (
            <div
                ref={playerRef}
                className="fixed bottom-24 right-6 z-[1000] bg-white/90 dark:bg-zinc-800/90 backdrop-blur-md rounded-full shadow-xl border border-zinc-200 dark:border-zinc-700 p-2 flex items-center space-x-3 cursor-grab active:cursor-grabbing select-none transition-transform hover:scale-105 hover:shadow-2xl"
                style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
                onMouseDown={handleMouseDown}
            >
                <div className="relative">
                    {coverImage ? (
                        <img src={coverImage} alt="Cover" className={`w-10 h-10 rounded-full object-cover border border-zinc-200 dark:border-zinc-600 ${isPlaying ? 'animate-spin-slow' : ''}`} style={{ animationDuration: '8s' }} />
                    ) : (
                        <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                            <Icon name="HEADPHONES" className="w-5 h-5" />
                        </div>
                    )}
                    {isPlaying && (
                        <div className="absolute -bottom-1 -right-1 bg-white dark:bg-zinc-800 rounded-full p-0.5 border border-zinc-100 dark:border-zinc-700">
                            <Visualizer isPlaying={true} />
                        </div>
                    )}
                </div>
                
                <div className="flex items-center pr-2 space-x-2">
                    <button 
                        onClick={isPlaying ? pauseAudiobook : resumeAudiobook}
                        className="p-2 rounded-full bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-sm"
                    >
                        <Icon name={isPlaying ? 'PAUSE' : 'PLAY'} className="w-4 h-4 fill-current" />
                    </button>
                    <button onClick={() => setIsMinimized(false)} className="p-1.5 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors">
                        <Icon name="EXPAND" className="w-4 h-4" />
                    </button>
                </div>
            </div>
        );
    }

    // Expanded View
    return (
        <div
            ref={playerRef}
            className="fixed bottom-24 right-6 z-[1000] w-80 bg-white/95 dark:bg-zinc-800/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-zinc-200/50 dark:border-zinc-700/50 overflow-hidden flex flex-col transition-all duration-200 group"
            style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
            onMouseDown={handleMouseDown}
        >
            {/* Header / Drag Area */}
            <div className="flex items-start p-4 pb-0 cursor-grab active:cursor-grabbing relative">
                <div className="flex-shrink-0 mr-4 relative">
                    {coverImage ? (
                        <img src={coverImage} alt="Cover" className="w-16 h-24 object-cover rounded-md shadow-md" />
                    ) : (
                        <div className="w-16 h-24 bg-zinc-100 dark:bg-zinc-700 rounded-md flex items-center justify-center shadow-inner">
                            <Icon name="IMAGE" className="w-8 h-8 text-zinc-300 dark:text-zinc-500" />
                        </div>
                    )}
                    {/* Visualizer Overlay on Cover */}
                    <div className="absolute bottom-1 left-1 right-1 flex justify-center opacity-80">
                         <Visualizer isPlaying={isPlaying} />
                    </div>
                </div>
                <div className="flex-grow min-w-0 pt-1">
                    <h4 className="font-bold text-zinc-800 dark:text-zinc-100 text-sm leading-tight line-clamp-2 mb-1">
                        {bookTitle || 'Unknown Book'}
                    </h4>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium truncate">
                        {currentChapterTitle || 'Loading Chapter...'}
                    </p>
                    <div className="mt-3 flex items-center space-x-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${isPlaying ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400'}`}>
                            {playbackState === 'loading' ? 'Buffering...' : isPlaying ? 'Playing' : 'Paused'}
                        </span>
                        <button onClick={handleCycleSpeed} className="text-[10px] font-bold bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 px-2 py-0.5 rounded transition-colors">
                            {playbackRate}x
                        </button>
                    </div>
                </div>
                <button 
                    onClick={() => setIsMinimized(true)}
                    className="absolute top-2 right-2 p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-700/50"
                >
                    <Icon name="CLOSE" className="w-4 h-4" style={{ transform: 'rotate(45deg)' }} />
                </button>
            </div>
            
            {/* Scrubber */}
            <div className="px-4 mt-4">
                <div
                    ref={progressBarRef}
                    onClick={handleScrub}
                    className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full cursor-pointer group/scrubber relative"
                >
                    <div 
                        className="absolute top-0 left-0 h-full bg-indigo-500 rounded-full transition-all duration-100 ease-linear" 
                        style={{ width: `${chapterProgress}%`}}
                    >
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white border-2 border-indigo-600 rounded-full opacity-0 group-hover/scrubber:opacity-100 transition-opacity shadow-sm transform scale-125"></div>
                    </div>
                </div>
                <div className="flex justify-between mt-1">
                    <span className="text-[10px] text-zinc-400 font-mono">0:00</span>
                    <span className="text-[10px] text-zinc-400 font-mono">--:--</span>
                </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between px-4 pb-4 mt-2">
                <button onClick={() => skipAudiobookChapter('prev')} className="p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-700/30" title="Previous Chapter">
                    <Icon name="SKIP_BACK" className="w-5 h-5" />
                </button>
                
                <button onClick={() => skipParagraph('prev')} className="p-2 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-100 transition-colors rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-700/30" title="Rewind Sentence">
                    <Icon name="UNDO" className="w-5 h-5" />
                </button>

                <button 
                    onClick={isPlaying ? pauseAudiobook : resumeAudiobook} 
                    className="w-12 h-12 flex items-center justify-center bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 hover:scale-105 active:scale-95 transition-all"
                >
                    <Icon name={isPlaying ? 'PAUSE' : 'PLAY'} className="w-6 h-6 fill-current" />
                </button>

                <button onClick={() => skipParagraph('next')} className="p-2 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-100 transition-colors rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-700/30" title="Fast Forward Sentence">
                    <Icon name="REDO" className="w-5 h-5" />
                </button>

                <button onClick={() => skipAudiobookChapter('next')} className="p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-700/30" title="Next Chapter">
                    <Icon name="SKIP_FORWARD" className="w-5 h-5" />
                </button>
            </div>
            
            {/* Footer Actions: Stop & Volume */}
            <div className="px-4 pb-3 flex justify-between items-center gap-3">
                <div 
                    className="relative flex items-center"
                    onMouseEnter={() => setShowVolume(true)}
                    onMouseLeave={() => setShowVolume(false)}
                >
                    <button className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
                        {volume === 0 ? (
                             <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
                        ) : (
                             <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                        )}
                    </button>
                    
                    {/* Pop-up Volume Slider */}
                    <div className={`absolute bottom-full left-0 mb-1 bg-white dark:bg-zinc-800 p-2 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-700 transition-all duration-200 origin-bottom ${showVolume ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}>
                        <div className="h-24 w-6 flex justify-center">
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.01"
                                value={volume}
                                onChange={handleVolumeChange}
                                className="w-1 h-20 bg-zinc-200 dark:bg-zinc-600 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                style={{ writingMode: 'vertical-lr', WebkitAppearance: 'slider-vertical' }}
                            />
                        </div>
                    </div>
                </div>

                <button 
                    onClick={stopAudiobook} 
                    className="flex-grow py-1.5 px-3 text-xs font-medium text-red-500 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-md transition-colors text-center"
                >
                    Stop Playback
                </button>
            </div>
        </div>
    );
};

export default FloatingAudioPlayer;
