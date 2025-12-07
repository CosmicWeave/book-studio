
// It's important to replace these with your actual Google Cloud project credentials.
// These are typically provided via environment variables during build.
// However, we now support dynamic configuration via localStorage for users without env vars.

export const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';

// The scopes define the level of access the application is requesting.
// 'appDataFolder' is a special folder that is private to the application and user, invisible to them on Google Drive.
// 'userinfo.profile' is for displaying user name and picture.
// 'drive.readonly' is for importing existing Google Docs.
export const SCOPES = 'https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/drive.readonly';

export const getCredentials = () => {
    return {
        clientId: process.env.GOOGLE_CLIENT_ID || localStorage.getItem('google_client_id') || '',
        apiKey: process.env.GOOGLE_API_KEY || localStorage.getItem('google_api_key') || ''
    };
};

export const saveCredentials = (clientId: string, apiKey: string) => {
    if (clientId) localStorage.setItem('google_client_id', clientId.trim());
    if (apiKey) localStorage.setItem('google_api_key', apiKey.trim());
};

export const clearCredentials = () => {
    localStorage.removeItem('google_client_id');
    localStorage.removeItem('google_api_key');
};
