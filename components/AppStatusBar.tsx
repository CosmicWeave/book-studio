import React, { useContext, useEffect, useMemo, useState } from 'react';
import { AppContext } from '../contexts/AppContext';
import { BackupStatus, getNetworkStats, subscribeToBackupStatus } from '../services/backupService';
import { formatBytes, getStorageStats, StorageStats } from '../services/storageService';
import Icon from './Icon';

type AiHealth = {
    provider: string;
    model?: string;
};

interface AppStatusBarProps {
    isOffline: boolean;
}

const formatTimeAgo = (timestamp: number | null): string => {
    if (!timestamp) return 'never';
    const diffSeconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
    if (diffSeconds < 10) return 'just now';
    if (diffSeconds < 60) return `${diffSeconds}s ago`;
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
    if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
    return `${Math.floor(diffSeconds / 86400)}d ago`;
};

const AppStatusBar: React.FC<AppStatusBarProps> = ({ isOffline }) => {
    const appContext = useContext(AppContext);
    const [backupStatus, setBackupStatus] = useState<BackupStatus>('idle');
    const [lastBackupTimestamp, setLastBackupTimestamp] = useState<number | null>(null);
    const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
    const [aiHealth, setAiHealth] = useState<AiHealth>({ provider: 'checking...' });
    const [sessionUploadBytes, setSessionUploadBytes] = useState(0);

    useEffect(() => {
        const unsubscribe = subscribeToBackupStatus((state) => {
            setBackupStatus(state.status);
            setLastBackupTimestamp(state.lastBackupTimestamp);
        });
        return unsubscribe;
    }, []);

    useEffect(() => {
        let cancelled = false;

        const refreshStorageStats = async () => {
            const stats = await getStorageStats();
            if (!cancelled) setStorageStats(stats);
        };

        refreshStorageStats();
        const intervalId = window.setInterval(refreshStorageStats, 30000);
        const onDbChange = () => refreshStorageStats();
        window.addEventListener('dbversionchange', onDbChange);

        return () => {
            cancelled = true;
            window.clearInterval(intervalId);
            window.removeEventListener('dbversionchange', onDbChange);
        };
    }, []);

    useEffect(() => {
        const refreshNetworkStats = () => {
            setSessionUploadBytes(getNetworkStats().session);
        };
        refreshNetworkStats();
        const intervalId = window.setInterval(refreshNetworkStats, 15000);
        return () => window.clearInterval(intervalId);
    }, []);

    useEffect(() => {
        let cancelled = false;

        const refreshAiHealth = async () => {
            try {
                const res = await fetch('/api/ai/health');
                if (!res.ok) throw new Error('AI health unavailable');
                const data = (await res.json()) as { provider?: string; model?: string };
                if (!cancelled) {
                    setAiHealth({
                        provider: data.provider || 'unknown',
                        model: data.model,
                    });
                }
            } catch {
                if (!cancelled) {
                    setAiHealth({ provider: 'offline' });
                }
            }
        };

        refreshAiHealth();
        const intervalId = window.setInterval(refreshAiHealth, 60000);

        return () => {
            cancelled = true;
            window.clearInterval(intervalId);
        };
    }, []);

    const backupLabel = useMemo(() => {
        switch (backupStatus) {
            case 'syncing':
                return 'Backup: syncing';
            case 'synced':
                return `Backup: ${formatTimeAgo(lastBackupTimestamp)}`;
            case 'failed':
                return 'Backup: failed';
            case 'disabled':
                return 'Backup: disabled';
            case 'conflict':
                return 'Backup: conflict';
            case 'idle':
            default:
                return 'Backup: ready';
        }
    }, [backupStatus, lastBackupTimestamp]);

    const backupIconName = useMemo(() => {
        if (backupStatus === 'failed' || backupStatus === 'conflict') return 'CLOUD_OFF';
        if (backupStatus === 'synced') return 'CLOUD_CHECK';
        return 'CLOUD';
    }, [backupStatus]);

    if (!appContext) return null;

    const { isAiEnabled, syncProvider } = appContext;
    const storageLabel = storageStats
        ? `Local: ${formatBytes(storageStats.usage)} / ${formatBytes(storageStats.quota)}`
        : 'Local: estimating...';
    const aiLabel = isAiEnabled
        ? `AI: ${aiHealth.provider}${aiHealth.model ? ` · ${aiHealth.model}` : ''}`
        : 'AI: unavailable';
    const aiBudgetLabel = `AI usage: provider-managed`;

    return (
        <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-zinc-200 dark:border-zinc-700 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md">
            <div className="flex h-9 items-center gap-2 overflow-x-auto px-3 text-xs text-zinc-600 dark:text-zinc-300 sm:px-4">
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
                    <Icon name={isOffline ? 'CLOUD_OFF' : 'CLOUD'} className={`h-3.5 w-3.5 ${isOffline ? 'text-amber-500' : 'text-emerald-500'}`} />
                    {isOffline ? 'Offline · local only' : 'Online'}
                </span>

                <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
                    <Icon name={backupIconName} className={`h-3.5 w-3.5 ${backupStatus === 'failed' || backupStatus === 'conflict' ? 'text-red-500' : 'text-sky-500'}`} />
                    {backupLabel}
                </span>

                <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
                    <Icon name="SAVE" className="h-3.5 w-3.5 text-indigo-500" />
                    {storageLabel}
                </span>

                <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
                    <Icon name="SPARKLES" className={`h-3.5 w-3.5 ${isAiEnabled ? 'text-violet-500' : 'text-zinc-400'}`} />
                    {aiLabel}
                </span>

                <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
                    <Icon name="INFO" className="h-3.5 w-3.5 text-zinc-500" />
                    {aiBudgetLabel}
                </span>

                <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
                    <Icon name="LINK" className="h-3.5 w-3.5 text-cyan-500" />
                    Sync: {syncProvider.replace('_', ' ')}
                </span>

                <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
                    <Icon name="UPLOAD" className="h-3.5 w-3.5 text-emerald-500" />
                    Session upload: {formatBytes(sessionUploadBytes)}
                </span>
            </div>
        </div>
    );
};

export default AppStatusBar;