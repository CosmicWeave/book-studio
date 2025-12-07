
import React, { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/db';
import { ICONS } from '../constants';
import Loader from '../components/Loader';
import { 
    subscribeToDriveInit,
    onAuthStateChanged,
    requestManualSignIn,
    signOut,
    backupToGoogleDrive,
    listFiles as listGoogleDriveFiles,
    downloadFile as downloadGoogleDriveFile,
    deleteFile as deleteGoogleDriveFile,
    configureDrive,
    disconnectDrive,
    DriveInitState
} from '../services/googleDrive';
import { getCredentials } from '../services/googleDriveConfig';
import { GoogleDriveFile, SyncProvider } from '../types';
import GoogleDriveRestoreModal from '../components/GoogleDriveRestoreModal';
import { AUTO_BACKUP_ENABLED_ID, manualTriggerBackup, listServerBackups, fetchBackupContent, fetchLatestBackup } from '../services/backupService';
import { toastService } from '../services/toastService';
import { modalService } from '../services/modalService';
import Icon, { IconName } from '../components/Icon';
import ServerRestoreModal from '../components/ServerRestoreModal';
import ImportModal from '../components/ImportModal';
import { useTheme } from '../contexts/ThemeContext';

const GOOGLE_ICON = `<svg viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path><path fill="none" d="M0 0h48v48H0z"></path></svg>`;

interface SettingsProps {
    onRestoreSuccess: () => Promise<void>;
    onManualRestoreCheck: () => void;
}

type SettingsTab = 'general' | 'data' | 'cloud' | 'shortcuts' | 'system';

const Settings: React.FC<SettingsProps> = ({ onRestoreSuccess, onManualRestoreCheck }) => {
    const { theme, toggleTheme } = useTheme();
    const navigate = useNavigate();
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // UI State
    const [activeTab, setActiveTab] = useState<SettingsTab>('general');
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    
    // Data State
    const [autoBackupEnabled, setAutoBackupEnabled] = useState(true);
    const [storageEstimate, setStorageEstimate] = useState<{ usage: number, quota: number } | null>(null);
    const [startPage, setStartPage] = useState(localStorage.getItem('start_page') || 'dashboard');
    const [selectedProvider, setSelectedProvider] = useState<SyncProvider>('google_drive');
    
    // Google Drive State
    const [driveStatus, setDriveStatus] = useState<DriveInitState>('loading');
    const [isSignedIn, setIsSignedIn] = useState(false);
    const [user, setUser] = useState<any>(null);
    const [gdriveFiles, setGdriveFiles] = useState<GoogleDriveFile[]>([]);
    const [isGdriveModalOpen, setIsGdriveModalOpen] = useState(false);
    
    // Google Drive Credentials State
    const [customClientId, setCustomClientId] = useState('');
    const [customApiKey, setCustomApiKey] = useState('');
    
    // Modals State
    const [serverBackups, setServerBackups] = useState<any[]>([]);
    const [isServerRestoreModalOpen, setIsServerRestoreModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);

    // --- Initialization ---

    useEffect(() => {
        const unsubDrive = subscribeToDriveInit(setDriveStatus);
        const unsubAuth = onAuthStateChanged((signedIn, gUser) => {
            setIsSignedIn(signedIn);
            setUser(gUser);
        });
        
        const fetchSettings = async () => {
            const setting = await db.settings.get(AUTO_BACKUP_ENABLED_ID);
            setAutoBackupEnabled(setting?.value !== false);
            
            const providerSetting = await db.settings.get('syncProvider');
            if (providerSetting) {
                setSelectedProvider(providerSetting.value);
            }
            
            // Pre-fill if already stored in localStorage (via getCredentials)
            const creds = getCredentials();
            setCustomClientId(creds.clientId);
            setCustomApiKey(creds.apiKey);
        };
        
        const checkStorage = async () => {
            if (navigator.storage && navigator.storage.estimate) {
                try {
                    const estimate = await navigator.storage.estimate();
                    setStorageEstimate({ 
                        usage: estimate.usage || 0, 
                        quota: estimate.quota || 0 
                    });
                } catch (e) {
                    console.warn("Storage estimate failed", e);
                }
            }
        };

        fetchSettings();
        checkStorage();

        return () => {
            unsubDrive();
            unsubAuth();
        };
    }, []);

    // --- Handlers ---

    const handleAutoBackupToggle = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const isEnabled = e.target.checked;
        setAutoBackupEnabled(isEnabled);
        await db.settings.put({ id: AUTO_BACKUP_ENABLED_ID, value: isEnabled });
        if (isEnabled) {
            toastService.success('Automatic server backups enabled.');
            manualTriggerBackup();
        } else {
            toastService.info('Automatic server backups disabled.');
        }
    };

    const handleProviderChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const provider = e.target.value as SyncProvider;
        setSelectedProvider(provider);
        await db.settings.put({ id: 'syncProvider', value: provider });
        toastService.success(`Sync provider changed to ${provider.replace('_', ' ')}`);
    };

    const handleStartPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newVal = e.target.value;
        setStartPage(newVal);
        localStorage.setItem('start_page', newVal);
        toastService.success('Start page preference updated.');
    };

    const handleBackup = async () => {
        setIsLoading(true);
        setLoadingMessage('Backing up data...');
        try {
            const json = await db.backup();
            const blob = new Blob([json], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            const timestamp = new Date().toISOString().replace(/:/g, '-').slice(0, 19);
            a.download = `ai-book-studio-backup-${timestamp}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(a.href);
            toastService.success('Local backup downloaded successfully!');
        } catch (err: any) {
            toastService.error(`Backup failed: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRestoreClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const confirmed = await modalService.confirm({
                title: 'Overwrite Data?',
                message: 'Restoring from this file will overwrite all current data. Are you sure you want to continue?',
                danger: true,
                confirmText: 'Overwrite and Restore'
            });
            if (confirmed) {
                setIsLoading(true);
                setLoadingMessage('Restoring from file...');
                const reader = new FileReader();
                reader.onload = async (event) => {
                    try {
                        const content = event.target?.result as string;
                        await db.restore(content);
                        toastService.success('Restore successful!');
                        await onRestoreSuccess();
                    } catch (err: any) {
                        toastService.error(`Restore failed: ${err.message}`);
                    } finally {
                        setIsLoading(false);
                    }
                };
                reader.readAsText(file);
            }
            e.target.value = ''; // Reset file input
        }
    };
    
    // --- Google Drive Handlers ---
    
    const handleConfigureDrive = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!customClientId.trim() || !customApiKey.trim()) {
            toastService.error("Please enter both Client ID and API Key.");
            return;
        }
        setIsLoading(true);
        setLoadingMessage('Initializing Google Drive Service...');
        try {
            await configureDrive(customClientId.trim(), customApiKey.trim());
            toastService.success("Google Drive configured!");
        } catch (e: any) {
            toastService.error("Failed to configure: " + e.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDisconnectDrive = () => {
        disconnectDrive();
        setCustomClientId('');
        setCustomApiKey('');
        toastService.info("Google Drive credentials removed.");
    };

    const handleGoogleDriveBackup = async () => {
        setIsLoading(true);
        setLoadingMessage('Backing up to Google Drive...');
        try {
            await backupToGoogleDrive();
            toastService.success('Successfully backed up to Google Drive!');
        } catch (err: any) {
            console.error(err);
            if (err.message.includes('Not signed in') || err.message.includes('401')) {
                toastService.info("Session expired. Please sign in again.");
                requestManualSignIn();
            } else {
                toastService.error(`Backup failed: ${err.message}`);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleDriveRestore = async () => {
        setIsLoading(true);
        setLoadingMessage('Fetching backups from Google Drive...');
        try {
            const files = await listGoogleDriveFiles();
            setGdriveFiles(files);
            setIsGdriveModalOpen(true);
        } catch (err: any) {
            console.error(err);
            if (err.message.includes('Not signed in') || err.message.includes('401')) {
                toastService.info("Session expired. Please sign in again.");
                requestManualSignIn();
            } else {
                toastService.error(`Failed to list files: ${err.message}`);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const performDriveRestore = async (fileId: string) => {
        setIsGdriveModalOpen(false);
        setIsLoading(true);
        setLoadingMessage('Restoring from Google Drive...');
        try {
            const content = await downloadGoogleDriveFile(fileId);
            await db.restore(content);
            toastService.success('Restore successful!');
            await onRestoreSuccess();
        } catch (err: any) {
            toastService.error(`Restore failed: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const performDriveDelete = async (fileId: string) => {
        try {
            await deleteGoogleDriveFile(fileId);
            setGdriveFiles(prev => prev.filter(f => f.id !== fileId));
            toastService.success('Backup deleted from Google Drive.');
        } catch (err: any) {
            toastService.error(`Failed to delete file: ${err.message}`);
        }
    };

    // --- Server Backup Handlers ---

    const handleServerRestoreCheck = async () => {
        setIsLoading(true);
        setLoadingMessage('Checking for server backups...');
        try {
            const backups = await listServerBackups();
            if (backups.length === 0) {
                toastService.info("No server backups found.");
            } else {
                setServerBackups(backups);
                setIsServerRestoreModalOpen(true);
            }
        } catch (e: any) {
            toastService.error(`Failed to list server backups: ${e.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const performServerRestore = async (backupId: string) => {
        setIsServerRestoreModalOpen(false);
        setIsLoading(true);
        setLoadingMessage('Restoring from server...');
        try {
            const content = await fetchBackupContent(backupId);
            if (content) {
                await db.restore(content);
                toastService.success('Restore successful!');
                await onRestoreSuccess();
            } else {
                throw new Error("Empty backup content.");
            }
        } catch (e: any) {
            toastService.error(`Restore failed: ${e.message}`);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleForceUpload = async () => {
        setIsLoading(true);
        setLoadingMessage('Force uploading to server...');
        try {
            const error = await manualTriggerBackup(true);
            if (error) throw error;
            toastService.success('Force upload successful.');
        } catch (e: any) {
            toastService.error(`Force upload failed: ${e.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleForceDownload = async () => {
        setIsLoading(true);
        setLoadingMessage('Checking server for latest backup...');
        try {
            const backup = await fetchLatestBackup(true);
            if (backup) {
                const confirmed = await modalService.confirm({
                    title: 'Restore from Server?',
                    message: `Found a backup from ${new Date(backup.backupTimestamp).toLocaleString()}. Restoring will overwrite your local data.`,
                    danger: true,
                    confirmText: 'Restore'
                });
                if (confirmed) {
                    setLoadingMessage('Restoring...');
                    await db.restore(backup.content);
                    await onRestoreSuccess();
                    toastService.success('Restored successfully.');
                }
            } else {
                toastService.info('No backup found on server.');
            }
        } catch (e: any) {
            toastService.error(`Force download failed: ${e.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleResetApp = async () => {
        const confirmed = await modalService.confirm({
            title: 'Reset Application?',
            message: 'This will delete ALL local data (books, settings, history). Ensure you have a backup first. This action cannot be undone.',
            danger: true,
            confirmText: 'Reset Everything'
        });
        if (confirmed) {
            try {
                await db.books.clear();
                await db.instructions.clear();
                await db.styles.clear();
                await db.snapshots.clear();
                await db.macros.clear();
                await db.series.clear();
                await db.readingProgress.clear();
                localStorage.clear();
                window.location.reload();
            } catch (e: any) {
                toastService.error(`Reset failed: ${e.message}`);
            }
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
            {isLoading && <Loader message={loadingMessage} />}
            
            <GoogleDriveRestoreModal 
                isOpen={isGdriveModalOpen} 
                onClose={() => setIsGdriveModalOpen(false)} 
                files={gdriveFiles}
                onRestore={performDriveRestore}
                onDelete={performDriveDelete}
            />

            <ServerRestoreModal
                isOpen={isServerRestoreModalOpen}
                onClose={() => setIsServerRestoreModalOpen(false)}
                backups={serverBackups}
                onRestore={performServerRestore}
            />

            <ImportModal 
                isOpen={isImportModalOpen} 
                onClose={() => setIsImportModalOpen(false)} 
            />

            <h1 className="text-3xl font-bold mb-8 text-zinc-800 dark:text-white">Settings</h1>

            <div className="flex flex-col md:flex-row gap-8">
                {/* Sidebar Navigation */}
                <div className="w-full md:w-64 space-y-2">
                    {[
                        { id: 'general', label: 'General', icon: 'SETTINGS' },
                        { id: 'data', label: 'Data Management', icon: 'SAVE' },
                        { id: 'cloud', label: 'Cloud Sync', icon: 'CLOUD' },
                        { id: 'system', label: 'System', icon: 'INFO' },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as SettingsTab)}
                            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                                activeTab === tab.id 
                                    ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300' 
                                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                            }`}
                        >
                            <Icon name={tab.icon as IconName} className="w-5 h-5" />
                            <span>{tab.label}</span>
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                <div className="flex-1 bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-6 shadow-sm">
                    
                    {/* General Settings */}
                    {activeTab === 'general' && (
                        <div className="space-y-6">
                            <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">General Settings</h2>
                            
                            <div className="flex items-center justify-between py-4 border-b border-zinc-100 dark:border-zinc-700">
                                <div>
                                    <p className="font-medium text-zinc-700 dark:text-zinc-200">Start Page</p>
                                    <p className="text-sm text-zinc-500 dark:text-zinc-400">Which page to show when the app opens.</p>
                                </div>
                                <select 
                                    value={startPage} 
                                    onChange={handleStartPageChange}
                                    className="bg-zinc-50 dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 rounded-lg px-3 py-2 text-sm text-zinc-700 dark:text-zinc-200"
                                >
                                    <option value="dashboard">Library</option>
                                    <option value="reading">Reading</option>
                                    <option value="instructions">Instructions</option>
                                </select>
                            </div>

                            <div className="flex items-center justify-between py-4 border-b border-zinc-100 dark:border-zinc-700">
                                <div>
                                    <p className="font-medium text-zinc-700 dark:text-zinc-200">Appearance</p>
                                    <p className="text-sm text-zinc-500 dark:text-zinc-400">Switch between light and dark themes.</p>
                                </div>
                                <button onClick={toggleTheme} className="flex items-center space-x-2 px-3 py-2 bg-zinc-100 dark:bg-zinc-700 rounded-lg text-sm font-medium hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors text-zinc-700 dark:text-zinc-200">
                                    <Icon name={theme === 'light' ? 'SUN' : 'MOON'} className="w-4 h-4" />
                                    <span>{theme === 'light' ? 'Light Mode' : 'Dark Mode'}</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Data Management */}
                    {activeTab === 'data' && (
                        <div className="space-y-6">
                            <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">Data Management</h2>
                            
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-900/50">
                                <div className="flex items-center space-x-3 mb-2">
                                    <Icon name="INFO" className="text-blue-500" />
                                    <h3 className="font-bold text-blue-700 dark:text-blue-300">Storage Usage</h3>
                                </div>
                                {storageEstimate ? (
                                    <div className="space-y-2">
                                        <div className="w-full bg-blue-200 dark:bg-blue-900 rounded-full h-2.5">
                                            <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${(storageEstimate.usage / storageEstimate.quota) * 100}%` }}></div>
                                        </div>
                                        <p className="text-xs text-blue-600 dark:text-blue-400">
                                            Using {(storageEstimate.usage / 1024 / 1024).toFixed(2)} MB of {(storageEstimate.quota / 1024 / 1024).toFixed(0)} MB available.
                                        </p>
                                    </div>
                                ) : (
                                    <p className="text-sm text-blue-600 dark:text-blue-400">Storage estimate unavailable.</p>
                                )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="p-4 border border-zinc-200 dark:border-zinc-700 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-700/30 transition-colors">
                                    <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-3">
                                        <Icon name="DOWNLOAD" />
                                    </div>
                                    <h3 className="font-bold text-zinc-800 dark:text-zinc-100">Backup Data</h3>
                                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 mb-3">Download a local JSON backup of all your books and settings.</p>
                                    <button onClick={handleBackup} className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300">Download Backup &rarr;</button>
                                </div>

                                <div className="p-4 border border-zinc-200 dark:border-zinc-700 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-700/30 transition-colors">
                                    <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-3">
                                        <Icon name="UPLOAD" />
                                    </div>
                                    <h3 className="font-bold text-zinc-800 dark:text-zinc-100">Restore Data</h3>
                                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 mb-3">Restore your library from a previously saved backup file.</p>
                                    <input 
                                        type="file" 
                                        ref={fileInputRef} 
                                        onChange={handleFileChange} 
                                        accept=".json" 
                                        className="hidden" 
                                    />
                                    <button onClick={handleRestoreClick} className="text-sm font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300">Select File &rarr;</button>
                                </div>
                            </div>

                            <div className="border-t border-zinc-100 dark:border-zinc-700 pt-6">
                                <h3 className="font-bold text-zinc-800 dark:text-zinc-100 mb-4">Import Content</h3>
                                <button 
                                    onClick={() => setIsImportModalOpen(true)}
                                    className="flex items-center space-x-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-700 rounded-lg text-sm font-medium hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors text-zinc-700 dark:text-zinc-200"
                                >
                                    <Icon name="PLUS" className="w-4 h-4" />
                                    <span>Import Book / Document</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Cloud Sync */}
                    {activeTab === 'cloud' && (
                        <div className="space-y-8">
                            <div>
                                <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 mb-4">Personal Cloud Storage</h2>
                                
                                <div className="mb-6">
                                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Select Provider</label>
                                    <select
                                        value={selectedProvider}
                                        onChange={handleProviderChange}
                                        className="w-full p-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm"
                                    >
                                        <option value="google_drive">Google Drive</option>
                                        <option value="dropbox" disabled>Dropbox (Coming Soon)</option>
                                        <option value="onedrive" disabled>OneDrive (Coming Soon)</option>
                                    </select>
                                </div>

                                {selectedProvider === 'google_drive' && (
                                    <>
                                    {driveStatus === 'unconfigured' ? (
                                        <form onSubmit={handleConfigureDrive} className="bg-zinc-50 dark:bg-zinc-900 p-4 rounded-lg border border-zinc-200 dark:border-zinc-700 space-y-4">
                                            <p className="text-sm text-zinc-600 dark:text-zinc-400">Configure your Google Cloud credentials to enable Drive sync.</p>
                                            <div>
                                                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Client ID</label>
                                                <input 
                                                    type="text" 
                                                    value={customClientId} 
                                                    onChange={e => setCustomClientId(e.target.value)} 
                                                    className="w-full rounded-md border-zinc-300 dark:border-zinc-600 dark:bg-zinc-800 text-sm"
                                                    placeholder="apps.googleusercontent.com"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">API Key</label>
                                                <input 
                                                    type="text" 
                                                    value={customApiKey} 
                                                    onChange={e => setCustomApiKey(e.target.value)} 
                                                    className="w-full rounded-md border-zinc-300 dark:border-zinc-600 dark:bg-zinc-800 text-sm"
                                                />
                                            </div>
                                            <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-semibold hover:bg-indigo-700">Save & Connect</button>
                                        </form>
                                    ) : (
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-900 p-4 rounded-lg border border-zinc-200 dark:border-zinc-700">
                                                <div className="flex items-center space-x-3">
                                                    <div className="w-10 h-10 bg-white dark:bg-zinc-800 rounded-full flex items-center justify-center shadow-sm" dangerouslySetInnerHTML={{ __html: GOOGLE_ICON }} />
                                                    <div>
                                                        <p className="font-bold text-sm text-zinc-800 dark:text-zinc-100">Google Drive</p>
                                                        <p className="text-xs text-zinc-500 dark:text-zinc-400">{isSignedIn ? `Connected as ${user?.name}` : 'Not connected'}</p>
                                                    </div>
                                                </div>
                                                {isSignedIn ? (
                                                    <button onClick={signOut} className="text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400">Sign Out</button>
                                                ) : (
                                                    <button onClick={requestManualSignIn} className="text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400">Connect</button>
                                                )}
                                            </div>

                                            {isSignedIn && (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    <button onClick={handleGoogleDriveBackup} className="flex items-center justify-center space-x-2 p-3 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors">
                                                        <Icon name="CLOUD" className="w-5 h-5 text-indigo-500" />
                                                        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Backup to Drive</span>
                                                    </button>
                                                    <button onClick={handleGoogleDriveRestore} className="flex items-center justify-center space-x-2 p-3 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors">
                                                        <Icon name="RESTORE" className="w-5 h-5 text-emerald-500" />
                                                        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Restore from Drive</span>
                                                    </button>
                                                </div>
                                            )}
                                            
                                            <div className="text-right">
                                                <button onClick={handleDisconnectDrive} className="text-xs text-red-500 hover:underline">Remove Credentials</button>
                                            </div>
                                        </div>
                                    )}
                                    </>
                                )}
                                
                                {selectedProvider === 'dropbox' && (
                                     <div className="p-6 bg-zinc-50 dark:bg-zinc-900 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg text-center">
                                        <p className="text-zinc-500 dark:text-zinc-400">Dropbox integration is coming soon.</p>
                                     </div>
                                )}
                                
                                {selectedProvider === 'onedrive' && (
                                     <div className="p-6 bg-zinc-50 dark:bg-zinc-900 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-lg text-center">
                                        <p className="text-zinc-500 dark:text-zinc-400">OneDrive integration is coming soon.</p>
                                     </div>
                                )}
                            </div>

                            <div className="border-t border-zinc-100 dark:border-zinc-700 pt-6">
                                <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 mb-4">Automatic App Backup</h2>
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="font-medium text-zinc-700 dark:text-zinc-200">Enable Auto-Backup</p>
                                            <p className="text-sm text-zinc-500 dark:text-zinc-400">Automatically sync changes to our secure server.</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input type="checkbox" className="sr-only peer" checked={autoBackupEnabled} onChange={handleAutoBackupToggle} />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
                                        </label>
                                    </div>
                                    
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="font-medium text-zinc-700 dark:text-zinc-200">Manual Server Checks</p>
                                            <p className="text-sm text-zinc-500 dark:text-zinc-400">Check for updates or restore from server.</p>
                                        </div>
                                        <div className="space-x-2">
                                            <button onClick={onManualRestoreCheck} className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline px-2">Check Updates</button>
                                            <button onClick={handleServerRestoreCheck} className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline px-2">View Backups</button>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-700/50">
                                        <div>
                                            <p className="font-medium text-zinc-700 dark:text-zinc-200">Advanced Sync</p>
                                            <p className="text-sm text-zinc-500 dark:text-zinc-400">Force synchronization with the server.</p>
                                        </div>
                                        <div className="flex space-x-2">
                                            <button onClick={handleForceUpload} disabled={isLoading} className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-sm font-semibold rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors disabled:opacity-50">
                                                Force Upload
                                            </button>
                                            <button onClick={handleForceDownload} disabled={isLoading} className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-sm font-semibold rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors disabled:opacity-50">
                                                Force Download
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* System */}
                    {activeTab === 'system' && (
                        <div className="space-y-6">
                            <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">System</h2>
                            <div className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700">
                                <p className="text-sm text-zinc-600 dark:text-zinc-400"><strong>Version:</strong> 1.3.2</p>
                                <p className="text-sm text-zinc-600 dark:text-zinc-400"><strong>Environment:</strong> Production</p>
                            </div>
                            
                            <div className="pt-4 border-t border-zinc-100 dark:border-zinc-700">
                                <h3 className="font-bold text-red-600 dark:text-red-400 mb-2">Danger Zone</h3>
                                <button onClick={handleResetApp} className="px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors shadow-sm">
                                    Reset Application Data
                                </button>
                                <p className="text-xs text-zinc-500 mt-2">This will wipe all local data. Use with caution.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Settings;