
import React from 'react';
import { ICONS } from '../constants';
import Icon from './Icon';

interface ServerBackup {
    id: string;
    createdAt: string;
    size: number;
}

interface ServerRestoreModalProps {
    isOpen: boolean;
    onClose: () => void;
    backups: ServerBackup[];
    onRestore: (backupId: string) => void;
    onDownload: (backupId: string) => void;
}

const ServerRestoreModal: React.FC<ServerRestoreModalProps> = ({ isOpen, onClose, backups, onRestore, onDownload }) => {
    if (!isOpen) return null;

    const getBackupLabel = (filename: string) => {
        if (filename === 'latest.json' || filename === 'latest.json.gz') return 'Latest Auto-Backup';
        if (filename.startsWith('daily_')) return 'Daily Snapshot';
        if (filename.startsWith('snapshot_')) {
            // Extract custom name: snapshot_TIMESTAMP_name.json
            const parts = filename.split('_');
            if (parts.length >= 3) {
                const namePart = parts.slice(2).join('_').replace('.json', '').replace('.gz', '');
                return `Snapshot: ${namePart.replace(/_/g, ' ')}`;
            }
            return 'Cloud Snapshot';
        }
        return 'Unknown Backup';
    };

    const getBackupIcon = (filename: string) => {
        if (filename.startsWith('daily_')) return 'CALENDAR'; // Using CALENDAR via standard Icon mapping might fail if not in constants, fallback to CLOUD
        if (filename.startsWith('snapshot_')) return 'SAVE';
        return 'CLOUD_CHECK';
    };
    
    // Group backups
    const latest = backups.find(b => b.id === 'latest.json' || b.id === 'latest.json.gz');
    const userSnapshots = backups.filter(b => b.id.startsWith('snapshot_'));
    const dailySnapshots = backups.filter(b => b.id.startsWith('daily_'));
    const otherBackups = backups.filter(b => 
        b.id !== 'latest.json' && 
        b.id !== 'latest.json.gz' && 
        !b.id.startsWith('snapshot_') && 
        !b.id.startsWith('daily_')
    );

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 animate-fade-in"
            onClick={onClose}
        >
            <div 
                className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-2xl max-h-[80vh] flex flex-col border border-gray-200 dark:border-gray-700"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Restore from Cloud</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700" aria-label="Close modal">
                        <Icon name="CLOSE" className="w-6 h-6" />
                    </button>
                </div>
                
                <div className="overflow-y-auto space-y-4 flex-grow pr-2 -mr-2">
                    {/* Latest Section */}
                    {latest && (
                         <div className="mb-4">
                            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Current State</h3>
                            <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center border border-emerald-200 dark:border-emerald-800">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-emerald-100 dark:bg-emerald-800/50 rounded-full text-emerald-600 dark:text-emerald-300">
                                        <Icon name="CLOUD_CHECK" className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-800 dark:text-gray-100">Latest Auto-Backup</p>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            {new Date(latest.createdAt).toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-3 mt-3 sm:mt-0">
                                    <button onClick={() => onDownload(latest.id)} className="p-2 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400" title="Download">
                                        <Icon name="DOWNLOAD" className="w-5 h-5" />
                                    </button>
                                    <button onClick={() => onRestore(latest.id)} className="px-3 py-1.5 text-sm font-semibold rounded-md bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm">
                                        Restore
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* User Snapshots */}
                    {userSnapshots.length > 0 && (
                        <div>
                            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">My Cloud Snapshots</h3>
                            <div className="space-y-2">
                                {userSnapshots.map(backup => (
                                    <div key={backup.id} className="bg-indigo-50 dark:bg-indigo-900/10 p-3 rounded-lg flex justify-between items-center border border-indigo-100 dark:border-indigo-900/30">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <Icon name="SAVE" className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                                            <div className="min-w-0">
                                                <p className="font-semibold text-sm text-gray-800 dark:text-gray-100 truncate">{getBackupLabel(backup.id)}</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">{new Date(backup.createdAt).toLocaleString()}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center space-x-2 flex-shrink-0">
                                            <button onClick={() => onDownload(backup.id)} className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
                                                <Icon name="DOWNLOAD" className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => onRestore(backup.id)} className="px-3 py-1 text-xs font-semibold rounded bg-white dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-600">
                                                Restore
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Daily Snapshots */}
                    {dailySnapshots.length > 0 && (
                        <div>
                            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Daily History</h3>
                            <div className="space-y-2">
                                {dailySnapshots.map(backup => (
                                    <div key={backup.id} className="bg-gray-50 dark:bg-gray-700/30 p-3 rounded-lg flex justify-between items-center border border-gray-200 dark:border-gray-700">
                                        <div className="flex items-center gap-3">
                                            <Icon name="HISTORY" className="w-4 h-4 text-zinc-400" />
                                            <div>
                                                <p className="font-medium text-sm text-gray-800 dark:text-gray-100">{new Date(backup.createdAt).toLocaleDateString()}</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">{new Date(backup.createdAt).toLocaleTimeString()}</p>
                                            </div>
                                        </div>
                                        <button onClick={() => onRestore(backup.id)} className="px-3 py-1 text-xs font-semibold rounded bg-white dark:bg-zinc-600 border border-zinc-200 dark:border-zinc-500 hover:bg-zinc-50">
                                            Restore
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Other Backups */}
                    {otherBackups.length > 0 && (
                        <div>
                            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Other Backups</h3>
                            <div className="space-y-2">
                                {otherBackups.map(backup => (
                                    <div key={backup.id} className="bg-zinc-50 dark:bg-zinc-700/30 p-3 rounded-lg flex justify-between items-center border border-zinc-200 dark:border-zinc-700">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <Icon name="FILE_TEXT" className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                                            <div className="min-w-0">
                                                <p className="font-medium text-sm text-gray-800 dark:text-gray-100 truncate">{backup.id}</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">{new Date(backup.createdAt).toLocaleString()}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center space-x-2 flex-shrink-0">
                                             <button onClick={() => onDownload(backup.id)} className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
                                                <Icon name="DOWNLOAD" className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => onRestore(backup.id)} className="px-3 py-1 text-xs font-semibold rounded bg-white dark:bg-zinc-600 border border-zinc-200 dark:border-zinc-500 hover:bg-zinc-50">
                                                Restore
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {backups.length === 0 && (
                        <div className="text-center py-10">
                            <p className="text-gray-500 dark:text-gray-400">No backups found on the server.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ServerRestoreModal;
