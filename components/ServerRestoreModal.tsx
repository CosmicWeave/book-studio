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
}

const ServerRestoreModal: React.FC<ServerRestoreModalProps> = ({ isOpen, onClose, backups, onRestore }) => {
    if (!isOpen) return null;

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
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Restore from Server Backup</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700" aria-label="Close modal">
                        <Icon name="CLOSE" className="w-6 h-6" />
                    </button>
                </div>
                <div className="overflow-y-auto space-y-3 flex-grow pr-2 -mr-2">
                    {backups.length > 0 ? backups.map(backup => (
                        <div key={backup.id} className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center border border-gray-200 dark:border-gray-700">
                            <div className="mb-2 sm:mb-0">
                                <p className="font-semibold text-gray-800 dark:text-gray-100">{backup.id}</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Saved: {new Date(backup.createdAt).toLocaleString()}
                                </p>
                            </div>
                            <div className="flex space-x-2 flex-shrink-0">
                                <button onClick={() => onRestore(backup.id)} className="px-3 py-1 text-sm font-semibold rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors">Restore</button>
                            </div>
                        </div>
                    )) : (
                        <div className="text-center py-10">
                            <p className="text-gray-500 dark:text-gray-400">No backup files found on the server.</p>
                            <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">Automatic backups create daily snapshots.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ServerRestoreModal;
