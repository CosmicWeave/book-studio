
import React, { createContext, useState, useEffect, useCallback, ReactNode, useMemo } from 'react';
import { Book, BookSnapshot, Macro, Series, AudiobookState, GeneralDoc, ChatMessage, SyncProvider } from '../types';
import { db } from '../services/db';
import { toastService } from '../services/toastService';
import { AudioPlayerService } from '../services/audioPlayerService';
import { produce } from 'immer';
import { isAiEnabled as checkAiEnabled } from '../services/gemini';

interface AppContextType {
    books: Book[];
    documents: GeneralDoc[];
    series: Series[];
    macros: Macro[];
    audiobookState: AudiobookState;
    isAiEnabled: boolean;
    syncProvider: SyncProvider;
    setSyncProvider: (provider: SyncProvider) => Promise<void>;
    createNewBook: (initialData?: Partial<Book>) => Promise<string>;
    deleteBook: (bookId: string) => Promise<void>;
    restoreBook: (bookId: string) => Promise<void>;
    archiveBook: (bookId: string) => Promise<void>;
    updateBook: (book: Book) => Promise<void>;
    fetchSnapshotsForBook: (bookId: string) => Promise<BookSnapshot[]>;
    createSnapshot: (book: Book, name: string) => Promise<void>;
    restoreSnapshot: (snapshot: BookSnapshot) => Promise<void>;
    deleteSnapshot: (snapshotId: string) => Promise<void>;
    createNewSeriesAndFirstBook: (seriesTitle: string, firstBookTitle: string) => Promise<string>;
    addBookToSeries: (bookId: string, seriesInfo: { seriesId?: string; newSeriesTitle?: string }) => Promise<void>;
    removeBookFromSeries: (bookId: string) => Promise<void>;
    reorderBooksInSeries: (seriesId: string, fromIndex: number, toIndex: number) => Promise<void>;
    updateSeries: (series: Series) => Promise<void>;
    createRelatedBook: (parentBook: Book, topic: string, relationType: 'sequel' | 'prequel', overrides?: Partial<Book>) => Promise<string>;
    playAudiobook: (bookId: string, startChapterIndex: number) => void;
    pauseAudiobook: () => void;
    resumeAudiobook: () => void;
    stopAudiobook: () => void;
    skipAudiobookChapter: (direction: 'next' | 'prev') => void;
    setPlaybackRate: (rate: number) => void;
    setAudiobookVolume: (volume: number) => void;
    jumpToParagraph: (paragraphIndex: number) => void;
    skipParagraph: (direction: 'next' | 'prev') => void;
    
    // Document methods
    createNewDocument: (initialTitle?: string) => Promise<string>;
    updateDocument: (doc: GeneralDoc) => Promise<void>;
    deleteDocument: (id: string) => Promise<void>;
}

export const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppContextProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [books, setBooks] = useState<Book[]>([]);
    const [documents, setDocuments] = useState<GeneralDoc[]>([]);
    const [series, setSeries] = useState<Series[]>([]);
    const [macros, setMacros] = useState<Macro[]>([]);
    const [syncProvider, setSyncProviderState] = useState<SyncProvider>('google_drive');
    const [audiobookState, setAudiobookState] = useState<AudiobookState>({
        playbackState: 'stopped', bookId: null, bookTitle: null, currentChapterIndex: -1, currentChapterTitle: null,
        currentParagraphIndex: -1, chapterProgress: 0, playbackRate: 1, totalParagraphsInChapter: 0,
    });
    
    const isAiEnabled = checkAiEnabled();
    
    const audioPlayerService = useMemo(() => new AudioPlayerService(setAudiobookState), []);

    const fetchData = useCallback(async () => {
        try {
            await db.init();
            const [booksData, seriesData, macrosData, docsData, providerSetting] = await Promise.all([
                db.books.getAll(),
                db.series.getAll(),
                db.macros.getAll(),
                db.documents.getAll(),
                db.settings.get('syncProvider')
            ]);
            setBooks(booksData.sort((a, b) => b.updatedAt - a.updatedAt));
            setSeries(seriesData);
            setMacros(macrosData);
            setDocuments(docsData.sort((a, b) => b.updatedAt - a.updatedAt));
            if (providerSetting) {
                setSyncProviderState(providerSetting.value);
            }
        } catch (e: any) {
            toastService.error(`Failed to load data: ${e.message}`);
        }
    }, []);

    useEffect(() => {
        fetchData();
        const handleVersionChange = () => {
            toastService.error("Database updated in another tab. Please reload.");
        };
        window.addEventListener('dbversionchange', handleVersionChange);
        return () => window.removeEventListener('dbversionchange', handleVersionChange);
    }, [fetchData]);

    const setSyncProvider = useCallback(async (provider: SyncProvider) => {
        await db.settings.put({ id: 'syncProvider', value: provider });
        setSyncProviderState(provider);
    }, []);

    const updateBook = useCallback(async (book: Book) => {
        await db.books.put({ ...book, updatedAt: Date.now() });
        await fetchData();
    }, [fetchData]);

    const createNewBook = useCallback(async (initialData: Partial<Book> = {}) => {
        const newBook: Book = {
            id: crypto.randomUUID(),
            topic: 'New Book',
            instructions: '',
            generateImages: false,
            imageGenerationInstructions: 'Photorealistic, cinematic lighting, epic fantasy',
            status: 'configuring',
            outline: [],
            content: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
            language: 'en',
            bookChatHistory: [],
            ...initialData
        };
        await db.books.put(newBook);
        await fetchData();
        return newBook.id;
    }, [fetchData]);
    
    const removeBookFromSeries = useCallback(async (bookId: string, isDeletingBook: boolean = false) => {
        const book = books.find(b => b.id === bookId);
        if (!book || !book.seriesId) return;

        const seriesToUpdate = series.find(s => s.id === book.seriesId);
        if (seriesToUpdate) {
            const updatedBookIds = seriesToUpdate.bookIds.filter(id => id !== bookId);

            if (updatedBookIds.length <= 1) {
                await db.series.delete(seriesToUpdate.id);
                if (updatedBookIds.length === 1) {
                    const remainingBook = books.find(b => b.id === updatedBookIds[0]);
                    if (remainingBook) {
                        await db.books.put({ ...remainingBook, seriesId: undefined, seriesName: undefined });
                    }
                }
                toastService.info(`Series "${seriesToUpdate.title}" dissolved.`);
            } else {
                await db.series.put({ ...seriesToUpdate, bookIds: updatedBookIds });
            }
        }
        
        if (!isDeletingBook) {
            await db.books.put({ ...book, seriesId: undefined, seriesName: undefined });
        }
        
        await fetchData();
    }, [books, series, fetchData]);


    const deleteBook = useCallback(async (bookId: string) => {
        const book = books.find(b => b.id === bookId);
        if (!book) return;

        if (book.deletedAt) {
            // Hard delete: It was already in trash
            await removeBookFromSeries(bookId, true);
            await db.books.delete(bookId);
            const snapshots = await db.snapshots.getAllForBook(bookId);
            for (const snapshot of snapshots) {
                await db.snapshots.delete(snapshot.id);
            }
            toastService.info('Book permanently deleted.');
        } else {
            // Soft delete: Move to trash
            await db.books.put({ ...book, deletedAt: Date.now() });
            toastService.info('Book moved to trash.');
        }
        await fetchData();
    }, [books, fetchData, removeBookFromSeries]);

    const restoreBook = useCallback(async (bookId: string) => {
        const book = books.find(b => b.id === bookId);
        if (!book) return;

        if (book.deletedAt) {
            // Restore from trash
            const restoredBook = { ...book };
            delete restoredBook.deletedAt;
            await db.books.put(restoredBook);
            toastService.success('Book restored from trash.');
        } else if (book.status === 'archived') {
            // Unarchive
            await db.books.put({ ...book, status: 'writing' });
            toastService.success('Book unarchived.');
        }
        await fetchData();
    }, [books, fetchData]);

    const archiveBook = useCallback(async (bookId: string) => {
        const book = books.find(b => b.id === bookId);
        if (!book) return;
        
        await db.books.put({ ...book, status: 'archived' });
        await fetchData();
        toastService.success('Book archived.');
    }, [books, fetchData]);

    const fetchSnapshotsForBook = useCallback((bookId: string) => db.snapshots.getAllForBook(bookId), []);
    
    const createSnapshot = useCallback(async (book: Book, name: string) => {
        const snapshot: BookSnapshot = {
            id: crypto.randomUUID(),
            bookId: book.id,
            name,
            bookData: JSON.stringify(book),
            createdAt: Date.now()
        };
        await db.snapshots.put(snapshot);
    }, []);

    const restoreSnapshot = useCallback(async (snapshot: BookSnapshot) => {
        const bookData = JSON.parse(snapshot.bookData);
        await db.books.put(bookData);
        await fetchData();
        window.location.reload();
    }, [fetchData]);

    const deleteSnapshot = useCallback(async (snapshotId: string) => {
        await db.snapshots.delete(snapshotId);
    }, []);

    const createNewSeriesAndFirstBook = useCallback(async (seriesTitle: string, firstBookTitle: string) => {
        const newSeries: Series = {
            id: crypto.randomUUID(),
            title: seriesTitle,
            bookIds: [],
        };
        
        const newBookId = await createNewBook({
            topic: firstBookTitle,
            seriesId: newSeries.id,
            seriesName: seriesTitle,
        });

        newSeries.bookIds.push(newBookId);
        await db.series.put(newSeries);
        await fetchData();
        return newBookId;
    }, [createNewBook, fetchData]);

    const addBookToSeries = useCallback(async (bookId: string, seriesInfo: { seriesId?: string; newSeriesTitle?: string }) => {
        const book = books.find(b => b.id === bookId);
        if (!book) return;

        let targetSeries: Series | undefined;

        if (seriesInfo.seriesId) {
            targetSeries = series.find(s => s.id === seriesInfo.seriesId);
        } else if (seriesInfo.newSeriesTitle) {
            targetSeries = { id: crypto.randomUUID(), title: seriesInfo.newSeriesTitle, bookIds: [] };
            await db.series.put(targetSeries);
        }

        if (!targetSeries) {
            toastService.error("Could not find or create series.");
            return;
        }

        await db.books.put({ ...book, seriesId: targetSeries.id, seriesName: targetSeries.title });
        await db.series.put({ ...targetSeries, bookIds: [...targetSeries.bookIds, book.id] });
        await fetchData();
        toastService.success(`"${book.topic}" added to series "${targetSeries.title}".`);
    }, [books, series, fetchData]);
    
    const reorderBooksInSeries = useCallback(async (seriesId: string, fromIndex: number, toIndex: number) => {
        const seriesToUpdate = series.find(s => s.id === seriesId);
        if (!seriesToUpdate) return;
        
        const newBookIds = produce(seriesToUpdate.bookIds, draft => {
            const [moved] = draft.splice(fromIndex, 1);
            draft.splice(toIndex, 0, moved);
        });

        await db.series.put({ ...seriesToUpdate, bookIds: newBookIds });
        await fetchData();
    }, [series, fetchData]);

    const updateSeries = useCallback(async (seriesToUpdate: Series) => {
        await db.series.put(seriesToUpdate);
        await fetchData();
    }, [fetchData]);

    const createRelatedBook = useCallback(async (parentBook: Book, topic: string, relationType: 'sequel' | 'prequel', overrides: Partial<Book> = {}) => {
        const newBookId = await createNewBook({
            topic,
            instructions: parentBook.instructions,
            generateImages: parentBook.generateImages,
            imageGenerationInstructions: parentBook.imageGenerationInstructions,
            seriesId: parentBook.seriesId,
            seriesName: parentBook.seriesName,
            ...overrides // Allow overriding inherited properties
        });

        if (parentBook.seriesId) {
            const seriesToUpdate = series.find(s => s.id === parentBook.seriesId);
            if (seriesToUpdate) {
                const parentIndex = seriesToUpdate.bookIds.indexOf(parentBook.id);
                const newBookIds = produce(seriesToUpdate.bookIds, draft => {
                    const insertIndex = relationType === 'sequel' ? parentIndex + 1 : parentIndex;
                    draft.splice(insertIndex, 0, newBookId);
                });
                await db.series.put({ ...seriesToUpdate, bookIds: newBookIds });
                await fetchData();
            }
        }
        return newBookId;
    }, [createNewBook, series, fetchData]);
    
    // --- Document Methods ---
    
    const createNewDocument = useCallback(async (initialTitle: string = 'Untitled Document') => {
        const newDoc: GeneralDoc = {
            id: crypto.randomUUID(),
            title: initialTitle,
            content: '',
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        await db.documents.put(newDoc);
        await fetchData();
        return newDoc.id;
    }, [fetchData]);

    const updateDocument = useCallback(async (doc: GeneralDoc) => {
        await db.documents.put({ ...doc, updatedAt: Date.now() });
        await fetchData();
    }, [fetchData]);

    const deleteDocument = useCallback(async (id: string) => {
        await db.documents.delete(id);
        await fetchData();
        toastService.info("Document deleted.");
    }, [fetchData]);
    
    const playAudiobook = useCallback(async (bookId: string, startChapterIndex: number) => {
        const book = books.find(b => b.id === bookId);
        if (book) {
            audioPlayerService.play(book, startChapterIndex);
        }
    }, [books, audioPlayerService]);

    const value: AppContextType = useMemo(() => ({
        books, documents, series, macros, audiobookState, isAiEnabled, syncProvider, setSyncProvider,
        createNewBook, deleteBook, restoreBook, archiveBook, updateBook,
        fetchSnapshotsForBook, createSnapshot, restoreSnapshot, deleteSnapshot,
        createNewSeriesAndFirstBook, addBookToSeries, removeBookFromSeries, reorderBooksInSeries, updateSeries,
        createRelatedBook,
        createNewDocument, updateDocument, deleteDocument,
        playAudiobook,
        pauseAudiobook: () => audioPlayerService.pause(),
        resumeAudiobook: () => audioPlayerService.resume(),
        stopAudiobook: () => audioPlayerService.stop(),
        skipAudiobookChapter: (dir: 'next' | 'prev') => audioPlayerService.skipChapter(dir),
        setPlaybackRate: (rate: number) => audioPlayerService.setPlaybackRate(rate),
        setAudiobookVolume: (vol: number) => audioPlayerService.setVolume(vol),
        jumpToParagraph: (idx: number) => audioPlayerService.jumpToParagraph(idx),
        skipParagraph: (dir: 'next' | 'prev') => audioPlayerService.skipParagraph(dir),
    }), [
        books, documents, series, macros, audiobookState, isAiEnabled, syncProvider, setSyncProvider, createNewBook, deleteBook, restoreBook, archiveBook, updateBook,
        fetchSnapshotsForBook, createSnapshot, restoreSnapshot, deleteSnapshot,
        createNewSeriesAndFirstBook, addBookToSeries, removeBookFromSeries, reorderBooksInSeries, updateSeries,
        createRelatedBook, createNewDocument, updateDocument, deleteDocument, playAudiobook, audioPlayerService
    ]);

    return (
        <AppContext.Provider value={value}>
            {children}
        </AppContext.Provider>
    );
};
