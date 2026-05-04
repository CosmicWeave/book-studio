import React, { useContext, useEffect, useMemo, useState } from 'react';
import { AppContext } from '../contexts/AppContext';
import { BackupStatus, getNetworkStats, subscribeToBackupStatus } from '../services/backupService';
import { formatBytes, getStorageStats, StorageStats } from '../services/storageService';
import { getPendingWriteCount } from '../services/apiClient';
import Icon from './Icon';

type AiHealth = {
    provider: string;
    model?: string;
};

type AiQuota = {
    status: 'ok' | 'exhausted' | 'unknown';
    provider?: string;
    updatedAt: number;
    retryInSec: number | null;
    message: string | null;
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

const formatRetryTime = (seconds: number | null): string => {
    if (seconds === null || seconds <= 0) return 'soon';
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.ceil(seconds / 60);
    if (mins < 60) return `${mins}m`;
    const hours = Math.ceil(mins / 60);
    return `${hours}h`;
};

const AppStatusBar: React.FC<AppStatusBarProps> = ({ isOffline }) => {
    const appContext = useContext(AppContext);
    const [backupStatus, setBackupStatus] = useState<BackupStatus>('idle');
    const [lastBackupTimestamp, setLastBackupTimestamp] = useState<number | null>(null);
    const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
    const [aiHealth, setAiHealth] = useState<AiHealth>({ provider: 'checking...' });
    const [aiQuota, setAiQuota] = useState<AiQuota>({
        status: 'unknown',
        provider: 'unknown',
        updatedAt: Date.now(),
        retryInSec: null,
        message: null,
    });
    const [sessionUploadBytes, setSessionUploadBytes] = useState(0);
    const [pendingWrites, setPendingWrites] = useState(() => getPendingWriteCount());

    useEffect(() => {
        const unsubscribe = subscribeToBackupStatus((state) => {
            setBackupStatus(state.status);
            setLastBackupTimestamp(state.lastBackupTimestamp);
        });
        return unsubscribe;
    }, []);

    useEffect(() => {
        const onQueueChange = (e: Event) => {
            const detail = (e as CustomEvent<{ count: number }>).detail;
            setPendingWrites(detail?.count ?? getPendingWriteCount());
        };
        window.addEventListener('writequeuechange', onQueueChange);
        return () => window.removeEventListener('writequeuechange', onQueueChange);
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
        window.addEventListener('dbdatachange', onDbChange);

        return () => {
            cancelled = true;
            window.clearInterval(intervalId);
            window.removeEventListener('dbdatachange', onDbChange);
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

    useEffect(() => {
        let cancelled = false;

        const refreshAiQuota = async () => {
            try {
                const res = await fetch('/api/ai/quota');
                if (!res.ok) throw new Error('AI quota unavailable');
                const data = (await res.json()) as AiQuota;
                if (!cancelled) {
                    setAiQuota({
                        status: data.status ?? 'unknown',
                        provider: data.provider ?? 'unknown',
                        updatedAt: data.updatedAt ?? Date.now(),
                        retryInSec: data.retryInSec ?? null,
                        message: data.message ?? null,
                    });
                }
            } catch {
                if (!cancelled) {
                    setAiQuota((prev) => ({ ...prev, status: 'unknown', updatedAt: Date.now() }));
                }
            }
        };

        refreshAiQuota();
        const intervalId = window.setInterval(refreshAiQuota, 10000);

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
    const aiBudgetLabel = !isAiEnabled
        ? 'AI usage: unavailable'
        : aiQuota.status === 'ok'
            ? 'AI usage: within quota'
            : aiQuota.status === 'exhausted'
                ? `AI usage: quota exceeded · retry in ${formatRetryTime(aiQuota.retryInSec)}`
                : 'AI usage: unknown';

    const aiBudgetClassName = aiQuota.status === 'exhausted'
        ? 'text-red-500'
        : aiQuota.status === 'ok'
            ? 'text-emerald-500'
            : 'text-zinc-500';

    return (
        <div className="relative z-0 border-t border-zinc-200/80 bg-white/95 backdrop-blur-md dark:border-zinc-700/80 dark:bg-zinc-900/95">
            <div className="overflow-x-auto px-3 py-1 pb-[max(env(safe-area-inset-bottom),0.25rem)] sm:px-4">
                <div className="ml-auto flex h-7 w-max items-center justify-end gap-3 text-[11px] text-zinc-600 dark:text-zinc-300">
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                    <Icon name={isOffline ? 'CLOUD_OFF' : 'CLOUD'} className={`h-3.5 w-3.5 ${isOffline ? 'text-amber-500' : 'text-emerald-500'}`} />
                    {isOffline ? 'Offline · local only' : 'Online'}
                </span>

                    {pendingWrites > 0 && (
                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap border-l border-zinc-200 pl-3 dark:border-zinc-700 text-amber-600 dark:text-amber-400">
                            <Icon name="CLOCK" className="h-3.5 w-3.5" />
                            {pendingWrites} pending {pendingWrites === 1 ? 'write' : 'writes'}
                        </span>
                    )}

                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap border-l border-zinc-200 pl-3 dark:border-zinc-700">
                    <Icon name={backupIconName} className={`h-3.5 w-3.5 ${backupStatus === 'failed' || backupStatus === 'conflict' ? 'text-red-500' : 'text-sky-500'}`} />
                    {backupLabel}
                </span>

                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap border-l border-zinc-200 pl-3 dark:border-zinc-700">
                    <Icon name="SAVE" className="h-3.5 w-3.5 text-indigo-500" />
                    {storageLabel}
                </span>

                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap border-l border-zinc-200 pl-3 dark:border-zinc-700">
                    <Icon name="SPARKLES" className={`h-3.5 w-3.5 ${isAiEnabled ? 'text-violet-500' : 'text-zinc-400'}`} />
                    {aiLabel}
                </span>

                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap border-l border-zinc-200 pl-3 dark:border-zinc-700">
                    <Icon name="INFO" className={`h-3.5 w-3.5 ${aiBudgetClassName}`} />
                    {aiBudgetLabel}
                </span>

                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap border-l border-zinc-200 pl-3 dark:border-zinc-700">
                    <Icon name="LINK" className="h-3.5 w-3.5 text-cyan-500" />
                    Sync: {syncProvider.replace('_', ' ')}
                </span>

                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap border-l border-zinc-200 pl-3 dark:border-zinc-700">
                    <Icon name="UPLOAD" className="h-3.5 w-3.5 text-emerald-500" />
                    Session upload: {formatBytes(sessionUploadBytes)}
                </span>
                </div>
            </div>
        </div>
    );
};

export default AppStatusBar;