
import { db } from './apiClient';

// It's important to replace these with your actual Google Cloud project credentials.
// These are typically provided via environment variables during build.
// However, we now support dynamic configuration via db.settings for users without env vars.

export const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';

// The scopes define the level of access the application is requesting.
// 'appDataFolder' is a special folder that is private to the application and user, invisible to them on Google Drive.
// 'userinfo.profile' is for displaying user name and picture.
// 'drive.readonly' is for importing existing Google Docs.
export const SCOPES = 'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/drive.readonly';

const GOOGLE_DRIVE_CREDENTIALS_SETTING_ID = 'googleDriveCredentials';
const GDRIVE_CONNECTED_SETTING_ID = 'gdriveConnected';

type GoogleDriveCredentials = {
    clientId: string;
    apiKey: string;
};

let cachedCredentials: GoogleDriveCredentials = { clientId: '', apiKey: '' };
let credentialsLoaded = false;
let cachedGdriveConnected = false;

const sanitiseCredentials = (value: unknown): GoogleDriveCredentials => {
    const raw = (value && typeof value === 'object' ? value : {}) as Partial<GoogleDriveCredentials>;
    return {
        clientId: typeof raw.clientId === 'string' ? raw.clientId.trim() : '',
        apiKey: typeof raw.apiKey === 'string' ? raw.apiKey.trim() : '',
    };
};

export const initGoogleDriveConfig = async (): Promise<void> => {
    if (credentialsLoaded) return;

    try {
        const setting = await db.settings.get(GOOGLE_DRIVE_CREDENTIALS_SETTING_ID);
        if (setting) {
            cachedCredentials = sanitiseCredentials(setting.value);
        } else {
            cachedCredentials = sanitiseCredentials({
                clientId: localStorage.getItem('google_client_id') || '',
                apiKey: localStorage.getItem('google_api_key') || '',
            });
            if (cachedCredentials.clientId || cachedCredentials.apiKey) {
                await db.settings.put({ id: GOOGLE_DRIVE_CREDENTIALS_SETTING_ID, value: cachedCredentials });
                localStorage.removeItem('google_client_id');
                localStorage.removeItem('google_api_key');
            }
        }
    } catch (error) {
        console.error('Failed to load Google Drive credentials from db.settings', error);
        cachedCredentials = sanitiseCredentials({
            clientId: localStorage.getItem('google_client_id') || '',
            apiKey: localStorage.getItem('google_api_key') || '',
        });
    } finally {
        credentialsLoaded = true;
    }

    // gdrive_connected
    try {
        const connSetting = await db.settings.get(GDRIVE_CONNECTED_SETTING_ID);
        if (connSetting != null) {
            cachedGdriveConnected = connSetting.value === true;
        } else if (localStorage.getItem('gdrive_connected') === 'true') {
            cachedGdriveConnected = true;
            await db.settings.put({ id: GDRIVE_CONNECTED_SETTING_ID, value: true });
        }
        localStorage.removeItem('gdrive_connected');
    } catch (error) {
        console.error('Failed to load gdrive_connected from db.settings', error);
        cachedGdriveConnected = localStorage.getItem('gdrive_connected') === 'true';
    }
};

export const getCredentials = () => {
    return {
        clientId: process.env.GOOGLE_CLIENT_ID || cachedCredentials.clientId || localStorage.getItem('google_client_id') || '',
        apiKey: process.env.GOOGLE_API_KEY || cachedCredentials.apiKey || localStorage.getItem('google_api_key') || ''
    };
};

export const getGdriveConnected = (): boolean => cachedGdriveConnected;

export const setGdriveConnectedPersisted = async (connected: boolean): Promise<void> => {
    cachedGdriveConnected = connected;
    try {
        if (connected) {
            await db.settings.put({ id: GDRIVE_CONNECTED_SETTING_ID, value: true });
        } else {
            await db.settings.delete(GDRIVE_CONNECTED_SETTING_ID);
        }
        localStorage.removeItem('gdrive_connected');
    } catch (error) {
        console.error('Failed to persist gdriveConnected', error);
        if (connected) {
            localStorage.setItem('gdrive_connected', 'true');
        } else {
            localStorage.removeItem('gdrive_connected');
        }
    }
};

export const saveCredentials = async (clientId: string, apiKey: string) => {
    cachedCredentials = {
        clientId: clientId.trim(),
        apiKey: apiKey.trim(),
    };
    credentialsLoaded = true;
    await db.settings.put({ id: GOOGLE_DRIVE_CREDENTIALS_SETTING_ID, value: cachedCredentials });
    localStorage.removeItem('google_client_id');
    localStorage.removeItem('google_api_key');
};

export const clearCredentials = async () => {
    cachedCredentials = { clientId: '', apiKey: '' };
    credentialsLoaded = true;
    await db.settings.delete(GOOGLE_DRIVE_CREDENTIALS_SETTING_ID);
    localStorage.removeItem('google_client_id');
    localStorage.removeItem('google_api_key');
};
