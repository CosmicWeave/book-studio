import React, { useContext, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AppContext } from '../contexts/AppContext';
import { db } from '../services/db';
import { Book, ReadingProgress } from '../types';
import ReadingBookCard from '../components/ReadingBookCard';
import Icon from '../components/Icon';
import Loader from '../components/Loader';

const CurrentlyReading: React.FC = () => {
    const { books } = useContext(AppContext);
    const navigate = useNavigate();
    const location = useLocation();
    const [readingItems, setReadingItems] = useState<{ book: Book; progress: ReadingProgress }[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchReadingProgress = async () => {
            try {
                setIsLoading(true);
                const progressData = await db.readingProgress.getAll();
                
                const bookMap = new Map<string, Book>();
                books.forEach(b => bookMap.set(b.id, b));

                const activeItems: { book: Book; progress: ReadingProgress }[] = [];

                progressData.forEach((p: ReadingProgress) => {
                    // Only show books that exist, have some progress, and are not 'complete' status unless explicitly kept in progress
                    if (bookMap.has(p.bookId)) {
                        const book = bookMap.get(p.bookId)!;
                        activeItems.push({
                            book,
                            progress: p
                        });
                    }
                });

                // Sort by most recently updated (read)
                activeItems.sort((a, b) => b.progress.updatedAt - a.progress.updatedAt);
                
                setReadingItems(activeItems);
            } catch (e) {
                console.error("Failed to fetch reading progress", e);
            } finally {
                setIsLoading(false);
            }
        };

        fetchReadingProgress();
    }, [books]);

    const heroItem = readingItems.length > 0 ? readingItems[0] : null;
    const otherItems = readingItems.length > 1 ? readingItems.slice(1) : [];

    const handleHeroClick = () => {
        if (heroItem) {
            navigate(`/reader/${heroItem.book.id}`, { state: { from: location.pathname } });
        }
    };

    if (isLoading) return <Loader message="Loading your library..." />;

    return (
        <div className="min-h-screen pb-12 bg-zinc-50 dark:bg-zinc-900">
            {/* Header Area */}
            <div className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 pt-8 pb-6 px-4 sm:px-6 lg:px-8 mb-8">
                <div className="max-w-7xl mx-auto">
                    <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-3">
                        <Icon name="BOOK" className="text-indigo-600 dark:text-indigo-400" />
                        Currently Reading
                    </h1>
                    <p className="mt-2 text-zinc-500 dark:text-zinc-400">Jump back into your stories.</p>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
                
                {/* Hero Section: Most Recent Read */}
                {heroItem ? (
                    <section className="animate-fade-in-up">
                        <div className="relative rounded-3xl overflow-hidden bg-zinc-900 shadow-2xl group cursor-pointer" onClick={handleHeroClick}>
                            
                            {/* Dynamic Background using Cover */}
                            <div className="absolute inset-0 opacity-40 dark:opacity-30 transition-opacity duration-700 group-hover:opacity-50">
                                {heroItem.book.coverImage ? (
                                    <img 
                                        src={heroItem.book.coverImage} 
                                        alt="" 
                                        className="w-full h-full object-cover blur-xl scale-110 transform transition-transform duration-[20s] group-hover:scale-125"
                                    />
                                ) : (
                                    <div className="w-full h-full bg-gradient-to-br from-indigo-900 to-purple-900" />
                                )}
                            </div>
                            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent" />

                            <div className="relative z-10 p-6 sm:p-10 md:p-12 flex flex-col md:flex-row items-start md:items-center gap-8">
                                {/* Hero Cover */}
                                <div className="flex-shrink-0 relative shadow-2xl rounded-lg overflow-hidden border border-white/10 w-32 sm:w-40 md:w-48 group-hover:-translate-y-2 transition-transform duration-500">
                                    {heroItem.book.coverImage ? (
                                        <img src={heroItem.book.coverImage} alt={heroItem.book.topic} className="w-full h-auto object-cover aspect-[2/3]" />
                                    ) : (
                                        <div className="w-full aspect-[2/3] bg-white/10 flex items-center justify-center backdrop-blur-sm">
                                            <Icon name="BOOK" className="w-12 h-12 text-white/50" />
                                        </div>
                                    )}
                                </div>

                                {/* Hero Content */}
                                <div className="flex-1 text-white space-y-4">
                                    <div className="inline-flex items-center space-x-2 bg-indigo-600/80 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border border-indigo-400/30">
                                        <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                                        <span>Pick up where you left off</span>
                                    </div>
                                    
                                    <div>
                                        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold leading-tight mb-2">{heroItem.book.topic}</h2>
                                        {heroItem.book.author && <p className="text-lg text-zinc-300 font-medium">{heroItem.book.author}</p>}
                                    </div>

                                    {/* Hero Progress */}
                                    <div className="max-w-md">
                                        <div className="flex justify-between text-sm font-medium text-zinc-300 mb-2">
                                            <span>{heroItem.progress.percentage || 0}% Complete</span>
                                            <span>Last read recently</span>
                                        </div>
                                        <div className="h-2 bg-white/10 rounded-full overflow-hidden backdrop-blur-sm">
                                            <div 
                                                className="h-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.6)]" 
                                                style={{ width: `${heroItem.progress.percentage || 0}%` }}
                                            />
                                        </div>
                                    </div>

                                    <div className="pt-4">
                                        <button className="bg-white text-zinc-900 px-8 py-3 rounded-xl font-bold shadow-lg hover:bg-indigo-50 transition-colors flex items-center space-x-2 transform active:scale-95">
                                            <Icon name="BOOK" className="w-5 h-5" />
                                            <span>Continue Reading</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>
                ) : (
                    // Empty State
                    <div className="text-center py-24 bg-white dark:bg-zinc-800 rounded-3xl border border-dashed border-zinc-300 dark:border-zinc-700">
                        <div className="w-20 h-20 bg-zinc-100 dark:bg-zinc-700/50 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Icon name="BOOK" className="w-10 h-10 text-zinc-400 dark:text-zinc-500" />
                        </div>
                        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">No active reads</h2>
                        <p className="text-zinc-500 dark:text-zinc-400 max-w-md mx-auto mb-8">
                            Looks like you haven't started reading any books yet. Head over to your library to begin your next adventure.
                        </p>
                        <button 
                            onClick={() => navigate('/')}
                            className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-colors shadow-md inline-flex items-center space-x-2"
                        >
                            <span>Go to Library</span>
                            <Icon name="CHEVRON_RIGHT" className="w-4 h-4" />
                        </button>
                    </div>
                )}

                {/* Other Items Grid */}
                {otherItems.length > 0 && (
                    <section className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
                        <div className="flex items-center space-x-4 mb-6">
                            <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">More in Progress</h2>
                            <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                            {otherItems.map(({ book, progress }) => (
                                <ReadingBookCard 
                                    key={book.id} 
                                    book={book} 
                                    progress={progress} 
                                    onOpen={() => navigate(`/reader/${book.id}`, { state: { from: location.pathname } })} 
                                />
                            ))}
                        </div>
                    </section>
                )}
            </div>
        </div>
    );
};

export default CurrentlyReading;