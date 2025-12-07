
import React, { useState, useEffect, useRef, useCallback, useContext, useLayoutEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { db } from '../services/db';
import { Book, ReadingProgress, ReaderSettings, ChapterOutline, Bookmark } from '../types';
import Loader from '../components/Loader';
import Icon from '../components/Icon';
import { AppContext } from '../contexts/AppContext';
import { manualTriggerBackup } from '../services/backupService';
import ReaderSearchModal, { SearchResult } from '../components/ReaderSearchModal';
import BookmarkManagerModal from '../components/BookmarkManagerModal';
import { toastService } from '../services/toastService';

const DEFAULT_SETTINGS: ReaderSettings = {
    theme: 'light',
    fontFamily: 'literata',
    fontSize: 18,
    lineHeight: 1.6,
    paragraphSpacing: 1.5,
    textIndent: 1.5,
    viewMode: 'scroll',
    maxWidth: '700px',
    textAlign: 'justify',
    paddingX: 2,
};

export const READER_CONTENT_SELECTORS = 'p, h1, h2, h3, h4, h5, h6, li, blockquote, pre, img';

interface ReaderProps {
    bookId: string;
}

const Reader: React.FC<ReaderProps> = ({ bookId }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const backPath = (location.state as any)?.from || '/';

    const { 
        audiobookState,
        playAudiobook,
    } = useContext(AppContext);

    const [book, setBook] = useState<Book | null>(null);
    const [settings, setSettings] = useState<ReaderSettings>(DEFAULT_SETTINGS);
    const [isLoading, setIsLoading] = useState(true);
    const [isRestoringPosition, setIsRestoringPosition] = useState(true);
    
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isTocOpen, setIsTocOpen] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isBookmarkModalOpen, setIsBookmarkModalOpen] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [currentPage, setCurrentPage] = useState(0);
    const totalPages = useRef(0);
    const [progressPercent, setProgressPercent] = useState(0);
    const [timeRemaining, setTimeRemaining] = useState<string>('');
    const [currentTime, setCurrentTime] = useState<string>('');
    const [activeChapterIndex, setActiveChapterIndex] = useState(0);
    
    const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
    const [currentLocationInfo, setCurrentLocationInfo] = useState<{ chapterIndex: number, elementIndex: number, text: string } | null>(null);

    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

    const contentRef = useRef<HTMLDivElement>(null);
    const pageContentWrapperRef = useRef<HTMLDivElement>(null);
    const lastScrollY = useRef(0);
    const latestProgressRef = useRef<ReadingProgress | null>(null);
    const hasRestoredRef = useRef(false);
    const chapterRefs = useRef<Map<number, HTMLDivElement>>(new Map());
    
    // Anchor tracking for robust position maintenance
    const anchorRef = useRef<{ chapterIndex: number, elementIndex: number, offset: number } | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const [bookData, settingsData, progressData] = await Promise.all([
                    db.books.get(bookId),
                    db.settings.get('readerSettings'),
                    db.readingProgress.get(bookId)
                ]);

                if (bookData) {
                    setBook(bookData);
                    if (settingsData) {
                        setSettings({ ...DEFAULT_SETTINGS, ...settingsData.value });
                    }
                    if (progressData) {
                        latestProgressRef.current = progressData;
                        if (progressData.scroll !== undefined) {
                            lastScrollY.current = progressData.scroll;
                        }
                        if (progressData.paginate !== undefined) {
                            setCurrentPage(progressData.paginate);
                        }
                        if (progressData.percentage !== undefined) {
                            setProgressPercent(progressData.percentage);
                        }
                        if (progressData.chapterIndex !== undefined) {
                            setActiveChapterIndex(progressData.chapterIndex);
                        }
                        
                        if (progressData.bookmarks) {
                            setBookmarks(progressData.bookmarks);
                        } else if (progressData.bookmark) {
                            const legacy = progressData.bookmark;
                            const newBookmark: Bookmark = {
                                id: crypto.randomUUID(),
                                chapterIndex: legacy.chapterIndex,
                                elementIndex: legacy.elementIndex,
                                title: `Chapter ${legacy.chapterIndex + 1}`,
                                previewText: legacy.previewText || 'Bookmarked location',
                                timestamp: legacy.timestamp
                            };
                            setBookmarks([newBookmark]);
                        }
                    } else {
                        setIsRestoringPosition(false);
                    }
                } else {
                    navigate('/');
                }
            } catch (e) {
                console.error("Failed to load reader data", e);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [bookId, navigate]);

    useEffect(() => {
        const updateTime = () => {
            const now = new Date();
            setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        };
        updateTime();
        const interval = setInterval(updateTime, 60000);
        return () => clearInterval(interval);
    }, []);

    const calculateReadingTime = (text: string) => {
        const wordsPerMinute = 250;
        const words = text.trim().split(/\s+/).length;
        const minutes = Math.ceil(words / wordsPerMinute);
        return minutes;
    };

    // 1. Update Anchor: Finds the specific element currently at the top of the viewport
    const updateAnchor = useCallback(() => {
        if (settings.viewMode !== 'scroll' || chapterRefs.current.size === 0) return;

        const headerHeight = 60; // Approximate header/padding top
        const viewportHeight = window.innerHeight;
        
        // Only scan visible chapters for performance
        for (const [index, chapterEl] of chapterRefs.current.entries()) {
            const rect = chapterEl.getBoundingClientRect();
            
            if (rect.bottom > headerHeight && rect.top < viewportHeight) {
                const contentBody = chapterEl.querySelector('.chapter-body');
                if (!contentBody) continue;

                const elements = contentBody.querySelectorAll(READER_CONTENT_SELECTORS);
                
                for (let i = 0; i < elements.length; i++) {
                    const el = elements[i];
                    const elRect = el.getBoundingClientRect();
                    
                    // Find the first element that starts below the header or spans across the header line
                    if (elRect.bottom >= headerHeight) {
                        // Calculate exact offset from the header line
                        const offset = elRect.top - headerHeight;
                        
                        anchorRef.current = {
                            chapterIndex: index,
                            elementIndex: i,
                            offset: offset
                        };
                        
                        // Also update current location info for display
                        setCurrentLocationInfo({
                            chapterIndex: index,
                            elementIndex: i,
                            text: el.textContent?.substring(0, 80) || `Chapter ${index + 1}`
                        });
                        return;
                    }
                }
                
                // Fallback if chapter is visible but no content elements matched (rare)
                if (elements.length > 0) {
                    anchorRef.current = { chapterIndex: index, elementIndex: 0, offset: 0 };
                }
            }
        }
    }, [settings.viewMode]);

    // 2. Restore Position: Scrolls to the anchored element with the exact visual offset
    const restoreAnchorPosition = useCallback(() => {
        if (!anchorRef.current || settings.viewMode !== 'scroll' || !contentRef.current) return;
        
        const { chapterIndex, elementIndex, offset } = anchorRef.current;
        const chapterEl = chapterRefs.current.get(chapterIndex);
        
        if (chapterEl) {
             const contentBody = chapterEl.querySelector('.chapter-body');
             if (contentBody) {
                 const elements = contentBody.querySelectorAll(READER_CONTENT_SELECTORS);
                 const el = elements[elementIndex];
                 if (el) {
                     // Current position of the target element relative to viewport
                     const currentRect = el.getBoundingClientRect();
                     const headerHeight = 60;
                     
                     // We want elRect.top to be (headerHeight + offset)
                     const desiredTop = headerHeight + offset;
                     const diff = currentRect.top - desiredTop;
                     
                     if (Math.abs(diff) > 1) {
                         // Adjust container scroll to compensate
                         contentRef.current.scrollTop += diff;
                     }
                 }
             }
        }
    }, [settings.viewMode]);

    const calculateProgress = useCallback(() => {
        let percent = 0;
        if (settings.viewMode === 'scroll') {
            if (!contentRef.current) return;
            const { scrollTop, scrollHeight, clientHeight } = contentRef.current;
            if (scrollHeight > clientHeight) {
                percent = Math.min(100, Math.round((scrollTop / (scrollHeight - clientHeight)) * 100));
            } else {
                percent = scrollHeight > 0 ? 100 : 0;
            }
        } else {
            percent = Math.min(100, Math.round(((currentPage + 1) / Math.max(1, totalPages.current)) * 100));
        }
        setProgressPercent(percent);

        if (settings.viewMode === 'scroll') {
            let currentIdx = activeChapterIndex;
            chapterRefs.current.forEach((el, idx) => {
                const rect = el.getBoundingClientRect();
                if (rect.top < window.innerHeight / 2 && rect.bottom > 0) {
                    currentIdx = idx;
                }
            });
            if (currentIdx !== activeChapterIndex) {
                setActiveChapterIndex(currentIdx);
            }
        }

        if (book) {
            const totalWords = book.content.reduce((acc, c) => acc + (c.htmlContent.length / 6), 0);
            const wordsLeft = totalWords * ((100 - percent) / 100);
            const minutesLeft = Math.ceil(wordsLeft / 250);
            if (minutesLeft > 60) {
                setTimeRemaining(`${Math.floor(minutesLeft / 60)}h ${minutesLeft % 60}m left`);
            } else {
                setTimeRemaining(`${minutesLeft} min left`);
            }
        }
    }, [settings.viewMode, currentPage, book, activeChapterIndex]);

    const saveProgress = useCallback((overrideScroll?: number, overridePage?: number) => {
        if (!bookId) return;
        
        const currentProgress = latestProgressRef.current || { bookId, updatedAt: Date.now(), percentage: 0, bookmarks: [] };
        const newProgress: ReadingProgress = {
            ...currentProgress,
            bookId,
            updatedAt: Date.now(),
            bookmarks
        };
        
        let calculatedPercent = currentProgress.percentage || 0;

        if (settings.viewMode === 'scroll') {
            const scrollTop = overrideScroll ?? (contentRef.current ? contentRef.current.scrollTop : (currentProgress.scroll || 0));
            newProgress.scroll = scrollTop;
            
            if (anchorRef.current) {
                newProgress.chapterIndex = anchorRef.current.chapterIndex;
                newProgress.elementIndex = anchorRef.current.elementIndex;
            }

            if (contentRef.current && contentRef.current.clientHeight > 0) {
                const { scrollHeight, clientHeight } = contentRef.current;
                if (scrollHeight > clientHeight) {
                    calculatedPercent = Math.min(100, Math.round((scrollTop / (scrollHeight - clientHeight)) * 100));
                } else {
                    calculatedPercent = 100;
                }
            }
        } else {
            const page = overridePage ?? currentPage;
            newProgress.paginate = page;
            if (totalPages.current > 0) {
                calculatedPercent = Math.min(100, Math.round(((page + 1) / Math.max(1, totalPages.current)) * 100));
            }
        }
        
        newProgress.percentage = isNaN(calculatedPercent) ? 0 : calculatedPercent;
        
        latestProgressRef.current = newProgress;
        db.readingProgress.put(newProgress).catch(console.warn);
        
        if (overrideScroll === undefined) {
            setProgressPercent(newProgress.percentage);
        }
    }, [bookId, settings.viewMode, currentPage, bookmarks]);

    const handleAddBookmark = (note: string) => {
        // Use anchor for bookmark position if available, else fallback
        const chapterIndex = anchorRef.current?.chapterIndex ?? activeChapterIndex;
        const elementIndex = anchorRef.current?.elementIndex ?? 0;
        const text = currentLocationInfo?.text || `Chapter ${chapterIndex + 1}`;

        const newBookmark: Bookmark = {
            id: crypto.randomUUID(),
            chapterIndex,
            elementIndex,
            title: book?.content[chapterIndex]?.title || `Chapter ${chapterIndex + 1}`,
            previewText: text,
            timestamp: Date.now(),
            note
        };

        const newBookmarks = [...bookmarks, newBookmark];
        setBookmarks(newBookmarks);
        
        if (latestProgressRef.current) {
            const updated = { ...latestProgressRef.current, bookmarks: newBookmarks };
            latestProgressRef.current = updated;
            db.readingProgress.put(updated);
        }
        toastService.success("Bookmark added");
    };

    const handleDeleteBookmark = (bookmark: Bookmark) => {
        const newBookmarks = bookmarks.filter(b => b.id !== bookmark.id);
        setBookmarks(newBookmarks);
        if (latestProgressRef.current) {
            const updated = { ...latestProgressRef.current, bookmarks: newBookmarks };
            latestProgressRef.current = updated;
            db.readingProgress.put(updated);
        }
        toastService.info("Bookmark removed");
    };

    const handleGoToBookmark = (bookmark: Bookmark) => {
        scrollToElement(bookmark.chapterIndex, bookmark.elementIndex, 'auto');
        toastService.info("Jumped to bookmark");
    };

    const scrollToElement = (chapterIndex: number, elementIndex: number, behavior: ScrollBehavior = 'smooth', highlight: boolean = true): boolean => {
        const chapterEl = chapterRefs.current.get(chapterIndex);
        if (chapterEl) {
            const contentBody = chapterEl.querySelector('.chapter-body');
            if (!contentBody) return false;

            const elements = contentBody.querySelectorAll(READER_CONTENT_SELECTORS);
            const targetElement = elements[elementIndex];
            
            if (targetElement) {
                targetElement.scrollIntoView({ block: 'center', behavior });
                
                // Manually update anchor so we stay here if resized immediately
                anchorRef.current = { chapterIndex, elementIndex, offset: 0 }; 

                if (highlight) {
                    targetElement.classList.add('bg-yellow-100', 'dark:bg-yellow-900/50', 'transition-colors', 'duration-1000');
                    setTimeout(() => {
                        targetElement.classList.remove('bg-yellow-100', 'dark:bg-yellow-900/50');
                    }, 2000);
                }

                setShowControls(true);
                return true;
            }
        }
        const el = chapterRefs.current.get(chapterIndex);
        if (el) {
            el.scrollIntoView({ behavior, block: 'start' });
            setShowControls(true);
            return true;
        }
        return false;
    };

    // Restore Position on Initial Load
    useLayoutEffect(() => {
        if (isLoading || !book) return;
        
        if (hasRestoredRef.current) {
            if (isRestoringPosition) setIsRestoringPosition(false);
            return;
        }
        
        if (!latestProgressRef.current) {
            setIsRestoringPosition(false);
            return;
        }

        const restore = () => {
            const progress = latestProgressRef.current!;
            
            if (settings.viewMode === 'scroll' && contentRef.current) {
                if ('scrollRestoration' in window.history) {
                    window.history.scrollRestoration = 'manual';
                }

                let restored = false;

                if (typeof progress.chapterIndex === 'number' && typeof progress.elementIndex === 'number') {
                    // Prioritize structural restoration using element index
                    restored = scrollToElement(progress.chapterIndex, progress.elementIndex, 'auto', false);
                    // Immediately establish anchor after jump
                    if(restored) updateAnchor(); 
                }

                if (!restored && typeof progress.scroll === 'number' && progress.scroll > 0) {
                     contentRef.current.scrollTop = progress.scroll;
                     lastScrollY.current = progress.scroll;
                     updateAnchor();
                }

            } else if (settings.viewMode === 'paginate' && pageContentWrapperRef.current && typeof progress.paginate === 'number') {
                const page = progress.paginate;
                setCurrentPage(page);
                if(pageContentWrapperRef.current) {
                    pageContentWrapperRef.current.scrollLeft = page * pageContentWrapperRef.current.clientWidth;
                }
            }
            
            calculateProgress();
            
            requestAnimationFrame(() => {
                setIsRestoringPosition(false);
                hasRestoredRef.current = true;
            });
        };

        restore();
        
    }, [isLoading, book, settings.viewMode, calculateProgress, isRestoringPosition, updateAnchor]);

    // Scroll Handling
    useEffect(() => {
        const element = contentRef.current;
        if (!element || settings.viewMode !== 'scroll') return;

        let timeoutId: any;
        const handleScroll = () => {
            if (isRestoringPosition) return;

            const currentScrollY = element.scrollTop;
            const lastControlScroll = parseFloat(element.dataset.lastControlScroll || '0');
            const diff = currentScrollY - lastControlScroll;

            if (Math.abs(diff) > 400) { 
                if (currentScrollY > 50 && diff > 0) {
                    setShowControls(false);
                } else if (diff < 0) {
                    setShowControls(true);
                }
                element.dataset.lastControlScroll = currentScrollY.toString();
            }

            lastScrollY.current = currentScrollY;
            
            // Crucial: Update anchor continuously during scroll interaction
            updateAnchor();

            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => saveProgress(currentScrollY), 1000);
            
            calculateProgress();
        };

        element.addEventListener('scroll', handleScroll);
        return () => {
            element.removeEventListener('scroll', handleScroll);
            clearTimeout(timeoutId);
            if (!isRestoringPosition) {
                saveProgress(lastScrollY.current);
            }
        };
    }, [settings.viewMode, saveProgress, calculateProgress, isRestoringPosition, updateAnchor]);

    // React to Layout Changes (Font size, line height, width, padding)
    // useLayoutEffect is key here: it runs synchronously after DOM updates but before paint.
    // This allows us to adjust scroll position "instantly" so the user doesn't see a jump.
    useLayoutEffect(() => {
        if (settings.viewMode === 'scroll' && !isRestoringPosition) {
            restoreAnchorPosition();
        }
    }, [
        settings.fontSize, 
        settings.lineHeight, 
        settings.fontFamily, 
        settings.maxWidth, 
        settings.paddingX, 
        settings.paragraphSpacing, 
        settings.viewMode, 
        restoreAnchorPosition, 
        isRestoringPosition
    ]);

    // ResizeObserver to handle window resizing and orientation changes
    useEffect(() => {
         if (!contentRef.current) return;
         const ro = new ResizeObserver(() => {
              if (settings.viewMode === 'scroll' && !isRestoringPosition) {
                  // When window resizes, text reflows. We must restore anchor to keep reading position.
                  restoreAnchorPosition();
              } else if (settings.viewMode === 'paginate' && pageContentWrapperRef.current) {
                   const container = pageContentWrapperRef.current;
                   const newTotalPages = Math.ceil(container.scrollWidth / container.clientWidth);
                   totalPages.current = newTotalPages;
                   if (currentPage >= newTotalPages) setCurrentPage(newTotalPages - 1);
                   container.scrollTo({ left: currentPage * container.clientWidth });
              }
         });
         ro.observe(contentRef.current);
         return () => ro.disconnect();
    }, [settings.viewMode, restoreAnchorPosition, isRestoringPosition, currentPage]);


    const handleSettingsChange = <K extends keyof ReaderSettings>(key: K, value: ReaderSettings[K]) => {
        // Before changing settings, make sure our anchor is up to date with current view
        if (settings.viewMode === 'scroll') updateAnchor();

        if (key === 'viewMode') {
            saveProgress(lastScrollY.current);
            hasRestoredRef.current = false;
        }
        const newSettings = { ...settings, [key]: value };
        setSettings(newSettings);
        db.settings.put({ id: 'readerSettings', value: newSettings });
    };

    const handleResetSettings = () => {
        setSettings(DEFAULT_SETTINGS);
        db.settings.put({ id: 'readerSettings', value: DEFAULT_SETTINGS });
    };

    const handlePageTurn = (direction: 'next' | 'prev') => {
        if (!pageContentWrapperRef.current) return;
        const container = pageContentWrapperRef.current;
        const newPage = direction === 'next' 
            ? Math.min(currentPage + 1, totalPages.current - 1) 
            : Math.max(currentPage - 1, 0);
        
        setCurrentPage(newPage);
        saveProgress(undefined, newPage);
        
        container.scrollTo({
            left: newPage * container.clientWidth,
            behavior: 'smooth'
        });
    };

    const scrollPage = (direction: 'up' | 'down') => {
        if (!contentRef.current) return;
        const amount = window.innerHeight * 0.8;
        contentRef.current.scrollBy({
            top: direction === 'down' ? amount : -amount,
            behavior: 'smooth'
        });
    };

    const handleNavigation = (chapterIndex: number, elementIndex?: number, behavior: ScrollBehavior = 'smooth') => {
        setIsTocOpen(false);
        if (settings.viewMode === 'paginate') {
            handleSettingsChange('viewMode', 'scroll');
            setTimeout(() => {
                scrollToElement(chapterIndex, elementIndex ?? 0, behavior);
            }, 100);
        } else {
            scrollToElement(chapterIndex, elementIndex ?? 0, behavior);
        }
    };

    const handleZoneClick = (e: React.MouseEvent) => {
        const width = window.innerWidth;
        const x = e.clientX;
        if (x > width * 0.25 && x < width * 0.75) {
            setShowControls(!showControls);
        } else if (x <= width * 0.25) {
            if (settings.viewMode === 'paginate') handlePageTurn('prev');
            else scrollPage('up');
        } else {
            if (settings.viewMode === 'paginate') handlePageTurn('next');
            else scrollPage('down');
        }
    };

    const getThemeClasses = () => {
        switch (settings.theme) {
            case 'dark': return 'bg-zinc-900 text-zinc-300';
            case 'sepia': return 'bg-[#f4ecd8] text-[#5b4636]';
            case 'high-contrast': return 'bg-black text-white';
            default: return 'bg-white text-zinc-800';
        }
    };

    const getThemeBackgroundColor = () => {
         switch (settings.theme) {
            case 'dark': return 'bg-zinc-900';
            case 'sepia': return 'bg-[#f4ecd8]';
            case 'high-contrast': return 'bg-black';
            default: return 'bg-white';
        }
    };

    const getFontFamily = () => {
        switch (settings.fontFamily) {
            case 'merriweather': return '"Merriweather", serif';
            case 'inter': return '"Inter", sans-serif';
            case 'roboto-mono': return '"Roboto Mono", monospace';
            case 'literata': default: return '"Literata", serif';
        }
    };

    const contentStyles: React.CSSProperties = {
        fontFamily: getFontFamily(),
        fontSize: `${settings.fontSize}px`,
        lineHeight: settings.lineHeight,
        maxWidth: settings.maxWidth,
        margin: '0 auto',
        paddingLeft: `${settings.paddingX}rem`,
        paddingRight: `${settings.paddingX}rem`,
        // Padding top to clear the notch when scrolled to top, but scrollable
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
    };

    const paragraphStyles = `
        .reader-content p {
            margin-bottom: ${settings.paragraphSpacing}em;
            text-indent: ${settings.textIndent}em;
            text-align: ${settings.textAlign || 'justify'};
        }
        .reader-content h1, .reader-content h2, .reader-content h3 {
            text-indent: 0;
            margin-top: 2em;
            margin-bottom: 1em;
            font-family: "Inter", sans-serif;
            font-weight: 700;
            text-align: left;
        }
        .reader-content img {
            max-width: 100%;
            height: auto;
            border-radius: 0.5rem;
            margin: 1.5rem auto;
            display: block;
        }
        .reader-content code {
            white-space: pre-wrap;
            word-break: break-word;
        }
        .reader-theme-high-contrast .reader-content a {
            color: #ffff00; text-decoration: underline;
        }
    `;

    const getChapterMeta = (index: number) => {
        if (!book || !book.content[index]) return null;
        const text = book.content[index].htmlContent.replace(/<[^>]*>/g, '');
        const minutes = calculateReadingTime(text);
        return `${minutes} min`;
    };

    if (isLoading) return <Loader message="Opening book..." />;
    if (!book) return null;

    const renderFullContent = () => {
        let lastPart = '';
        return book.content.map((chapter, index) => {
            if (!chapter) return null;
            const outline = book.outline[index];
            const showPartHeader = outline?.part && outline.part !== lastPart;
            if (showPartHeader) lastPart = outline.part!;

            return (
                <div 
                    key={index} 
                    ref={el => { if(el) chapterRefs.current.set(index, el); }} 
                    className="chapter-container mb-20"
                >
                    {showPartHeader && (
                        <div className="part-header text-center my-20">
                            <h1 className="text-3xl font-bold opacity-60 mb-4">{outline.part}</h1>
                            {outline.partContent && <p className="italic opacity-80 max-w-md mx-auto">{outline.partContent}</p>}
                        </div>
                    )}
                    <div className="chapter-title mb-8">
                        <h2 className="text-2xl font-bold">{chapter.title}</h2>
                    </div>
                    <div 
                        className="chapter-body" 
                        dangerouslySetInnerHTML={{ __html: chapter.htmlContent }} 
                    />
                </div>
            );
        });
    };

    return (
        <>
            <style>{paragraphStyles}</style>
            {isSearchOpen && (
                <ReaderSearchModal 
                    isOpen={isSearchOpen} 
                    onClose={() => setIsSearchOpen(false)} 
                    book={book}
                    onNavigate={handleNavigation}
                    query={searchQuery}
                    setQuery={setSearchQuery}
                    results={searchResults}
                    setResults={setSearchResults}
                />
            )}
            <BookmarkManagerModal
                isOpen={isBookmarkModalOpen}
                onClose={() => setIsBookmarkModalOpen(false)}
                bookmarks={bookmarks}
                onGoTo={handleGoToBookmark}
                onDelete={handleDeleteBookmark}
                onAdd={handleAddBookmark}
                currentLocationText={currentLocationInfo?.text}
            />

            <div className={`fixed inset-0 h-full w-full overflow-hidden flex flex-col transition-colors duration-300 ${getThemeClasses()} ${!showControls ? 'cursor-none' : ''}`}>
                
                {/* Safe Area Background Guards - These ensure notch areas are always covered by the theme background, regardless of scroll/UI state */}
                <div className={`fixed top-0 left-0 right-0 h-[env(safe-area-inset-top)] z-40 ${getThemeBackgroundColor()}`}></div>
                <div className={`fixed bottom-0 left-0 right-0 h-[env(safe-area-inset-bottom)] z-40 ${getThemeBackgroundColor()}`}></div>

                <header className={`fixed top-0 left-0 right-0 z-50 transition-transform duration-300 ${showControls ? 'translate-y-0' : '-translate-y-full'}`}>
                    <div className={`backdrop-blur-md border-b shadow-sm px-4 h-14 flex items-center justify-between mt-[env(safe-area-inset-top)] ${
                        settings.theme === 'dark' || settings.theme === 'high-contrast' ? 'bg-zinc-900/90 border-zinc-800' : 
                        settings.theme === 'sepia' ? 'bg-[#f4ecd8]/90 border-[#e3dcc8]' : 'bg-white/90 border-zinc-200'
                    }`}>
                        <div className="flex items-center space-x-1">
                            <button onClick={() => navigate(backPath)} className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors">
                                <Icon name="CHEVRON_LEFT" className="w-5 h-5" />
                            </button>
                            <button onClick={() => setIsTocOpen(true)} className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors" title="Table of Contents">
                                <Icon name="MENU" className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex-1 text-center mx-4 truncate opacity-90 font-medium text-sm">
                            {book.topic}
                        </div>
                        <div className="flex items-center space-x-1">
                            <button onClick={() => setIsBookmarkModalOpen(true)} className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors" title="Bookmarks">
                                <Icon name="HIGHLIGHT" className="w-5 h-5" />
                            </button>
                            <button onClick={() => setIsSearchOpen(true)} className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors" title="Search">
                                <Icon name="SEARCH" className="w-5 h-5" />
                            </button>
                            <button onClick={() => playAudiobook(bookId, 0)} className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors hidden sm:block" title="Play Audiobook">
                                <Icon name="HEADPHONES" className="w-5 h-5" />
                            </button>
                            <button onClick={() => setIsMenuOpen(true)} className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors" title="Reader Settings">
                                <Icon name="SETTINGS" className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </header>

                <main className={`flex-grow relative h-full w-full overflow-hidden ${isRestoringPosition ? 'opacity-0' : 'opacity-100'}`} onClick={handleZoneClick}>
                    {settings.viewMode === 'scroll' ? (
                        <div ref={contentRef} className={`h-full w-full overflow-y-auto px-4 pt-20 pb-20 ${isRestoringPosition ? '' : 'scroll-smooth'}`}>
                            <div className="reader-content transition-all duration-300" style={contentStyles}>
                                {renderFullContent()}
                                <div className="text-center py-20 opacity-50">
                                    <Icon name="BOOK" className="w-8 h-8 mx-auto mb-2"/>
                                    <p>End of Book</p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div ref={pageContentWrapperRef} className="h-full w-full overflow-x-hidden">
                            <div className="h-full flex transition-transform duration-300 ease-out" style={{ width: `${Math.max(100, totalPages.current * 100)}%`, transform: `translateX(-${(currentPage / Math.max(1, totalPages.current)) * 100}%)` }}>
                                <div className="reader-content h-full w-full px-8 py-16 pt-20" style={{ ...contentStyles, columnWidth: 'calc(100vw - 4rem)', columnGap: '4rem', height: '100vh', width: 'auto', maxWidth: 'none' }}>
                                    {renderFullContent()}
                                </div>
                            </div>
                        </div>
                    )}
                </main>

                <footer className={`fixed bottom-0 left-0 right-0 z-50 transition-transform duration-300 pointer-events-none pb-[env(safe-area-inset-bottom)] ${showControls ? 'translate-y-0' : 'translate-y-full'}`}>
                    <div className={`backdrop-blur-md border-t px-6 py-3 flex justify-between items-center text-xs font-medium opacity-90 ${settings.theme === 'dark' || settings.theme === 'high-contrast' ? 'bg-zinc-900/90 border-zinc-800' : settings.theme === 'sepia' ? 'bg-[#f4ecd8]/90 border-[#e3dcc8]' : 'bg-white/90 border-zinc-200'}`}>
                        <div className="flex items-center space-x-4">
                            <span>{progressPercent}% Completed</span>
                            <span className="opacity-60">|</span>
                            <span className="font-bold opacity-80">{currentTime}</span>
                        </div>
                        <span>{timeRemaining}</span>
                    </div>
                    <div className="h-1 w-full bg-black/10 dark:bg-white/10">
                        <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${progressPercent}%` }} />
                    </div>
                </footer>
                
                {/* Menus (TOC, Settings) rendered here - omitted for brevity but present in full file */}
                {isTocOpen && (
                    <div className="fixed inset-0 z-50 flex">
                        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsTocOpen(false)} />
                        <div className={`relative w-80 max-w-[80vw] shadow-2xl flex flex-col animate-slide-in-left ${settings.theme === 'dark' ? 'bg-zinc-900 text-zinc-200' : 'bg-white text-zinc-800'}`}>
                            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center pt-[calc(1rem+env(safe-area-inset-top))]">
                                <h2 className="font-bold text-lg">Contents</h2>
                                <button onClick={() => setIsTocOpen(false)}><Icon name="CLOSE" className="w-5 h-5" /></button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-2">
                                {book.outline.map((chapter, i) => (
                                    <button key={i} onClick={() => handleNavigation(i)} className={`w-full text-left p-3 rounded-lg transition-colors text-sm flex items-center justify-between group ${activeChapterIndex === i ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-semibold' : 'hover:bg-black/5 dark:hover:bg-white/10'}`}>
                                        <div className="flex items-center overflow-hidden">
                                            <span className="opacity-50 w-8 font-mono text-xs flex-shrink-0">{i + 1}</span>
                                            <span className="font-medium truncate">{chapter.title}</span>
                                        </div>
                                        <span className="text-xs opacity-50 flex-shrink-0 ml-2 whitespace-nowrap">{getChapterMeta(i)}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {isMenuOpen && (
                    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pointer-events-none">
                        <div className="absolute inset-0 bg-black/20 backdrop-blur-sm pointer-events-auto" onClick={() => setIsMenuOpen(false)} />
                        <div className={`pointer-events-auto w-full sm:w-[480px] max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl shadow-2xl p-6 animate-slide-in-up ${settings.theme === 'dark' ? 'bg-zinc-900 text-zinc-200' : 'bg-white text-zinc-800'}`}>
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold">Display Settings</h2>
                                <button onClick={() => setIsMenuOpen(false)} className="p-1 bg-black/5 dark:bg-white/10 rounded-full"><Icon name="CLOSE" className="w-5 h-5" /></button>
                            </div>
                            {/* Theme */}
                            <div className="space-y-3 mb-6">
                                <label className="text-xs font-bold uppercase opacity-60 tracking-wider">Theme</label>
                                <div className="grid grid-cols-4 gap-3">
                                    {[
                                        { id: 'light', label: 'Light', bg: 'bg-white', border: 'border-zinc-200' },
                                        { id: 'sepia', label: 'Sepia', bg: 'bg-[#f4ecd8]', border: 'border-[#e3dcc8]' },
                                        { id: 'dark', label: 'Dark', bg: 'bg-zinc-900', border: 'border-zinc-700' },
                                        { id: 'high-contrast', label: 'OLED', bg: 'bg-black', border: 'border-zinc-800' }
                                    ].map(t => (
                                        <button key={t.id} onClick={() => handleSettingsChange('theme', t.id as any)} className={`h-16 rounded-xl border-2 flex flex-col items-center justify-center space-y-1 transition-all ${t.bg} ${t.border} ${settings.theme === t.id ? 'ring-2 ring-indigo-500 border-transparent' : ''}`}>
                                            <span className={`text-xs font-medium ${t.id === 'light' || t.id === 'sepia' ? 'text-zinc-900' : 'text-white'}`}>Aa</span>
                                            <span className={`text-[10px] ${t.id === 'light' || t.id === 'sepia' ? 'text-zinc-500' : 'text-zinc-400'}`}>{t.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {/* Fonts */}
                            <div className="space-y-3 mb-6">
                                <label className="text-xs font-bold uppercase opacity-60 tracking-wider">Font</label>
                                <div className="grid grid-cols-2 gap-3">
                                    {[
                                        { id: 'literata', label: 'Literata', font: 'font-serif' },
                                        { id: 'merriweather', label: 'Merriweather', font: 'font-serif' },
                                        { id: 'inter', label: 'Inter', font: 'font-sans' },
                                        { id: 'roboto-mono', label: 'Mono', font: 'font-mono' }
                                    ].map(f => (
                                        <button key={f.id} onClick={() => handleSettingsChange('fontFamily', f.id as any)} className={`p-3 rounded-lg border text-left transition-all ${f.font} ${settings.fontFamily === f.id ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400' : 'border-zinc-200 dark:border-zinc-700 hover:bg-black/5 dark:hover:bg-white/5'}`}>
                                            {f.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {/* Typography Controls */}
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm"><span>Font Size</span><span className="opacity-60">{settings.fontSize}px</span></div>
                                    <input type="range" min="14" max="32" step="1" value={settings.fontSize} onChange={e => handleSettingsChange('fontSize', parseInt(e.target.value))} className="w-full accent-indigo-600"/>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm"><span>Line Height</span><span className="opacity-60">{settings.lineHeight}</span></div>
                                    <input type="range" min="1.2" max="2.2" step="0.1" value={settings.lineHeight} onChange={e => handleSettingsChange('lineHeight', parseFloat(e.target.value))} className="w-full accent-indigo-600"/>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm"><span>Paragraph Spacing</span><span className="opacity-60">{settings.paragraphSpacing}em</span></div>
                                    <input type="range" min="0.5" max="3" step="0.1" value={settings.paragraphSpacing} onChange={e => handleSettingsChange('paragraphSpacing', parseFloat(e.target.value))} className="w-full accent-indigo-600"/>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm"><span>Text Indent</span><span className="opacity-60">{settings.textIndent}em</span></div>
                                    <input type="range" min="0" max="4" step="0.5" value={settings.textIndent} onChange={e => handleSettingsChange('textIndent', parseFloat(e.target.value))} className="w-full accent-indigo-600"/>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm"><span>Side Padding</span><span className="opacity-60">{settings.paddingX}rem</span></div>
                                    <input type="range" min="0" max="10" step="0.5" value={settings.paddingX} onChange={e => handleSettingsChange('paddingX', parseFloat(e.target.value))} className="w-full accent-indigo-600"/>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm"><span>Alignment</span></div>
                                    <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1 border border-zinc-200 dark:border-zinc-700">
                                        <button onClick={() => handleSettingsChange('textAlign', 'left')} className={`flex-1 py-1.5 text-xs rounded-md transition-all ${settings.textAlign === 'left' ? 'bg-white dark:bg-zinc-700 shadow text-indigo-600 dark:text-indigo-300 font-semibold' : 'text-zinc-500'}`}>Left Align</button>
                                        <button onClick={() => handleSettingsChange('textAlign', 'justify')} className={`flex-1 py-1.5 text-xs rounded-md transition-all ${settings.textAlign === 'justify' ? 'bg-white dark:bg-zinc-700 shadow text-indigo-600 dark:text-indigo-300 font-semibold' : 'text-zinc-500'}`}>Justified</button>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm"><span>Max Width</span><span className="opacity-60">{settings.maxWidth}</span></div>
                                    <select value={settings.maxWidth} onChange={e => handleSettingsChange('maxWidth', e.target.value)} className="w-full p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm">
                                        <option value="600px">Narrow (600px)</option>
                                        <option value="700px">Standard (700px)</option>
                                        <option value="900px">Wide (900px)</option>
                                        <option value="100%">Full Width</option>
                                    </select>
                                </div>
                            </div>
                            {/* Advanced Toggles */}
                            <div className="mt-8 pt-6 border-t border-zinc-200 dark:border-zinc-700 space-y-6">
                                <div className="flex items-center justify-between">
                                    <div><p className="font-medium">Paginated View</p><p className="text-xs opacity-60">Read page by page instead of scrolling</p></div>
                                    <button onClick={() => handleSettingsChange('viewMode', settings.viewMode === 'scroll' ? 'paginate' : 'scroll')} className={`w-12 h-6 rounded-full transition-colors relative ${settings.viewMode === 'paginate' ? 'bg-indigo-600' : 'bg-zinc-300 dark:bg-zinc-600'}`}>
                                        <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${settings.viewMode === 'paginate' ? 'translate-x-6' : 'translate-x-0'}`} />
                                    </button>
                                </div>
                                <button onClick={handleResetSettings} className="w-full py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">Reset to Defaults</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};

export default Reader;