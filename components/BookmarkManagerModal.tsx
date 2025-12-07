
import React, { useState } from 'react';
import { Bookmark } from '../types';
import { ICONS } from '../constants';
import Icon from './Icon';
import { modalService } from '../services/modalService';

interface BookmarkManagerModalProps {
    isOpen: boolean;
    onClose: () => void;
    bookmarks: Bookmark[];
    onGoTo: (bookmark: Bookmark) => void;
    onDelete: (bookmark: Bookmark) => void;
    onAdd: (note: string) => void;
    currentLocationText?: string;
}

const BookmarkManagerModal: React.FC<BookmarkManagerModalProps> = ({ 
    isOpen, 
    onClose, 
    bookmarks, 
    onGoTo, 
    onDelete, 
    onAdd,
    currentLocationText 
}) => {
    const [newNote, setNewNote] = useState('');

    if (!isOpen) return null;

    const handleAdd = () => {
        onAdd(newNote);
        setNewNote('');
    };

    const handleDeleteClick = async (bookmark: Bookmark) => {
        const confirmed = await modalService.confirm({
            title: 'Delete Bookmark?',
            message: 'Are you sure you want to remove this bookmark?',
            confirmText: 'Delete',
            danger: true
        });
        if (confirmed) {
            onDelete(bookmark);
        }
    };

    const sortedBookmarks = [...bookmarks].sort((a, b) => b.timestamp - a.timestamp);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 animate-fade-in" onClick={onClose}>
            <div 
                className="bg-white dark:bg-zinc-800 rounded-xl shadow-2xl w-full max-w-lg flex flex-col border border-zinc-200 dark:border-zinc-700 max-h-[80vh]" 
                onClick={e => e.stopPropagation()}
            >
                <div className="flex justify-between items-center p-4 border-b border-zinc-200 dark:border-zinc-700 flex-shrink-0">
                    <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
                        <Icon name="HIGHLIGHT" className="w-5 h-5 text-indigo-500" />
                        Bookmarks
                    </h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700" aria-label="Close">
                        <Icon name="CLOSE" className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-4 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 flex-shrink-0">
                    <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Current Location</label>
                    <p className="text-sm text-zinc-800 dark:text-zinc-200 italic mb-3 line-clamp-2">"{currentLocationText || 'Unknown location'}"</p>
                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            value={newNote}
                            onChange={(e) => setNewNote(e.target.value)}
                            placeholder="Optional note..."
                            className="flex-grow bg-white dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600 rounded-md text-sm"
                        />
                        <button 
                            onClick={handleAdd}
                            className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-semibold hover:bg-indigo-700 transition-colors"
                        >
                            Add Bookmark
                        </button>
                    </div>
                </div>

                <div className="flex-grow overflow-y-auto p-4 space-y-3">
                    {sortedBookmarks.length === 0 ? (
                        <div className="text-center py-8 text-zinc-500">
                            <Icon name="BOOK" className="w-12 h-12 mx-auto mb-2 opacity-30" />
                            <p>No bookmarks saved yet.</p>
                        </div>
                    ) : (
                        sortedBookmarks.map(bookmark => (
                            <div key={bookmark.id} className="bg-white dark:bg-zinc-700/30 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-start mb-1">
                                    <h3 className="font-bold text-sm text-zinc-800 dark:text-zinc-100">{bookmark.title}</h3>
                                    <span className="text-[10px] text-zinc-400">{new Date(bookmark.timestamp).toLocaleDateString()}</span>
                                </div>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400 italic mb-2 line-clamp-2">"{bookmark.previewText}"</p>
                                {bookmark.note && (
                                    <div className="bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded text-xs text-zinc-700 dark:text-zinc-300 mb-2 border border-yellow-100 dark:border-yellow-800/30">
                                        Note: {bookmark.note}
                                    </div>
                                )}
                                <div className="flex justify-end gap-2 mt-2">
                                    <button 
                                        onClick={() => handleDeleteClick(bookmark)}
                                        className="p-1.5 rounded-md text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                                        title="Delete"
                                    >
                                        <Icon name="TRASH" className="w-4 h-4" />
                                    </button>
                                    <button 
                                        onClick={() => { onGoTo(bookmark); onClose(); }}
                                        className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-600 hover:bg-zinc-200 dark:hover:bg-zinc-500 text-zinc-800 dark:text-zinc-100 text-xs font-semibold rounded-md transition-colors flex items-center gap-1"
                                    >
                                        <span>Jump to</span>
                                        <Icon name="CHEVRON_RIGHT" className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default BookmarkManagerModal;