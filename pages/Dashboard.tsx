
import React, { useContext, useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../contexts/AppContext';
import { ICONS } from '../constants';
import { Book, Series, ReadingProgress } from '../types';
import Loader from '../components/Loader';
import CoverGenerationModal from '../components/CoverGenerationModal';
import SnapshotHistoryModal from '../components/SnapshotHistoryModal';
import SequelPrequelModal from '../components/SequelPrequelModal';
import BookCard from '../components/BookCard';
import Icon, { IconName } from '../components/Icon';
import CreateSeriesModal from '../components/CreateSeriesModal';
import AddToSeriesModal from '../components/AddToSeriesModal';
import BookCreationModal from '../components/BookCreationModal';
import { modalService } from '../services/modalService';
import { db } from '../services/db';

const StatCard: React.FC<{ label: string; value: number; icon: IconName; colorClass: string }> = ({ label, value, icon, colorClass }) => (
    <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-sm flex items-center space-x-4 hover:shadow-md transition-all">
        <div className={`p-3 rounded-lg ${colorClass}`}>
            <Icon name={icon} className="w-6 h-6" />
        </div>
        <div>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">{label}</p>
            <p className="text-2xl font-bold text-zinc-800 dark:text-zinc-100">{value}</p>
        </div>
    </div>
);

type SortOption = 'updated' | 'created' | 'alpha';

const Dashboard: React.FC = () => {
    const { books, series: allSeries, deleteBook, archiveBook, updateBook, removeBookFromSeries, reorderBooksInSeries } = useContext(AppContext);
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    
    // Modals
    const [generatingCoverBook, setGeneratingCoverBook] = useState<Book | null>(null);
    const [managingSnapshotsFor, setManagingSnapshotsFor] = useState<Book | null>(null);
    const [relatedBookDetails, setRelatedBookDetails] = useState<{parentBook: Book, relationType: 'sequel' | 'prequel'} | null>(null);
    const [isCreateSeriesModalOpen, setIsCreateSeriesModalOpen] = useState(false);
    const [isCreateBookModalOpen, setIsCreateBookModalOpen] = useState(false);
    const [addingBookToSeries, setAddingBookToSeries] = useState<Book | null>(null);
    
    // UI State
    const [searchQuery, setSearchQuery] = useState('');
    const [sortOption, setSortOption] = useState<SortOption>('updated');
    const [collapsedSeries, setCollapsedSeries] = useState<Set<string>>(new Set());
    const [readingProgressMap, setReadingProgressMap] = useState<Record<string, number>>({});

    // Drag and Drop
    const [draggedItem, setDraggedItem] = useState<{ seriesId: string; fromIndex: number } | null>(null);
    const [dragOverItem, setDragOverItem] = useState<{ seriesId: string; toIndex: number } | null>(null);

    useEffect(() => {
        const fetchProgress = async () => {
            try {
                const progressList = await db.readingProgress.getAll();
                const map: Record<string, number> = {};
                progressList.forEach((p: ReadingProgress) => {
                    if (p.percentage !== undefined) {
                        map[p.bookId] = p.percentage;
                    }
                });
                setReadingProgressMap(map);
            } catch (e) {
                console.warn("Failed to fetch reading progress", e);
            }
        };
        fetchProgress();
    }, [books]); // Refresh when books change (e.g. import)

    const handleCoverGenerated = (bookId: string, coverImage: string) => {
        const bookToUpdate = books.find(b => b.id === bookId);
        if (bookToUpdate) {
            updateBook({ ...bookToUpdate, coverImage });
        }
        setGeneratingCoverBook(null);
    };

    const handleRemoveFromSeries = async (bookToRemove: Book) => {
        const confirmed = await modalService.confirm({
            title: `Remove from Series?`,
            message: `Are you sure you want to remove "${bookToRemove.topic}" from the "${bookToRemove.seriesName}" series? If only one book remains, the series will be dissolved.`,
            confirmText: 'Remove',
            danger: true,
        });

        if (confirmed) {
            await removeBookFromSeries(bookToRemove.id);
        }
    };

    const handleDragStart = (seriesId: string, fromIndex: number) => {
        setDraggedItem({ seriesId, fromIndex });
    };

    const handleDragEnter = (seriesId: string, toIndex: number) => {
        if (draggedItem && draggedItem.seriesId === seriesId) {
            setDragOverItem({ seriesId, toIndex });
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = () => {
        if (draggedItem && dragOverItem && draggedItem.seriesId === dragOverItem.seriesId && draggedItem.fromIndex !== dragOverItem.toIndex) {
            reorderBooksInSeries(draggedItem.seriesId, draggedItem.fromIndex, dragOverItem.toIndex);
        }
        setDraggedItem(null);
        setDragOverItem(null);
    };

    const handleDragEnd = () => {
        setDraggedItem(null);
        setDragOverItem(null);
    };

    const toggleSeriesCollapse = (seriesId: string) => {
        setCollapsedSeries(prev => {
            const newSet = new Set(prev);
            if (newSet.has(seriesId)) {
                newSet.delete(seriesId);
            } else {
                newSet.add(seriesId);
            }
            return newSet;
        });
    };

    // Filter active books (not archived, not deleted)
    const activeBooks = useMemo(() => {
        return books.filter(b => !b.deletedAt && b.status !== 'archived');
    }, [books]);

    const filteredBooks = useMemo(() => {
        if (!searchQuery.trim()) return activeBooks;
        const lowerQuery = searchQuery.toLowerCase();
        return activeBooks.filter(b => b.topic.toLowerCase().includes(lowerQuery));
    }, [activeBooks, searchQuery]);

    const { series, standalone } = useMemo(() => {
        const seriesMap = new Map<string, Series>(allSeries.map(s => [s.id, s]));
        const seriesBooksGroups: Record<string, Book[]> = {};
        const standaloneBooks: Book[] = [];

        filteredBooks.forEach(book => {
            if (book.seriesId) {
                if (!seriesBooksGroups[book.seriesId]) {
                    seriesBooksGroups[book.seriesId] = [];
                }
                seriesBooksGroups[book.seriesId].push(book);
            } else {
                standaloneBooks.push(book);
            }
        });

        const sortedSeries = Object.keys(seriesBooksGroups)
            .map(seriesId => {
                const seriesInfo = seriesMap.get(seriesId);
                if (!seriesInfo) {
                    standaloneBooks.push(...seriesBooksGroups[seriesId]);
                    return null;
                }
                
                const booksInSeries = seriesBooksGroups[seriesId];
                const bookOrderMap = new Map<string, number>(seriesInfo.bookIds.map((id, index) => [id, index]));
                
                // Ensure internal series order is preserved unless dragging
                booksInSeries.sort((a, b) => {
                    const orderA = bookOrderMap.get(a.id) ?? Infinity;
                    const orderB = bookOrderMap.get(b.id) ?? Infinity;
                    return orderA - orderB;
                });

                const lastUpdated = booksInSeries.length > 0 ? Math.max(...booksInSeries.map(b => b.updatedAt)) : 0;
                const createdAt = booksInSeries.length > 0 ? Math.min(...booksInSeries.map(b => b.createdAt)) : 0;

                return {
                    seriesInfo,
                    books: booksInSeries,
                    lastUpdated,
                    createdAt
                };
            })
            .filter((s): s is { seriesInfo: Series; books: Book[]; lastUpdated: number; createdAt: number } => s !== null);

        // Sort top-level Series
        sortedSeries.sort((a, b) => {
            switch (sortOption) {
                case 'alpha': return a.seriesInfo.title.localeCompare(b.seriesInfo.title);
                case 'created': return b.createdAt - a.createdAt;
                case 'updated': default: return b.lastUpdated - a.lastUpdated;
            }
        });

        // Sort Standalone Books
        standaloneBooks.sort((a, b) => {
            switch (sortOption) {
                case 'alpha': return a.topic.localeCompare(b.topic);
                case 'created': return b.createdAt - a.createdAt;
                case 'updated': default: return b.updatedAt - a.updatedAt;
            }
        });

        return { series: sortedSeries, standalone: standaloneBooks };

    }, [filteredBooks, allSeries, sortOption]);

    const mostRecentBook = useMemo(() => {
        if (activeBooks.length === 0) return null;
        return activeBooks.reduce((prev, current) => (prev.updatedAt > current.updatedAt) ? prev : current);
    }, [activeBooks]);

    return (
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
            {isLoading && <Loader message="Processing..." />}
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
            {isCreateSeriesModalOpen && (
                <CreateSeriesModal 
                    isOpen={isCreateSeriesModalOpen}
                    onClose={() => setIsCreateSeriesModalOpen(false)}
                />
            )}
            {isCreateBookModalOpen && (
                <BookCreationModal 
                    isOpen={isCreateBookModalOpen}
                    onClose={() => setIsCreateBookModalOpen(false)}
                />
            )}
            {addingBookToSeries && (
                <AddToSeriesModal
                    book={addingBookToSeries}
                    onClose={() => setAddingBookToSeries(null)}
                />
            )}

            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
                <div>
                    <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white mb-2">Your Library</h1>
                    <p className="text-zinc-500 dark:text-zinc-400">Manage your books, series, and creative projects.</p>
                </div>
                <div className="flex gap-3 w-full md:w-auto">
                    <button
                        onClick={() => setIsCreateSeriesModalOpen(true)}
                        className="flex-1 md:flex-none flex items-center justify-center space-x-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 px-4 py-2.5 rounded-lg shadow-sm hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-all"
                    >
                        <Icon name="LINK" className="w-5 h-5" />
                        <span className="font-semibold">New Series</span>
                    </button>
                    <button
                        onClick={() => setIsCreateBookModalOpen(true)}
                        className="flex-1 md:flex-none flex items-center justify-center space-x-2 bg-indigo-600 text-white px-5 py-2.5 rounded-lg shadow-md hover:bg-indigo-700 transition-all"
                    >
                        <Icon name="PLUS" className="w-5 h-5" />
                        <span className="font-semibold">New Book</span>
                    </button>
                </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
                <StatCard 
                    label="Active Books" 
                    value={activeBooks.length} 
                    icon="BOOK" 
                    colorClass="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" 
                />
                <StatCard 
                    label="Total Series" 
                    value={allSeries.length} 
                    icon="LINK" 
                    colorClass="bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400" 
                />
                <StatCard 
                    label="In Progress" 
                    value={activeBooks.filter(b => b.status !== 'complete').length} 
                    icon="EDIT" 
                    colorClass="bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400" 
                />
                <StatCard 
                    label="Completed" 
                    value={activeBooks.filter(b => b.status === 'complete').length} 
                    icon="CLOUD_CHECK" 
                    colorClass="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" 
                />
            </div>

            {/* Recent Work & Search */}
            <div className="space-y-8">
                {/* Continue Writing Hero */}
                {!searchQuery && mostRecentBook && (
                    <div className="relative rounded-2xl shadow-xl overflow-hidden text-white p-6 sm:p-10 min-h-[220px] flex flex-col justify-center group transition-all hover:shadow-2xl">
                        {/* Dynamic Background */}
                        <div className="absolute inset-0 z-0 bg-zinc-900">
                            {mostRecentBook.coverImage ? (
                                <>
                                    <img 
                                        src={mostRecentBook.coverImage} 
                                        alt="Background" 
                                        className="w-full h-full object-cover opacity-40 blur-xl scale-110 group-hover:scale-105 transition-transform duration-1000" 
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-r from-zinc-900/90 via-zinc-900/70 to-transparent/30" />
                                </>
                            ) : (
                                <div className="w-full h-full bg-gradient-to-r from-indigo-600 to-purple-700" />
                            )}
                        </div>
                        
                        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                            <div className="flex items-center gap-6">
                                {mostRecentBook.coverImage ? (
                                    <img src={mostRecentBook.coverImage} alt="Cover" className="w-24 h-36 object-cover rounded-lg shadow-2xl border border-white/20 hidden sm:block transform group-hover:scale-105 transition-transform duration-500" />
                                ) : (
                                    <div className="w-24 h-36 bg-white/10 rounded-lg border-2 border-white/20 flex items-center justify-center hidden sm:flex">
                                        <Icon name="BOOK" className="w-10 h-10 text-white/70" />
                                    </div>
                                )}
                                <div>
                                    <div className="inline-flex items-center space-x-2 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-medium mb-3 border border-white/10">
                                        <Icon name="HISTORY" className="w-3 h-3" />
                                        <span>Resume Writing</span>
                                    </div>
                                    <h2 className="text-3xl sm:text-4xl font-bold leading-tight mb-2 tracking-tight">{mostRecentBook.topic}</h2>
                                    <p className="text-zinc-300 text-sm mb-1 flex items-center gap-2">
                                        {mostRecentBook.seriesName && <span className="bg-white/10 px-2 py-0.5 rounded text-xs">{mostRecentBook.seriesName}</span>}
                                        <span>{mostRecentBook.content.length} Chapters Written</span>
                                    </p>
                                    <p className="text-zinc-400 text-xs">Updated {new Date(mostRecentBook.updatedAt).toLocaleDateString()}</p>
                                </div>
                            </div>
                            
                            <button 
                                onClick={() => navigate(`/editor/${mostRecentBook.id}`)}
                                className="bg-white text-zinc-900 px-8 py-3.5 rounded-xl font-bold shadow-lg hover:bg-indigo-50 transition-all transform hover:-translate-y-0.5 flex items-center space-x-2 whitespace-nowrap w-full sm:w-auto justify-center"
                            >
                                <Icon name="EDIT" className="w-5 h-5" />
                                <span>Open Editor</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* Controls Bar: Search + Sort */}
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-grow">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Icon name="SEARCH" className="h-5 w-5 text-zinc-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search your library..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="block w-full pl-10 pr-4 py-3 border border-zinc-300 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-500 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-sm"
                        />
                    </div>
                    <div className="flex-shrink-0">
                        <select
                            value={sortOption}
                            onChange={(e) => setSortOption(e.target.value as SortOption)}
                            className="block w-full pl-4 pr-10 py-3 border border-zinc-300 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm cursor-pointer"
                        >
                            <option value="updated">Last Updated</option>
                            <option value="created">Date Created</option>
                            <option value="alpha">Alphabetical</option>
                        </select>
                    </div>
                </div>

                {/* Content Grid */}
                {filteredBooks.length === 0 && searchQuery ? (
                    <div className="text-center py-20">
                        <Icon name="SEARCH" className="w-12 h-12 mx-auto text-zinc-300 dark:text-zinc-600 mb-4" />
                        <p className="text-zinc-500 dark:text-zinc-400">No books found matching "{searchQuery}"</p>
                    </div>
                ) : activeBooks.length === 0 ? (
                    <div className="text-center py-20 bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 empty-state-bg">
                        <Icon name="BOOK" className="w-20 h-20 mx-auto text-zinc-300 dark:text-zinc-600" />
                        <h2 className="mt-4 text-2xl font-semibold text-zinc-800 dark:text-zinc-100">Your library is empty</h2>
                        <p className="mt-2 text-zinc-500 dark:text-zinc-400">Click "New Book" above to start your first masterpiece.</p>
                    </div>
                ) : (
                    <div className="space-y-12">
                        {series.map(({ seriesInfo, books: seriesBooks }) => (
                            <div key={seriesInfo.id} className="bg-zinc-50/50 dark:bg-zinc-800/20 rounded-2xl p-2 border border-zinc-200/50 dark:border-zinc-700/30">
                                <div className="flex justify-between items-center p-4">
                                    <div 
                                        className="flex items-center space-x-3 cursor-pointer group"
                                        onClick={() => toggleSeriesCollapse(seriesInfo.id)}
                                    >
                                        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
                                            <Icon name="LINK" className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
                                                {seriesInfo.title}
                                                <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400 bg-zinc-200 dark:bg-zinc-700 px-2 py-0.5 rounded-full">Series</span>
                                            </h2>
                                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{seriesBooks.length} books</p>
                                        </div>
                                        <Icon 
                                            name="CHEVRON_RIGHT" 
                                            className={`w-5 h-5 text-zinc-400 transform transition-transform duration-200 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 ${collapsedSeries.has(seriesInfo.id) ? 'rotate-0' : 'rotate-90'}`} 
                                        />
                                    </div>
                                    <button
                                        onClick={() => navigate(`/series/${seriesInfo.id}`)}
                                        className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline px-3 py-1 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-md transition-colors"
                                    >
                                        Manage Series
                                    </button>
                                </div>
                                
                                {!collapsedSeries.has(seriesInfo.id) && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 p-4 pt-0 animate-fade-in">
                                        {seriesBooks.map((book, index) => {
                                            const isDragging = draggedItem?.seriesId === seriesInfo.id && draggedItem?.fromIndex === index;
                                            const isDragOver = dragOverItem?.seriesId === seriesInfo.id && dragOverItem?.toIndex === index && !isDragging;

                                            return (
                                                <BookCard 
                                                    key={book.id}
                                                    book={book} 
                                                    readingProgress={readingProgressMap[book.id]}
                                                    onDelete={() => deleteBook(book.id)}
                                                    onManageSnapshots={() => setManagingSnapshotsFor(book)}
                                                    onGenerateCover={() => setGeneratingCoverBook(book)}
                                                    onCreateRelated={(type) => setRelatedBookDetails({parentBook: book, relationType: type})}
                                                    onRemoveFromSeries={() => handleRemoveFromSeries(book)}
                                                    isDraggable={true}
                                                    onDragStart={() => handleDragStart(seriesInfo.id, index)}
                                                    onDragEnter={() => handleDragEnter(seriesInfo.id, index)}
                                                    onDragOver={handleDragOver}
                                                    onDrop={handleDrop}
                                                    onDragEnd={handleDragEnd}
                                                    isDragging={isDragging}
                                                    isDragOver={isDragOver}
                                                />
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        ))}
                        
                        {standalone.length > 0 && (
                            <div className="space-y-6 px-2">
                                {series.length > 0 && (
                                    <div className="flex items-center space-x-2 border-b border-zinc-200 dark:border-zinc-700 pb-2">
                                        <Icon name="BOOK" className="w-5 h-5 text-zinc-400" />
                                        <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">Standalone Books</h2>
                                    </div>
                                )}
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                                    {standalone.map(book => (
                                        <BookCard 
                                            key={book.id}
                                            book={book} 
                                            readingProgress={readingProgressMap[book.id]}
                                            onDelete={() => deleteBook(book.id)}
                                            onManageSnapshots={() => setManagingSnapshotsFor(book)}
                                            onGenerateCover={() => setGeneratingCoverBook(book)}
                                            onCreateRelated={(type) => setRelatedBookDetails({parentBook: book, relationType: type})}
                                            onAddToSeries={() => setAddingBookToSeries(book)}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Dashboard;
