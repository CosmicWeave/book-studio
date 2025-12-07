

import React, { useState, useEffect } from 'react';
import { historyService } from '../services/historyService';
import { ICONS } from '../constants';
import Icon from './Icon';

interface HistoryControlsProps {
    onUndo: () => void;
    onRedo: () => void;
}

const HistoryControls: React.FC<HistoryControlsProps> = ({ onUndo, onRedo }) => {
    const [canUndo, setCanUndo] = useState(false);
    const [canRedo, setCanRedo] = useState(false);

    useEffect(() => {
        const unsubscribe = historyService.subscribe(state => {
            setCanUndo(state.canUndo);
            setCanRedo(state.canRedo);
        });
        return unsubscribe;
    }, []);
    
    const buttonClass = (disabled: boolean) => 
        `p-3 rounded-full text-zinc-600 dark:text-zinc-300 transition-all duration-200
        ${disabled
            ? 'bg-zinc-100 dark:bg-zinc-800 cursor-not-allowed opacity-40'
            : 'bg-white dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 shadow-lg hover:shadow-xl transform hover:-translate-y-1'
        }`;

    return (
        <div className="fixed bottom-6 right-6 z-50 flex items-center space-x-3">
            <button
                onClick={onUndo}
                disabled={!canUndo}
                className={buttonClass(!canUndo)}
                aria-label="Undo"
                title="Undo (Ctrl+Z)"
            >
                <Icon name="UNDO" className="w-6 h-6" />
            </button>
            <button
                onClick={onRedo}
                disabled={!canRedo}
                className={buttonClass(!canRedo)}
                aria-label="Redo"
                title="Redo (Ctrl+Y)"
            >
                <Icon name="REDO" className="w-6 h-6" />
            </button>
        </div>
    );
};

export default HistoryControls;
