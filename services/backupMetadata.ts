/**
 * backupMetadata.ts
 *
 * Shared in-memory + db.settings store for backup sync metadata.
 * Imported by both backupService.ts and conflictService.ts to avoid
 * creating a circular dependency while sharing the same live state.
 */

import { db } from './apiClient';

const LAST_BACKUP_TIMESTAMP_ID = 'lastBackupTimestamp';
const LAST_BACKUP_HASH_ID = 'lastBackupHash';
const TOTAL_BYTES_UPLOADED_ID = 'totalBytesUploaded';

// In-memory caches — the single source of truth for synchronous reads
let timestampCache: number | null = null;
let hashCache: string | null = null;
let totalBytesCache: number = 0;
let loaded = false;

export const initBackupMetadata = async (): Promise<void> => {
    if (loaded) return;

    try {
        // lastBackupTimestamp
        const tsSetting = await db.settings.get(LAST_BACKUP_TIMESTAMP_ID);
        if (tsSetting != null) {
            timestampCache = typeof tsSetting.value === 'number' ? tsSetting.value : null;
        } else {
            const legacy = localStorage.getItem('lastBackupTimestamp');
            if (legacy) {
                timestampCache = parseInt(legacy, 10);
                await db.settings.put({ id: LAST_BACKUP_TIMESTAMP_ID, value: timestampCache });
            }
        }
        localStorage.removeItem('lastBackupTimestamp');

        // lastBackupHash
        const hashSetting = await db.settings.get(LAST_BACKUP_HASH_ID);
        if (hashSetting != null) {
            hashCache = typeof hashSetting.value === 'string' ? hashSetting.value : null;
        } else {
            const legacy = localStorage.getItem('lastBackupHash');
            if (legacy) {
                hashCache = legacy;
                await db.settings.put({ id: LAST_BACKUP_HASH_ID, value: hashCache });
            }
        }
        localStorage.removeItem('lastBackupHash');

        // totalBytesUploaded
        const totalSetting = await db.settings.get(TOTAL_BYTES_UPLOADED_ID);
        if (totalSetting != null) {
            totalBytesCache = typeof totalSetting.value === 'number' ? totalSetting.value : 0;
        } else {
            const legacy = localStorage.getItem('totalBytesUploaded');
            if (legacy) {
                totalBytesCache = parseInt(legacy, 10) || 0;
                await db.settings.put({ id: TOTAL_BYTES_UPLOADED_ID, value: totalBytesCache });
            }
        }
        localStorage.removeItem('totalBytesUploaded');
    } catch (error) {
        console.error('Failed to load backup metadata from db.settings; falling back to localStorage', error);
        const ts = localStorage.getItem('lastBackupTimestamp');
        timestampCache = ts ? parseInt(ts, 10) : null;
        hashCache = localStorage.getItem('lastBackupHash');
        totalBytesCache = parseInt(localStorage.getItem('totalBytesUploaded') || '0', 10);
    } finally {
        loaded = true;
    }
};

export const getLastBackupTimestamp = (): number | null => timestampCache;

export const setLastBackupTimestamp = async (ts: number): Promise<void> => {
    timestampCache = ts;
    try {
        await db.settings.put({ id: LAST_BACKUP_TIMESTAMP_ID, value: ts });
        localStorage.removeItem('lastBackupTimestamp');
    } catch (error) {
        console.error('Failed to persist lastBackupTimestamp', error);
        localStorage.setItem('lastBackupTimestamp', ts.toString());
    }
};

export const getLastBackupHash = (): string | null => hashCache;

export const setLastBackupHash = async (hash: string | null): Promise<void> => {
    hashCache = hash;
    try {
        if (hash !== null) {
            await db.settings.put({ id: LAST_BACKUP_HASH_ID, value: hash });
        } else {
            await db.settings.delete(LAST_BACKUP_HASH_ID);
        }
        localStorage.removeItem('lastBackupHash');
    } catch (error) {
        console.error('Failed to persist lastBackupHash', error);
        if (hash !== null) {
            localStorage.setItem('lastBackupHash', hash);
        } else {
            localStorage.removeItem('lastBackupHash');
        }
    }
};

export const addNetworkBytes = async (bytes: number): Promise<void> => {
    totalBytesCache += bytes;
    // Session counter stays in sessionStorage (intentionally per-session only)
    const currentSession = parseInt(sessionStorage.getItem('sessionBytesUploaded') || '0', 10);
    sessionStorage.setItem('sessionBytesUploaded', (currentSession + bytes).toString());
    try {
        await db.settings.put({ id: TOTAL_BYTES_UPLOADED_ID, value: totalBytesCache });
        localStorage.removeItem('totalBytesUploaded');
    } catch (error) {
        console.error('Failed to persist totalBytesUploaded', error);
        localStorage.setItem('totalBytesUploaded', totalBytesCache.toString());
    }
};

export const getNetworkStatsFromCache = () => ({
    total: totalBytesCache,
    session: parseInt(sessionStorage.getItem('sessionBytesUploaded') || '0', 10),
});
