import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { ICONS } from '../constants';
import { AppContext } from '../contexts/AppContext';
import { toastService } from '../services/toastService';
import Icon from './Icon';

interface CreateSeriesModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const CreateSeriesModal: React.FC<CreateSeriesModalProps> = ({ isOpen, onClose }) => {
    const { createNewSeriesAndFirstBook } = useContext(AppContext);
    const navigate = useNavigate();

    const [seriesTitle, setSeriesTitle] = useState('');
    const [firstBookTitle, setFirstBookTitle] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    if (!isOpen) return null;

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!seriesTitle.trim() || !firstBookTitle.trim()) {
            toastService.error('Please fill out both fields.');
            return;
        }
        setIsLoading(true);
        try {
            const newBookId = await createNewSeriesAndFirstBook(seriesTitle, firstBookTitle);
            navigate(`/editor/${newBookId}`);
            onClose();
        } catch (error: any) {
            toastService.error(`Failed to create series: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-2xl w-full max-w-lg flex flex-col border border-zinc-200 dark:border-zinc-700" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b border-zinc-200 dark:border-zinc-700">
                    <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">Create a New Book Series</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700" aria-label="Close">
                        <Icon name="CLOSE" className="w-6 h-6" />
                    </button>
                </div>

                <form onSubmit={handleCreate} className="p-6 space-y-4">
                    <div>
                        <label htmlFor="series-title" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Series Title</label>
                        <input
                            id="series-title"
                            type="text"
                            value={seriesTitle}
                            onChange={e => setSeriesTitle(e.target.value)}
                            placeholder="e.g., The Galactic Chronicles"
                            className="mt-1 block w-full bg-white dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                            required
                        />
                    </div>
                     <div>
                        <label htmlFor="first-book-title" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">First Book's Title</label>
                        <input
                            id="first-book-title"
                            type="text"
                            value={firstBookTitle}
                            onChange={e => setFirstBookTitle(e.target.value)}
                            placeholder="e.g., Episode I: The Stellar Forge"
                            className="mt-1 block w-full bg-white dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                            required
                        />
                    </div>
                    
                    <div className="flex justify-end space-x-3 pt-4">
                        <button type="button" onClick={onClose} className="bg-zinc-200 dark:bg-zinc-600 text-zinc-800 dark:text-zinc-100 px-4 py-2 rounded-lg font-semibold hover:bg-zinc-300 dark:hover:bg-zinc-500">Cancel</button>
                        <button type="submit" disabled={isLoading} className="bg-indigo-600 text-white px-6 py-2 rounded-lg shadow font-semibold hover:bg-indigo-700 disabled:bg-indigo-400">
                            {isLoading ? 'Creating...' : 'Create Series'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateSeriesModal;