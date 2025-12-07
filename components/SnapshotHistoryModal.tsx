import React, { useState, useEffect, useContext } from 'react';
import { Book, BookSnapshot } from '../types';
import { AppContext } from '../contexts/AppContext';
import { ICONS } from '../constants';
import { modalService } from '../services/modalService';
import { toastService } from '../services/toastService';
import Icon from './Icon';

interface SnapshotHistoryModalProps {
    book: Book;
    onClose: () => void;
}

const SnapshotHistoryModal: React.FC<SnapshotHistoryModalProps> = ({ book, onClose }) => {
    const { fetchSnapshotsForBook, createSnapshot, restoreSnapshot, deleteSnapshot } = useContext(AppContext);
    const [snapshots, setSnapshots] = useState<BookSnapshot[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [newSnapshotName, setNewSnapshotName] = useState('');

    const loadSnapshots = async () => {
        setIsLoading(true);
        const snaps = await fetchSnapshotsForBook(book.id);
        setSnapshots(snaps.sort((a, b) => b.createdAt - a.createdAt));
        setIsLoading(false);
    };

    useEffect(() => {
        loadSnapshots();
    }, [book.id]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newSnapshotName.trim()) return;
        await createSnapshot(book, newSnapshotName.trim());
        toastService.success('Version saved!');
        setNewSnapshotName('');
        await loadSnapshots();
    };

    const handleRestore = async (snapshot: BookSnapshot) => {
        const confirmed = await modalService.confirm({
            title: `Restore "${snapshot.name}"?`,
            message: `This will overwrite the current version of "${book.topic}" with the version from ${new Date(snapshot.createdAt).toLocaleString()}. This action cannot be undone.`,
            confirmText: 'Restore Version',
            danger: true,
        });
        if (confirmed) {
            await restoreSnapshot(snapshot);
            toastService.success('Book restored to selected version.');
            onClose();
        }
    };
    
    const handleDelete = async (snapshot: BookSnapshot) => {
        const confirmed = await modalService.confirm({
            title: `Delete "${snapshot.name}"?`,
            message: 'Are you sure you want to permanently delete this version? This action cannot be undone.',
            confirmText: 'Delete Version',
            danger: true,
        });
        if (confirmed) {
            await deleteSnapshot(snapshot.id);
            toastService.info('Version deleted.');
            await loadSnapshots();
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-zinc-200 dark:border-zinc-700" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-zinc-200 dark:border-zinc-700 flex-shrink-0">
                    <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 truncate">Version History: {book.topic}</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700" aria-label="Close">
                        <Icon name="CLOSE" className="w-6 h-6" />
                    </button>
                </div>

                {/* Create New Snapshot Form */}
                <form onSubmit={handleCreate} className="p-4 border-b border-zinc-200 dark:border-zinc-700 flex-shrink-0">
                    <label htmlFor="snapshot-name" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Save new version</label>
                    <div className="mt-1 flex gap-2">
                        <input
                            id="snapshot-name"
                            type="text"
                            value={newSnapshotName}
                            onChange={e => setNewSnapshotName(e.target.value)}
                            placeholder={`e.g., "Finished draft", "Before rewrite"`}
                            className="flex-grow block w-full bg-white dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                        />
                        <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg shadow font-semibold hover:bg-indigo-700 transition-colors disabled:bg-indigo-400" disabled={!newSnapshotName.trim()}>
                            Save
                        </button>
                    </div>
                </form>

                {/* Snapshot List */}
                <div className="flex-grow overflow-y-auto p-4">
                    {isLoading ? (
                        <p className="text-center text-zinc-500">Loading history...</p>
                    ) : snapshots.length > 0 ? (
                        <ul className="space-y-3">
                            {snapshots.map(snap => (
                                <li key={snap.id} className="bg-zinc-50 dark:bg-zinc-700/50 p-3 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center border border-zinc-200 dark:border-zinc-700">
                                    <div className="mb-2 sm:mb-0">
                                        <p className="font-semibold text-zinc-800 dark:text-zinc-100">{snap.name}</p>
                                        <p className="text-sm text-zinc-500 dark:text-zinc-400">Saved: {new Date(snap.createdAt).toLocaleString()}</p>
                                    </div>
                                    <div className="flex space-x-2 flex-shrink-0">
                                        <button onClick={() => handleRestore(snap)} className="px-3 py-1 text-sm font-semibold rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition-colors">Restore</button>
                                        <button onClick={() => handleDelete(snap)} className="p-2 rounded-full text-zinc-400 hover:text-red-500 hover:bg-red-100 dark:hover:bg-zinc-700" title="Delete version">
                                            <Icon name="TRASH" className="w-4 h-4" />
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-center text-zinc-500 py-8">No versions saved for this book yet.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SnapshotHistoryModal;