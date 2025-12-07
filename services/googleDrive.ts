
import { getCredentials, saveCredentials, clearCredentials, DISCOVERY_DOC, SCOPES } from './googleDriveConfig';
import { db } from './db';
import { GoogleDriveFile } from '../types';

// Types for Google Libraries
declare var gapi: any;
declare var google: any;

// State Tracking
export type DriveInitState = 'loading' | 'ready' | 'error' | 'unconfigured';

let tokenClient: any = null;
let gapiInited = false;
let gisInited = false;
let pickerInited = false; // Track picker
let accessToken: string | null = null;
let tokenExpiresAt = 0; // Epoch time
let userProfile: any = null;
let initState: DriveInitState = 'loading';

// Event Subscriptions
type AuthStateListener = (isSignedIn: boolean, user: any) => void;
const authListeners: Set<AuthStateListener> = new Set();
const initListeners: Set<(status: DriveInitState) => void> = new Set();

// --- Helper to update init state ---
const setInitState = (newState: DriveInitState) => {
    initState = newState;
    initListeners.forEach(cb => cb(initState));
};

// --- Initialization ---

let initPromise: Promise<void> | null = null;

export const initGoogleDriveService = (): Promise<void> => {
    // If we are already ready or loading, return the existing promise (unless we force reload which is handled by configureDrive)
    if (initPromise && initState !== 'unconfigured' && initState !== 'error') return initPromise;

    initPromise = new Promise((resolve) => {
        const { clientId, apiKey } = getCredentials();

        if (!clientId || !apiKey || clientId === 'undefined' || apiKey === 'undefined') {
            console.warn("Google Drive API Key or Client ID missing.");
            setInitState('unconfigured');
            resolve();
            return;
        }
        
        setInitState('loading');

        const checkReady = () => {
            if (gapiInited && gisInited) {
                setInitState('ready');
                // Try to restore session if previously signed in
                if (localStorage.getItem('gdrive_connected') === 'true') {
                    attemptSilentSignIn();
                }
            }
        };

        const loadGapi = new Promise<void>((resolveGapi) => {
            const onGapiLoad = () => {
                 gapi.load('client:picker', async () => { // Load 'picker' too
                    try {
                        await gapi.client.init({
                            apiKey: apiKey,
                            discoveryDocs: [DISCOVERY_DOC],
                        });
                        gapiInited = true;
                        pickerInited = true;
                        checkReady();
                    } catch (err) {
                        console.error("Failed to init GAPI client", err);
                        setInitState('error');
                    }
                    resolveGapi();
                });
            };

            if (typeof gapi !== 'undefined') {
                onGapiLoad();
            } else {
                const script = document.createElement('script');
                script.src = 'https://apis.google.com/js/api.js';
                script.onload = onGapiLoad;
                script.onerror = () => {
                    console.error("Failed to load GAPI script");
                    setInitState('error');
                    resolveGapi();
                };
                document.body.appendChild(script);
            }
        });

        const loadGis = new Promise<void>((resolveGis) => {
             const onGisLoad = () => {
                 try {
                    tokenClient = google.accounts.oauth2.initTokenClient({
                        client_id: clientId,
                        scope: SCOPES,
                        callback: (resp: any) => {
                            if (resp.error !== undefined) {
                                throw (resp);
                            }
                            handleTokenResponse(resp);
                        },
                    });
                    gisInited = true;
                    checkReady();
                } catch (err) {
                    console.error("Failed to init GIS client", err);
                    setInitState('error');
                }
                resolveGis();
            };

            if (typeof google !== 'undefined' && google.accounts) {
                onGisLoad();
            } else {
                const script = document.createElement('script');
                script.src = 'https://accounts.google.com/gsi/client';
                script.onload = onGisLoad;
                script.onerror = () => {
                    console.error("Failed to load GIS script");
                    setInitState('error');
                    resolveGis();
                };
                document.body.appendChild(script);
            }
        });

        Promise.all([loadGapi, loadGis]).then(() => {
            resolve();
        });
    });

    return initPromise;
};

export const configureDrive = async (clientId: string, apiKey: string) => {
    saveCredentials(clientId, apiKey);
    // Reset state to force re-initialization
    gapiInited = false;
    gisInited = false;
    pickerInited = false;
    initPromise = null;
    await initGoogleDriveService();
};

export const disconnectDrive = () => {
    clearCredentials();
    signOut();
    setInitState('unconfigured');
};

// --- Authentication Logic ---

const handleTokenResponse = (resp: any) => {
    if (resp && resp.access_token) {
        accessToken = resp.access_token;
        // Calculate expiry (default is usually 3599 seconds)
        const expiresIn = resp.expires_in ? parseInt(resp.expires_in) : 3599;
        tokenExpiresAt = Date.now() + (expiresIn * 1000) - 60000; // Buffer 1 minute
        
        localStorage.setItem('gdrive_connected', 'true');
        fetchUserProfile();
    }
};

const fetchUserProfile = async () => {
    if (!accessToken) return;
    try {
        const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if (response.ok) {
            userProfile = await response.json();
            notifyListeners();
        }
    } catch (e) {
        console.warn("Failed to fetch user profile", e);
    }
};

export const onAuthStateChanged = (callback: AuthStateListener) => {
    authListeners.add(callback);
    // Immediate callback with current state
    callback(!!accessToken && Date.now() < tokenExpiresAt, userProfile);
    return () => authListeners.delete(callback);
};

const notifyListeners = () => {
    const isSignedIn = !!accessToken && Date.now() < tokenExpiresAt;
    authListeners.forEach(cb => cb(isSignedIn, userProfile));
};

export const requestManualSignIn = () => {
    if (!tokenClient) {
        // Attempt re-init if called prematurely
        initGoogleDriveService().then(() => {
            if (tokenClient) tokenClient.requestAccessToken({ prompt: 'consent' });
        });
        return;
    }
    // Request consent for first time or explicit sign in
    tokenClient.requestAccessToken({ prompt: 'consent' });
};

export const attemptSilentSignIn = () => {
    if (!tokenClient) return;
    // Try to get token without prompt
    tokenClient.requestAccessToken({ prompt: 'none' });
};

export const signOut = () => {
    const token = gapi?.client?.getToken();
    if (token !== null && google?.accounts?.oauth2) {
        google.accounts.oauth2.revoke(token.access_token, () => {});
    }
    gapi?.client?.setToken(null);
    accessToken = null;
    userProfile = null;
    tokenExpiresAt = 0;
    localStorage.removeItem('gdrive_connected');
    notifyListeners();
};

export const subscribeToDriveInit = (cb: (status: DriveInitState) => void) => {
    initListeners.add(cb);
    cb(initState);
    return () => initListeners.delete(cb);
};

// Backwards compatibility wrapper (deprecated but kept for now if other files use it)
export const onGapiReady = (cb: (ready: boolean) => void) => {
    return subscribeToDriveInit((status) => {
        cb(status === 'ready');
    });
};

// --- API Wrapper ---

const ensureToken = async (): Promise<void> => {
    if (!gapiInited || !gisInited) throw new Error("Google Services not initialized.");

    // If we have a valid token, we're good
    if (accessToken && Date.now() < tokenExpiresAt) {
        return;
    }

    // If we don't have a token but user was connected, try silent refresh
    if (localStorage.getItem('gdrive_connected') === 'true') {
        return new Promise((resolve, reject) => {
            const start = Date.now();
            if (tokenClient) {
                tokenClient.requestAccessToken({ prompt: 'none' });
            } else {
                reject(new Error("Token client not initialized"));
                return;
            }
            
            const interval = setInterval(() => {
                if (accessToken && Date.now() < tokenExpiresAt) {
                    clearInterval(interval);
                    resolve();
                } else if (Date.now() - start > 5000) {
                    clearInterval(interval);
                    reject(new Error("Silent refresh failed. Please sign in again."));
                }
            }, 100);
        });
    }

    throw new Error("Not signed in.");
};

// --- Drive Operations ---

export const backupToGoogleDrive = async (): Promise<void> => {
    await ensureToken();
    
    const backupJson = await db.backup();
    const backupData = JSON.parse(backupJson);
    
    // Basic validation
    if (backupData.books.length === 0 && backupData.instructions.length === 0) {
        throw new Error("No data to backup.");
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `ai-book-studio-backup-${timestamp}.json`;

    const fileMetadata = {
        name: fileName,
        parents: ['appDataFolder'], // Save to hidden app folder
        mimeType: 'application/json'
    };

    const fileContent = new Blob([backupJson], { type: 'application/json' });
    
    // GAPI doesn't support simple upload easily, using multipart fetch
    const metadataBlob = new Blob([JSON.stringify(fileMetadata)], { type: 'application/json' });
    const form = new FormData();
    form.append('metadata', metadataBlob);
    form.append('file', fileContent);

    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}` },
        body: form
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Upload failed: ${response.status} - ${text}`);
    }
};

export const listFiles = async (): Promise<GoogleDriveFile[]> => {
    await ensureToken();
    
    const response = await gapi.client.drive.files.list({
        spaces: 'appDataFolder',
        fields: 'files(id, name, modifiedTime)',
        orderBy: 'modifiedTime desc',
        pageSize: 20
    });

    return response.result.files || [];
};

export const downloadFile = async (fileId: string): Promise<string> => {
    await ensureToken();

    const response = await gapi.client.drive.files.get({
        fileId: fileId,
        alt: 'media'
    });

    return response.body;
};

export const deleteFile = async (fileId: string): Promise<void> => {
    await ensureToken();
    await gapi.client.drive.files.delete({ fileId });
};

// Google Docs Import
export const listGoogleDocs = async (): Promise<GoogleDriveFile[]> => {
    await ensureToken();
    const response = await gapi.client.drive.files.list({
        q: "mimeType='application/vnd.google-apps.document' and trashed=false",
        fields: 'files(id, name, modifiedTime)',
        orderBy: 'modifiedTime desc',
        pageSize: 20
    });
    return response.result.files || [];
};

export const getGoogleDocContent = async (fileId: string): Promise<string> => {
    await ensureToken();
    const response = await gapi.client.drive.files.export({
        fileId: fileId,
        mimeType: 'text/html'
    });
    return response.body;
};

// --- Picker API ---

export const openDrivePicker = async (onSelect: (fileId: string, fileName: string) => void): Promise<void> => {
    await ensureToken();
    if (!pickerInited) throw new Error("Google Picker not initialized.");

    const { apiKey } = getCredentials();
    
    const view = new google.picker.View(google.picker.ViewId.DOCS);
    view.setMimeTypes("application/vnd.google-apps.document");

    const picker = new google.picker.PickerBuilder()
        .setDeveloperKey(apiKey)
        .setAppId(getCredentials().clientId.split('-')[0])
        .setOAuthToken(accessToken)
        .addView(view)
        .addView(new google.picker.DocsUploadView())
        .setCallback((data: any) => {
            if (data[google.picker.Response.ACTION] == google.picker.Action.PICKED) {
                const doc = data[google.picker.Response.DOCUMENTS][0];
                onSelect(doc[google.picker.Document.ID], doc[google.picker.Document.NAME]);
            }
        })
        .build();
        
    picker.setVisible(true);
};
