import React, { useState, useEffect } from 'react';
import { ICONS } from '../../constants';
import { subscribeToBackupStatus, BackupStatus } from '../../services/backupService';
import Icon, { IconName } from '../Icon';

interface SaveStatusIndicatorProps {
    status: 'saved' | 'saving' | 'unsaved';
}

const SaveStatusIndicator: React.FC<SaveStatusIndicatorProps> = ({ status }) => {
    const [backupStatus, setBackupStatus] = useState<BackupStatus>('idle');
    const [lastBackup, setLastBackup] = useState<number | null>(null);
    const [timeAgo, setTimeAgo] = useState('');

    useEffect(() => {
        const unsubscribe = subscribeToBackupStatus((state) => {
            setBackupStatus(state.status);
            setLastBackup(state.lastBackupTimestamp);
        });
        return unsubscribe;
    }, []);

    useEffect(() => {
        if (!lastBackup) {
            setTimeAgo('');
            return;
        }
        
        const formatTimeAgo = () => {
            if (!lastBackup) {
                setTimeAgo('');
                return;
            }
            const now = Date.now();
            const diffSeconds = Math.round((now - lastBackup) / 1000);
            
            if (diffSeconds < 10) setTimeAgo('just now');
            else if (diffSeconds < 60) setTimeAgo(`${diffSeconds}s ago`);
            else if (diffSeconds < 3600) setTimeAgo(`${Math.floor(diffSeconds / 60)}m ago`);
            else if (diffSeconds < 86400) setTimeAgo(`${Math.floor(diffSeconds / 3600)}h ago`);
            else setTimeAgo(`${Math.floor(diffSeconds / 86400)}d ago`);
        };
        
        formatTimeAgo();
        const interval = setInterval(formatTimeAgo, 5000);
        return () => clearInterval(interval);

    }, [lastBackup]);

    const getStatusContent = (): { icon: IconName; text: string; className: string } => {
        switch (status) {
            case 'saving':
                return { icon: 'ROTATE_CW', text: 'Saving...', className: 'animate-spin text-indigo-500 dark:text-indigo-400' };
            case 'unsaved':
                return { icon: 'EDIT', text: 'Unsaved changes', className: 'text-amber-600 dark:text-amber-400' };
            case 'saved':
                switch (backupStatus) {
                    case 'syncing':
                        return { icon: 'ROTATE_CW', text: 'Backing up...', className: 'animate-spin text-indigo-500 dark:text-indigo-400' };
                    case 'synced':
                        return { icon: 'CLOUD_CHECK', text: `Saved & backed up ${timeAgo}`, className: 'text-emerald-600 dark:text-emerald-400' };
                    case 'failed':
                        return { icon: 'CLOUD_OFF', text: 'Save OK, backup failed', className: 'text-red-500 dark:text-red-400' };
                    case 'disabled':
                        return { icon: 'CLOUD_CHECK', text: 'Saved locally', className: 'text-emerald-600 dark:text-emerald-400' };
                    case 'idle':
                    default:
                         return { icon: 'CLOUD_CHECK', text: 'All changes saved', className: 'text-emerald-600 dark:text-emerald-400' };
                }
            default:
                return { icon: 'EDIT', text: 'Unsaved changes', className: 'text-amber-600 dark:text-amber-400' };
        }
    };

    const { icon, text, className } = getStatusContent();

    return (
        <div className={`flex items-center space-x-2 text-sm transition-all duration-300 p-2 rounded-lg bg-zinc-100 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-700`}>
            <Icon name={icon} className={`w-4 h-4 ${className}`} />
            <span className={`font-medium ${className}`}>{text}</span>
        </div>
    );
};

export default SaveStatusIndicator;
