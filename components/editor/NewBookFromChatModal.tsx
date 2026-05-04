import React, { useState, useRef, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../../contexts/AppContext';
import { Book, ChatMessage } from '../../types';
import { streamBrainstorm, generateFullBookDataFromChat } from '../../services/gemini';
import { toastService } from '../../services/toastService';
import { marked } from 'marked';
import Icon from '../Icon';
import { Content } from '@google/genai';
import { withModalPortal } from '../ModalPortal';

interface ProposalData {
    topic: string;
    description: string;
    instructions?: string;
    outline: { title: string; summary: string }[];
    addToCurrentSeries?: boolean;
    proposalReason?: string;
}

interface NewBookFromChatModalProps {
    isOpen: boolean;
    onClose: () => void;
    proposalData: ProposalData;
    chapterCount: number;
    currentBook: Book | null;
}

type Mode = 'select' | 'brainstorm';

const NewBookFromChatModal: React.FC<NewBookFromChatModalProps> = ({
    isOpen,
    onClose,
    proposalData,
    chapterCount: initialChapterCount,
    currentBook,
}) => {
    const { createNewBook, createNewSeriesAndFirstBook } = useContext(AppContext);
    const navigate = useNavigate();

    const [mode, setMode] = useState<Mode>('select');
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');

    // Editable fields
    const [topic, setTopic] = useState(proposalData.topic);
    const [description, setDescription] = useState(proposalData.description);
    const [instructions, setInstructions] = useState(proposalData.instructions || '');
    const [chapterCount, setChapterCount] = useState(initialChapterCount);

    // Brainstorm chat
    const [chatHistory, setChatHistory] = useState<Content[]>([]);
    const [uiMessages, setUiMessages] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (isOpen) {
            setMode('select');
            setIsLoading(false);
            setTopic(proposalData.topic);
            setDescription(proposalData.description);
            setInstructions(proposalData.instructions || '');
            setChapterCount(initialChapterCount);
            setChatHistory([]);
            setUiMessages([]);
            setChatInput('');
        }
    }, [isOpen, proposalData, initialChapterCount]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [uiMessages]);

    const buildSyntheticHistory = (): Content[] => {
        const seriesInfo = proposalData.addToCurrentSeries && currentBook?.seriesName
            ? `\nThis book is part of the series: "${currentBook.seriesName}".`
            : '';
        const currentBookCtx = currentBook
            ? `\nCurrent book context: "${currentBook.topic}"${currentBook.description ? ` — ${currentBook.description}` : ''}.`
            : '';
        const outlineText = proposalData.outline.length > 0
            ? `\n\nProposed chapter outline:\n${proposalData.outline.map((ch, i) => `${i + 1}. ${ch.title}: ${ch.summary}`).join('\n')}`
            : '';

        const userMsg = `I want to create a new book with the following details:\n\nTitle: ${topic}\nDescription: ${description}${instructions ? `\nWriting style: ${instructions}` : ''}\nTarget: ${chapterCount} chapters${proposalData.proposalReason ? `\n\nContext: ${proposalData.proposalReason}` : ''}${currentBookCtx}${seriesInfo}${outlineText}`;
        const modelMsg = `I understand. I'll create "${topic}" — ${description} The book will have approximately ${chapterCount} chapters.`;

        return [
            { role: 'user', parts: [{ text: userMsg }] },
            { role: 'model', parts: [{ text: modelMsg }] },
        ];
    };

    const buildBrainstormContext = (): string => {
        const parts: string[] = [];
        if (currentBook) {
            parts.push(`Current book: "${currentBook.topic}"${currentBook.description ? ` — ${currentBook.description}` : ''}.`);
            if (currentBook.seriesName) parts.push(`Part of series: "${currentBook.seriesName}".`);
        }
        parts.push(`New book proposal: "${topic}". ${proposalData.proposalReason || ''}`);
        parts.push(`Description: ${description}`);
        if (instructions) parts.push(`Writing style: ${instructions}`);
        parts.push(`Target length: ~${chapterCount} chapters.`);
        return parts.join('\n');
    };

    const handleGenerate = async () => {
        setIsLoading(true);
        setLoadingMessage('Architecting your book…');
        try {
            const history = buildSyntheticHistory();
            const bookData = await generateFullBookDataFromChat(history, chapterCount);

            setLoadingMessage('Creating your book…');

            const initialData: Partial<Book> = {
                ...bookData,
                outline: (bookData.outline || []).map(ch => ({
                    ...ch,
                    id: crypto.randomUUID(),
                    status: 'todo' as const,
                })),
                content: (bookData.outline || []).map(ch => ({ title: ch.title, htmlContent: '' })),
                status: 'draft',
            };

            if (proposalData.addToCurrentSeries && currentBook?.seriesId) {
                initialData.seriesId = currentBook.seriesId;
                initialData.seriesName = currentBook.seriesName;
            }

            let newId: string;
            if (bookData.isSeries && bookData.seriesTitle && !proposalData.addToCurrentSeries) {
                newId = await createNewSeriesAndFirstBook(bookData.seriesTitle, bookData.topic, initialData);
            } else {
                newId = await createNewBook(initialData);
            }

            toastService.success(`Book created: ${topic}`);
            onClose();
            navigate(`/editor/${newId}`);
        } catch (e: any) {
            toastService.error(`Failed to generate book: ${e.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleStartBrainstorm = async () => {
        const context = buildBrainstormContext();
        setMode('brainstorm');
        setIsLoading(true);

        const seedPrompt = `I want to brainstorm a new book called "${topic}". Here are the initial details:\n\n${context}\n\nHelp me develop this concept further and refine the outline.`;
        const placeholder: ChatMessage = { role: 'model', parts: [{ text: '' }] };
        setUiMessages([{ role: 'user', parts: [{ text: seedPrompt }] }, placeholder]);

        try {
            let newHistory: Content[] = [];
            newHistory = await streamBrainstorm(
                seedPrompt,
                [],
                (chunk) => {
                    setUiMessages(prev => {
                        const updated = [...prev];
                        const last = updated[updated.length - 1];
                        if (last.role === 'model') {
                            last.parts = [{ text: ((last.parts[0] as any).text || '') + chunk }];
                        }
                        return updated;
                    });
                },
                context,
            );
            setChatHistory(newHistory);
        } catch (e: any) {
            toastService.error(`AI error: ${e.message}`);
            setUiMessages(prev => prev.slice(0, -1));
        } finally {
            setIsLoading(false);
        }
    };

    const handleSendBrainstorm = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!chatInput.trim() || isLoading) return;

        const userMsg = chatInput.trim();
        setChatInput('');
        if (textareaRef.current) textareaRef.current.style.height = '46px';
        setIsLoading(true);

        setUiMessages(prev => [
            ...prev,
            { role: 'user', parts: [{ text: userMsg }] },
            { role: 'model', parts: [{ text: '' }] },
        ]);

        try {
            const newHistory = await streamBrainstorm(
                userMsg,
                chatHistory,
                (chunk) => {
                    setUiMessages(prev => {
                        const updated = [...prev];
                        const last = updated[updated.length - 1];
                        if (last.role === 'model') {
                            last.parts = [{ text: ((last.parts[0] as any).text || '') + chunk }];
                        }
                        return updated;
                    });
                },
            );
            setChatHistory(newHistory);
        } catch (e: any) {
            toastService.error(`AI error: ${e.message}`);
            setUiMessages(prev => prev.slice(0, -1));
        } finally {
            setIsLoading(false);
        }
    };

    const handleFinishBrainstorm = async () => {
        setIsLoading(true);
        setLoadingMessage('Architecting your book from the conversation…');
        try {
            const bookData = await generateFullBookDataFromChat(chatHistory, chapterCount);

            setLoadingMessage('Creating your book…');
            const initialData: Partial<Book> = {
                ...bookData,
                outline: (bookData.outline || []).map(ch => ({
                    ...ch,
                    id: crypto.randomUUID(),
                    status: 'todo' as const,
                })),
                content: (bookData.outline || []).map(ch => ({ title: ch.title, htmlContent: '' })),
                status: 'draft',
                bookChatHistory: chatHistory.map(h => ({
                    role: h.role as string,
                    parts: h.parts ? h.parts.map(p => ({ text: p.text })) as any : [],
                })),
            };

            if (proposalData.addToCurrentSeries && currentBook?.seriesId) {
                initialData.seriesId = currentBook.seriesId;
                initialData.seriesName = currentBook.seriesName;
            }

            let newId: string;
            if (bookData.isSeries && bookData.seriesTitle && !proposalData.addToCurrentSeries) {
                newId = await createNewSeriesAndFirstBook(bookData.seriesTitle, bookData.topic, initialData);
            } else {
                newId = await createNewBook(initialData);
            }

            toastService.success(`Book created: ${bookData.topic}`);
            onClose();
            navigate(`/editor/${newId}`);
        } catch (e: any) {
            toastService.error(`Failed to generate book: ${e.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleInputResize = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setChatInput(e.target.value);
        e.target.style.height = 'auto';
        e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`;
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendBrainstorm();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-xl flex flex-col overflow-hidden border border-zinc-200 dark:border-zinc-700"
                style={{ maxHeight: 'calc(100vh - 2rem)' }}>

                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-zinc-200 dark:border-zinc-800 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-violet-100 dark:bg-violet-900/50 rounded-lg text-violet-600 dark:text-violet-400">
                            <Icon name="BOOK" className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="font-bold text-zinc-800 dark:text-zinc-100">
                                {mode === 'brainstorm' ? 'Brainstorm New Book' : 'Create New Book'}
                            </h2>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                {mode === 'brainstorm' ? 'Refine the concept with AI, then generate' : 'Review and generate'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 transition-colors">
                        <Icon name="CLOSE" className="w-5 h-5" />
                    </button>
                </div>

                {/* Loading overlay */}
                {isLoading && mode === 'select' && (
                    <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
                        <div className="w-10 h-10 rounded-full border-4 border-violet-200 border-t-violet-600 animate-spin" />
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center">{loadingMessage}</p>
                    </div>
                )}

                {/* Select mode */}
                {!isLoading && mode === 'select' && (
                    <div className="flex-1 overflow-y-auto p-5 space-y-4">
                        {proposalData.proposalReason && (
                            <p className="text-xs text-violet-600 dark:text-violet-400 italic bg-violet-50 dark:bg-violet-900/20 rounded-lg px-3 py-2">
                                {proposalData.proposalReason}
                            </p>
                        )}

                        <div>
                            <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Title</label>
                            <input
                                value={topic}
                                onChange={e => setTopic(e.target.value)}
                                className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Description</label>
                            <textarea
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                rows={3}
                                className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Writing Instructions</label>
                            <textarea
                                value={instructions}
                                onChange={e => setInstructions(e.target.value)}
                                rows={2}
                                placeholder="Style, tone, POV…"
                                className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Chapter Count</label>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setChapterCount(c => Math.max(1, c - 1))}
                                    className="w-8 h-8 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-lg font-bold transition-colors"
                                >−</button>
                                <input
                                    type="number"
                                    min={1}
                                    max={200}
                                    value={chapterCount}
                                    onChange={e => setChapterCount(Math.max(1, Math.min(200, parseInt(e.target.value) || 1)))}
                                    className="w-16 text-center px-2 py-1.5 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                                />
                                <button
                                    onClick={() => setChapterCount(c => Math.min(200, c + 1))}
                                    className="w-8 h-8 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-lg font-bold transition-colors"
                                >+</button>
                                <span className="text-xs text-zinc-400">chapters</span>
                            </div>
                        </div>

                        {proposalData.addToCurrentSeries && currentBook?.seriesName && (
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800 rounded-lg px-3 py-2">
                                Will be added to series: <span className="font-semibold">{currentBook.seriesName}</span>
                            </p>
                        )}
                    </div>
                )}

                {/* Brainstorm chat mode */}
                {mode === 'brainstorm' && (
                    <div className="flex-1 flex flex-col overflow-hidden">
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {uiMessages.map((msg, idx) => {
                                const text = (msg.parts[0] as any)?.text || '';
                                const isUser = msg.role === 'user';
                                if (!text && !isLoading) return null;
                                const html = marked.parse(text, { breaks: true }) as string;
                                return (
                                    <div key={idx} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[90%] rounded-2xl p-3 text-sm shadow-sm ${isUser
                                            ? 'bg-violet-600 text-white rounded-tr-none'
                                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-tl-none border border-zinc-200 dark:border-zinc-700'}`}>
                                            <div className="prose prose-sm max-w-none dark:prose-invert break-words"
                                                dangerouslySetInnerHTML={{ __html: html || '' }} />
                                        </div>
                                    </div>
                                );
                            })}
                            {isLoading && (
                                <div className="flex justify-start">
                                    <div className="bg-zinc-100 dark:bg-zinc-800 rounded-2xl rounded-tl-none p-3 border border-zinc-200 dark:border-zinc-700 flex gap-1">
                                        <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                        <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                        <span className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                    </div>
                                </div>
                            )}
                            {isLoading && loadingMessage && (
                                <p className="text-center text-xs text-zinc-400">{loadingMessage}</p>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Chat input */}
                        <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 flex-shrink-0">
                            <div className="flex items-end gap-2">
                                <div className="flex items-center gap-2 mb-2 mr-auto">
                                    <label className="text-xs text-zinc-500">Chapters:</label>
                                    <button onClick={() => setChapterCount(c => Math.max(1, c - 1))}
                                        className="w-6 h-6 rounded border border-zinc-300 dark:border-zinc-600 text-xs flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-700">−</button>
                                    <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 min-w-[20px] text-center">{chapterCount}</span>
                                    <button onClick={() => setChapterCount(c => Math.min(200, c + 1))}
                                        className="w-6 h-6 rounded border border-zinc-300 dark:border-zinc-600 text-xs flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-700">+</button>
                                </div>
                                <textarea
                                    ref={textareaRef}
                                    value={chatInput}
                                    onChange={handleInputResize}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Refine the idea…"
                                    rows={1}
                                    disabled={isLoading}
                                    className="flex-1 px-3 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                                    style={{ minHeight: '40px', maxHeight: '120px' }}
                                />
                                <button
                                    onClick={() => handleSendBrainstorm()}
                                    disabled={isLoading || !chatInput.trim()}
                                    className="p-2 rounded-xl bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40 transition-colors flex-shrink-0"
                                >
                                    <Icon name="CHEVRON_RIGHT" className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Footer buttons */}
                {!(isLoading && mode === 'select') && (
                    <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex gap-2 flex-shrink-0">
                        {mode === 'select' ? (
                            <>
                                <button
                                    onClick={handleStartBrainstorm}
                                    disabled={!topic.trim()}
                                    className="flex-1 py-2.5 rounded-xl border-2 border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300 font-semibold text-sm hover:bg-violet-50 dark:hover:bg-violet-900/30 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
                                >
                                    <Icon name="MESSAGE_CIRCLE" className="w-4 h-4" />
                                    Brainstorm
                                </button>
                                <button
                                    onClick={handleGenerate}
                                    disabled={!topic.trim()}
                                    className="flex-1 py-2.5 rounded-xl bg-violet-600 text-white font-semibold text-sm hover:bg-violet-700 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
                                >
                                    <Icon name="SPARKLES" className="w-4 h-4" />
                                    Generate
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    onClick={() => setMode('select')}
                                    disabled={isLoading}
                                    className="px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 font-semibold text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 transition-colors"
                                >
                                    Back
                                </button>
                                <button
                                    onClick={handleFinishBrainstorm}
                                    disabled={isLoading || chatHistory.length < 2}
                                    className="flex-1 py-2.5 rounded-xl bg-violet-600 text-white font-semibold text-sm hover:bg-violet-700 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
                                >
                                    <Icon name="SPARKLES" className="w-4 h-4" />
                                    Create Book from Chat
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default withModalPortal(NewBookFromChatModal);
