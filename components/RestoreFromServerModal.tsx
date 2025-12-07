import React, { useState } from 'react';
import Loader from './Loader';
import { ICONS } from '../constants';
import Icon from './Icon';

interface RestoreFromServerModalProps {
    backupTimestamp: number;
    localTimestamp: number;
    onRestore: () => Promise<void>;
    onDecline: () => void;
}

const RestoreFromServerModal: React.FC<RestoreFromServerModalProps> = ({
    backupTimestamp,
    localTimestamp,
    onRestore,
    onDecline,
}) => {
    const [isRestoring, setIsRestoring] = useState(false);

    const handleRestoreClick = async () => {
        setIsRestoring(true);
        // The parent's onRestore function handles all logic, including
        // unmounting this modal on completion or error.
        await onRestore();
    };

    const backupDate = new Date(backupTimestamp).toLocaleString();
    const localDate = new Date(localTimestamp).toLocaleString();
    const isNewUser = localTimestamp === 0;

    const title = isNewUser ? "Welcome Back!" : "Remote Backup Found";
    const message = isNewUser
        ? `We found a backup from ${backupDate}. Would you like to restore it to pick up where you left off?`
        : `A server backup from ${backupDate} is available. Your local data was last saved on ${localDate}.`;
    
    const warning = isNewUser ? "" : "Restoring will overwrite your current local data. This action cannot be undone.";

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[10000] p-4 animate-fade-in" onClick={onDecline}>
            {isRestoring && <Loader message="Restoring from server..." />}
            <div 
                className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-lg border border-gray-300 dark:border-gray-700"
                onClick={e => e.stopPropagation()}
            >
                <div className="text-center">
                    <div className="mx-auto w-16 h-16 text-blue-500 flex items-center justify-center">
                        <Icon name="UPLOAD" className="w-10 h-10" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mt-4">{title}</h2>
                </div>
                <div className="text-gray-600 dark:text-gray-400 mt-4 text-center space-y-3">
                    <p>{message}</p>
                    {warning && <p className="font-bold text-yellow-600 dark:text-yellow-400">{warning}</p>}
                </div>
                <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button onClick={onDecline} className="w-full bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 px-4 py-3 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors">
                        {isNewUser ? "Start Fresh" : "Keep Local Version"}
                    </button>
                    <button onClick={handleRestoreClick} className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg shadow font-semibold hover:bg-blue-700 transition-colors">
                        Restore Backup
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RestoreFromServerModal;
