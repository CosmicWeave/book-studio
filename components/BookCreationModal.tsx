
import React, { useState, useContext, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../contexts/AppContext';
import { ICONS } from '../constants';
import Icon from './Icon';
import { ChatMessage } from '../types';
import { Content } from '@google/genai';
import { streamBrainstorm, generateFullBookDataFromChat } from '../services/gemini';
import { marked } from 'marked';
import { toastService } from '../services/toastService';

interface BookCreationModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type CreationMode = 'select' | 'manual' | 'brainstorm';

const BookCreationModal: React.FC<BookCreationModalProps> = ({ isOpen, onClose }) => {
    const { createNewBook, isAiEnabled } = useContext(AppContext);
    const navigate = useNavigate();
    
    const [mode, setMode] = useState<CreationMode>('select');
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    
    // Manual Form State
    const [bookTopic, setBookTopic] = useState('');
    const [bookSubtitle, setBookSubtitle] = useState('');
    const [bookDescription, setBookDescription] = useState('');
    const [bookInstructions, setBookInstructions] = useState('');
    const [generateImages, setGenerateImages] = useState(false);
    const [imageStyle, setImageStyle] = useState('Photorealistic, cinematic lighting');

    // Chat State
    const [chatHistory, setChatHistory] = useState<Content[]>([]);
    const [uiMessages, setUiMessages] = useState<ChatMessage[]>([
        { role: 'model', parts: [{ text: "Hi there! I'm your creative consultant. Let's build your book together. What genre or idea do you have in mind?" }] }
    ]);
    const [chatInput, setChatInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (isOpen) {
            // Reset state on open
            setMode(isAiEnabled ? 'select' : 'manual');
            setBookTopic('');
            setBookSubtitle('');
            setBookDescription('');
            setBookInstructions('');
            setGenerateImages(false);
            setChatHistory([]);
            setUiMessages([{ role: 'model', parts: [{ text: "Hi there! I'm your creative consultant. Let's build your book together. What genre or idea do you have in mind?" }] }]);
            setIsLoading(false);
        }
    }, [isOpen, isAiEnabled]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [uiMessages, mode]);

    const handleManualStart = () => {
        setMode('manual');
    };

    const handleBrainstormStart = () => {
        setMode('brainstorm');
    };

    const handleCreateBook = async () => {
        if (!bookTopic.trim()) {
            toastService.error("Please enter a book title.");
            return;
        }
        setIsLoading(true);
        setLoadingMessage('Creating your book...');
        try {
            const newBookId = await createNewBook({
                topic: bookTopic,
                subtitle: bookSubtitle,
                description: bookDescription,
                instructions: bookInstructions,
                generateImages,
                imageGenerationInstructions: imageStyle
            });
            navigate(`/editor/${newBookId}`);
            onClose();
        } catch (e: any) {
            toastService.error(`Failed to create book: ${e.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    // Chat Handlers
    const handleSendMessage = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!chatInput.trim() || isLoading) return;

        const userMsg = chatInput.trim();
        setChatInput('');
        if (textareaRef.current) {
            textareaRef.current.style.height = '46px'; // Reset to min height
        }
        setIsLoading(true);

        // Update UI immediately
        const newUiMsg: ChatMessage = { role: 'user', parts: [{ text: userMsg }] };
        setUiMessages(prev => [...prev, newUiMsg]);

        // Create AI placeholder in UI
        const placeholderMsg: ChatMessage = { role: 'model', parts: [{ text: '' }] };
        setUiMessages(prev => [...prev, placeholderMsg]);

        try {
            const newHistory = await streamBrainstorm(
                userMsg,
                chatHistory,
                (chunk) => {
                    setUiMessages(prev => {
                        const updated = [...prev];
                        const last = updated[updated.length - 1];
                        if (last.role === 'model') {
                            const currentText = (last.parts[0] as any).text || '';
                            last.parts = [{ text: currentText + chunk }];
                        }
                        return updated;
                    });
                }
            );
            setChatHistory(newHistory);
        } catch (e: any) {
            toastService.error("Failed to get response from AI.");
            // Remove placeholder
            setUiMessages(prev => prev.slice(0, -1));
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const handleInputResize = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setChatInput(e.target.value);
        e.target.style.height = 'auto';
        e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`;
    };

    const handleFinishBrainstorming = async () => {
        if (uiMessages.length < 3) {
            toastService.info("Let's chat a bit more to flesh out the idea first.");
            return;
        }
        
        setIsLoading(true);
        setLoadingMessage('Architecting your book... Generating outline and knowledge base...');
        
        try {
            // Generate EVERYTHING from the chat history
            const bookData = await generateFullBookDataFromChat(chatHistory);
            
            const newBookId = await createNewBook({
                ...bookData,
                bookChatHistory: chatHistory.map(h => ({
                    role: h.role as string,
                    parts: h.parts ? h.parts.map(p => ({ text: p.text })) as any : []
                }))
            });
            
            navigate(`/editor/${newBookId}`);
            onClose();
            toastService.success("Book created successfully!");
        } catch (e: any) {
            toastService.error(`Failed to generate book: ${e.message}. Please try again.`);
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    const renderSelectMode = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full place-items-center p-8">
            <button 
                onClick={handleManualStart}
                className="w-full h-64 bg-zinc-50 dark:bg-zinc-700/30 hover:bg-zinc-100 dark:hover:bg-zinc-700 border-2 border-zinc-200 dark:border-zinc-600 hover:border-indigo-500 dark:hover:border-indigo-500 rounded-2xl flex flex-col items-center justify-center p-6 transition-all group"
            >
                <div className="w-20 h-20 bg-zinc-200 dark:bg-zinc-600 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <Icon name="EDIT" className="w-10 h-10 text-zinc-500 dark:text-zinc-300" />
                </div>
                <h3 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">Manual Setup</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 text-center">
                    I already have a title and idea.<br/>Let me configure it manually.
                </p>
            </button>

            {isAiEnabled && (
            <button 
                onClick={handleBrainstormStart}
                className="w-full h-64 bg-indigo-50 dark:bg-indigo-900/10 hover:bg-indigo-100 dark:hover:bg-indigo-900/20 border-2 border-indigo-200 dark:border-indigo-800 hover:border-indigo-500 dark:hover:border-indigo-400 rounded-2xl flex flex-col items-center justify-center p-6 transition-all group relative overflow-hidden"
            >
                <div className="absolute top-0 right-0 p-2">
                    <span className="bg-indigo-600 text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wide">AI Powered</span>
                </div>
                <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-900/50 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <Icon name="SPARKLES" className="w-10 h-10 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h3 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">Book Architect</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 text-center">
                    Chat with an expert to brainstorm<br/>and automatically generate your book.
                </p>
            </button>
            )}
        </div>
    );

    const renderBrainstormMode = () => (
        <div className="flex flex-col h-full">
            <div className="flex-grow overflow-y-auto p-4 space-y-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-200 dark:border-zinc-700 m-4 mb-0">
                {uiMessages.map((msg, idx) => {
                    const isUser = msg.role === 'user';
                    const text = (msg.parts[0] as any).text || '';
                    if (!text && !isLoading) return null;
                    
                    return (
                        <div key={idx} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] rounded-2xl p-3 text-sm shadow-sm ${
                                isUser 
                                    ? 'bg-indigo-600 text-white rounded-tr-none' 
                                    : 'bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-tl-none border border-zinc-200 dark:border-zinc-700'
                            }`}>
                                <div 
                                    className={`prose prose-sm max-w-none leading-relaxed break-words ${isUser ? 'prose-user-bubble' : 'dark:prose-invert'}`} 
                                    dangerouslySetInnerHTML={{ __html: marked.parse(text, { breaks: true }) as string }} 
                                />
                            </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>
            
            <div className="p-4 flex items-end gap-2">
                <div className="flex-grow relative">
                    <textarea 
                        ref={textareaRef}
                        value={chatInput} 
                        onChange={handleInputResize}
                        onKeyDown={handleKeyDown}
                        placeholder="Type your response..." 
                        rows={1}
                        className="w-full bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:text-white resize-none max-h-40"
                        disabled={isLoading}
                        style={{ minHeight: '46px' }}
                    />
                </div>
                <button 
                    onClick={handleSendMessage} 
                    disabled={isLoading || !chatInput.trim()} 
                    className="p-3 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:opacity-50 transition-colors mb-1"
                >
                    <Icon name={isLoading ? "ROTATE_CW" : "MESSAGE_CIRCLE"} className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
                
                <div className="w-px h-8 bg-zinc-300 dark:bg-zinc-700 mx-2 mb-2"></div>
                
                <button 
                    onClick={handleFinishBrainstorming} 
                    disabled={uiMessages.length < 3 || isLoading}
                    className="whitespace-nowrap bg-emerald-600 text-white px-4 py-2.5 rounded-full font-semibold hover:bg-emerald-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 disabled:cursor-not-allowed transition-colors flex items-center space-x-2 mb-1"
                >
                    <Icon name="WAND" className="w-4 h-4" />
                    <span>I'm Ready</span>
                </button>
            </div>
        </div>
    );

    const renderManualForm = () => (
        <div className="p-6 md:p-8 space-y-6 h-full overflow-y-auto">
            <h3 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 border-b border-zinc-200 dark:border-zinc-700 pb-2">
                Book Details
            </h3>
            
            <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="topic" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Book Title</label>
                        <input 
                            type="text" 
                            id="topic" 
                            value={bookTopic} 
                            onChange={e => setBookTopic(e.target.value)} 
                            className="mt-1 block w-full bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-lg font-semibold"
                            placeholder="e.g., The Last Starship"
                        />
                    </div>
                    <div>
                        <label htmlFor="subtitle" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Subtitle <span className="text-zinc-400 font-normal">(Optional)</span></label>
                        <input 
                            type="text" 
                            id="subtitle" 
                            value={bookSubtitle} 
                            onChange={e => setBookSubtitle(e.target.value)} 
                            className="mt-1 block w-full bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-lg"
                            placeholder="e.g., A Journey Beyond"
                        />
                    </div>
                </div>

                <div>
                    <label htmlFor="description" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Premise / Description</label>
                    <textarea 
                        id="description" 
                        value={bookDescription} 
                        onChange={e => setBookDescription(e.target.value)} 
                        rows={3}
                        className="mt-1 block w-full bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="What is this book about?"
                    />
                </div>

                <div>
                    <label htmlFor="instructions" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Writing Style & Tone</label>
                    <textarea 
                        id="instructions" 
                        value={bookInstructions} 
                        onChange={e => setBookInstructions(e.target.value)} 
                        rows={3}
                        className="mt-1 block w-full bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="e.g., Fast-paced, witty, first-person perspective..."
                    />
                </div>

                {isAiEnabled && (
                <div className="flex items-center pt-2">
                    <input 
                        id="generateImages" 
                        type="checkbox" 
                        checked={generateImages} 
                        onChange={e => setGenerateImages(e.target.checked)} 
                        className="h-4 w-4 text-indigo-600 border-zinc-300 rounded focus:ring-indigo-500"
                    />
                    <label htmlFor="generateImages" className="ml-2 block text-sm text-zinc-900 dark:text-zinc-200">Enable AI Image Generation</label>
                </div>
                )}

                {generateImages && (
                    <div className="animate-fade-in">
                        <label htmlFor="imageStyle" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Art Style</label>
                        <input 
                            type="text" 
                            id="imageStyle" 
                            value={imageStyle} 
                            onChange={e => setImageStyle(e.target.value)} 
                            className="mt-1 block w-full bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="e.g., Oil painting, Cyberpunk, Minimalist vector..."
                        />
                    </div>
                )}
            </div>

            <div className="pt-6 flex justify-end space-x-3">
                <button 
                    onClick={handleCreateBook} 
                    className="bg-indigo-600 text-white px-6 py-2 rounded-lg shadow-md font-bold hover:bg-indigo-700 transition-transform transform hover:scale-105 flex items-center space-x-2"
                >
                    <Icon name="BOOK" className="w-5 h-5" />
                    <span>Create Book</span>
                </button>
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-white dark:bg-zinc-800 w-full max-w-4xl h-[80vh] rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/50">
                    <div className="flex items-center space-x-2">
                        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
                            <Icon name={mode === 'brainstorm' ? 'SPARKLES' : 'PLUS'} className="w-5 h-5" />
                        </div>
                        <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-100">
                            {mode === 'select' ? 'Create New Book' : mode === 'brainstorm' ? 'Creative Brainstorm' : 'Configure Book'}
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
                        <Icon name="CLOSE" className="w-6 h-6 text-zinc-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-grow overflow-hidden relative">
                    {isLoading && mode !== 'brainstorm' && (
                        <div className="absolute inset-0 bg-white/80 dark:bg-zinc-900/80 z-10 flex flex-col items-center justify-center">
                            <div className="w-12 h-12 border-4 border-t-indigo-500 border-zinc-200 rounded-full animate-spin mb-4"></div>
                            <p className="text-zinc-600 dark:text-zinc-300 font-semibold animate-pulse">{loadingMessage}</p>
                        </div>
                    )}
                    
                    {mode === 'select' && renderSelectMode()}
                    {mode === 'brainstorm' && renderBrainstormMode()}
                    {mode === 'manual' && renderManualForm()}
                </div>
            </div>
        </div>
    );
};

export default BookCreationModal;