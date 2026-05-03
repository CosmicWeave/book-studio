import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppContextProvider, AppContext } from '@/contexts/AppContext';
import { Book, Series } from '@/types';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockDb = vi.hoisted(() => ({
    books: {
        getAll: vi.fn().mockResolvedValue([]),
        get: vi.fn().mockResolvedValue(undefined),
        put: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
    },
    series: {
        getAll: vi.fn().mockResolvedValue([]),
        get: vi.fn().mockResolvedValue(undefined),
        put: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
    },
    macros: {
        getAll: vi.fn().mockResolvedValue([]),
    },
    documents: {
        getAll: vi.fn().mockResolvedValue([]),
        put: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
    },
    snapshots: {
        getAllForBook: vi.fn().mockResolvedValue([]),
        put: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
    },
    settings: {
        get: vi.fn().mockResolvedValue(null),
        put: vi.fn().mockResolvedValue(undefined),
    },
    history: {
        get: vi.fn().mockResolvedValue(null),
        put: vi.fn().mockResolvedValue(undefined),
    },
    init: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/services/apiClient', () => ({ db: mockDb }));
vi.mock('@/services/gemini', () => ({
    checkServerAiStatus: vi.fn().mockResolvedValue(true),
    PERSONA_INSTRUCTIONS: {},
}));
vi.mock('@/services/audioPlayerService', () => ({
    AudioPlayerService: class {
        play = vi.fn();
        pause = vi.fn();
        resume = vi.fn();
        stop = vi.fn();
        skip = vi.fn();
        setPlaybackRate = vi.fn();
        setVolume = vi.fn();
        jumpToParagraph = vi.fn();
        skipParagraph = vi.fn();
    },
}));

// ─── Helper ───────────────────────────────────────────────────────────────────

function makeBook(overrides: Partial<Book> = {}): Book {
    return {
        id: 'book-1',
        topic: 'Test Book',
        instructions: '',
        generateImages: false,
        imageGenerationInstructions: '',
        status: 'writing',
        outline: [],
        content: [],
        createdAt: 1000,
        updatedAt: 1000,
        language: 'en',
        bookChatHistory: [],
        ...overrides,
    };
}

function wrapper({ children }: { children: React.ReactNode }) {
    return (
        <MemoryRouter>
            <AppContextProvider>{children}</AppContextProvider>
        </MemoryRouter>
    );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AppContext', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDb.books.getAll.mockResolvedValue([]);
        mockDb.series.getAll.mockResolvedValue([]);
        mockDb.macros.getAll.mockResolvedValue([]);
        mockDb.documents.getAll.mockResolvedValue([]);
        mockDb.settings.get.mockResolvedValue(null);
    });

    // ─── createNewBook ─────────────────────────────────────────────────────────

    describe('createNewBook', () => {
        it('saves a new book with default fields and returns its id', async () => {
            const { result } = renderHook(() => React.useContext(AppContext), { wrapper });
            await waitFor(() => expect(result.current).toBeDefined());

            let bookId: string | undefined;
            await act(async () => {
                bookId = await result.current!.createNewBook();
            });

            expect(bookId).toBeDefined();
            expect(typeof bookId).toBe('string');

            const savedBook = mockDb.books.put.mock.calls[0][0] as Book;
            expect(savedBook.topic).toBe('New Book');
            expect(savedBook.status).toBe('configuring');
            expect(savedBook.outline).toEqual([]);
            expect(savedBook.content).toEqual([]);
            expect(savedBook.language).toBe('en');
        });

        it('merges overrides into the default book', async () => {
            const { result } = renderHook(() => React.useContext(AppContext), { wrapper });
            await waitFor(() => expect(result.current).toBeDefined());

            await act(async () => {
                await result.current!.createNewBook({ topic: 'My Novel', author: 'Alice', language: 'fr' });
            });

            const savedBook = mockDb.books.put.mock.calls[0][0] as Book;
            expect(savedBook.topic).toBe('My Novel');
            expect(savedBook.author).toBe('Alice');
            expect(savedBook.language).toBe('fr');
            expect(savedBook.status).toBe('configuring');
        });

        it('calls fetchData after creating a book', async () => {
            const { result } = renderHook(() => React.useContext(AppContext), { wrapper });
            await waitFor(() => expect(result.current).toBeDefined());

            const initialCallCount = mockDb.books.getAll.mock.calls.length;

            await act(async () => {
                await result.current!.createNewBook();
            });

            expect(mockDb.books.getAll.mock.calls.length).toBeGreaterThan(initialCallCount);
        });
    });

    // ─── deleteBook ────────────────────────────────────────────────────────────

    describe('deleteBook', () => {
        it('soft-deletes a book (sets deletedAt) if not already in trash', async () => {
            const book = makeBook({ id: 'b1' });
            mockDb.books.getAll.mockResolvedValue([book]);

            const { result } = renderHook(() => React.useContext(AppContext), { wrapper });
            await waitFor(() => expect(result.current!.books).toHaveLength(1));

            await act(async () => {
                await result.current!.deleteBook('b1');
            });

            const savedBook = mockDb.books.put.mock.calls.find(
                ([b]: [Book]) => b.id === 'b1' && b.deletedAt !== undefined
            )?.[0] as Book | undefined;
            expect(savedBook).toBeDefined();
            expect(savedBook!.deletedAt).toBeTypeOf('number');
            expect(mockDb.books.delete).not.toHaveBeenCalled();
        });

        it('hard-deletes a book that is already in trash', async () => {
            const book = makeBook({ id: 'b1', deletedAt: 999 });
            mockDb.books.getAll.mockResolvedValue([book]);
            mockDb.snapshots.getAllForBook.mockResolvedValue([]);

            const { result } = renderHook(() => React.useContext(AppContext), { wrapper });
            await waitFor(() => expect(result.current!.books).toHaveLength(1));

            await act(async () => {
                await result.current!.deleteBook('b1');
            });

            expect(mockDb.books.delete).toHaveBeenCalledWith('b1');
        });

        it('hard-deletes all snapshots for the book', async () => {
            const book = makeBook({ id: 'b1', deletedAt: 999 });
            const snapshots = [
                { id: 'snap-1', bookId: 'b1', name: 'v1', bookData: '{}', createdAt: 1 },
                { id: 'snap-2', bookId: 'b1', name: 'v2', bookData: '{}', createdAt: 2 },
            ];
            mockDb.books.getAll.mockResolvedValue([book]);
            mockDb.snapshots.getAllForBook.mockResolvedValue(snapshots);

            const { result } = renderHook(() => React.useContext(AppContext), { wrapper });
            await waitFor(() => expect(result.current!.books).toHaveLength(1));

            await act(async () => {
                await result.current!.deleteBook('b1');
            });

            expect(mockDb.snapshots.delete).toHaveBeenCalledWith('snap-1');
            expect(mockDb.snapshots.delete).toHaveBeenCalledWith('snap-2');
        });

        it('does nothing if book not found', async () => {
            mockDb.books.getAll.mockResolvedValue([]);

            const { result } = renderHook(() => React.useContext(AppContext), { wrapper });
            await waitFor(() => expect(result.current).toBeDefined());

            await act(async () => {
                await result.current!.deleteBook('nonexistent');
            });

            expect(mockDb.books.delete).not.toHaveBeenCalled();
            expect(mockDb.books.put).not.toHaveBeenCalled();
        });
    });

    // ─── restoreBook ──────────────────────────────────────────────────────────

    describe('restoreBook', () => {
        it('restores a book from trash (removes deletedAt)', async () => {
            const book = makeBook({ id: 'b1', deletedAt: 999 });
            mockDb.books.getAll.mockResolvedValue([book]);

            const { result } = renderHook(() => React.useContext(AppContext), { wrapper });
            await waitFor(() => expect(result.current!.books).toHaveLength(1));

            await act(async () => {
                await result.current!.restoreBook('b1');
            });

            const savedBook = mockDb.books.put.mock.calls.find(
                ([b]: [Book]) => b.id === 'b1' && !b.deletedAt
            )?.[0] as Book | undefined;
            expect(savedBook).toBeDefined();
            expect(savedBook!.deletedAt).toBeUndefined();
        });

        it('unarchives a book by setting status to writing', async () => {
            const book = makeBook({ id: 'b1', status: 'archived' });
            mockDb.books.getAll.mockResolvedValue([book]);

            const { result } = renderHook(() => React.useContext(AppContext), { wrapper });
            await waitFor(() => expect(result.current!.books).toHaveLength(1));

            await act(async () => {
                await result.current!.restoreBook('b1');
            });

            const savedBook = mockDb.books.put.mock.calls.find(
                ([b]: [Book]) => b.id === 'b1' && b.status === 'writing'
            )?.[0] as Book | undefined;
            expect(savedBook).toBeDefined();
            expect(savedBook!.status).toBe('writing');
        });
    });

    // ─── archiveBook ──────────────────────────────────────────────────────────

    describe('archiveBook', () => {
        it('sets book status to archived', async () => {
            const book = makeBook({ id: 'b1', status: 'writing' });
            mockDb.books.getAll.mockResolvedValue([book]);

            const { result } = renderHook(() => React.useContext(AppContext), { wrapper });
            await waitFor(() => expect(result.current!.books).toHaveLength(1));

            await act(async () => {
                await result.current!.archiveBook('b1');
            });

            const savedBook = mockDb.books.put.mock.calls.find(
                ([b]: [Book]) => b.id === 'b1'
            )?.[0] as Book | undefined;
            expect(savedBook!.status).toBe('archived');
        });
    });

    // ─── updateBook ───────────────────────────────────────────────────────────

    describe('updateBook', () => {
        it('updates updatedAt and saves to db', async () => {
            const book = makeBook({ id: 'b1', updatedAt: 0 });
            const beforeTime = Date.now();

            const { result } = renderHook(() => React.useContext(AppContext), { wrapper });
            await waitFor(() => expect(result.current).toBeDefined());

            await act(async () => {
                await result.current!.updateBook(book);
            });

            const savedBook = mockDb.books.put.mock.calls[0][0] as Book;
            expect(savedBook.updatedAt).toBeGreaterThanOrEqual(beforeTime);
        });
    });

    // ─── createNewSeriesAndFirstBook ──────────────────────────────────────────

    describe('createNewSeriesAndFirstBook', () => {
        it('creates a series and a book linked together', async () => {
            const { result } = renderHook(() => React.useContext(AppContext), { wrapper });
            await waitFor(() => expect(result.current).toBeDefined());

            let bookId: string | undefined;
            await act(async () => {
                bookId = await result.current!.createNewSeriesAndFirstBook('The Saga', 'Book One');
            });

            expect(bookId).toBeDefined();

            // The book should have been saved with the series id
            const savedBook = mockDb.books.put.mock.calls.find(
                ([b]: [Book]) => b.topic === 'Book One'
            )?.[0] as Book | undefined;
            expect(savedBook).toBeDefined();
            expect(savedBook!.seriesName).toBe('The Saga');

            // The series should have been saved with the book id
            const savedSeries = mockDb.series.put.mock.calls.find(
                ([s]: [Series]) => s.title === 'The Saga'
            )?.[0] as Series | undefined;
            expect(savedSeries).toBeDefined();
            expect(savedSeries!.bookIds).toContain(bookId);
        });
    });

    // ─── addBookToSeries ──────────────────────────────────────────────────────

    describe('addBookToSeries', () => {
        it('adds a book to an existing series', async () => {
            const book = makeBook({ id: 'b1', topic: 'Standalone' });
            const existingSeries: Series = { id: 's1', title: 'My Series', bookIds: [] };
            mockDb.books.getAll.mockResolvedValue([book]);
            mockDb.series.getAll.mockResolvedValue([existingSeries]);

            const { result } = renderHook(() => React.useContext(AppContext), { wrapper });
            await waitFor(() => expect(result.current!.books).toHaveLength(1));

            await act(async () => {
                await result.current!.addBookToSeries('b1', { seriesId: 's1' });
            });

            const savedBook = mockDb.books.put.mock.calls.find(
                ([b]: [Book]) => b.id === 'b1' && b.seriesId === 's1'
            )?.[0] as Book | undefined;
            expect(savedBook).toBeDefined();
            expect(savedBook!.seriesName).toBe('My Series');

            const savedSeries = mockDb.series.put.mock.calls.find(
                ([s]: [Series]) => s.id === 's1'
            )?.[0] as Series | undefined;
            expect(savedSeries!.bookIds).toContain('b1');
        });

        it('creates a new series and adds the book when newSeriesTitle is provided', async () => {
            const book = makeBook({ id: 'b1', topic: 'Standalone' });
            mockDb.books.getAll.mockResolvedValue([book]);
            mockDb.series.getAll.mockResolvedValue([]);

            const { result } = renderHook(() => React.useContext(AppContext), { wrapper });
            await waitFor(() => expect(result.current!.books).toHaveLength(1));

            await act(async () => {
                await result.current!.addBookToSeries('b1', { newSeriesTitle: 'Brand New Series' });
            });

            const savedBook = mockDb.books.put.mock.calls.find(
                ([b]: [Book]) => b.id === 'b1' && b.seriesName === 'Brand New Series'
            )?.[0] as Book | undefined;
            expect(savedBook).toBeDefined();

            const savedSeries = mockDb.series.put.mock.calls.findLast(
                ([s]: [Series]) => s.title === 'Brand New Series'
            )?.[0] as Series | undefined;
            expect(savedSeries).toBeDefined();
            expect(savedSeries!.bookIds).toContain('b1');
        });
    });

    // ─── createRelatedBook ────────────────────────────────────────────────────

    describe('createRelatedBook', () => {
        it('creates a sequel that inherits parent book properties', async () => {
            const parentBook = makeBook({
                id: 'parent-1',
                topic: 'Book One',
                instructions: 'Epic fantasy style',
                generateImages: true,
                imageGenerationInstructions: 'Oil painting',
                seriesId: 's1',
                seriesName: 'My Series',
            });
            mockDb.books.getAll.mockResolvedValue([parentBook]);

            const { result } = renderHook(() => React.useContext(AppContext), { wrapper });
            await waitFor(() => expect(result.current!.books).toHaveLength(1));

            await act(async () => {
                await result.current!.createRelatedBook(parentBook, 'Book Two', 'sequel');
            });

            const savedBook = mockDb.books.put.mock.calls.find(
                ([b]: [Book]) => b.topic === 'Book Two'
            )?.[0] as Book | undefined;
            expect(savedBook).toBeDefined();
            expect(savedBook!.instructions).toBe('Epic fantasy style');
            expect(savedBook!.generateImages).toBe(true);
            expect(savedBook!.imageGenerationInstructions).toBe('Oil painting');
            expect(savedBook!.seriesId).toBe('s1');
        });
    });

    // ─── reorderBooksInSeries ─────────────────────────────────────────────────

    describe('reorderBooksInSeries', () => {
        it('reorders book ids in a series', async () => {
            const seriesData: Series = { id: 's1', title: 'My Series', bookIds: ['b1', 'b2', 'b3'] };
            mockDb.series.getAll.mockResolvedValue([seriesData]);

            const { result } = renderHook(() => React.useContext(AppContext), { wrapper });
            await waitFor(() => expect(result.current!.series).toHaveLength(1));

            await act(async () => {
                // Move b1 from index 0 to index 2
                await result.current!.reorderBooksInSeries('s1', 0, 2);
            });

            const savedSeries = mockDb.series.put.mock.calls.find(
                ([s]: [Series]) => s.id === 's1'
            )?.[0] as Series | undefined;
            expect(savedSeries!.bookIds).toEqual(['b2', 'b3', 'b1']);
        });
    });

    // ─── fetchSnapshotsForBook ────────────────────────────────────────────────

    describe('fetchSnapshotsForBook', () => {
        it('returns snapshots from db', async () => {
            const snapshots = [
                { id: 'snap-1', bookId: 'b1', name: 'v1', bookData: '{}', createdAt: 1 },
            ];
            mockDb.snapshots.getAllForBook.mockResolvedValue(snapshots);

            const { result } = renderHook(() => React.useContext(AppContext), { wrapper });
            await waitFor(() => expect(result.current).toBeDefined());

            let fetched: any;
            await act(async () => {
                fetched = await result.current!.fetchSnapshotsForBook('b1');
            });

            expect(fetched).toEqual(snapshots);
        });
    });

    // ─── isAiEnabled ──────────────────────────────────────────────────────────

    describe('isAiEnabled', () => {
        it('is true when checkServerAiStatus resolves true', async () => {
            const { result } = renderHook(() => React.useContext(AppContext), { wrapper });
            await waitFor(() => expect(result.current!.isAiEnabled).toBe(true));
        });

        it('is false when checkServerAiStatus resolves false', async () => {
            const { checkServerAiStatus } = await import('@/services/gemini');
            (checkServerAiStatus as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false);

            const { result } = renderHook(() => React.useContext(AppContext), { wrapper });
            await waitFor(() => expect(result.current!.isAiEnabled).toBe(false));
        });
    });
});
