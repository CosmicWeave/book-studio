
import { Book } from '../types';
import { db } from './db';

export const AUTO_BACKUP_ENABLED_ID = 'autoBackupEnabled';
const APP_ID = 'ai-book-studio';
const BASE_API_URL = 'https://www.greenyogafestival.org/backup-api/api/v1/apps';
const UPLOAD_URL = `${BASE_API_URL}/${APP_ID}/backups`;
const LIST_BACKUPS_URL = `${UPLOAD_URL}/list`;
const LATEST_BACKUP_URL = `${BASE_API_URL}/${APP_ID}/backups/latest`;
const BACKUP_API_KEY = 'qRt+gU/57GHKhxTZeRnRi+dfT274iSkKKq2UnTr9Bxs=';

// --- STATE MANAGEMENT ---
export type BackupStatus = 'idle' | 'syncing' | 'synced' | 'failed' | 'disabled';

interface BackupState {
    status: BackupStatus;
    lastBackupTimestamp: number | null;
}

let state: BackupState = {
    status: 'idle',
    lastBackupTimestamp: localStorage.getItem('lastBackupTimestamp') ? parseInt(localStorage.getItem('lastBackupTimestamp')!, 10) : null,
};

type Subscriber = (state: BackupState) => void;
const subscribers: Set<Subscriber> = new Set();

// --- NETWORK DETECTION ---

const isWifi = (): boolean => {
    const nav = navigator as any;
    const conn = nav.connection || nav.mozConnection || nav.webkitConnection;
    if (!conn) return true; // Assume yes if API not supported or unknown
    
    // If save data mode is enabled, treat as non-wifi to be safe
    if (conn.saveData) return false;
    
    // Check connection type if available
    if (conn.type) {
        if (conn.type === 'cellular' || conn.type === 'bluetooth' || conn.type === 'none') return false;
        if (conn.type === 'wifi' || conn.type === 'ethernet') return true;
    }
    
    // Check effectiveType as fallback (4g is often cellular, but not always, so use caution)
    // Generally, 'type' is the reliable one. If 'type' is missing, we default to true to avoid blocking desktops.
    return true; 
};

const setupNetworkListener = () => {
    const nav = navigator as any;
    const conn = nav.connection || nav.mozConnection || nav.webkitConnection;
    if (conn) {
        conn.addEventListener('change', () => {
            // If we are back on WiFi and we have pending changes (status is idle or failed but not synced), try to sync.
            if (isWifi() && (state.status === 'idle' || state.status === 'failed')) {
                console.log('WiFi detected, triggering pending backup.');
                triggerBackup();
            }
        });
    }
    
    window.addEventListener('online', () => {
         if (state.status !== 'synced' && state.status !== 'disabled' && isWifi()) {
             triggerBackup();
         }
    });
}

export const initBackupService = async () => {
    try {
        // Ensure DB is initialized before checking settings
        await db.init(); 
        
        const enabledSetting = await db.settings.get(AUTO_BACKUP_ENABLED_ID);
        const isEnabled = enabledSetting?.value !== false;

        setupNetworkListener();

        if (!isEnabled) {
            setState({ status: 'disabled' });
        } else if (state.lastBackupTimestamp) {
            setState({ status: 'synced' });
        } else {
            setState({ status: 'idle' });
        }
    } catch (e) {
        console.warn("Could not initialize backup status.", e);
    }
};

const notifySubscribers = () => {
    subscribers.forEach(cb => cb(state));
};

const setState = (newState: Partial<BackupState>) => {
    state = { ...state, ...newState };
    notifySubscribers();
};

export const subscribeToBackupStatus = (callback: Subscriber) => {
    subscribers.add(callback);
    callback(state); // Immediately provide current state
    return () => {
        subscribers.delete(callback);
    };
};

// --- API LOGIC ---

let isSyncing = false;
let syncQueued = false;

interface ServerBackupItem {
    filename: string;
    modified: string;
    size: number;
}

const performBackupToServer = async (force: boolean = false): Promise<Error | null> => {
    if (isSyncing) {
        syncQueued = true;
        return null;
    }

    // Network Check
    if (!force && !isWifi()) {
        console.log("Backup deferred: Not on WiFi or metered connection.");
        // If deferred, we are no longer fully synced with server.
        // Set status to 'idle' so the network listener can pick it up when wifi returns.
        if (state.status === 'synced') {
            setState({ status: 'idle' });
        }
        return null;
    }

    try {
        if (!force) {
            const enabledSetting = await db.settings.get(AUTO_BACKUP_ENABLED_ID);
            if (enabledSetting?.value === false) {
                setState({ status: 'disabled' });
                return null;
            }
        }

        isSyncing = true;
        setState({ status: 'syncing' });

        const backupJson = await db.backup();
        const blob = new Blob([backupJson], { type: 'application/json' });
        
        // 1. Always upload/overwrite the "latest" backup. This is the primary backup.
        const latestFile = new File([blob], `latest.json`, { type: 'application/json' });
        const latestFormData = new FormData();
        latestFormData.append('file', latestFile);

        const uploadLatestResponse = await fetch(UPLOAD_URL, {
            method: 'POST',
            headers: { 'X-API-Key': BACKUP_API_KEY },
            body: latestFormData,
        });

        if (!uploadLatestResponse.ok) {
            const errorText = await uploadLatestResponse.text();
            throw new Error(`Failed to upload latest backup: ${uploadLatestResponse.status} ${uploadLatestResponse.statusText} - ${errorText}`);
        }

        // 2. Handle daily snapshots and pruning.
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const dailySnapshotFilename = `daily_${today}.json`;
        
        const listResponse = await fetch(LIST_BACKUPS_URL, {
            method: 'GET',
            headers: { 'X-API-Key': BACKUP_API_KEY },
            cache: 'no-store',
        });

        if (listResponse.ok) {
            const responseData = await listResponse.json();
            const serverBackups: ServerBackupItem[] = responseData.backups || [];

            // Check if a snapshot for today already exists.
            const dailySnapshotExistsToday = serverBackups.some((b) => b.filename === dailySnapshotFilename);

            if (!dailySnapshotExistsToday) {
                // If not, create one. This is a best-effort task.
                const dailyFile = new File([blob], dailySnapshotFilename, { type: 'application/json' });
                const dailyFormData = new FormData();
                dailyFormData.append('file', dailyFile);
                fetch(UPLOAD_URL, {
                    method: 'POST',
                    headers: { 'X-API-Key': BACKUP_API_KEY },
                    body: dailyFormData,
                }).catch(e => console.warn("Failed to create daily snapshot", e));
            }
            
            // Prune old daily snapshots.
            const dailyBackups = serverBackups
                .filter((b) => b.filename.startsWith('daily_'))
                .map((b) => ({ id: b.filename, createdAt: b.modified }))
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); // Newest first

            const MAX_DAILY_BACKUPS = 10;
            if (dailyBackups.length > MAX_DAILY_BACKUPS) {
                const backupsToDelete = dailyBackups.slice(MAX_DAILY_BACKUPS);
                for (const backup of backupsToDelete) {
                    fetch(`${UPLOAD_URL}/${backup.id}`, {
                        method: 'DELETE',
                        headers: { 'X-API-Key': BACKUP_API_KEY },
                    }).catch(e => console.warn(`Failed to delete old snapshot ${backup.id}`, e));
                }
            }
        }
        
        const timestamp = Date.now();
        localStorage.setItem('lastBackupTimestamp', timestamp.toString());
        setState({ status: 'synced', lastBackupTimestamp: timestamp });
        return null;

    } catch (error) {
        console.error('An error occurred during server backup:', error);
        setState({ status: 'failed' });
        return error as Error;
    } finally {
        isSyncing = false;
        if (syncQueued) {
            syncQueued = false;
            setTimeout(() => performBackupToServer(force), 100); // Process queue with a small delay
        }
    }
};


let debounceTimer: number | null = null;

export const triggerBackup = () => {
    if (debounceTimer) {
        clearTimeout(debounceTimer);
    }
    // If we know we are not on Wifi, don't even buffer the timer, unless state is 'synced' (to invalidate it)
    if (!isWifi()) {
        if (state.status === 'synced') setState({ status: 'idle' });
        return; 
    }

    debounceTimer = window.setTimeout(() => {
        performBackupToServer();
        debounceTimer = null;
    }, 1500); // 1.5-second debounce
};

export const manualTriggerBackup = async (force: boolean = false): Promise<Error | null> => {
    if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
    }
    return await performBackupToServer(force);
};

export const fetchLatestBackup = async (force: boolean = false): Promise<{ content: string; contentTimestamp: number; backupTimestamp: number; } | null> => {
    try {
        await db.init();
        const enabledSetting = await db.settings.get(AUTO_BACKUP_ENABLED_ID);
        if (enabledSetting?.value === false && !force) {
            return null;
        }

        const storedEtag = localStorage.getItem('latestBackupEtag');
        const cachedContent = localStorage.getItem('latestBackupContent');
        const storedLastModified = localStorage.getItem('latestBackupLastModified');

        const fetchMetadata = async (useEtag: boolean) => {
            const headers: HeadersInit = { 'X-API-Key': BACKUP_API_KEY };
            if (useEtag && storedEtag && !force) {
                headers['If-None-Match'] = storedEtag;
            }
            const url = `${LATEST_BACKUP_URL}?t=${new Date().getTime()}`;
            return fetch(url, { method: 'GET', headers, cache: 'no-store' });
        };

        let metadataResponse = await fetchMetadata(true);

        if (metadataResponse.status === 304 && !cachedContent) {
            metadataResponse = await fetchMetadata(false);
        }

        if (metadataResponse.status === 304) {
            // Not modified, use cached content if it exists
            if (cachedContent) {
                const data = JSON.parse(cachedContent);
                if (!data.books || data.books.length === 0) return null;
                const contentTimestamp = Math.max(...data.books.map((b: Book) => b.updatedAt));
                const backupTimestamp = storedLastModified ? new Date(storedLastModified).getTime() : contentTimestamp;
                return { content: cachedContent, contentTimestamp, backupTimestamp };
            }
            return null; // Nothing new and no cache, so nothing to do.
        }

        if (metadataResponse.status === 404) {
            // No backup found, clear local cache.
            localStorage.removeItem('latestBackupEtag');
            localStorage.removeItem('latestBackupContent');
            localStorage.removeItem('latestBackupLastModified');
            return null;
        }

        if (!metadataResponse.ok) {
            const errorText = await metadataResponse.text();
            throw new Error(`Failed to fetch backup metadata: ${metadataResponse.status} ${metadataResponse.statusText} - ${errorText}`);
        }
        
        // Got new metadata, now fetch the content
        const metadata = await metadataResponse.json();
        const downloadUrl = metadata.download_url;

        if (!downloadUrl) {
            throw new Error('Backup metadata is missing the download_url.');
        }

        const contentResponse = await fetch(downloadUrl, {
            method: 'GET',
            headers: { 'X-API-Key': BACKUP_API_KEY },
            cache: 'no-store'
        });

        if (!contentResponse.ok) {
            const errorText = await contentResponse.text();
            throw new Error(`Failed to download backup content: ${contentResponse.status} ${contentResponse.statusText} - ${errorText}`);
        }

        const backupContent = await contentResponse.text();
        
        const newEtag = metadataResponse.headers.get('ETag');
        const lastModified = metadataResponse.headers.get('Last-Modified') || metadata.modified;

        // Update cache with new content and metadata ETag
        if (newEtag) {
            localStorage.setItem('latestBackupEtag', newEtag);
            localStorage.setItem('latestBackupContent', backupContent);
            if (lastModified) {
                localStorage.setItem('latestBackupLastModified', lastModified);
            }
        }

        if (!backupContent) return null;
        
        const data = JSON.parse(backupContent);
        if (!data.books || data.books.length === 0) {
            return null;
        }
        
        const contentTimestamp = Math.max(...data.books.map((b: Book) => b.updatedAt));
        const backupTimestamp = lastModified ? new Date(lastModified).getTime() : contentTimestamp;
        return { content: backupContent, contentTimestamp, backupTimestamp };

    } catch (error) {
        console.error('An error occurred while fetching the latest server backup:', error);
        return null;
    }
};

export const listServerBackups = async (): Promise<{ id: string; createdAt: string; size: number }[]> => {
    try {
        await db.init();
        const enabledSetting = await db.settings.get(AUTO_BACKUP_ENABLED_ID);
        if (enabledSetting?.value === false) {
            return [];
        }

        const response = await fetch(LIST_BACKUPS_URL, {
            method: 'GET',
            headers: { 'X-API-Key': BACKUP_API_KEY },
            cache: 'no-store', // Ensure fresh data is fetched every time
        });
        
        if (response.status === 404) {
            // 404 means the app ID hasn't created any backups yet, which is not an error.
            return [];
        }

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to list backups: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const responseData = await response.json();
        const serverBackups: ServerBackupItem[] = responseData.backups || [];

        const backups: { id: string; createdAt: string; size: number }[] = serverBackups
            .filter(b => b.filename.startsWith('daily_')) // Only show daily snapshots to the user for restore
            .map((b: any) => ({
                id: b.filename,
                createdAt: b.modified,
                size: b.size,
            }));

        backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); // Newest first
        return backups;

    } catch (error) {
        console.error('An error occurred while listing server backups:', error);
        if (error instanceof TypeError) { // Often indicates a network error
            throw new Error("Could not connect to the backup server. Please check your internet connection.");
        }
        throw error; // re-throw other errors
    }
};

export const fetchBackupContent = async (backupId: string): Promise<string | null> => {
    try {
        const response = await fetch(`${UPLOAD_URL}/${encodeURIComponent(backupId)}`, {
            method: 'GET',
            headers: { 'X-API-Key': BACKUP_API_KEY },
        });

        if (response.status === 404) {
            return null;
        }

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to fetch backup content: ${response.status} ${response.statusText} - ${errorText}`);
        }
        
        const content = await response.text();
        return content;
    } catch (error) {
        console.error(`An error occurred while fetching backup content for ${backupId}:`, error);
        if (error instanceof TypeError) {
            throw new Error("Could not connect to the backup server. Please check your internet connection.");
        }
        throw error;
    }
};
