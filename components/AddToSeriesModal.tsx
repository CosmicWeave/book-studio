import React, { useState, useContext } from 'react';
import { Book, Series } from '../types';
import { ICONS } from '../constants';
import { AppContext } from '../contexts/AppContext';
import Icon from './Icon';

interface AddToSeriesModalProps {
    book: Book;
    onClose: () => void;
}

const AddToSeriesModal: React.FC<AddToSeriesModalProps> = ({ book, onClose }) => {
    const { series: allSeries, addBookToSeries } = useContext(AppContext);
    const [isLoading, setIsLoading] = useState(false);
    const [view, setView] = useState<'existing' | 'new'>('existing');

    // State for "Add to Existing"
    const [selectedSeriesId, setSelectedSeriesId] = useState(allSeries.length > 0 ? allSeries[0].id : '');
    
    // State for "Create New"
    const [newSeriesTitle, setNewSeriesTitle] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        if (view === 'existing') {
            await addBookToSeries(book.id, { seriesId: selectedSeriesId });
        } else {
            await addBookToSeries(book.id, { newSeriesTitle });
        }
        setIsLoading(false);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-2xl w-full max-w-lg flex flex-col border border-zinc-200 dark:border-zinc-700" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b border-zinc-200 dark:border-zinc-700">
                    <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">Add "{book.topic}" to Series</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700" aria-label="Close">
                        <Icon name="CLOSE" className="w-6 h-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6">
                    <div className="mb-4">
                        <div className="flex border border-zinc-300 dark:border-zinc-600 rounded-lg p-1 bg-zinc-100 dark:bg-zinc-900">
                            <button type="button" onClick={() => setView('existing')} className={`flex-1 py-2 text-sm font-semibold rounded-md ${view === 'existing' ? 'bg-white dark:bg-zinc-700 shadow' : 'text-zinc-600 dark:text-zinc-300'}`}>Existing Series</button>
                            <button type="button" onClick={() => setView('new')} className={`flex-1 py-2 text-sm font-semibold rounded-md ${view === 'new' ? 'bg-white dark:bg-zinc-700 shadow' : 'text-zinc-600 dark:text-zinc-300'}`}>New Series</button>
                        </div>
                    </div>
                    
                    {view === 'existing' ? (
                        <div>
                            <label htmlFor="series-select" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Select a series</label>
                            {allSeries.length > 0 ? (
                                <select
                                    id="series-select"
                                    value={selectedSeriesId}
                                    onChange={e => setSelectedSeriesId(e.target.value)}
                                    className="mt-1 block w-full bg-white dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                                >
                                    {allSeries.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                                </select>
                            ) : (
                                <p className="text-sm text-zinc-500 mt-2">No existing series found. Create a new one!</p>
                            )}
                        </div>
                    ) : (
                         <div>
                            <label htmlFor="new-series-title" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">New Series Title</label>
                            <input
                                id="new-series-title"
                                type="text"
                                value={newSeriesTitle}
                                onChange={e => setNewSeriesTitle(e.target.value)}
                                placeholder="e.g., The Galactic Chronicles"
                                className="mt-1 block w-full bg-white dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                                required
                            />
                        </div>
                    )}
                    
                    <div className="flex justify-end space-x-3 pt-6">
                        <button type="button" onClick={onClose} className="bg-zinc-200 dark:bg-zinc-600 text-zinc-800 dark:text-zinc-100 px-4 py-2 rounded-lg font-semibold hover:bg-zinc-300 dark:hover:bg-zinc-500">Cancel</button>
                        <button type="submit" disabled={isLoading || (view === 'existing' && allSeries.length === 0)} className="bg-indigo-600 text-white px-6 py-2 rounded-lg shadow font-semibold hover:bg-indigo-700 disabled:bg-indigo-400">
                            {isLoading ? 'Adding...' : 'Add to Series'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddToSeriesModal;