import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BookEditorProvider, useBookEditor } from '@/contexts/BookEditorContext';
import { AppContext } from '@/contexts/AppContext';
import { Book, ChapterOutline, ChapterContent } from '@/types';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
    return { ...actual, useNavigate: () => mockNavigate };
});

const mockDb = vi.hoisted(() => ({
    books: {
        get: vi.fn(),
        put: vi.fn().mockResolvedValue(undefined),
        getAll: vi.fn().mockResolvedValue([]),
    },
    series: {
        get: vi.fn().mockResolvedValue(null),
        put: vi.fn().mockResolvedValue(undefined),
    },
    instructions: {
        getAll: vi.fn().mockResolvedValue([]),
        put: vi.fn().mockResolvedValue(undefined),
    },
    settings: {
        get: vi.fn().mockResolvedValue(null),
        put: vi.fn().mockResolvedValue(undefined),
    },
    snapshots: {
        getAllForBook: vi.fn().mockResolvedValue([]),
    },
    macros: {
        getAll: vi.fn().mockResolvedValue([]),
    },
}));

vi.mock('@/services/apiClient', () => ({ db: mockDb }));

const mockGemini = vi.hoisted(() => ({
    checkServerAiStatus: vi.fn().mockResolvedValue(true),
    PERSONA_INSTRUCTIONS: { 'Standard Co-Author': 'You are a helpful co-author.' },
    generateChapterContent: vi.fn(),
    validateAndPolishChapterContent: vi.fn(),
    regenerateOutlineForBook: vi.fn(),
    streamChatWithBook: vi.fn(),
    analyzeChapterContent: vi.fn(),
    improveBookInstructions: vi.fn(),
    breakdownChapterSummary: vi.fn(),
    autoFillKnowledgeBase: vi.fn(),
    regenerateImageWithPrompt: vi.fn(),
    generateCoverImage: vi.fn(),
    analyzePlanCompleteness: vi.fn(),
    isAiEnabled: vi.fn().mockReturnValue(true),
}));
vi.mock('@/services/gemini', () => mockGemini);
vi.mock('@/services/backupService', () => ({ manualTriggerBackup: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/services/backgroundTaskService', () => ({
    backgroundTaskService: { addTask: vi.fn(), subscribe: vi.fn().mockReturnValue(vi.fn()) },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeOutline(count = 2): ChapterOutline[] {
    return Array.from({ length: count }, (_, i) => ({
        id: `ch-${i}`,
        title: `Chapter ${i + 1}`,
        summary: `Summary ${i + 1}`,
        status: 'todo' as const,
    }));
}

function makeContent(outline: ChapterOutline[]): ChapterContent[] {
    return outline.map(ch => ({ title: ch.title, htmlContent: '' }));
}

function makeBook(overrides: Partial<Book> = {}): Book {
    const outline = makeOutline(2);
    return {
        id: 'test-book-1',
        topic: 'Test Novel',
        instructions: 'Write in a dramatic style.',
        generateImages: false,
        imageGenerationInstructions: '',
        status: 'writing',
        outline,
        content: makeContent(outline),
        createdAt: 1000,
        updatedAt: 1000,
        language: 'en',
        bookChatHistory: [],
        ...overrides,
    };
}

const mockAppContext = {
    books: [],
    documents: [],
    series: [],
    macros: [],
    audiobookState: {
        playbackState: 'stopped', bookId: null, bookTitle: null, currentChapterIndex: -1,
        currentChapterTitle: null, currentParagraphIndex: -1, chapterProgress: 0,
        playbackRate: 1, totalParagraphsInChapter: 0,
    } as any,
    isAiEnabled: true,
    syncProvider: 'google_drive' as any,
    setSyncProvider: vi.fn(),
    updateBook: vi.fn().mockResolvedValue(undefined),
    createNewBook: vi.fn().mockResolvedValue('new-book-id'),
    deleteBook: vi.fn(),
    restoreBook: vi.fn(),
    archiveBook: vi.fn(),
    fetchSnapshotsForBook: vi.fn().mockResolvedValue([]),
    createSnapshot: vi.fn().mockResolvedValue(undefined),
    restoreSnapshot: vi.fn().mockResolvedValue(undefined),
    deleteSnapshot: vi.fn().mockResolvedValue(undefined),
    createNewSeriesAndFirstBook: vi.fn(),
    addBookToSeries: vi.fn(),
    removeBookFromSeries: vi.fn(),
    reorderBooksInSeries: vi.fn(),
    updateSeries: vi.fn(),
    createRelatedBook: vi.fn(),
    playAudiobook: vi.fn(),
    pauseAudiobook: vi.fn(),
    resumeAudiobook: vi.fn(),
    stopAudiobook: vi.fn(),
    skipAudiobookChapter: vi.fn(),
    setPlaybackRate: vi.fn(),
    setAudiobookVolume: vi.fn(),
    jumpToParagraph: vi.fn(),
    skipParagraph: vi.fn(),
    createNewDocument: vi.fn(),
    updateDocument: vi.fn(),
    deleteDocument: vi.fn(),
};

function wrapper(bookId: string, onBack = vi.fn()) {
    return function Wrapper({ children }: { children: React.ReactNode }) {
        return (
            <MemoryRouter>
                <AppContext.Provider value={mockAppContext as any}>
                    <BookEditorProvider bookId={bookId} onBack={onBack}>
                        {children}
                    </BookEditorProvider>
                </AppContext.Provider>
            </MemoryRouter>
        );
    };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('BookEditorContext', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockNavigate.mockReset();
        // By default, db.books.get returns a valid book
        mockDb.books.get.mockResolvedValue(makeBook());
        mockDb.instructions.getAll.mockResolvedValue([]);
        mockDb.settings.get.mockResolvedValue(null);
        mockDb.series.get.mockResolvedValue(null);
        mockAppContext.fetchSnapshotsForBook.mockResolvedValue([]);
        mockAppContext.updateBook.mockResolvedValue(undefined);
        mockAppContext.createNewBook.mockResolvedValue('new-book-id');
    });

    // ─── Loading ──────────────────────────────────────────────────────────────

    describe('loading', () => {
        it('loads the book from db on mount', async () => {
            const book = makeBook({ topic: 'My Special Book' });
            mockDb.books.get.mockResolvedValue(book);

            const { result } = renderHook(
                () => useBookEditor(),
                { wrapper: wrapper('test-book-1') }
            );

            await waitFor(() => expect(result.current!.isLoading).toBe(false));
            expect(result.current!.book!.topic).toBe('My Special Book');
        });

        it('calls onBack if book is not found', async () => {
            const onBack = vi.fn();
            mockDb.books.get.mockResolvedValue(undefined);

            renderHook(
                () => useBookEditor(),
                { wrapper: wrapper('missing-book', onBack) }
            );

            await waitFor(() => expect(onBack).toHaveBeenCalled());
        });

        it('sets isLoading to false after successful load', async () => {
            const { result } = renderHook(
                () => useBookEditor(),
                { wrapper: wrapper('test-book-1') }
            );

            await waitFor(() => expect(result.current!.isLoading).toBe(false));
        });
    });

    // ─── handleContentChange ──────────────────────────────────────────────────

    describe('handleContentChange', () => {
        it('updates the chapter html content', async () => {
            const { result } = renderHook(
                () => useBookEditor(),
                { wrapper: wrapper('test-book-1') }
            );
            await waitFor(() => expect(result.current!.isLoading).toBe(false));

            act(() => {
                result.current!.handleContentChange(0, '<p>New content</p>');
            });

            expect(result.current!.book!.content[0].htmlContent).toBe('<p>New content</p>');
        });

        it('marks save status as unsaved after content change', async () => {
            const { result } = renderHook(
                () => useBookEditor(),
                { wrapper: wrapper('test-book-1') }
            );
            await waitFor(() => expect(result.current!.isLoading).toBe(false));

            act(() => {
                result.current!.handleContentChange(0, '<p>Changed</p>');
            });

            expect(result.current!.saveStatus).toBe('unsaved');
        });

        it('does not update if content is unchanged', async () => {
            const book = makeBook();
            book.content[0].htmlContent = '<p>Existing</p>';
            mockDb.books.get.mockResolvedValue(book);

            const { result } = renderHook(
                () => useBookEditor(),
                { wrapper: wrapper('test-book-1') }
            );
            await waitFor(() => expect(result.current!.isLoading).toBe(false));

            const bookBefore = result.current!.book;
            act(() => {
                result.current!.handleContentChange(0, '<p>Existing</p>');
            });

            // Same reference returned because content didn't change
            expect(result.current!.book).toBe(bookBefore);
        });
    });

    // ─── handleChapterTitleChange ─────────────────────────────────────────────

    describe('handleChapterTitleChange', () => {
        it('updates chapter title in both outline and content', async () => {
            const { result } = renderHook(
                () => useBookEditor(),
                { wrapper: wrapper('test-book-1') }
            );
            await waitFor(() => expect(result.current!.isLoading).toBe(false));

            const fakeEvent = {
                currentTarget: { textContent: 'Updated Title' }
            } as unknown as React.FocusEvent<HTMLElement>;

            act(() => {
                result.current!.handleChapterTitleChange(fakeEvent, 0);
            });

            expect(result.current!.book!.outline[0].title).toBe('Updated Title');
            expect(result.current!.book!.content[0].title).toBe('Updated Title');
        });
    });

    // ─── handleAddChapter ─────────────────────────────────────────────────────

    describe('handleAddChapter', () => {
        it('inserts a new chapter after the given index', async () => {
            const { result } = renderHook(
                () => useBookEditor(),
                { wrapper: wrapper('test-book-1') }
            );
            await waitFor(() => expect(result.current!.isLoading).toBe(false));

            const initialLength = result.current!.book!.outline.length;

            act(() => {
                result.current!.handleAddChapter(0, 'after');
            });

            expect(result.current!.book!.outline).toHaveLength(initialLength + 1);
            expect(result.current!.book!.outline[1].title).toBe('New Chapter');
        });

        it('inserts a new chapter before the given index', async () => {
            const { result } = renderHook(
                () => useBookEditor(),
                { wrapper: wrapper('test-book-1') }
            );
            await waitFor(() => expect(result.current!.isLoading).toBe(false));

            act(() => {
                result.current!.handleAddChapter(1, 'before');
            });

            expect(result.current!.book!.outline[1].title).toBe('New Chapter');
        });

        it('updates content array length to match outline', async () => {
            const { result } = renderHook(
                () => useBookEditor(),
                { wrapper: wrapper('test-book-1') }
            );
            await waitFor(() => expect(result.current!.isLoading).toBe(false));

            act(() => {
                result.current!.handleAddChapter(0, 'after');
            });

            expect(result.current!.book!.content).toHaveLength(result.current!.book!.outline.length);
        });
    });

    // ─── handleMoveChapter ────────────────────────────────────────────────────

    describe('handleMoveChapter', () => {
        it('swaps two chapters correctly', async () => {
            const { result } = renderHook(
                () => useBookEditor(),
                { wrapper: wrapper('test-book-1') }
            );
            await waitFor(() => expect(result.current!.isLoading).toBe(false));

            const firstTitle = result.current!.book!.outline[0].title;
            const secondTitle = result.current!.book!.outline[1].title;

            act(() => {
                result.current!.handleMoveChapter(0, 1);
            });

            expect(result.current!.book!.outline[0].title).toBe(secondTitle);
            expect(result.current!.book!.outline[1].title).toBe(firstTitle);
        });

        it('does nothing when fromIndex equals toIndex', async () => {
            const { result } = renderHook(
                () => useBookEditor(),
                { wrapper: wrapper('test-book-1') }
            );
            await waitFor(() => expect(result.current!.isLoading).toBe(false));

            const outlineBefore = [...result.current!.book!.outline];

            act(() => {
                result.current!.handleMoveChapter(0, 0);
            });

            expect(result.current!.book!.outline[0].title).toBe(outlineBefore[0].title);
        });
    });

    // ─── handleBrainstormComplete ─────────────────────────────────────────────

    describe('handleBrainstormComplete', () => {
        it('applies new outline and title to the book', async () => {
            const { result } = renderHook(
                () => useBookEditor(),
                { wrapper: wrapper('test-book-1') }
            );
            await waitFor(() => expect(result.current!.isLoading).toBe(false));

            const newOutline: ChapterOutline[] = [
                { id: 'n1', title: 'New Ch 1', summary: 'Intro', status: 'todo' },
                { id: 'n2', title: 'New Ch 2', summary: 'Climax', status: 'todo' },
                { id: 'n3', title: 'New Ch 3', summary: 'Resolution', status: 'todo' },
            ];

            act(() => {
                result.current!.handleBrainstormComplete(newOutline, 'Brainstormed Title');
            });

            expect(result.current!.book!.topic).toBe('Brainstormed Title');
            expect(result.current!.book!.outline).toHaveLength(3);
            expect(result.current!.book!.outline[0].title).toBe('New Ch 1');
        });

        it('preserves existing content for matched chapter titles', async () => {
            const book = makeBook();
            book.content[0].htmlContent = '<p>Existing prose for Chapter 1</p>';
            mockDb.books.get.mockResolvedValue(book);

            const { result } = renderHook(
                () => useBookEditor(),
                { wrapper: wrapper('test-book-1') }
            );
            await waitFor(() => expect(result.current!.isLoading).toBe(false));

            const newOutline: ChapterOutline[] = [
                { id: 'n1', title: 'Chapter 1', summary: 'Same title', status: 'todo' },
            ];

            act(() => {
                result.current!.handleBrainstormComplete(newOutline, 'Same Title');
            });

            expect(result.current!.book!.content[0].htmlContent).toBe('<p>Existing prose for Chapter 1</p>');
        });
    });

    // ─── handleUpdateChapterOutline ───────────────────────────────────────────

    describe('handleUpdateChapterOutline', () => {
        it('updates summary of a chapter in outline', async () => {
            const { result } = renderHook(
                () => useBookEditor(),
                { wrapper: wrapper('test-book-1') }
            );
            await waitFor(() => expect(result.current!.isLoading).toBe(false));

            act(() => {
                result.current!.handleUpdateChapterOutline(0, { summary: 'New summary text' });
            });

            expect(result.current!.book!.outline[0].summary).toBe('New summary text');
        });

        it('syncs content title when title is updated via outline', async () => {
            const { result } = renderHook(
                () => useBookEditor(),
                { wrapper: wrapper('test-book-1') }
            );
            await waitFor(() => expect(result.current!.isLoading).toBe(false));

            act(() => {
                result.current!.handleUpdateChapterOutline(0, { title: 'Renamed Chapter' });
            });

            expect(result.current!.book!.content[0].title).toBe('Renamed Chapter');
        });
    });

    // ─── handleSaveToDB ───────────────────────────────────────────────────────

    describe('handleSaveToDB', () => {
        it('calls updateBook from AppContext with current book data', async () => {
            const { result } = renderHook(
                () => useBookEditor(),
                { wrapper: wrapper('test-book-1') }
            );
            await waitFor(() => expect(result.current!.isLoading).toBe(false));

            await act(async () => {
                await result.current!.handleSaveToDB();
            });

            expect(mockAppContext.updateBook).toHaveBeenCalledWith(
                expect.objectContaining({ id: 'test-book-1' })
            );
        });

        it('sets saveStatus to saved after successful save', async () => {
            const { result } = renderHook(
                () => useBookEditor(),
                { wrapper: wrapper('test-book-1') }
            );
            await waitFor(() => expect(result.current!.isLoading).toBe(false));

            // Make it unsaved first
            act(() => {
                result.current!.handleContentChange(0, '<p>Changed</p>');
            });
            expect(result.current!.saveStatus).toBe('unsaved');

            await act(async () => {
                await result.current!.handleSaveToDB();
            });

            expect(result.current!.saveStatus).toBe('saved');
        });
    });

    // ─── handleGenerateSpecificChapter ────────────────────────────────────────

    describe('handleGenerateSpecificChapter', () => {
        it('calls gemini.generateChapterContent with correct arguments', async () => {
            // Mock generateChapterContent to call the onStream callback with content
            mockGemini.generateChapterContent.mockImplementation(
                async (topic: string, _instructions: any, _kb: any, _seriesKb: any, _outline: any, _history: any, onStream: (chunk: string) => void) => {
                    onStream('<p>Generated text</p>');
                }
            );

            const { result } = renderHook(
                () => useBookEditor(),
                { wrapper: wrapper('test-book-1') }
            );
            await waitFor(() => expect(result.current!.isLoading).toBe(false));

            await act(async () => {
                await result.current!.handleGenerateSpecificChapter(0);
            });

            expect(mockGemini.generateChapterContent).toHaveBeenCalledWith(
                'Test Novel',
                'Write in a dramatic style.',
                undefined, // knowledgeBase
                [], // seriesKnowledgeBase
                expect.objectContaining({ title: 'Chapter 1' }),
                [], // bookChatHistory
                expect.any(Function), // onStream
                'en',
                1000 // default word count
            );
        });

        it('uses targetWordCount when provided', async () => {
            mockGemini.generateChapterContent.mockImplementation(
                async (_topic: any, _instructions: any, _kb: any, _seriesKb: any, _outline: any, _history: any, onStream: (chunk: string) => void) => {
                    onStream('<p>Content</p>');
                }
            );

            const { result } = renderHook(
                () => useBookEditor(),
                { wrapper: wrapper('test-book-1') }
            );
            await waitFor(() => expect(result.current!.isLoading).toBe(false));

            await act(async () => {
                await result.current!.handleGenerateSpecificChapter(0, 2500);
            });

            const callArgs = mockGemini.generateChapterContent.mock.calls[0];
            // Last arg is wordCount
            expect(callArgs[callArgs.length - 1]).toBe(2500);
        });

        it('sets isGeneratingChapter to null after completion', async () => {
            mockGemini.generateChapterContent.mockResolvedValue(undefined);

            const { result } = renderHook(
                () => useBookEditor(),
                { wrapper: wrapper('test-book-1') }
            );
            await waitFor(() => expect(result.current!.isLoading).toBe(false));

            await act(async () => {
                await result.current!.handleGenerateSpecificChapter(0);
            });

            expect(result.current!.isGeneratingChapter).toBeNull();
        });

        it('does not call validateAndPolish in budget mode', async () => {
            mockGemini.generateChapterContent.mockImplementation(
                async (_t: any, _i: any, _k: any, _s: any, _o: any, _h: any, onStream: (chunk: string) => void) => {
                    onStream('<p>Content</p>');
                }
            );

            const { result } = renderHook(
                () => useBookEditor(),
                { wrapper: wrapper('test-book-1') }
            );
            await waitFor(() => expect(result.current!.isLoading).toBe(false));

            // Default mode is 'budget'
            expect(result.current!.generationMode).toBe('budget');

            await act(async () => {
                await result.current!.handleGenerateSpecificChapter(0);
            });

            expect(mockGemini.validateAndPolishChapterContent).not.toHaveBeenCalled();
        });

        it('calls validateAndPolish in full mode', async () => {
            mockGemini.generateChapterContent.mockImplementation(
                async (_t: any, _i: any, _k: any, _s: any, _o: any, _h: any, onStream: (chunk: string) => void) => {
                    onStream('<p>Content</p>');
                }
            );
            mockGemini.validateAndPolishChapterContent.mockResolvedValue('<p>Polished</p>');

            const { result } = renderHook(
                () => useBookEditor(),
                { wrapper: wrapper('test-book-1') }
            );
            await waitFor(() => expect(result.current!.isLoading).toBe(false));

            act(() => {
                result.current!.setGenerationMode('full');
            });

            await act(async () => {
                await result.current!.handleGenerateSpecificChapter(0);
            });

            expect(mockGemini.validateAndPolishChapterContent).toHaveBeenCalled();
        });

        it('sets isGeneratingChapter to null even on error', async () => {
            mockGemini.generateChapterContent.mockRejectedValue(new Error('AI failure'));

            const { result } = renderHook(
                () => useBookEditor(),
                { wrapper: wrapper('test-book-1') }
            );
            await waitFor(() => expect(result.current!.isLoading).toBe(false));

            await act(async () => {
                await result.current!.handleGenerateSpecificChapter(0);
            });

            expect(result.current!.isGeneratingChapter).toBeNull();
        });
    });

    // ─── handleGenerateChapters ───────────────────────────────────────────────

    describe('handleGenerateChapters', () => {
        it('generates the first chapter that has no content', async () => {
            mockGemini.generateChapterContent.mockImplementation(
                async (_t: any, _i: any, _k: any, _s: any, _o: any, _h: any, onStream: (chunk: string) => void) => {
                    onStream('<p>Generated</p>');
                }
            );

            // Book with 2 outline items but only 1 content item — generates at index 1
            const outline = makeOutline(2);
            const book = makeBook({
                outline,
                content: [{ title: outline[0].title, htmlContent: '<p>Already written</p>' }],
            });
            mockDb.books.get.mockResolvedValue(book);

            const { result } = renderHook(
                () => useBookEditor(),
                { wrapper: wrapper('test-book-1') }
            );
            await waitFor(() => expect(result.current!.isLoading).toBe(false));

            await act(async () => {
                await result.current!.handleGenerateChapters();
            });

            expect(mockGemini.generateChapterContent).toHaveBeenCalledTimes(1);
            expect(mockGemini.generateChapterContent).toHaveBeenCalledWith(
                expect.any(String),
                expect.any(String),
                undefined,
                [],
                expect.objectContaining({ title: 'Chapter 2' }),
                expect.any(Array),
                expect.any(Function),
                'en',
                1000
            );
        });

        it('shows info toast when all chapters already have content', async () => {
            const outline = makeOutline(2);
            const content: ChapterContent[] = outline.map(ch => ({
                title: ch.title,
                htmlContent: '<p>Already written</p>',
            }));
            const book = makeBook({ outline, content });
            mockDb.books.get.mockResolvedValue(book);

            const { result } = renderHook(
                () => useBookEditor(),
                { wrapper: wrapper('test-book-1') }
            );
            await waitFor(() => expect(result.current!.isLoading).toBe(false));

            await act(async () => {
                await result.current!.handleGenerateChapters();
            });

            // Should not have called gemini
            expect(mockGemini.generateChapterContent).not.toHaveBeenCalled();
        });
    });

    // ─── handleRebuildOutline ─────────────────────────────────────────────────

    describe('handleRebuildOutline', () => {
        it('calls regenerateOutlineForBook and updates outline', async () => {
            const newOutline: ChapterOutline[] = [
                { id: 'r1', title: 'Rebuilt Ch 1', summary: 'Start', status: 'todo' },
                { id: 'r2', title: 'Rebuilt Ch 2', summary: 'Middle', status: 'todo' },
                { id: 'r3', title: 'Rebuilt Ch 3', summary: 'End', status: 'todo' },
            ];
            mockGemini.regenerateOutlineForBook.mockResolvedValue(newOutline);

            const { result } = renderHook(
                () => useBookEditor(),
                { wrapper: wrapper('test-book-1') }
            );
            await waitFor(() => expect(result.current!.isLoading).toBe(false));

            await act(async () => {
                await result.current!.handleRebuildOutline(3);
            });

            expect(mockGemini.regenerateOutlineForBook).toHaveBeenCalledWith(
                expect.objectContaining({ id: 'test-book-1' }),
                3
            );
            expect(result.current!.book!.outline).toHaveLength(3);
            expect(result.current!.book!.outline[0].title).toBe('Rebuilt Ch 1');
        });

        it('sets isRebuildingOutline to false after completion', async () => {
            mockGemini.regenerateOutlineForBook.mockResolvedValue([
                { id: 'r1', title: 'Ch 1', summary: '', status: 'todo' },
            ]);

            const { result } = renderHook(
                () => useBookEditor(),
                { wrapper: wrapper('test-book-1') }
            );
            await waitFor(() => expect(result.current!.isLoading).toBe(false));

            await act(async () => {
                await result.current!.handleRebuildOutline(1);
            });

            expect(result.current!.isRebuildingOutline).toBe(false);
        });
    });

    // ─── handleCreateBookFromChat ─────────────────────────────────────────────

    describe('handleCreateBookFromChat', () => {
        it('creates a new book and navigates to its editor', async () => {
            mockAppContext.createNewBook.mockResolvedValue('created-book-id');

            const { result } = renderHook(
                () => useBookEditor(),
                { wrapper: wrapper('test-book-1') }
            );
            await waitFor(() => expect(result.current!.isLoading).toBe(false));

            await act(async () => {
                await result.current!.handleCreateBookFromChat({
                    topic: 'Chat-Proposed Book',
                    description: 'An exciting adventure',
                    outline: [
                        { title: 'Beginning', summary: 'The hero is born' },
                        { title: 'Middle', summary: 'The journey' },
                    ],
                });
            });

            expect(mockAppContext.createNewBook).toHaveBeenCalledWith(
                expect.objectContaining({
                    topic: 'Chat-Proposed Book',
                    description: 'An exciting adventure',
                    status: 'draft',
                    outline: expect.arrayContaining([
                        expect.objectContaining({ title: 'Beginning' }),
                    ]),
                })
            );
            expect(mockNavigate).toHaveBeenCalledWith('/editor/created-book-id');
        });

        it('inherits series info from current book when addToCurrentSeries is true', async () => {
            const book = makeBook({ seriesId: 'series-99', seriesName: 'Epic Series' });
            mockDb.books.get.mockResolvedValue(book);
            mockAppContext.createNewBook.mockResolvedValue('new-in-series-id');

            const { result } = renderHook(
                () => useBookEditor(),
                { wrapper: wrapper('test-book-1') }
            );
            await waitFor(() => expect(result.current!.isLoading).toBe(false));

            await act(async () => {
                await result.current!.handleCreateBookFromChat({
                    topic: 'Series Companion',
                    description: 'Second in series',
                    outline: [],
                    addToCurrentSeries: true,
                });
            });

            expect(mockAppContext.createNewBook).toHaveBeenCalledWith(
                expect.objectContaining({
                    seriesId: 'series-99',
                    seriesName: 'Epic Series',
                })
            );
        });
    });

    // ─── handleInputChange ────────────────────────────────────────────────────

    describe('handleInputChange', () => {
        it('updates a text field on the book', async () => {
            const { result } = renderHook(
                () => useBookEditor(),
                { wrapper: wrapper('test-book-1') }
            );
            await waitFor(() => expect(result.current!.isLoading).toBe(false));

            const event = {
                target: { name: 'author', value: 'Jane Doe', type: 'text' }
            } as React.ChangeEvent<HTMLInputElement>;

            act(() => {
                result.current!.handleInputChange(event);
            });

            expect(result.current!.book!.author).toBe('Jane Doe');
        });

        it('coerces number fields', async () => {
            const { result } = renderHook(
                () => useBookEditor(),
                { wrapper: wrapper('test-book-1') }
            );
            await waitFor(() => expect(result.current!.isLoading).toBe(false));

            const event = {
                target: { name: 'wordCountGoal', value: '80000', type: 'number' }
            } as unknown as React.ChangeEvent<HTMLInputElement>;

            act(() => {
                result.current!.handleInputChange(event);
            });

            expect(result.current!.book!.wordCountGoal).toBe(80000);
        });
    });

    // ─── generationMode ───────────────────────────────────────────────────────

    describe('generationMode', () => {
        it('defaults to budget mode', async () => {
            const { result } = renderHook(
                () => useBookEditor(),
                { wrapper: wrapper('test-book-1') }
            );
            await waitFor(() => expect(result.current!.isLoading).toBe(false));
            expect(result.current!.generationMode).toBe('budget');
        });

        it('can be switched to full mode', async () => {
            const { result } = renderHook(
                () => useBookEditor(),
                { wrapper: wrapper('test-book-1') }
            );
            await waitFor(() => expect(result.current!.isLoading).toBe(false));

            act(() => {
                result.current!.setGenerationMode('full');
            });

            expect(result.current!.generationMode).toBe('full');
        });
    });
});
