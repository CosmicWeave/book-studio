import React, { useState, useEffect } from 'react';
import { BackgroundTaskState } from '../types';
import { backgroundTaskService } from '../services/backgroundTaskService';
import { ICONS } from '../constants';
import Icon from './Icon';

const TaskQueueNotifier: React.FC = () => {
    const [state, setState] = useState<BackgroundTaskState>({
        currentTask: null,
        queue: [],
        progress: null,
        isProcessing: false,
    });
    const [isVisible, setIsVisible] = useState(false);
    const [isCompleted, setIsCompleted] = useState(false);

    useEffect(() => {
        const unsubscribe = backgroundTaskService.subscribe(setState);
        return unsubscribe;
    }, []);

    useEffect(() => {
        const hasTasks = state.isProcessing || state.queue.length > 0;
        if (hasTasks) {
            setIsVisible(true);
            setIsCompleted(false);
        } else if (isVisible && !hasTasks) {
            // When tasks are done, show completed state then fade out
            setIsCompleted(true);
            const timer = setTimeout(() => {
                setIsVisible(false);
                setIsCompleted(false);
            }, 4000);
            return () => clearTimeout(timer);
        }
    }, [state, isVisible]);

    if (!isVisible) {
        return null;
    }

    const { currentTask, queue, progress, isProcessing } = state;

    const renderContent = () => {
        if (isCompleted) {
            return (
                <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center text-emerald-600 dark:text-emerald-300">
                        <Icon name="CLOUD_CHECK" className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="font-bold text-sm text-gray-800 dark:text-gray-100">Queue complete</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">All background tasks are finished.</p>
                    </div>
                </div>
            );
        }

        if (!currentTask && !isProcessing) {
            return null; // Should be handled by isVisible, but as a safeguard
        }

        return (
            <>
                <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-indigo-600 dark:text-indigo-300">
                        <Icon name="ROTATE_CW" className="w-5 h-5 animate-spin" />
                    </div>
                    <div className="flex-1 overflow-hidden">
                        <p className="font-bold text-sm text-gray-800 dark:text-gray-100 truncate" title={currentTask?.name}>{currentTask?.name || 'Processing...'}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate" title={progress?.message || ''}>{progress?.message || 'Starting task...'}</p>
                    </div>
                </div>
                <div className="mt-2.5">
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div className="bg-indigo-600 h-2 rounded-full" style={{ width: `${progress?.percentage || 0}%`, transition: 'width 0.3s ease-in-out' }}></div>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{queue.length} task(s) in queue</span>
                        <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{progress?.percentage || 0}%</span>
                    </div>
                </div>
            </>
        );
    };

    return (
        <div className={`fixed bottom-5 left-5 z-[10000] w-80 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-4 transition-all duration-300 ease-in-out ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
            {renderContent()}
        </div>
    );
};

export default TaskQueueNotifier;