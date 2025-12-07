
import React, { useContext } from 'react';
import { AppContext } from '../../contexts/AppContext';
import Icon from '../Icon';

const AudiobookPlayer: React.FC = () => {
    const { audiobookState, pauseAudiobook, resumeAudiobook } = useContext(AppContext);
    const { playbackState } = audiobookState;
    
    // Simple placeholder component if ever needed directly
    if (playbackState === 'stopped') return null;

    return (
        <div className="p-4 bg-white dark:bg-zinc-800 rounded-lg shadow-md">
            <div className="flex items-center justify-center space-x-4">
                <button onClick={playbackState === 'playing' ? pauseAudiobook : resumeAudiobook} className="p-2 bg-indigo-600 text-white rounded-full">
                    <Icon name={playbackState === 'playing' ? 'PAUSE' : 'PLAY'} className="w-6 h-6" />
                </button>
            </div>
        </div>
    );
};

export default AudiobookPlayer;
