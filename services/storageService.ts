
export interface StorageStats {
    usage: number;
    quota: number;
    percentUsed: number;
    remaining: number;
}

export const getStorageStats = async (): Promise<StorageStats | null> => {
    if (!navigator.storage || !navigator.storage.estimate) return null;
    try {
        const estimate = await navigator.storage.estimate();
        const usage = estimate.usage || 0;
        const quota = estimate.quota || 0;
        const percentUsed = quota > 0 ? (usage / quota) * 100 : 0;
        const remaining = quota - usage;
        return { usage, quota, percentUsed, remaining };
    } catch (e) {
        console.warn("Storage estimate failed", e);
        return null;
    }
};

export const requestPersistentStorage = async (): Promise<boolean> => {
    if (!navigator.storage || !navigator.storage.persist) return false;
    try {
        const isPersisted = await navigator.storage.persist();
        console.log(`Storage persistence granted: ${isPersisted}`);
        return isPersisted;
    } catch (e) {
        console.warn("Failed to request persistent storage", e);
        return false;
    }
};

export const checkPersistence = async (): Promise<boolean> => {
    if (!navigator.storage || !navigator.storage.persisted) return false;
    return await navigator.storage.persisted();
};

export const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};
