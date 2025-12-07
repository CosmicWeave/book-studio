
import React, { useState, useEffect, useRef } from 'react';
import { audiobookGenerator, GeneratorState } from '../services/audiobookGenerator';
import Icon from './Icon';

const AudiobookGenerationIndicator: React.FC = () => {
    const [state, setState] = useState<GeneratorState>({
        status: 'idle',
        progress: 0,
        message: '',
        error: null,
        bookTitle: '',
        totalFiles: 0,
        completedFiles: 0
    });
    
    const [position, setPosition] = useState({ x: 20, y: 20 }); // Bottom-left relative
    const [isDragging, setIsDragging] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const dragStartPos = useRef({ x: 0, y: 0 });
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const unsubscribe = audiobookGenerator.subscribe(setState);
        return unsubscribe;
    }, []);

    // Dragging logic
    const handleMouseDown = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('button')) return;
        setIsDragging(true);
        dragStartPos.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging) return;
            setPosition({
                x: e.clientX - dragStartPos.current.x,
                y: e.clientY - dragStartPos.current.y
            });
        };
        const handleMouseUp = () => setIsDragging(false);

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging]);

    if (state.status === 'idle' || state.status === 'cancelled') return null;

    const isError = state.status === 'error';
    const isCompleted = state.status === 'completed';

    return (
        <div 
            ref={ref}
            className={`fixed bottom-6 left-6 z-[9999] bg-white dark:bg-zinc-800 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden transition-all duration-200 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
            style={{ transform: `translate(${position.x - 20}px, ${position.y - 20}px)`, width: isMinimized ? 'auto' : '320px' }}
            onMouseDown={handleMouseDown}
        >
            {isMinimized ? (
                <div className="p-3 flex items-center space-x-3">
                    {isError ? (
                        <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                    ) : isCompleted ? (
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    ) : (
                        <div className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    )}
                    <span className="font-bold text-sm text-zinc-800 dark:text-zinc-100">Audiobook</span>
                    <button onClick={() => setIsMinimized(false)} className="ml-2 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
                        <Icon name="EXPAND" className="w-4 h-4" />
                    </button>
                </div>
            ) : (
                <div className="p-4">
                    <div className="flex justify-between items-start mb-3">
                        <div>
                            <h4 className="font-bold text-sm text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
                                {isError ? <Icon name="CLOUD_OFF" className="w-4 h-4 text-red-500" /> : 
                                 isCompleted ? <Icon name="CLOUD_CHECK" className="w-4 h-4 text-green-500" /> : 
                                 <Icon name="HEADPHONES" className="w-4 h-4 text-indigo-500" />}
                                <span>Audiobook Download</span>
                            </h4>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate max-w-[200px]">{state.bookTitle}</p>
                        </div>
                        <button onClick={() => setIsMinimized(true)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
                            <Icon name="CLOSE" className="w-4 h-4" style={{ transform: 'rotate(45deg)' }} />
                        </button>
                    </div>

                    {!isError && !isCompleted && (
                        <div className="mb-3">
                            <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-2 mb-1">
                                <div 
                                    className="bg-indigo-600 h-2 rounded-full transition-all duration-300" 
                                    style={{ width: `${state.progress}%` }}
                                ></div>
                            </div>
                            <div className="flex justify-between text-[10px] text-zinc-500 dark:text-zinc-400">
                                <span>{state.completedFiles} / {state.totalFiles} files</span>
                                <span>{Math.round(state.progress)}%</span>
                            </div>
                        </div>
                    )}

                    <p className={`text-xs mb-4 ${isError ? 'text-red-600 dark:text-red-400 font-medium' : 'text-zinc-600 dark:text-zinc-300'}`}>
                        {state.message}
                    </p>

                    <div className="flex gap-2">
                        {isError ? (
                            <>
                                <button 
                                    onClick={() => audiobookGenerator.cancel()} 
                                    className="flex-1 px-3 py-1.5 bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-semibold rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors"
                                >
                                    Discard
                                </button>
                                <button 
                                    onClick={() => audiobookGenerator.downloadPartial()} 
                                    className="flex-1 px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
                                >
                                    Download Partial
                                </button>
                            </>
                        ) : isCompleted ? (
                            <button 
                                onClick={() => audiobookGenerator.reset()} 
                                className="w-full px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 transition-colors"
                            >
                                Close
                            </button>
                        ) : (
                            <button 
                                onClick={() => audiobookGenerator.cancel()} 
                                className="w-full px-3 py-1.5 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-xs font-semibold rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            >
                                Cancel Download
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AudiobookGenerationIndicator;
