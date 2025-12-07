import React, { useState, useRef, useEffect, useMemo, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Book } from '../types';
import { ICONS } from '../constants';
import Icon, { IconName } from './Icon';
import { AppContext } from '../contexts/AppContext';

interface BookCardProps {
    book: Book;
    readingProgress?: number;
    onDelete: () => void;
    onManageSnapshots: () => void;
    onGenerateCover: () => void;
    onCreateRelated: (type: 'sequel' | 'prequel') => void;
    onAddToSeries?: () => void;
    onRemoveFromSeries?: () => void;
    isDraggable?: boolean;
    onDragStart?: (e: React.DragEvent) => void;
    onDragEnter?: (e: React.DragEvent) => void;
    onDragOver?: (e: React.DragEvent) => void;
    onDrop?: (e: React.DragEvent) => void;
    onDragEnd?: (e: React.DragEvent) => void;
    isDragging?: boolean;
    isDragOver?: boolean;
    onOpen?: () => void;
}

const wordCounter = (text: string): number => {
    if (!text || !text.trim()) return 0;
    return text.trim().split(/\s+/).filter(Boolean).length;
};

const BookCard: React.FC<BookCardProps> = ({
    book,
    readingProgress = 0,
    onDelete,
    onManageSnapshots,
    onGenerateCover,
    onCreateRelated,
    onAddToSeries,
    onRemoveFromSeries,
    isDraggable,
    onDragStart,
    onDragEnter,
    onDragOver,
    onDrop,
    onDragEnd,
    isDragging,
    isDragOver,
    onOpen
}) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { isAiEnabled, restoreBook, archiveBook } = useContext(AppContext);
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleReadBook = () => {
        navigate(`/reader/${book.id}`, { state: { from: location.pathname } });
    };

    const menuItems: { label: string; icon: IconName; action: () => void, danger?: boolean }[] = [];

    const isDeleted = !!book.deletedAt;
    const isArchived = book.status === 'archived';

    if (isDeleted) {
        menuItems.push({ label: 'Restore Book', icon: 'RESTORE', action: () => restoreBook(book.id) });
    } else {
        if (isAiEnabled) {
            menuItems.push({ label: 'Generate Cover', icon: 'IMAGE', action: onGenerateCover });
        }

        menuItems.push(
            { label: 'Version History', icon: 'HISTORY', action: onManageSnapshots },
            { label: 'Read Book', icon: 'BOOK', action: handleReadBook },
        );

        if (onAddToSeries) {
            menuItems.push({ label: 'Add to Series...', icon: 'LINK', action: onAddToSeries });
        }

        if (onRemoveFromSeries) {
            menuItems.push({ label: 'Remove from Series', icon: 'CLOSE', action: onRemoveFromSeries });
        }

        if (isAiEnabled) {
            menuItems.push(
                { label: 'Create Sequel', icon: 'PLUS', action: () => onCreateRelated('sequel') },
                { label: 'Create Prequel', icon: 'PLUS', action: () => onCreateRelated('prequel') }
            );
        }

        if (isArchived) {
            menuItems.push({ label: 'Unarchive', icon: 'RESTORE', action: () => restoreBook(book.id) });
        } else {
            menuItems.push({ label: 'Archive', icon: 'ARCHIVE', action: () => archiveBook(book.id) });
        }
    }

    menuItems.push({ label: isDeleted ? 'Delete Forever' : 'Delete', icon: 'TRASH', action: onDelete, danger: true });
    
    const totalWords = useMemo(() => {
        if (!book.content) return 0;
        return book.content.reduce((acc, chapter) => {
            if (!chapter || !chapter.htmlContent) return acc;
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = chapter.htmlContent;
            return acc + wordCounter(tempDiv.textContent || "");
        }, 0);
    }, [book.content]);

    const cardClasses = `
        relative group bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 flex flex-row overflow-hidden transition-all duration-300 hover:shadow-xl hover:border-indigo-300 dark:hover:border-indigo-700 hover:-translate-y-1 h-full min-h-[16rem]
        ${isDraggable ? 'cursor-grab active:cursor-grabbing' : ''}
        ${isDragging ? 'opacity-40' : ''}
        ${isDeleted ? 'opacity-60 grayscale' : ''}
    `;

    const dropIndicatorClasses = `
        absolute -inset-1 border-2 border-dashed border-indigo-500 rounded-2xl transition-opacity pointer-events-none z-50
        ${isDragOver ? 'opacity-100' : 'opacity-0'}
    `;

    const handleOpen = () => {
        if (isDeleted) return;
        if (onOpen) {
            onOpen();
        } else {
            navigate(`/editor/${book.id}`, { state: { from: location.pathname } });
        }
    };

    return (
        <div
            className={cardClasses}
            draggable={isDraggable}
            onDragStart={onDragStart}
            onDragEnter={onDragEnter}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onDragEnd={onDragEnd}
        >
            <div className={dropIndicatorClasses} />
            
            {/* Cover Image Section - Left Side (Reduced Width) */}
            <div 
                className={`w-28 sm:w-36 bg-zinc-200 dark:bg-zinc-700 flex-shrink-0 relative overflow-hidden group/cover ${isDeleted ? '' : 'cursor-pointer'}`}
                onClick={handleOpen}
            >
                {book.coverImage ? (
                    <img 
                        src={book.coverImage} 
                        alt={`${book.topic} cover`} 
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                    />
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-700 dark:to-zinc-800 p-4 text-center">
                        <Icon name="IMAGE" className="text-zinc-300 dark:text-zinc-600 w-12 h-12 mb-3" />
                        {isAiEnabled && !isDeleted && <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium uppercase tracking-widest leading-relaxed">Generate<br/>Cover</span>}
                    </div>
                )}
                
                {/* Hover Overlay */}
                {!isDeleted && <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors pointer-events-none"></div>}

                {/* Reading Progress Indicator */}
                {readingProgress > 0 && !isDeleted && (
                    <div className="absolute bottom-0 left-0 right-0">
                        {/* Gradient Bar */}
                        <div className="h-2 bg-zinc-800/80 dark:bg-black/80 backdrop-blur-sm overflow-hidden">
                            <div 
                                className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 animate-shimmer bg-[length:200%_100%]" 
                                style={{ width: `${readingProgress}%` }} 
                            />
                        </div>
                        {/* Floating Badge - Visible on hover or always if significant progress */}
                        <div className="absolute bottom-3 right-1 opacity-0 group-hover/cover:opacity-100 transition-opacity duration-300">
                            <span className="px-1.5 py-0.5 rounded bg-zinc-900/90 text-[10px] font-bold text-white shadow-sm border border-white/10 backdrop-blur-md">
                                {readingProgress}%
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {/* Content Section - Right Side (Reduced Padding) */}
            <div className="flex-1 flex flex-col p-4 sm:p-5 min-w-0 relative">
                
                {/* Menu Button - Absolute Positioned to allow title full width */}
                <div ref={menuRef} className="absolute top-2 right-2 z-10">
                    <button 
                        onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }} 
                        className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 dark:text-zinc-500 dark:hover:text-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                    >
                        <Icon name="MORE_VERTICAL" className="w-5 h-5" />
                    </button>
                    {menuOpen && (
                         <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-zinc-800 rounded-lg shadow-xl border border-zinc-200 dark:border-zinc-700 z-20 animate-fade-in-up overflow-hidden">
                            {menuItems.map((item, idx) => (
                                <button
                                    key={idx}
                                    onClick={(e) => { e.stopPropagation(); item.action(); setMenuOpen(false); }}
                                    className={`w-full text-left flex items-center space-x-2 px-4 py-2.5 text-sm transition-colors
                                        ${item.danger 
                                            ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30' 
                                            : 'text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700'
                                        }`}
                                >
                                    <Icon name={item.icon} className="w-4 h-4 opacity-70" />
                                    <span>{item.label}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div onClick={handleOpen} className={`flex-1 min-w-0 pr-6 ${isDeleted ? 'cursor-default' : 'cursor-pointer'}`}>
                    <h3 className="font-bold text-xl sm:text-2xl text-zinc-900 dark:text-zinc-100 leading-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2" title={book.topic}>
                        {book.topic || 'Untitled Book'}
                    </h3>
                    {book.subtitle && (
                        <p className="text-sm text-zinc-600 dark:text-zinc-300 mt-1 italic line-clamp-1">
                            {book.subtitle}
                        </p>
                    )}
                    <p className="text-base font-medium text-zinc-500 dark:text-zinc-400 mt-2 truncate">
                        {book.author || 'Unknown Author'}
                    </p>
                </div>

                <div className="flex-grow">
                    {/* Dynamic Spacer */}
                </div>

                {/* Stats Footer */}
                <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-700/50 flex items-center justify-between">
                    <div className="flex flex-col space-y-1">
                        <div className="flex items-center space-x-4 text-sm text-zinc-500 dark:text-zinc-400">
                            <div className="flex items-center" title="Chapters Written / Planned">
                                <Icon name="BOOK" className="w-3.5 h-3.5 mr-1.5 text-zinc-400" />
                                <span>{book.content.length} / {book.outline.length || '?'} ch</span>
                            </div>
                            <div className="flex items-center" title="Total Word Count">
                                <Icon name="EDIT" className="w-3.5 h-3.5 mr-1.5 text-zinc-400" />
                                <span>{totalWords > 1000 ? `${(totalWords/1000).toFixed(1)}k` : totalWords} words</span>
                            </div>
                        </div>
                    </div>

                    
                </div>
                
                {isDeleted ? (
                    <span className="px-2.5 py-1 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 font-bold text-[10px] uppercase tracking-wide">
                        Deleted
                    </span>
                ) : isArchived ? (
                    <span className="px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300 font-bold text-[10px] uppercase tracking-wide">
                        Archived
                    </span>
                ) : book.status === 'complete' ? (
                    <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 font-bold text-[10px] uppercase tracking-wide">
                        Complete
                    </span>
                ) : (
                    <button 
                        onClick={handleOpen}
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50 transition-colors"
                        title={onOpen ? "Open Reader" : "Open Editor"}
                    >
                        <Icon name={onOpen ? "BOOK" : "EDIT"} className="w-4 h-4" />
                    </button>
                )}
            </div>
        </div>
    );
};

export default BookCard;