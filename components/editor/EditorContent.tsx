
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useBookEditor } from '../../contexts/BookEditorContext';
import ChapterEditor from '../ChapterEditor';
import ChapterBreakdown from './ChapterBreakdown';
import { ICONS } from '../../constants';
import Icon from '../Icon';
import { ImageSuggestion } from '../../types';
import { ViewSettings } from '../../pages/BookEditor';

interface EditorContentProps {
    viewSettings?: ViewSettings;
}

const EditorContent: React.FC<EditorContentProps> = ({ viewSettings }) => {
    const {
        book,
        handleTitleChange,
        handleSubtitleChange,
        handleChapterTitleChange,
        handleContentChange,
        handleEditImage,
        activeChapterIndex,
        setActiveChapterIndex,
        handleGenerateChapterBreakdown,
        handleOpenAnalysisModal,
        handleDeleteChapter,
        handleMergeChapters,
        isGeneratingChapter,
        setImageSuggestions,
        openImageSuggestionModal,
        handleAnalyzeChapterStyle,
        handleDownloadAudiobook,
        handleAddChapter,
        handleUpdatePart,
        handleUpdatePartContent,
        isAiEnabled
    } = useBookEditor();
    const contentRef = useRef<HTMLDivElement>(null);
    const [activeMenuIndex, setActiveMenuIndex] = useState<number | null>(null);

    // Observer for setting active chapter based on scroll position
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        const index = parseInt(entry.target.getAttribute('data-chapter-index') || '0', 10);
                        setActiveChapterIndex(index);
                    }
                });
            },
            {
                root: null,
                rootMargin: "-40% 0px -60% 0px", // A horizontal "line" in the middle of the viewport
                threshold: 0,
            }
        );

        const articles = contentRef.current?.querySelectorAll('article[data-chapter-index]');
        if (articles) {
            articles.forEach((article) => observer.observe(article));
        }

        return () => {
            if (articles) {
                articles.forEach((article) => observer.unobserve(article));
            }
        };
    }, [book, setActiveChapterIndex]);
    
    // Parser for finding image suggestions in the content
    useEffect(() => {
        if (!contentRef.current) return;
    
        const parse = () => {
            if (!contentRef.current) return;
            const suggestionElements = contentRef.current.querySelectorAll('span[data-ai-image-suggestion]');
            const suggestions: ImageSuggestion[] = [];
            
            suggestionElements.forEach((el, index) => {
                const chapterArticle = el.closest('article[data-chapter-index]');
                const chapterIndex = parseInt(chapterArticle?.getAttribute('data-chapter-index') || '-1', 10);
                const prompt = el.getAttribute('data-ai-image-suggestion') || '';
    
                if (chapterIndex !== -1 && prompt) {
                    // Use a deterministic ID based on content and position to prevent infinite loops
                    // caused by random ID generation on every render/observation.
                    const id = `suggestion-${chapterIndex}-${index}-${prompt.substring(0, 16).replace(/[^a-z0-9]/gi, '')}`;
                    
                    // Only set the attribute if it's different to minimize DOM mutations
                    if (el.getAttribute('data-suggestion-id') !== id) {
                        el.setAttribute('data-suggestion-id', id);
                    }

                    suggestions.push({ id, chapterIndex, prompt });
                }
            });

            // Only update state if suggestions have actually changed to prevent infinite loops
            setImageSuggestions((prev: ImageSuggestion[]) => {
                const isSame = prev.length === suggestions.length && prev.every((item, index) => 
                    item.id === suggestions[index].id && 
                    item.chapterIndex === suggestions[index].chapterIndex && 
                    item.prompt === suggestions[index].prompt
                );
                return isSame ? prev : suggestions;
            });
        };
    
        // We use a MutationObserver to robustly detect when Tiptap has rendered the content.
        const observer = new MutationObserver(parse);
        observer.observe(contentRef.current, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-ai-image-suggestion'] });
        
        parse(); // Initial parse
    
        return () => observer.disconnect();
    }, [book?.content, setImageSuggestions]);

    // Click handler for suggestion icons
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            const suggestionSpan = target.closest('span[data-ai-image-suggestion]');
            if (suggestionSpan) {
                const id = suggestionSpan.getAttribute('data-suggestion-id');
                const prompt = suggestionSpan.getAttribute('data-ai-image-suggestion') || '';
                const chapterArticle = suggestionSpan.closest('article[data-chapter-index]');
                const chapterIndex = parseInt(chapterArticle?.getAttribute('data-chapter-index') || '-1', 10);
                
                if (id && chapterIndex !== -1) {
                    openImageSuggestionModal({ id, chapterIndex, prompt });
                }
            }
        };
        
        const contentEl = contentRef.current;
        contentEl?.addEventListener('click', handleClick);
    
        return () => contentEl?.removeEventListener('click', handleClick);
    }, [openImageSuggestionModal]);


    if (!book) return null;

    // Determine style classes based on ViewSettings
    const maxWidthClass = useMemo(() => {
        switch (viewSettings?.width) {
            case 'narrow': return 'max-w-2xl mx-auto';
            case 'wide': return 'max-w-none';
            default: return 'max-w-4xl mx-auto'; // standard
        }
    }, [viewSettings?.width]);

    const fontClass = viewSettings?.font === 'sans' ? 'font-sans' : 'font-serif';

    return (
        <div ref={contentRef} className="w-full space-y-6">
            <div className={`bg-white dark:bg-zinc-800 p-6 sm:p-10 rounded-lg shadow-md border border-zinc-200 dark:border-zinc-700 min-h-[80vh] ${book.outline.length === 0 ? 'empty-state-bg' : ''} ${fontClass}`}>
                {book.outline.length > 0 ? (
                    <div className={`prose-base dark:prose-invert ${maxWidthClass} transition-all duration-300`}>
                        <div className="text-center mb-16">
                            <h1
                                contentEditable={true}
                                suppressContentEditableWarning={true}
                                onBlur={handleTitleChange}
                                className="hover:bg-zinc-100 dark:hover:bg-zinc-700/50 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-md px-2 -mx-2 cursor-text mb-2 inline-block"
                            >
                                {book.topic}
                            </h1>
                            <h2
                                className="text-2xl text-zinc-500 dark:text-zinc-400 font-light mt-0 hover:bg-zinc-100 dark:hover:bg-zinc-700/50 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-md px-2 -mx-2 cursor-text inline-block empty:before:content-['Add_subtitle...'] empty:before:text-zinc-300 dark:empty:before:text-zinc-600"
                                contentEditable={true}
                                suppressContentEditableWarning={true}
                                onBlur={handleSubtitleChange}
                            >
                                {book.subtitle}
                            </h2>
                        </div>
                        
                        {(() => {
                            let lastPart = '';
                            const chaptersToRender = book.content.length === book.outline.length ? book.outline : [ ...book.outline.slice(0, book.content.length), book.outline[book.content.length] ];
                            return (chaptersToRender || book.outline).map((outline, index) => {
                                const content = book.content[index];
                                if (!outline) return null;

                                const showPartHeader = outline.part && outline.part !== lastPart;
                                if (showPartHeader) {
                                    lastPart = outline.part!;
                                }
                                
                                // Use ID as key for stability, fallback to index if ID missing (should be rare after update)
                                const key = outline.id || `chapter-${index}`;

                                return (
                                    <React.Fragment key={key}>
                                        {showPartHeader && (
                                            <div className="mt-16 mb-12">
                                                <h2 
                                                    className="text-center text-3xl font-bold text-zinc-400 dark:text-zinc-600 pb-4 border-b border-zinc-200 dark:border-zinc-700 outline-none hover:text-zinc-500 dark:hover:text-zinc-500 focus:text-zinc-700 dark:focus:text-zinc-300 transition-colors cursor-text"
                                                    contentEditable={true}
                                                    suppressContentEditableWarning={true}
                                                    onBlur={(e) => handleUpdatePart(index, e.currentTarget.textContent || '')}
                                                >
                                                    {lastPart}
                                                </h2>
                                                
                                                <div 
                                                    className="mt-6 text-lg italic text-zinc-600 dark:text-zinc-400 text-center max-w-2xl mx-auto whitespace-pre-wrap outline-none border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700 focus:border-indigo-300 rounded px-4 py-2 transition-colors empty:before:content-['Add_description...'] empty:before:text-zinc-300 dark:empty:before:text-zinc-600 cursor-text"
                                                    contentEditable={true}
                                                    suppressContentEditableWarning={true}
                                                    onBlur={(e) => handleUpdatePartContent(index, e.currentTarget.textContent || '')}
                                                >
                                                    {outline.partContent || ''}
                                                </div>
                                            </div>
                                        )}
                                        <article data-chapter-index={index} className="mb-16">
                                            <div className="relative group mb-6">
                                                <h3
                                                    id={`chapter-${index}`}
                                                    className="scroll-mt-24 hover:bg-zinc-100 dark:hover:bg-zinc-700/50 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-md px-2 -mx-2 cursor-text font-bold text-2xl"
                                                    contentEditable={true}
                                                    suppressContentEditableWarning={true}
                                                    onBlur={(e) => handleChapterTitleChange(e, index)}
                                                >
                                                    {outline.title}
                                                </h3>
                                                {content && content.htmlContent.trim() !== '' && (
                                                    <div className={`absolute top-1/2 right-0 -translate-y-1/2 transition-opacity z-40 ${activeMenuIndex === index ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                                        <button 
                                                            onClick={() => setActiveMenuIndex(activeMenuIndex === index ? null : index)}
                                                            className="p-2 rounded-full bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 shadow-sm"
                                                        >
                                                            <Icon name="MORE_VERTICAL" className="w-5 h-5" />
                                                        </button>
                                                        {activeMenuIndex === index && (
                                                            <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-zinc-800 rounded-md shadow-lg border border-zinc-200 dark:border-zinc-700 z-30 animate-fade-in-up font-sans overflow-hidden">
                                                                {isAiEnabled && (
                                                                <>
                                                                <button
                                                                    onClick={() => { handleOpenAnalysisModal(index); setActiveMenuIndex(null); }}
                                                                    className="w-full text-left flex items-center space-x-2 px-4 py-2 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                                                                >
                                                                    <Icon name="SPARKLES" className="w-4 h-4" />
                                                                    <span>Analyze Content</span>
                                                                </button>
                                                                <button
                                                                    onClick={() => { handleAnalyzeChapterStyle(index); setActiveMenuIndex(null); }}
                                                                    className="w-full text-left flex items-center space-x-2 px-4 py-2 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                                                                >
                                                                    <Icon name="TONE" className="w-4 h-4" />
                                                                    <span>Analyze Style & Tone</span>
                                                                </button>
                                                                <button
                                                                    onClick={() => { handleDownloadAudiobook(index); setActiveMenuIndex(null); }}
                                                                    className="w-full text-left flex items-center space-x-2 px-4 py-2 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                                                                >
                                                                    <Icon name="DOWNLOAD" className="w-4 h-4" />
                                                                    <span>Download Audio</span>
                                                                </button>
                                                                <div className="my-1 border-t border-zinc-100 dark:border-zinc-700"></div>
                                                                </>
                                                                )}
                                                                <button
                                                                    onClick={() => { handleAddChapter(index, 'before'); setActiveMenuIndex(null); }}
                                                                    className="w-full text-left flex items-center space-x-2 px-4 py-2 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                                                                >
                                                                    <Icon name="PLUS" className="w-4 h-4" />
                                                                    <span>Insert Chapter Above</span>
                                                                </button>
                                                                <button
                                                                    onClick={() => { handleAddChapter(index, 'after'); setActiveMenuIndex(null); }}
                                                                    className="w-full text-left flex items-center space-x-2 px-4 py-2 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                                                                >
                                                                    <Icon name="PLUS" className="w-4 h-4" />
                                                                    <span>Insert Chapter Below</span>
                                                                </button>
                                                                <div className="my-1 border-t border-zinc-100 dark:border-zinc-700"></div>
                                                                {index < book.outline.length - 1 && (
                                                                <button
                                                                    onClick={() => { handleMergeChapters(index); setActiveMenuIndex(null); }}
                                                                    className="w-full text-left flex items-center space-x-2 px-4 py-2 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                                                                >
                                                                    <Icon name="EXPAND" className="w-4 h-4" style={{ transform: 'rotate(45deg)'}} />
                                                                    <span>Merge with Next Chapter</span>
                                                                </button>
                                                                )}
                                                                <button
                                                                    onClick={() => { handleDeleteChapter(index); setActiveMenuIndex(null); }}
                                                                    className="w-full text-left flex items-center space-x-2 px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/50"
                                                                >
                                                                    <Icon name="TRASH" className="w-4 h-4" />
                                                                    <span>Delete Chapter</span>
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            
                                            {outline.subSections && (
                                                <ChapterBreakdown chapterIndex={index} />
                                            )}

                                            {content ? (
                                                <ChapterEditor
                                                    chapter={content}
                                                    chapterIndex={index}
                                                    isGenerating={isGeneratingChapter === index}
                                                    onUpdate={(newHtml) => handleContentChange(index, newHtml)}
                                                    onEditImage={handleEditImage}
                                                />
                                            ) : outline.subSections ? (
                                                null
                                            ) : (
                                                <div className="text-center py-8 border-2 border-dashed border-zinc-200 dark:border-zinc-700 rounded-lg">
                                                    <p className="text-zinc-500 dark:text-zinc-400">This chapter has no content yet.</p>
                                                    {isAiEnabled && (
                                                    <button 
                                                        onClick={() => handleGenerateChapterBreakdown(index)}
                                                        className="mt-4 bg-indigo-600 text-white px-4 py-2 rounded-lg shadow-md font-semibold hover:bg-indigo-700 transition-colors"
                                                    >
                                                        Break Down Chapter into Sections
                                                    </button>
                                                    )}
                                                </div>
                                            )}
                                        </article>
                                    </React.Fragment>
                                )
                            });
                        })()}
                    </div>
                ) : (
                    <div className="text-center py-20 text-zinc-500 dark:text-zinc-400 h-full flex flex-col justify-center items-center">
                        <Icon name="PEN_TOOL" className="w-20 h-20 mx-auto text-zinc-300 dark:text-zinc-600" />
                        <h3 className="mt-4 text-2xl font-semibold text-zinc-800 dark:text-zinc-100">Your book will appear here</h3>
                        <p className="mt-2 max-w-md">
                            Fill out the details on the left {isAiEnabled ? "and generate an outline" : ""} to begin your creative journey.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default EditorContent;
