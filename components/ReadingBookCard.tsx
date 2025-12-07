import React, { useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Book, ReadingProgress } from '../types';
import Icon from './Icon';

interface ReadingBookCardProps {
    book: Book;
    progress: ReadingProgress;
    onOpen?: () => void;
}

const ReadingBookCard: React.FC<ReadingBookCardProps> = ({ book, progress, onOpen }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const percentage = progress.percentage || 0;
    
    const timeAgo = useMemo(() => {
        const seconds = Math.floor((Date.now() - progress.updatedAt) / 1000);
        if (seconds < 60) return 'Just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    }, [progress.updatedAt]);

    const handleOpen = () => {
        if (onOpen) {
            onOpen();
        } else {
            // Pass current path as 'from' state so Reader knows where to return
            navigate(`/reader/${book.id}`, { state: { from: location.pathname } });
        }
    };

    return (
        <div 
            onClick={handleOpen}
            className="group relative flex flex-col sm:flex-row bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer h-full"
        >
            {/* Cover Image Section */}
            <div className="sm:w-32 h-48 sm:h-auto flex-shrink-0 relative overflow-hidden bg-zinc-100 dark:bg-zinc-900">
                {book.coverImage ? (
                    <img 
                        src={book.coverImage} 
                        alt={book.topic} 
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <Icon name="BOOK" className="w-10 h-10 text-zinc-300 dark:text-zinc-600" />
                    </div>
                )}
                {/* Overlay gradient for text readability on mobile if needed */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent sm:hidden" />
            </div>

            {/* Content Section */}
            <div className="flex-1 p-5 flex flex-col justify-between">
                <div>
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded-full">
                            {timeAgo}
                        </span>
                    </div>
                    <h3 className="font-bold text-xl text-zinc-900 dark:text-zinc-100 mb-1 line-clamp-2 leading-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {book.topic}
                    </h3>
                    {book.author && (
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4 line-clamp-1">
                            by {book.author}
                        </p>
                    )}
                </div>

                <div className="space-y-3">
                    {/* Progress Bar */}
                    <div>
                        <div className="flex justify-between text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">
                            <span>Progress</span>
                            <span className="text-zinc-900 dark:text-zinc-200">{percentage}%</span>
                        </div>
                        <div className="h-2 w-full bg-zinc-100 dark:bg-zinc-700 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-indigo-600 rounded-full transition-all duration-500 group-hover:bg-indigo-500"
                                style={{ width: `${percentage}%` }}
                            />
                        </div>
                    </div>

                    <button 
                        className="w-full py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg font-semibold text-sm opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300 shadow-lg flex items-center justify-center space-x-2"
                    >
                        <Icon name="BOOK" className="w-4 h-4" />
                        <span>Continue Reading</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReadingBookCard;