
import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../../types';
import { ICONS } from '../../constants';
import Icon from '../Icon';
import { marked } from 'marked';
import { useBookEditor } from '../../contexts/BookEditorContext';
import DiffModal from './DiffModal';

interface ChatModalProps {
    isOpen: boolean;
    onClose: () => void;
    messages: ChatMessage[];
    onSendMessage: (message: string) => void;
    isLoading: boolean;
}

const QUICK_PROMPTS = [
    "Summarize the current chapter",
    "Analyze the tone of this section",
    "Suggest 3 ideas for what happens next",
    "Identify any plot holes in the outline",
    "Describe the character's motivation here",
    "Rewrite the last paragraph to be more descriptive"
];

const ChatModal: React.FC<ChatModalProps> = ({ isOpen, onClose, messages: initialMessages, onSendMessage, isLoading }) => {
    const { chatMessages, book, handleApplyEdit, handleExecuteTool } = useBookEditor(); // Use live messages from context
    const [input, setInput] = useState('');
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const shouldAutoScrollRef = useRef(true);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    
    // State for reviewing edits
    const [reviewData, setReviewData] = useState<{ chapterIndex: number, newContent: string, description: string } | null>(null);
    
    // Use chatMessages from context if available (for streaming), fallback to props
    const messagesToRender = chatMessages || initialMessages;

    const handleScroll = () => {
        const container = messagesContainerRef.current;
        if (container) {
            // Check if user is scrolled to the bottom (with a small tolerance)
            const isAtBottom = container.scrollHeight - container.clientHeight <= container.scrollTop + 20;
            shouldAutoScrollRef.current = isAtBottom;
        }
    };

    useEffect(() => {
        if (isOpen) {
            const container = messagesContainerRef.current;
            if (container && shouldAutoScrollRef.current) {
                container.scrollTop = container.scrollHeight;
            }
        }
    }, [messagesToRender, isOpen, isLoading]);

    const handleSend = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (input.trim() && !isLoading) {
            shouldAutoScrollRef.current = true;
            onSendMessage(input.trim());
            setInput('');
            if (textareaRef.current) {
                textareaRef.current.style.height = '40px';
            }
        }
    };
    
    const handleQuickPrompt = (prompt: string) => {
        shouldAutoScrollRef.current = true;
        onSendMessage(prompt);
    };

    const handleInputResize = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInput(e.target.value);
        e.target.style.height = 'auto';
        e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
    };
    
    const handleApplyFromDiff = () => {
        if (reviewData) {
            handleApplyEdit(reviewData.chapterIndex, reviewData.newContent);
            setReviewData(null);
        }
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Diff Review Modal */}
            {reviewData && book && (
                <DiffModal
                    isOpen={!!reviewData}
                    onClose={() => setReviewData(null)}
                    chapterTitle={book.outline[reviewData.chapterIndex]?.title || `Chapter ${reviewData.chapterIndex + 1}`}
                    changeDescription={reviewData.description}
                    newContent={reviewData.newContent}
                    onApply={handleApplyFromDiff}
                />
            )}

            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60]" onClick={onClose} />
            
            {/* Side Panel */}
            <div className="fixed inset-y-0 right-0 w-full sm:w-96 bg-white dark:bg-zinc-900 shadow-2xl z-[61] flex flex-col border-l border-zinc-200 dark:border-zinc-800 transform transition-transform duration-300 ease-out animate-slide-in-up">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/80 backdrop-blur-md sticky top-0 z-10">
                    <div className="flex items-center space-x-3">
                        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg text-indigo-600 dark:text-indigo-400">
                            <Icon name="MESSAGE_CIRCLE" className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="font-bold text-zinc-800 dark:text-zinc-100">Co-Author Chat</h2>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">Ask me anything about your book</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 transition-colors">
                        <Icon name="CLOSE" className="w-5 h-5" />
                    </button>
                </div>

                {/* Messages */}
                <div ref={messagesContainerRef} onScroll={handleScroll} className="flex-grow overflow-y-auto p-4 space-y-6 bg-white dark:bg-zinc-900">
                    {messagesToRender.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center text-zinc-400 space-y-4">
                            <Icon name="SPARKLES" className="w-12 h-12 text-zinc-300 dark:text-zinc-700" />
                            <p>No messages yet.<br/>Start a conversation with your AI editor.</p>
                        </div>
                    ) : (
                        messagesToRender.map((msg, index) => {
                            const isUser = msg.role === 'user';
                            // Safe access to parts
                            const part = (msg.parts && msg.parts.length > 0) ? msg.parts[0] : null;
                            
                            // Handle function calls (Tool use)
                            if (part && 'functionCall' in part && part.functionCall) {
                                const fc = part.functionCall;
                                const args = fc.args as any;

                                if (fc.name === 'updateChapter') {
                                    return (
                                        <div key={index} className="flex justify-start w-full">
                                            <div className="max-w-[90%] bg-white dark:bg-zinc-800 rounded-2xl rounded-tl-none border-2 border-indigo-100 dark:border-indigo-900/50 p-4 shadow-md">
                                                <div className="flex items-center space-x-2 mb-2">
                                                    <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900 rounded-full text-indigo-600 dark:text-indigo-300">
                                                        <Icon name="EDIT" className="w-4 h-4" />
                                                    </div>
                                                    <h3 className="font-bold text-zinc-800 dark:text-zinc-100 text-sm">Proposed Edit</h3>
                                                </div>
                                                <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">{args.changeDescription}</p>
                                                <button 
                                                    onClick={() => setReviewData({ 
                                                        chapterIndex: args.chapterIndex, 
                                                        newContent: args.newContent, 
                                                        description: args.changeDescription 
                                                    })}
                                                    className="w-full py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center space-x-2"
                                                >
                                                    <span>Review Changes</span>
                                                    <Icon name="CHEVRON_RIGHT" className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                }

                                // Generic handling for other tools
                                let actionDescription = "Unknown Action";
                                if (fc.name === 'updateBookMetadata') {
                                    actionDescription = `Update book details: ${[args.topic, args.subtitle].filter(Boolean).join(', ')}`;
                                } else if (fc.name === 'updateChapterMetadata') {
                                    actionDescription = `Update Chapter ${args.chapterIndex + 1}: ${[args.title, args.part].filter(Boolean).join(', ')}`;
                                } else if (fc.name === 'addChapter') {
                                    actionDescription = `Add new chapter: "${args.title}"`;
                                } else if (fc.name === 'deleteChapter') {
                                    actionDescription = `Delete Chapter ${args.chapterIndex + 1}`;
                                }

                                return (
                                    <div key={index} className="flex justify-start w-full">
                                        <div className="max-w-[90%] bg-white dark:bg-zinc-800 rounded-2xl rounded-tl-none border-2 border-indigo-100 dark:border-indigo-900/50 p-4 shadow-md">
                                            <div className="flex items-center space-x-2 mb-2">
                                                <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900 rounded-full text-indigo-600 dark:text-indigo-300">
                                                    <Icon name="COMMAND" className="w-4 h-4" />
                                                </div>
                                                <h3 className="font-bold text-zinc-800 dark:text-zinc-100 text-sm">Proposed Action</h3>
                                            </div>
                                            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">{actionDescription}</p>
                                            <button 
                                                onClick={() => handleExecuteTool(fc)}
                                                className="w-full py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center space-x-2"
                                            >
                                                <span>Approve</span>
                                                <Icon name="CLOUD_CHECK" className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            }

                            const text = (part && 'text' in part) ? part.text : '';
                            
                            if (!text && !isLoading) return null; // Skip empty messages unless loading placeholder

                            // Parse Markdown for both user and model messages
                            // Enable breaks to handle multiline user input correctly
                            const htmlContent = marked.parse(text || '', { breaks: true }) as string;

                            return (
                                <div key={index} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[90%] rounded-2xl p-4 shadow-sm ${
                                        isUser 
                                            ? 'bg-indigo-600 text-white rounded-tr-none' 
                                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-tl-none border border-zinc-200 dark:border-zinc-700'
                                    }`}>
                                        <div 
                                            className={`prose prose-sm max-w-none leading-relaxed break-words ${isUser ? 'prose-user-bubble' : 'dark:prose-invert'}`} 
                                            dangerouslySetInnerHTML={{ __html: htmlContent || '' }} 
                                        />
                                    </div>
                                </div>
                            );
                        })
                    )}
                    {isLoading && (
                         <div className="flex justify-start">
                            <div className="bg-zinc-100 dark:bg-zinc-800 p-3 rounded-2xl rounded-tl-none border border-zinc-200 dark:border-zinc-700 flex items-center space-x-1">
                                <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce"></div>
                                <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{animationDelay: '0.15s'}}></div>
                                <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{animationDelay: '0.3s'}}></div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Input Area */}
                <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 sticky bottom-0">
                    {/* Quick Prompts */}
                    {messagesToRender.length < 2 && (
                        <div className="flex gap-2 overflow-x-auto pb-3 mb-1 no-scrollbar mask-fade-right">
                            {QUICK_PROMPTS.map((prompt, i) => (
                                <button 
                                    key={i}
                                    onClick={() => handleQuickPrompt(prompt)}
                                    disabled={isLoading}
                                    className="whitespace-nowrap px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-300 border border-zinc-200 dark:border-zinc-700 hover:border-indigo-200 dark:hover:border-indigo-800 rounded-full transition-colors"
                                >
                                    {prompt}
                                </button>
                            ))}
                        </div>
                    )}

                    <form onSubmit={handleSend} className="relative flex items-end gap-2 bg-zinc-100 dark:bg-zinc-800 p-2 rounded-xl border border-transparent focus-within:border-indigo-500 dark:focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 transition-all">
                        <textarea
                            ref={textareaRef}
                            value={input}
                            onChange={handleInputResize}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                            placeholder="Ask about your story..."
                            className="flex-grow bg-transparent border-none focus:ring-0 text-sm text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 resize-none max-h-32 py-2.5 px-2"
                            rows={1}
                            disabled={isLoading}
                            style={{ minHeight: '40px' }}
                        />
                        <button 
                            type="submit" 
                            disabled={isLoading || !input.trim()}
                            className="p-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 disabled:cursor-not-allowed transition-colors mb-[1px]"
                        >
                            <Icon name={isLoading ? "ROTATE_CW" : "MESSAGE_CIRCLE"} className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                        </button>
                    </form>
                </div>
            </div>
        </>
    );
};

export default ChatModal;
