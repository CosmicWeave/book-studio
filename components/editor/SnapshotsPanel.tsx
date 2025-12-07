import React from 'react';
import { ICONS } from '../../constants';
import { useBookEditor } from '../../contexts/BookEditorContext';
import Icon from '../Icon';

const SnapshotsPanel: React.FC = () => {
    const {
        isSnapshotsPanelOpen,
        setIsSnapshotsPanelOpen,
        snapshots,
        handleRestoreSnapshot,
        handleDeleteSnapshot
    } = useBookEditor();

    if (!isSnapshotsPanelOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-40 p-4 animate-fade-in" onClick={() => setIsSnapshotsPanelOpen(false)}>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-2xl max-h-[80vh] flex flex-col border border-gray-200 dark:border-gray-700" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Book Snapshots</h2>
                    <button onClick={() => setIsSnapshotsPanelOpen(false)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-2xl leading-none">&times;</button>
                </div>
                <div className="overflow-y-auto space-y-3 flex-grow pr-2 -mr-2">
                    {snapshots.length > 0 ? snapshots.map(snap => (
                        <div key={snap.id} className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center border border-gray-200 dark:border-gray-700">
                            <div className="mb-2 sm:mb-0">
                                <p className="font-semibold text-gray-800 dark:text-gray-100">{snap.name}</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Created: {new Date(snap.createdAt).toLocaleString()}</p>
                            </div>
                            <div className="flex space-x-2 flex-shrink-0">
                                <button onClick={() => handleRestoreSnapshot(snap)} className="px-3 py-1 text-sm font-semibold rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors">Restore</button>
                                <button onClick={() => handleDeleteSnapshot(snap.id)} className="p-2 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-100 dark:hover:bg-gray-700 transition-colors">
                                    <Icon name="TRASH" className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )) : <p className="text-center text-gray-500 dark:text-gray-400 py-8">No snapshots created yet.</p>}
                </div>
            </div>
        </div>
    );
};

export default SnapshotsPanel;
