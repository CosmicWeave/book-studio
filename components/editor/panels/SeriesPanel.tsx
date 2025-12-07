
import React, { useContext, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBookEditor } from '../../../contexts/BookEditorContext';
import { AppContext } from '../../../contexts/AppContext';
import { ICONS } from '../../../constants';
import Icon from '../../Icon';
import { Book } from '../../../types';
import { modalService } from '../../../services/modalService';

const SeriesPanel: React.FC = () => {
    const { book: currentBook } = useBookEditor();
    const { books: allBooks, series: allSeries, reorderBooksInSeries, removeBookFromSeries } = useContext(AppContext);
    const navigate = useNavigate();
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

    const seriesInfo = useMemo(() => {
        if (!currentBook?.seriesId) return null;
        
        const series = allSeries.find(s => s.id === currentBook.seriesId);
        if (!series) return null;

        const booksMap = new Map(allBooks.map(b => [b.id, b]));
        const booksInSeries = series.bookIds
            .map(bookId => booksMap.get(bookId))
            .filter((book): book is Book => book !== undefined);


        return {
            ...series,
            books: booksInSeries
        };
    }, [currentBook, allBooks, allSeries]);

    if (!seriesInfo) {
        return null;
    }
    
    const handleDragStart = (e: React.DragEvent<HTMLLIElement>, index: number) => {
        e.dataTransfer.setData('text/plain', index.toString());
        setDraggedIndex(index);
    };

    const handleDragEnd = () => {
        setDraggedIndex(null);
        setDragOverIndex(null);
    };
    
    const handleDragOver = (e: React.DragEvent<HTMLLIElement>, index: number) => {
        e.preventDefault();
        if (draggedIndex !== null && draggedIndex !== index) {
            setDragOverIndex(index);
        }
    };
    
    const handleDrop = (e: React.DragEvent<HTMLLIElement>, toIndex: number) => {
        e.preventDefault();
        if (draggedIndex === null) return;

        if (draggedIndex !== toIndex) {
            reorderBooksInSeries(seriesInfo.id, draggedIndex, toIndex);
        }
        handleDragEnd();
    };

    const getDragClass = (index: number) => {
        if (index === draggedIndex) return 'opacity-30';
        if (index === dragOverIndex) {
            // Show border on top if dragging an item down, or bottom if dragging up
            if (draggedIndex === null || index < draggedIndex) {
                return 'border-t-2 border-indigo-500';
            }
            return 'border-b-2 border-indigo-500';
        }
        return '';
    };

    const handleRemoveFromSeries = async () => {
        if (!currentBook) return;
        const confirmed = await modalService.confirm({
            title: `Remove from Series?`,
            message: `Are you sure you want to remove "${currentBook.topic}" from the "${seriesInfo.title}" series? If only one book remains, the series will be dissolved.`,
            confirmText: 'Remove',
            danger: true,
        });
    
        if (confirmed) {
            removeBookFromSeries(currentBook.id);
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-bold mb-4 flex items-center space-x-2 overflow-hidden">
                <Icon name="LINK" className="w-5 h-5 text-gray-400 flex-shrink-0" />
                <span className="truncate" title={`Series: ${seriesInfo.title}`}>Series: {seriesInfo.title}</span>
            </h2>
            <ul className="space-y-1">
                {seriesInfo.books.map((book, index) => {
                    const isCurrent = book.id === currentBook?.id;
                    return (
                        <li 
                            key={book.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, index)}
                            onDragEnd={handleDragEnd}
                            onDragOver={(e) => handleDragOver(e, index)}
                            onDragLeave={() => setDragOverIndex(null)}
                            onDrop={(e) => handleDrop(e, index)}
                            className={`group transition-all duration-150 rounded-md cursor-grab active:cursor-grabbing flex items-center ${getDragClass(index)}`}
                        >
                            <button
                                onClick={() => navigate(`/editor/${book.id}`)}
                                disabled={isCurrent}
                                className={`w-full text-left flex items-start space-x-3 p-2 rounded-md transition-colors text-sm ${
                                    isCurrent
                                        ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-200 font-semibold'
                                        : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                                }`}
                            >
                                <span className="flex-shrink-0 mt-0.5 w-5 text-center font-mono text-xs">{index + 1}.</span>
                                <span className="flex-grow truncate">{book.topic}</span>
                            </button>
                             {isCurrent && (
                                <button
                                    onClick={handleRemoveFromSeries}
                                    title="Remove from series"
                                    className="p-1 rounded-full text-zinc-400 hover:text-red-500 hover:bg-red-100 dark:hover:bg-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity ml-1 flex-shrink-0"
                                >
                                    <Icon name="CLOSE" className="w-4 h-4" />
                                </button>
                            )}
                        </li>
                    )
                })}
            </ul>
        </div>
    );
};

export default SeriesPanel;
