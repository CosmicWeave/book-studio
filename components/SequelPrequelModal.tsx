
import React, { useState, useContext, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Book, ChatMessage } from '../types';
import { ICONS } from '../constants';
import { AppContext } from '../contexts/AppContext';
import { generateSequelIdeas, streamBrainstorm, extractBookMetadataFromChat } from '../services/gemini';
import { toastService } from '../services/toastService';
import Icon from './Icon';
import { marked } from 'marked';
import { Content } from '@google/genai';

interface SequelPrequelModalProps {
    parentBook: Book;
    relationType: 'sequel' | 'prequel';
    onClose: () => void;
}

type ModalMode = 'select' | 'ideas' | 'chat' | 'review';

const SequelPrequelModal: React.FC<SequelPrequelModalProps> = ({ parentBook, relationType, onClose }) => {
    const { createRelatedBook } = useContext(AppContext);
    const navigate = useNavigate();

    const [mode, setMode] = useState<ModalMode>('ideas');
    const [ideas, setIdeas] = useState<string[]>([]);
    const [selectedIdea, setSelectedIdea] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');

    // Chat State
    const [chatHistory, setChatHistory] = useState<Content[]>([]);
    const [uiMessages, setUiMessages] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Review State
    const [bookDescription, setBookDescription] = useState('');
    const [bookInstructions, setBookInstructions] = useState('');
    const [generateImages, setGenerateImages] = useState(parentBook.generateImages);
    const [imageStyle, setImageStyle] = useState(parentBook.imageGenerationInstructions);

    // Load quick ideas on mount
    const fetchIdeas = useCallback(async () => {
        setIsLoading(true);
        setLoadingMessage('Generating ideas...');
        try {
            const result = await generateSequelIdeas(parentBook, relationType);
            setIdeas(result);
            if (result.length > 0) {
                setSelectedIdea(result[0]);
            }
        } catch (e: any) {
            toastService.error(`Failed to generate ideas: ${e.message}`);
        } finally {
            setIsLoading(false);
        }
    }, [parentBook, relationType]);

    useEffect(() => {
        fetchIdeas();
    }, [fetchIdeas]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [uiMessages]);

    const startChat = () => {
        setMode('chat');
        const initialMsg: ChatMessage = { 
            role: 'model', 
            parts: [{ text: `Hi! I'm here to help you plan a ${relationType} to "${parentBook.topic}". What kind of story are you imagining?` }] 
        };
        setUiMessages([initialMsg]);
        setChatHistory([]); // Reset history
        setTimeout(() => textareaRef.current?.focus(), 100);
    };

    const handleSendMessage = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!chatInput.trim() || isLoading) return;

        const userMsg = chatInput.trim();
        setChatInput('');
        if (textareaRef.current) {
            textareaRef.current.style.height = '46px'; // Reset to min height
        }
        setIsLoading(true);

        // Update UI
        const newUiMsg: ChatMessage = { role: 'user', parts: [{ text: userMsg }] };
        setUiMessages(prev => [...prev, newUiMsg]);
        
        // Placeholder for AI response
        const placeholderMsg: ChatMessage = { role: 'model', parts: [{ text: '' }] };
        setUiMessages(prev => [...prev, placeholderMsg]);

        // Provide parent book context
        const context = `
Parent Book Title: "${parentBook.topic}"
Parent Book Description: "${parentBook.description || 'N/A'}"
Relation: The user wants to create a ${relationType}.
Parent Book Outline Summary: ${parentBook.outline.map(ch => ch.title).join(', ')}.
`;

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
                },
                context
            );
            setChatHistory(newHistory);
        } catch (e: any) {
            toastService.error("Failed to get response from AI.");
            setUiMessages(prev => prev.slice(0, -1)); // Remove placeholder
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

    const finishChat = async () => {
        setIsLoading(true);
        setLoadingMessage('Extracting book details...');
        try {
            const metadata = await extractBookMetadataFromChat(chatHistory);
            setSelectedIdea(metadata.topic || `New ${relationType} to ${parentBook.topic}`);
            setBookDescription(metadata.description || '');
            setBookInstructions(metadata.instructions || parentBook.instructions); // Fallback to parent
            setGenerateImages(metadata.generateImages ?? parentBook.generateImages);
            setImageStyle(metadata.imageStyle || parentBook.imageGenerationInstructions);
            setMode('review');
        } catch (e: any) {
            toastService.error("Failed to extract details. Please review manually.");
            setMode('review');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreate = async () => {
        if (!selectedIdea.trim()) {
            toastService.error('Please enter a topic/title for the new book.');
            return;
        }
        setIsCreating(true);
        try {
            const newBookId = await createRelatedBook(
                parentBook, 
                selectedIdea, 
                relationType, 
                {
                    description: bookDescription,
                    instructions: bookInstructions,
                    generateImages: generateImages,
                    imageGenerationInstructions: imageStyle
                }
            );
            navigate(`/editor/${newBookId}`);
            onClose();
        } catch (error: any) {
            toastService.error(`Failed to create ${relationType}: ${error.message}`);
        } finally {
            setIsCreating(false);
        }
    };

    if (!parentBook) return null;

    // --- Render Helpers ---

    const renderIdeasMode = () => (
        <>
            <div className="p-6 space-y-6">
                {/* Chat Option */}
                <div 
                    onClick={startChat}
                    className="group bg-indigo-50 dark:bg-indigo-900/20 border-2 border-indigo-200 dark:border-indigo-800 hover:border-indigo-500 dark:hover:border-indigo-400 rounded-xl p-5 cursor-pointer transition-all flex items-center space-x-4"
                >
                    <div className="p-3 bg-indigo-100 dark:bg-indigo-900/50 rounded-full text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform">
                        <Icon name="SPARKLES" className="w-8 h-8" />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-zinc-800 dark:text-zinc-100">Brainstorm with AI</h3>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">Discuss plot points, continuity, and themes with a creative consultant before starting.</p>
                    </div>
                    <div className="flex-grow text-right">
                        <Icon name="CHEVRON_RIGHT" className="w-6 h-6 text-indigo-400" />
                    </div>
                </div>

                <div className="relative">
                    <div className="absolute inset-0 flex items-center" aria-hidden="true">
                        <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
                    </div>
                    <div className="relative flex justify-center">
                        <span className="px-2 bg-white dark:bg-zinc-800 text-sm text-gray-500">OR CHOOSE A QUICK IDEA</span>
                    </div>
                </div>

                {/* Quick Ideas List */}
                {isLoading ? (
                     <div className="text-center py-4">
                        <div className="w-8 h-8 mx-auto border-4 border-t-indigo-500 border-gray-200 rounded-full animate-spin"></div>
                        <p className="mt-2 text-sm text-gray-500">Generating ideas...</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {ideas.map((idea, index) => (
                            <button
                                key={index}
                                onClick={() => { setSelectedIdea(idea); setMode('review'); }}
                                className="w-full text-left p-4 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700/50 hover:border-indigo-300 dark:hover:border-indigo-600 transition-all"
                            >
                                <span className="font-medium text-zinc-800 dark:text-zinc-200">{idea}</span>
                            </button>
                        ))}
                        <button 
                            onClick={() => { setSelectedIdea(''); setMode('review'); }}
                            className="w-full text-center text-sm text-indigo-600 dark:text-indigo-400 hover:underline p-2"
                        >
                            Skip to manual entry
                        </button>
                    </div>
                )}
            </div>
        </>
    );

    const renderChatMode = () => (
        <div className="flex flex-col h-full max-h-[60vh]">
            <div className="flex-grow overflow-y-auto p-4 space-y-4 bg-zinc-50 dark:bg-zinc-900/50 m-4 mb-0 rounded-xl border border-zinc-200 dark:border-zinc-700">
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
                        className="w-full bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm resize-none max-h-40"
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
                    onClick={finishChat} 
                    disabled={uiMessages.length < 2 || isLoading}
                    className="whitespace-nowrap bg-emerald-600 text-white px-4 py-2.5 rounded-full text-sm font-semibold hover:bg-emerald-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 disabled:cursor-not-allowed transition-colors flex items-center space-x-2 mb-1"
                >
                    <span>I'm Ready</span>
                    <Icon name="CHEVRON_RIGHT" className="w-4 h-4" />
                </button>
            </div>
        </div>
    );

    const renderReviewMode = () => (
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
            <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Book Title</label>
                <input
                    type="text"
                    value={selectedIdea}
                    onChange={e => setSelectedIdea(e.target.value)}
                    className="mt-1 block w-full bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 font-bold"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Description</label>
                <textarea
                    value={bookDescription}
                    onChange={e => setBookDescription(e.target.value)}
                    rows={3}
                    className="mt-1 block w-full bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                    placeholder="What is this book about?"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Writing Style & Instructions</label>
                <textarea
                    value={bookInstructions}
                    onChange={e => setBookInstructions(e.target.value)}
                    rows={3}
                    className="mt-1 block w-full bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                    placeholder="Inherited from parent book if left blank..."
                />
            </div>
            <div className="flex items-center pt-2">
                <input 
                    id="gen-images" 
                    type="checkbox" 
                    checked={generateImages} 
                    onChange={e => setGenerateImages(e.target.checked)} 
                    className="h-4 w-4 text-indigo-600 border-zinc-300 rounded focus:ring-indigo-500"
                />
                <label htmlFor="gen-images" className="ml-2 block text-sm text-zinc-900 dark:text-zinc-200">Generate Chapter Images</label>
            </div>
            {generateImages && (
                <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Image Style</label>
                    <input
                        type="text"
                        value={imageStyle}
                        onChange={e => setImageStyle(e.target.value)}
                        className="mt-1 block w-full bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                    />
                </div>
            )}
        </div>
    );

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col border border-zinc-200 dark:border-zinc-700 max-h-[90vh]" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/50">
                    <div>
                        <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">
                            {mode === 'chat' ? 'Brainstorming...' : mode === 'review' ? 'Review Details' : `Create ${relationType} to "${parentBook.topic}"`}
                        </h2>
                        {mode === 'ideas' && <p className="text-xs text-zinc-500">Choose a path to start your new book</p>}
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700" aria-label="Close">
                        <Icon name="CLOSE" className="w-6 h-6" />
                    </button>
                </div>

                {/* Content Body */}
                <div className="flex-grow overflow-hidden">
                    {mode === 'ideas' && renderIdeasMode()}
                    {mode === 'chat' && renderChatMode()}
                    {mode === 'review' && renderReviewMode()}
                </div>

                {/* Footer Actions (Review Mode only) */}
                {mode === 'review' && (
                    <div className="flex justify-end space-x-3 p-4 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-200 dark:border-zinc-700">
                        <button onClick={() => setMode('ideas')} className="bg-zinc-200 dark:bg-zinc-600 text-zinc-800 dark:text-zinc-100 px-4 py-2 rounded-lg font-semibold hover:bg-zinc-300 dark:hover:bg-zinc-500 transition-colors">Back</button>
                        <button onClick={handleCreate} disabled={isLoading || isCreating} className="bg-indigo-600 text-white px-6 py-2 rounded-lg shadow font-semibold hover:bg-indigo-700 disabled:bg-indigo-400 transition-colors flex items-center space-x-2">
                            {isCreating ? <Icon name="ROTATE_CW" className="w-4 h-4 animate-spin" /> : <Icon name="PLUS" className="w-4 h-4" />}
                            <span>{isCreating ? 'Creating...' : `Create ${relationType}`}</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SequelPrequelModal;
