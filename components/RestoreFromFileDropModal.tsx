import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import Loader from './Loader';
import { ICONS } from '../constants';
import { Book } from '../types';
import { toastService } from '../services/toastService';
import Icon from './Icon';

interface RestoreFromFileDropModalProps {
    fileContent: string;
    onClose: () => void;
    onRestoreSuccess: () => Promise<void>;
}

interface BackupBook {
    book: Book;
    isNew: boolean;
}

const RestoreFromFileDropModal: React.FC<RestoreFromFileDropModalProps> = ({ fileContent, onClose, onRestoreSuccess }) => {
    const [isLoading, setIsLoading] = useState(false);
    
    // New state for merge functionality
    const [view, setView] = useState<'initial' | 'merge'>('initial');
    const [backupBooks, setBackupBooks] = useState<BackupBook[]>([]);
    const [selectedBooks, setSelectedBooks] = useState<Record<string, boolean>>({});
    const [overwriteExisting, setOverwriteExisting] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(true);

    useEffect(() => {
        const analyzeBackup = async () => {
            try {
                const data = JSON.parse(fileContent);
                if (!data.books || !Array.isArray(data.books)) {
                    toastService.error('This does not appear to be a valid AI Book Studio backup file.');
                    setIsAnalyzing(false);
                    onClose();
                    return;
                }
                
                const localBooks = await db.books.getAll();
                const localBookIds = new Set(localBooks.map(b => b.id));

                const analyzedBooks: BackupBook[] = data.books.map((book: Book) => ({
                    book,
                    isNew: !localBookIds.has(book.id),
                }));

                setBackupBooks(analyzedBooks);

                // Pre-select all new books for import
                const initialSelection: Record<string, boolean> = {};
                analyzedBooks.forEach(b => {
                    if (b.isNew) {
                        initialSelection[b.book.id] = true;
                    }
                });
                setSelectedBooks(initialSelection);
            } catch (e) {
                toastService.error('Invalid backup file. Could not parse JSON.');
                onClose();
            } finally {
                setIsAnalyzing(false);
            }
        };

        analyzeBackup();
    }, [fileContent, onClose]);

    const handleFullOverwrite = async () => {
        setIsLoading(true);
        try {
            await db.restore(fileContent);
            await onRestoreSuccess();
        } catch (err) {
            console.error('Full overwrite restore failed:', err);
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
            toastService.error(`Restore failed. ${errorMessage}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleMerge = async () => {
        setIsLoading(true);
        try {
            const selectedNewBooks = backupBooks
                .filter(b => b.isNew && selectedBooks[b.book.id])
                .map(b => b.book.id);

            if (selectedNewBooks.length === 0 && !overwriteExisting) {
                 toastService.info("No new books were selected to import, and overwrite is off.");
                 setIsLoading(false);
                 return;
            }

            await db.merge(fileContent, { selectedNewBooks, overwriteExisting });
            await onRestoreSuccess();

        } catch (err) {
            console.error('Merge failed:', err);
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
            toastService.error(`Merge failed. ${errorMessage}`);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleBookSelectionChange = (bookId: string, isChecked: boolean) => {
        setSelectedBooks(prev => ({...prev, [bookId]: isChecked}));
    };
    
    const renderInitialView = () => (
        <>
            <div className="text-center">
                <Icon name="UPLOAD" className="mx-auto w-16 h-16 text-blue-500" />
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mt-4">Backup Detected</h2>
            </div>
            <div className="text-gray-600 dark:text-gray-400 mt-4 text-center">
                <p>How would you like to restore from this backup file?</p>
            </div>
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button onClick={() => setView('merge')} className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg shadow font-semibold hover:bg-blue-700 transition-colors">
                    Merge with Data
                </button>
                <button onClick={handleFullOverwrite} className="w-full bg-red-600 text-white px-6 py-3 rounded-lg shadow font-semibold hover:bg-red-700 transition-colors">
                    Full Overwrite
                </button>
            </div>
             <div className="mt-4 flex justify-center">
                <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 font-semibold py-2 px-4">
                    Cancel
                </button>
            </div>
        </>
    );
    
    const renderMergeView = () => (
        <>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Merge Backup</h2>
                <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700" aria-label="Close modal">
                    <Icon name="CLOSE" className="w-6 h-6" />
                </button>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-4">Select which new books to import. Existing books will not be changed unless you select the overwrite option below.</p>

            <div className="max-h-60 overflow-y-auto space-y-2 border-y border-gray-200 dark:border-gray-700 py-3 my-3 pr-2 -mr-2">
                {backupBooks.length > 0 ? backupBooks.map(({ book, isNew }) => (
                    <div key={book.id} className="flex items-center p-2 rounded-md bg-gray-50 dark:bg-gray-700/50">
                        <input
                            type="checkbox"
                            id={`book-${book.id}`}
                            checked={!!selectedBooks[book.id]}
                            onChange={(e) => handleBookSelectionChange(book.id, e.target.checked)}
                            disabled={!isNew}
                            className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                        />
                        <label htmlFor={`book-${book.id}`} className={`ml-3 flex-grow text-gray-800 dark:text-gray-200 truncate ${isNew ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                            {book.topic}
                        </label>
                        {isNew ? (
                            <span className="flex-shrink-0 ml-2 text-xs font-semibold px-2 py-1 bg-green-200 text-green-800 rounded-full">New</span>
                        ) : (
                            <span className="flex-shrink-0 ml-2 text-xs font-semibold px-2 py-1 bg-yellow-200 text-yellow-800 rounded-full">Existing</span>
                        )}
                    </div>
                )) : <p className="text-gray-500 dark:text-gray-400 text-center py-4">No books found in this backup file.</p>}
            </div>
            
            <div className="flex items-start p-2">
                <input
                    type="checkbox"
                    id="overwrite-existing"
                    checked={overwriteExisting}
                    onChange={(e) => setOverwriteExisting(e.target.checked)}
                    className="h-5 w-5 mt-0.5 rounded border-gray-300 text-red-600 focus:ring-red-500"
                />
                <label htmlFor="overwrite-existing" className="ml-3 text-sm text-gray-700 dark:text-gray-300">
                    <span className="font-semibold text-red-600 dark:text-red-400">Overwrite existing books</span>
                    <br />
                    <span className="text-xs text-gray-500 dark:text-gray-400">If a book in the backup has the same ID as a local book, the local version will be replaced.</span>
                </label>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
                <button onClick={() => setView('initial')} className="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 px-4 py-2 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors">
                    Back
                </button>
                <button onClick={handleMerge} className="bg-blue-600 text-white px-6 py-2 rounded-lg shadow font-semibold hover:bg-blue-700 transition-colors">
                    Merge Selected
                </button>
            </div>
        </>
    );

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 animate-fade-in" onClick={onClose}>
            {isLoading && <Loader message="Restoring..." />}
            <div 
                className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-lg border border-gray-200 dark:border-gray-700"
                onClick={e => e.stopPropagation()}
            >
                {isAnalyzing ? (
                    <div className="flex items-center justify-center p-8">
                        <div className="w-8 h-8 border-4 border-t-blue-500 border-gray-200 rounded-full animate-spin"></div>
                        <p className="ml-4 text-gray-600 dark:text-gray-300">Analyzing backup file...</p>
                    </div>
                ) : view === 'initial' ? renderInitialView() : renderMergeView()}
            </div>
        </div>
    );
};

export default RestoreFromFileDropModal;