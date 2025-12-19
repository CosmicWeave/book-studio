
import { Book } from '../types';
import { db } from './db';
import { conflictService } from './conflictService';
import { toastService } from './toastService';

export const AUTO_BACKUP_ENABLED_ID = 'autoBackupEnabled';
export const LOW_DATA_MODE_ID = 'lowDataMode';
export const BACKUP_API_KEY_ID = 'backupApiKey';

const APP_ID = 'ai-book-studio';
const BASE_API_URL = 'https://www.greenyogafestival.org/backup-api/api/v1/apps';
const UPLOAD_URL = `${BASE_API_URL}/${APP_ID}/backups`;
const LIST_BACKUPS_URL = `${UPLOAD_URL}/list`;
const LATEST_BACKUP_URL = `${BASE_API_URL}/${APP_ID}/backups/latest`;

// --- STATE MANAGEMENT ---
export type BackupStatus = 'idle' | 'syncing' | 'synced' | 'failed' | 'disabled' | 'conflict';

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

// --- HELPERS ---

const getApiKey = async (): Promise<string> => {
    try {
        const setting = await db.settings.get(BACKUP_API_KEY_ID);
        return setting?.value || '';
    } catch (e) {
        return '';
    }
};

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
    
    return true; 
};

const setupNetworkListener = () => {
    const nav = navigator as any;
    const conn = nav.connection || nav.mozConnection || nav.webkitConnection;
    if (conn) {
        conn.addEventListener('change', () => {
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
        const apiKey = await getApiKey();
        const isEnabled = enabledSetting?.value !== false && apiKey.length > 0;

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

// --- UTILS ---

async function computeHash(text: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function decompress(blob: Blob): Promise<string> {
    // @ts-ignore
    const ds = new DecompressionStream('gzip');
    const decompressedStream = blob.stream().pipeThrough(ds);
    return await new Response(decompressedStream).text();
}

export const getNetworkStats = () => {
    const total = localStorage.getItem('totalBytesUploaded') || '0';
    const session = sessionStorage.getItem('sessionBytesUploaded') || '0';
    return {
        total: parseInt(total, 10),
        session: parseInt(session, 10)
    };
};

const updateNetworkStats = (bytes: number) => {
    const currentTotal = parseInt(localStorage.getItem('totalBytesUploaded') || '0', 10);
    localStorage.setItem('totalBytesUploaded', (currentTotal + bytes).toString());
    
    const currentSession = parseInt(sessionStorage.getItem('sessionBytesUploaded') || '0', 10);
    sessionStorage.setItem('sessionBytesUploaded', (currentSession + bytes).toString());
};

// --- API LOGIC ---

let isSyncing = false;
let syncQueued = false;
let retryCount = 0;

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

    const apiKey = await getApiKey();
    if (!apiKey && !force) {
        setState({ status: 'disabled' });
        return null;
    }

    // Network Check
    if (!force && !isWifi()) {
        console.log("Backup deferred: Not on WiFi or metered connection.");
        if (state.status === 'synced') {
            setState({ status: 'idle' });
        }
        return null;
    }

    try {
        const enabledSetting = await db.settings.get(AUTO_BACKUP_ENABLED_ID);
        if (!force && enabledSetting?.value === false) {
            setState({ status: 'disabled' });
            return null;
        }

        const lowDataMode = await db.settings.get(LOW_DATA_MODE_ID);
        const excludeImages = lowDataMode?.value === true;

        isSyncing = true;
        setState({ status: 'syncing' });

        let backupJson = await db.backup({ excludeImages });
        
        // --- DEDUPLICATION ---
        const currentHash = await computeHash(backupJson);
        const lastHash = localStorage.getItem('lastBackupHash');
        
        if (!force && currentHash === lastHash) {
            console.log("Backup skipped: Content unchanged since last sync.");
            const timestamp = Date.now();
            localStorage.setItem('lastBackupTimestamp', timestamp.toString());
            setState({ status: 'synced', lastBackupTimestamp: timestamp });
            return null;
        }

        // --- CONFLICT DETECTION & AUTO-RESOLVE ---
        try {
            const latestMetaRes = await fetch(`${LATEST_BACKUP_URL}?t=${Date.now()}`, {
                method: 'GET',
                headers: { 'X-API-Key': apiKey },
                cache: 'no-store'
            });

            if (latestMetaRes.ok) {
                const meta = await latestMetaRes.json();
                const serverTime = new Date(meta.modified).getTime();
                const lastLocalSync = state.lastBackupTimestamp || 0;

                // Tolerance of 2 seconds for clock skew / network latency
                if (serverTime > lastLocalSync + 2000) {
                    console.warn("Sync Check: Server is newer.");
                    
                    const downloadUrl = meta.download_url;
                    const contentRes = await fetch(downloadUrl);
                    if (contentRes.ok) {
                        let remoteDataBlob = await contentRes.blob();
                        let remoteData = '';
                        if (meta.filename.endsWith('.gz')) {
                             remoteData = await decompress(remoteDataBlob);
                        } else {
                             remoteData = await remoteDataBlob.text();
                        }

                        const conflictingItems = conflictService.findConflictingItems(backupJson, remoteData, lastLocalSync);
                        
                        if (conflictingItems.length === 0) {
                            console.log("Auto-resolving sync: No overlapping conflicts found. Merging...");
                            
                            // Safe to merge remote into local because no individual item was modified on both sides.
                            await db.smartMerge(remoteData);
                            
                            // Re-generate backup JSON from the merged state
                            backupJson = await db.backup({ excludeImages });
                            
                            // Update UI to let user know
                            toastService.success("Synced with server (Changes merged)");
                        } else {
                            console.warn("Sync Conflict: Overlapping changes found.", conflictingItems);
                            conflictService.triggerConflict(backupJson, remoteData, serverTime);
                            setState({ status: 'conflict' });
                            return null; // Stop backup, wait for resolution
                        }
                    }
                }
            }
        } catch (checkErr) {
            console.warn("Could not check for conflicts, proceeding with overwrite (risky)", checkErr);
        }

        // --- UPLOAD ---
        const backupBlob = new Blob([backupJson], { type: 'application/json' });
        const fileName = `latest.json`;

        const latestFile = new File([backupBlob], fileName, { type: 'application/json' });
        const latestFormData = new FormData();
        latestFormData.append('file', latestFile);

        const uploadLatestResponse = await fetch(UPLOAD_URL, {
            method: 'POST',
            headers: { 'X-API-Key': apiKey },
            body: latestFormData,
        });

        if (!uploadLatestResponse.ok) {
            const errorText = await uploadLatestResponse.text();
            throw new Error(`Failed to upload latest backup: ${uploadLatestResponse.status} ${uploadLatestResponse.statusText} - ${errorText}`);
        }
        
        updateNetworkStats(backupBlob.size);
        localStorage.setItem('lastBackupHash', currentHash);

        // 2. Handle daily snapshots.
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const dailyCacheKey = `dailySnapshotCreated_${today}`;
        const dailySnapshotCreated = localStorage.getItem(dailyCacheKey);
        
        if (!dailySnapshotCreated) {
            const dailySnapshotFilename = `daily_${today}.json`;
            // Fire and forget daily snapshot
            const dailyFile = new File([backupBlob], dailySnapshotFilename, { type: 'application/json' });
            const dailyFormData = new FormData();
            dailyFormData.append('file', dailyFile);
            
            fetch(UPLOAD_URL, {
                method: 'POST',
                headers: { 'X-API-Key': apiKey },
                body: dailyFormData,
            }).then(() => {
                localStorage.setItem(dailyCacheKey, 'true');
            }).catch(e => console.warn("Failed to create daily snapshot", e));
        }
        
        const timestamp = Date.now();
        localStorage.setItem('lastBackupTimestamp', timestamp.toString());
        setState({ status: 'synced', lastBackupTimestamp: timestamp });
        retryCount = 0;
        return null;

    } catch (error) {
        console.error('An error occurred during server backup:', error);
        setState({ status: 'failed' });
        
        if (!force && retryCount < 5) {
            retryCount++;
            const delay = Math.pow(2, retryCount) * 1000 + (Math.random() * 1000);
            setTimeout(() => {
                isSyncing = false;
                performBackupToServer(false);
            }, delay);
        }
        
        return error as Error;
    } finally {
        isSyncing = false;
        if (syncQueued) {
            syncQueued = false;
            setTimeout(() => performBackupToServer(force), 1000); 
        }
    }
};

export const createCloudSnapshot = async (name: string): Promise<void> => {
    const apiKey = await getApiKey();
    if (!apiKey) throw new Error("Backup API Key not configured.");

    const lowDataMode = await db.settings.get(LOW_DATA_MODE_ID);
    const excludeImages = lowDataMode?.value === true;
    const backupJson = await db.backup({ excludeImages });
    const backupBlob = new Blob([backupJson], { type: 'application/json' });
    
    // Sanitize name for filename
    const sanitized = name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `snapshot_${timestamp}_${sanitized}.json`;
    
    const file = new File([backupBlob], fileName, { type: 'application/json' });
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(UPLOAD_URL, {
        method: 'POST',
        headers: { 'X-API-Key': apiKey },
        body: formData,
    });

    if (!response.ok) {
        throw new Error(`Failed to upload snapshot: ${response.statusText}`);
    }
    
    updateNetworkStats(backupBlob.size);
};


let debounceTimer: number | null = null;

export const triggerBackup = () => {
    if (debounceTimer) {
        clearTimeout(debounceTimer);
    }
    if (!isWifi()) {
        if (state.status === 'synced') setState({ status: 'idle' });
        return; 
    }

    debounceTimer = window.setTimeout(() => {
        performBackupToServer();
        debounceTimer = null;
    }, 1500); 
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
        const apiKey = await getApiKey();
        if (!apiKey && !force) return null;

        // Fast exit if offline to avoid "Failed to fetch" errors
        if (!navigator.onLine && !force) {
            return null;
        }

        await db.init();
        const enabledSetting = await db.settings.get(AUTO_BACKUP_ENABLED_ID);
        if (enabledSetting?.value === false && !force) {
            return null;
        }

        const storedEtag = localStorage.getItem('latestBackupEtag');
        const cachedContent = localStorage.getItem('latestBackupContent');
        const storedLastModified = localStorage.getItem('latestBackupLastModified');

        const fetchMetadata = async (useEtag: boolean) => {
            const headers: HeadersInit = { 'X-API-Key': apiKey };
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
            if (cachedContent) {
                const data = JSON.parse(cachedContent);
                if (!data.books || data.books.length === 0) return null;
                const contentTimestamp = Math.max(...data.books.map((b: Book) => b.updatedAt));
                const backupTimestamp = storedLastModified ? new Date(storedLastModified).getTime() : contentTimestamp;
                return { content: cachedContent, contentTimestamp, backupTimestamp };
            }
            return null; 
        }

        if (metadataResponse.status === 404) {
            localStorage.removeItem('latestBackupEtag');
            localStorage.removeItem('latestBackupContent');
            localStorage.removeItem('latestBackupLastModified');
            return null;
        }

        if (!metadataResponse.ok) {
            return null;
        }
        
        const metadata = await metadataResponse.json();
        const downloadUrl = metadata.download_url;

        if (!downloadUrl) return null;

        const contentResponse = await fetch(downloadUrl, {
            method: 'GET',
            headers: { 'X-API-Key': apiKey },
            cache: 'no-store'
        });

        if (!contentResponse.ok) return null;

        let backupBlob = await contentResponse.blob();
        let backupContent = '';
        
        if (metadata.filename && metadata.filename.endsWith('.gz')) {
            try {
                backupContent = await decompress(backupBlob);
            } catch (e) {
                backupContent = await backupBlob.text();
            }
        } else {
            backupContent = await backupBlob.text();
        }
        
        const newEtag = metadataResponse.headers.get('ETag');
        const lastModified = metadataResponse.headers.get('Last-Modified') || metadata.modified;

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
        // Suppress network errors to avoid console spam in background checks
        if (error instanceof TypeError && error.message === 'Failed to fetch') {
            console.warn('Backup check skipped: Server unreachable.');
        } else {
            console.error('An error occurred while fetching the latest server backup:', error);
        }
        return null;
    }
};

export const listServerBackups = async (): Promise<{ id: string; createdAt: string; size: number }[]> => {
    try {
        await db.init();
        const apiKey = await getApiKey();
        if (!apiKey) throw new Error("Backup API Key not configured.");
        
        const response = await fetch(LIST_BACKUPS_URL, {
            method: 'GET',
            headers: { 'X-API-Key': apiKey },
            cache: 'no-store',
        });
        
        if (response.status === 404) {
            return [];
        }

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to list backups: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const responseData = await response.json();
        const serverBackups: ServerBackupItem[] = responseData.backups || [];

        const backups: { id: string; createdAt: string; size: number }[] = serverBackups
            .filter(b => b.filename.endsWith('.json') || b.filename.endsWith('.json.gz'))
            .map((b: any) => ({
                id: b.filename,
                createdAt: b.modified,
                size: b.size,
            }));

        backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        return backups;

    } catch (error) {
        console.error('An error occurred while listing server backups:', error);
        if (error instanceof TypeError) {
            throw new Error("Could not connect to the backup server. Check your network or firewall.");
        }
        throw error; 
    }
};

export const fetchBackupContent = async (backupId: string): Promise<string | null> => {
    try {
        const apiKey = await getApiKey();
        if (!apiKey) throw new Error("Backup API Key not configured.");

        const response = await fetch(`${UPLOAD_URL}/${encodeURIComponent(backupId)}`, {
            method: 'GET',
            headers: { 'X-API-Key': apiKey },
        });

        if (response.status === 404) {
            return null;
        }

        if (!response.ok) {
            throw new Error(`Failed to fetch backup content`);
        }
        
        const blob = await response.blob();
        if (backupId.endsWith('.gz')) {
            return await decompress(blob);
        }
        
        return await blob.text();
    } catch (error) {
        console.error(`An error occurred while fetching backup content for ${backupId}:`, error);
        if (error instanceof TypeError) {
            throw new Error("Could not connect to the backup server. Please check your internet connection.");
        }
        throw error;
    }
};
