import React, { useContext, useState, useMemo } from 'react';
import { AppContext } from '../contexts/AppContext';
import { ICONS } from '../constants';
import Icon from '../components/Icon';
import BookCard from '../components/BookCard';
import { modalService } from '../services/modalService';

const Trash: React.FC = () => {
    const { books, deleteBook } = useContext(AppContext);
    
    const deletedBooks = useMemo(() => {
        return books.filter(b => !!b.deletedAt);
    }, [books]);

    const handleDeleteForever = async (bookId: string) => {
        const confirmed = await modalService.confirm({
            title: 'Delete Forever?',
            message: 'This action cannot be undone. The book and all its history will be permanently removed.',
            danger: true,
            confirmText: 'Delete Forever'
        });
        if (confirmed) {
            await deleteBook(bookId);
        }
    }

    return (
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-3">
                    <Icon name="TRASH" className="text-red-500 dark:text-red-400" />
                    Trash
                </h1>
                <p className="mt-2 text-zinc-500 dark:text-zinc-400">
                    Books in the trash can be restored or permanently deleted.
                </p>
            </div>

            {deletedBooks.length === 0 ? (
                <div className="text-center py-20 bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 empty-state-bg">
                    <Icon name="TRASH" className="w-20 h-20 mx-auto text-zinc-300 dark:text-zinc-600" />
                    <h2 className="mt-4 text-2xl font-semibold text-zinc-800 dark:text-zinc-100">Trash is empty</h2>
                    <p className="mt-2 text-zinc-500 dark:text-zinc-400">Deleted books will appear here.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                    {deletedBooks.map(book => (
                        <BookCard 
                            key={book.id}
                            book={book} 
                            onDelete={() => handleDeleteForever(book.id)}
                            onManageSnapshots={() => {}}
                            onGenerateCover={() => {}}
                            onCreateRelated={() => {}}
                            isDraggable={false}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default Trash;