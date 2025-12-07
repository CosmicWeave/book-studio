import React, { useContext, useState, useMemo } from 'react';
import { AppContext } from '../contexts/AppContext';
import { ICONS } from '../constants';
import Icon from '../components/Icon';
import BookCard from '../components/BookCard';
import SnapshotHistoryModal from '../components/SnapshotHistoryModal';
import CoverGenerationModal from '../components/CoverGenerationModal';
import SequelPrequelModal from '../components/SequelPrequelModal';
import { modalService } from '../services/modalService';
import { Book } from '../types';

const Archived: React.FC = () => {
    const { books, deleteBook, updateBook } = useContext(AppContext);
    
    // Modals
    const [generatingCoverBook, setGeneratingCoverBook] = useState<Book | null>(null);
    const [managingSnapshotsFor, setManagingSnapshotsFor] = useState<Book | null>(null);
    const [relatedBookDetails, setRelatedBookDetails] = useState<{parentBook: Book, relationType: 'sequel' | 'prequel'} | null>(null);

    const archivedBooks = useMemo(() => {
        return books.filter(b => !b.deletedAt && b.status === 'archived');
    }, [books]);

    const handleCoverGenerated = (bookId: string, coverImage: string) => {
        const bookToUpdate = books.find(b => b.id === bookId);
        if (bookToUpdate) {
            updateBook({ ...bookToUpdate, coverImage });
        }
        setGeneratingCoverBook(null);
    };

    const handleDelete = async (bookId: string) => {
        const confirmed = await modalService.confirm({
            title: 'Move to Trash?',
            message: 'Are you sure you want to move this book to the trash?',
            danger: true,
            confirmText: 'Move to Trash'
        });
        if (confirmed) {
            await deleteBook(bookId);
        }
    }

    return (
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
            {generatingCoverBook && (
                <CoverGenerationModal 
                    book={generatingCoverBook}
                    allBooks={books}
                    onClose={() => setGeneratingCoverBook(null)}
                    onCoverGenerated={handleCoverGenerated}
                />
            )}
            {managingSnapshotsFor && (
                <SnapshotHistoryModal
                    book={managingSnapshotsFor}
                    onClose={() => setManagingSnapshotsFor(null)}
                />
            )}
            {relatedBookDetails && (
                <SequelPrequelModal
                    parentBook={relatedBookDetails.parentBook}
                    relationType={relatedBookDetails.relationType}
                    onClose={() => setRelatedBookDetails(null)}
                />
            )}

            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-3">
                    <Icon name="ARCHIVE" className="text-zinc-500 dark:text-zinc-400" />
                    Archived Books
                </h1>
                <p className="mt-2 text-zinc-500 dark:text-zinc-400">
                    Books that you've set aside. They are safe here and can be unarchived anytime.
                </p>
            </div>

            {archivedBooks.length === 0 ? (
                <div className="text-center py-20 bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 empty-state-bg">
                    <Icon name="ARCHIVE" className="w-20 h-20 mx-auto text-zinc-300 dark:text-zinc-600" />
                    <h2 className="mt-4 text-2xl font-semibold text-zinc-800 dark:text-zinc-100">No archived books</h2>
                    <p className="mt-2 text-zinc-500 dark:text-zinc-400">Archive books from your library to declutter your workspace.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                    {archivedBooks.map(book => (
                        <BookCard 
                            key={book.id}
                            book={book} 
                            onDelete={() => handleDelete(book.id)}
                            onManageSnapshots={() => setManagingSnapshotsFor(book)}
                            onGenerateCover={() => setGeneratingCoverBook(book)}
                            onCreateRelated={(type) => setRelatedBookDetails({parentBook: book, relationType: type})}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default Archived;