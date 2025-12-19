
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useBookEditor } from '../contexts/BookEditorContext';
import Loader from '../components/Loader';
import ImageEditModal from '../components/ImageEditModal';
import EpubExportModal from '../components/EpubExportModal';
import SnapshotsPanel from '../components/editor/SnapshotsPanel';
import EditorSidebar from '../components/editor/EditorSidebar';
import EditorContent from '../components/editor/EditorContent';
import OutlineSidebar from '../components/editor/OutlineSidebar';
import BrainstormModal from '../components/editor/BrainstormModal';
import { ICONS } from '../constants';
import ChapterAnalysisModal from '../components/editor/ChapterAnalysisModal';
import StyleAnalysisModal from '../components/editor/StyleAnalysisModal';
import FloatingChatButton from '../components/editor/FloatingChatButton';
import ChatModal from '../components/editor/ChatModal';
import DeepAnalysisModal from '../components/editor/DeepAnalysisModal';
import MacroResultModal from '../components/editor/MacroResultModal';
import { useCommandPalette, Command } from '../contexts/CommandPaletteContext';
import { modalService } from '../services/modalService';
import BookViewSwitcher from '../components/editor/BookViewSwitcher';
import CorkboardView from '../components/editor/views/CorkboardView';
import OutlinerView from '../components/editor/views/OutlinerView';
import KnowledgeBaseModal from '../components/editor/KnowledgeBaseModal';
import EditorFooter from '../components/editor/EditorFooter';
import Icon from '../components/Icon';
import ImageSuggestionModal from '../components/editor/ImageSuggestionModal';
import { Editor } from '@tiptap/core';
import AudiobookDownloadModal from '../components/editor/AudiobookDownloadModal';
import TextToImageModal from '../components/editor/TextToImageModal';
import CharacterVoiceAnalysisModal from '../components/editor/CharacterVoiceAnalysisModal';
import PlotHoleAnalysisModal from '../components/editor/PlotHoleAnalysisModal';
import LoreConsistencyModal from '../components/editor/LoreConsistencyModal';

interface BookEditorProps {
  onSave: () => void;
  onBack: () => void;
}

export interface ViewSettings {
    focusMode: boolean;
    width: 'narrow' | 'standard' | 'wide';
    font: 'serif' | 'sans';
}

const BookEditor: React.FC<BookEditorProps> = ({ onSave, onBack }) => {
    const {
        book,
        isLoading,
        loadingMessage,
        isImageModalOpen,
        setIsImageModalOpen,
        editingImageData,
        isRegeneratingImage,
        handleRegenerateImage,
        isEpubModalOpen,
        setIsEpubModalOpen,
        handleStartEpubExport,
        handleSaveToDB,
        saveStatus,
        handleSaveAndSync,
        isSyncing,
        isBrainstormModalOpen,
        setIsBrainstormModalOpen,
        handleBrainstormComplete,
        isAnalysisModalOpen,
        setIsAnalysisModalOpen,
        analysisData,
        isAnalyzing,
        handleExecuteAnalysisAction,
        isStyleAnalysisModalOpen,
        setIsStyleAnalysisModalOpen,
        styleAnalysisResult,
        isAnalyzingStyle,
        handleApplyStyleSuggestion,
        analyzingStyleChapterIndex,
        isChatOpen,
        setIsChatOpen,
        handleSendChatMessage,
        isChatLoading,
        activeEditorInstance,
        handleAssistantAction,
        handleExportPdf,
        createSnapshot,
        setIsSnapshotsPanelOpen,
        handleGenerateChapters,
        handleGenerateFullBook,
        activeChapterIndex,
        handleOpenAnalysisModal,
        handleAnalyzeChapterStyle,
        isDeepAnalysisModalOpen,
        setIsDeepAnalysisModalOpen,
        deepAnalysisResult,
        deepAnalysisType,
        handleApplyShowTellSuggestion,
        isMacroResultModalOpen,
        setIsMacroResultModalOpen,
        macroResults,
        handleApplyMacroShowTellSuggestion,
        handleApplyMacroOpeningSuggestion,
        isKnowledgeBaseOpen,
        setIsKnowledgeBaseOpen,
        suggestionToGenerate,
        isDownloadModalOpen,
        isAiEnabled,
        isTextToImageModalOpen,
        isCharacterVoiceAnalysisModalOpen,
        setIsCharacterVoiceAnalysisModalOpen,
        characterVoiceAnalysisResult,
        isAnalyzingCharacterVoice,
        handleApplyCharacterVoiceSuggestion,
        isPlotHoleModalOpen,
        setIsPlotHoleModalOpen,
        plotHoleResults,
        isAnalyzingPlotHoles,
        isLoreConsistencyModalOpen,
        setIsLoreConsistencyModalOpen,
        loreConsistencyResults,
        isAnalyzingLore,
        handleApplyLoreSuggestion
    } = useBookEditor();
  
    const { registerCommands, unregisterCommands } = useCommandPalette();

    const [activeView, setActiveView] = useState<'editor' | 'corkboard' | 'outliner'>('editor');
    const [isOutlineOpen, setIsOutlineOpen] = useState(true);
    const mainScrollRef = useRef<HTMLElement>(null);
    const [isHeaderVisible, setIsHeaderVisible] = useState(true);
    const lastScrollTop = useRef(0);
    const [isViewMenuOpen, setIsViewMenuOpen] = useState(false);

    // View Settings State with Persistence
    const [viewSettings, setViewSettings] = useState<ViewSettings>(() => {
        const saved = localStorage.getItem('bookEditorViewSettings');
        return saved ? JSON.parse(saved) : { focusMode: false, width: 'standard', font: 'serif' };
    });

    useEffect(() => {
        localStorage.setItem('bookEditorViewSettings', JSON.stringify(viewSettings));
    }, [viewSettings]);
    
    const handleSaveAndClose = useCallback(async () => {
        await handleSaveToDB();
        onSave();
    }, [handleSaveToDB, onSave]);

    const [selection, setSelection] = useState(activeEditorInstance?.state.selection);

    useEffect(() => {
        if (activeEditorInstance) {
            const handleSelectionUpdate = ({ editor }: { editor: Editor }) => {
                setSelection(editor.state.selection);
            };
            activeEditorInstance.on('selectionUpdate', handleSelectionUpdate);
            setSelection(activeEditorInstance.state.selection);

            return () => {
                activeEditorInstance.off('selectionUpdate', handleSelectionUpdate);
            };
        }
    }, [activeEditorInstance]);

    const selectionEmpty = useMemo(() => {
        if (!selection) return true;
        const { from, to } = selection;
        return from === to;
    }, [selection]);
    

    useEffect(() => {
        if (!book) return;

        const editorCommands: Command[] = [
            { id: 'save-close', name: 'Save and Close', section: 'File', icon: ICONS.SAVE, action: handleSaveAndClose },
            { id: 'export-pdf', name: 'Export: Export as PDF', section: 'Export', icon: ICONS.DOWNLOAD, action: handleExportPdf },
            { id: 'export-epub', name: 'Export: Export as ePub', section: 'Export', icon: ICONS.BOOK, action: () => setIsEpubModalOpen(true) },
            { id: 'snapshot-create', name: 'Version: Create new snapshot', section: 'Versioning', icon: ICONS.SAVE, action: () => {
                modalService.prompt({ title: 'Create Snapshot', inputLabel: 'Snapshot Name', initialValue: `Snapshot ${new Date().toLocaleString()}` }).then(name => {
                    if (name) createSnapshot(name);
                });
            }},
            { id: 'snapshot-view', name: 'Version: View version history', section: 'Versioning', icon: ICONS.HISTORY, action: () => setIsSnapshotsPanelOpen(true) },
            { id: 'focus-mode', name: 'View: Toggle Focus Mode', section: 'View', icon: ICONS.LAYOUT, action: () => setViewSettings(s => ({ ...s, focusMode: !s.focusMode })) },
        ];

        if (isAiEnabled) {
            editorCommands.push({ id: 'chat-open', name: 'AI: Open assistant chat', section: 'AI Actions', icon: ICONS.MESSAGE_CIRCLE, action: () => setIsChatOpen(true) });

            if (book.status !== 'complete') {
                editorCommands.push(
                    { id: 'gen-next-chapter', name: 'Generate: Write next chapter', section: 'Generation', icon: ICONS.WAND, action: () => handleGenerateChapters() },
                    { id: 'gen-full-book', name: 'Generate: Write all remaining chapters', section: 'Generation', icon: ICONS.SPARKLES, action: () => handleGenerateFullBook() },
                );
            }

            if (book.content.length > 0) {
                editorCommands.push({
                    id: 'analyze-chapter',
                    name: `Analyze: Analyze Chapter ${activeChapterIndex + 1}`,
                    section: 'AI Actions',
                    icon: ICONS.SPARKLES,
                    action: () => handleOpenAnalysisModal(activeChapterIndex)
                });
            }
            
            if (selectionEmpty) {
                editorCommands.push({ id: 'ai-suggest', name: 'AI: Continue writing', keywords: 'suggest', section: 'AI Actions', icon: ICONS.WAND, action: () => handleAssistantAction('suggest') });
            } else {
                editorCommands.push(
                    { id: 'ai-rephrase', name: 'AI: Rephrase selection', section: 'AI Actions', icon: ICONS.REPHRASE, action: () => handleAssistantAction('rephrase') },
                    { id: 'ai-expand', name: 'AI: Expand selection', section: 'AI Actions', icon: ICONS.EXPAND, action: () => handleAssistantAction('expand') },
                    { id: 'ai-summarize', name: 'AI: Summarize selection', section: 'AI Actions', icon: ICONS.SUMMARIZE, action: () => handleAssistantAction('summarize') },
                    { id: 'ai-tone-formal', name: 'AI: Change tone to Formal', section: 'AI Actions', icon: ICONS.TONE, action: () => handleAssistantAction({ type: 'tone', tone: 'Formal' }) },
                    { id: 'ai-tone-casual', name: 'AI: Change tone to Casual', section: 'AI Actions', icon: ICONS.TONE, action: () => handleAssistantAction({ type: 'tone', tone: 'Casual' }) },
                );
            }
        }

        registerCommands(editorCommands);
        return () => unregisterCommands(editorCommands.map(c => c.id));
    }, [
        book?.status,
        book?.content.length,
        selection,
        activeChapterIndex,
        registerCommands,
        unregisterCommands,
        handleSaveAndClose,
        handleExportPdf,
        setIsEpubModalOpen,
        createSnapshot,
        setIsSnapshotsPanelOpen,
        setIsChatOpen,
        handleGenerateChapters,
        handleGenerateFullBook,
        handleOpenAnalysisModal,
        handleAssistantAction,
        isAiEnabled
    ]);


  useEffect(() => {
    const mainEl = mainScrollRef.current;
    if (!mainEl) return;

    const handleScroll = () => {
      const scrollTop = mainEl.scrollTop;

      if (scrollTop > lastScrollTop.current && scrollTop > 100) {
        if (isHeaderVisible) setIsHeaderVisible(false); // scrolling down
      } else {
        if (!isHeaderVisible) setIsHeaderVisible(true); // scrolling up
      }
      lastScrollTop.current = scrollTop <= 0 ? 0 : scrollTop;
    };

    mainEl.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      mainEl.removeEventListener('scroll', handleScroll);
    };
  }, [isHeaderVisible]);

  // Close view menu when clicking outside
  useEffect(() => {
      const closeMenu = () => setIsViewMenuOpen(false);
      if (isViewMenuOpen) {
          window.addEventListener('click', closeMenu);
      }
      return () => window.removeEventListener('click', closeMenu);
  }, [isViewMenuOpen]);

  if (!book) return (
    <div className="text-center py-10">Loading editor...</div>
  );

  return (
    <div className="flex h-screen overflow-hidden">
      {isLoading && <Loader message={loadingMessage} />}
      
      {isImageModalOpen && editingImageData && (
          <ImageEditModal
              isOpen={isImageModalOpen}
              onClose={() => setIsImageModalOpen(false)}
              currentImageUrl={editingImageData.src}
              imageGenerationInstructions={book.imageGenerationInstructions}
              onRegenerate={handleRegenerateImage}
              isGenerating={isRegeneratingImage}
          />
      )}
      
      {isEpubModalOpen && (
          <EpubExportModal
              isOpen={isEpubModalOpen}
              onClose={() => setIsEpubModalOpen(false)}
              onExport={handleStartEpubExport}
              book={book}
          />
      )}

      {isBrainstormModalOpen && (
          <BrainstormModal
              isOpen={isBrainstormModalOpen}
              onClose={() => setIsBrainstormModalOpen(false)}
              book={book}
              onOutlineGenerated={handleBrainstormComplete}
          />
      )}

      {isAnalysisModalOpen && book && (
        <ChapterAnalysisModal
            isOpen={isAnalysisModalOpen}
            onClose={() => setIsAnalysisModalOpen(false)}
            chapterTitle={book.outline[analysisData.chapterIndex]?.title || ''}
            analysisResult={analysisData.result}
            isLoading={isAnalyzing}
            onExecuteAction={handleExecuteAnalysisAction}
        />
      )}

      {isStyleAnalysisModalOpen && book && (
        <StyleAnalysisModal
            isOpen={isStyleAnalysisModalOpen}
            onClose={() => setIsStyleAnalysisModalOpen(false)}
            chapterTitle={book.outline[analyzingStyleChapterIndex ?? 0]?.title || ''}
            analysisResult={styleAnalysisResult}
            isLoading={isAnalyzingStyle}
            onApplySuggestion={handleApplyStyleSuggestion}
        />
      )}

      {isDeepAnalysisModalOpen && book && (
          <DeepAnalysisModal
              isOpen={isDeepAnalysisModalOpen}
              onClose={() => setIsDeepAnalysisModalOpen(false)}
              chapterTitle={book.outline[analysisData.chapterIndex]?.title || ''}
              analysisType={deepAnalysisType}
              analysisData={deepAnalysisResult}
              onApplySuggestion={handleApplyShowTellSuggestion}
          />
      )}
      
      {isCharacterVoiceAnalysisModalOpen && book && (
          <CharacterVoiceAnalysisModal
              isOpen={isCharacterVoiceAnalysisModalOpen}
              onClose={() => setIsCharacterVoiceAnalysisModalOpen(false)}
              results={characterVoiceAnalysisResult}
              isLoading={isAnalyzingCharacterVoice}
              onApplySuggestion={handleApplyCharacterVoiceSuggestion}
          />
      )}
      
      {isPlotHoleModalOpen && book && (
          <PlotHoleAnalysisModal
              isOpen={isPlotHoleModalOpen}
              onClose={() => setIsPlotHoleModalOpen(false)}
              results={plotHoleResults}
              isLoading={isAnalyzingPlotHoles}
          />
      )}
      
      {isLoreConsistencyModalOpen && book && (
          <LoreConsistencyModal
              isOpen={isLoreConsistencyModalOpen}
              onClose={() => setIsLoreConsistencyModalOpen(false)}
              results={loreConsistencyResults}
              isLoading={isAnalyzingLore}
              onApplySuggestion={handleApplyLoreSuggestion}
          />
      )}

      {isMacroResultModalOpen && (
        <MacroResultModal
            isOpen={isMacroResultModalOpen}
            onClose={() => setIsMacroResultModalOpen(false)}
            results={macroResults}
            onApplyShowTellSuggestion={handleApplyMacroShowTellSuggestion}
            onApplyOpeningSuggestion={handleApplyMacroOpeningSuggestion}
        />
      )}
      
      {book && isAiEnabled && (
        <ChatModal
            isOpen={isChatOpen}
            onClose={() => setIsChatOpen(false)}
            messages={book.bookChatHistory || []}
            onSendMessage={handleSendChatMessage}
            isLoading={isChatLoading}
        />
      )}

      {suggestionToGenerate && <ImageSuggestionModal />}
      
      {isDownloadModalOpen && <AudiobookDownloadModal />}
      
      {isTextToImageModalOpen && <TextToImageModal />}
      
      <KnowledgeBaseModal isOpen={isKnowledgeBaseOpen} onClose={() => setIsKnowledgeBaseOpen(false)} />

      <SnapshotsPanel />

      {book.outline && book.outline.length > 0 && !viewSettings.focusMode && (
          <OutlineSidebar isOpen={isOutlineOpen} setIsOpen={setIsOutlineOpen} />
      )}
      
      <div className="flex-1 flex flex-col relative bg-zinc-50 dark:bg-zinc-900">
        <header className={`absolute top-0 left-0 right-0 z-20 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm border-b border-zinc-200 dark:border-zinc-700 transition-transform duration-300 pt-[env(safe-area-inset-top)] ${isHeaderVisible ? 'translate-y-0' : '-translate-y-full'}`}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between h-16">
                  <div className="flex items-center min-w-0 max-w-[30%]">
                    <button onClick={onBack} aria-label="Back to dashboard" className="p-3 mr-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 flex-shrink-0">
                        <Icon name="CHEVRON_LEFT" className="w-6 h-6" />
                    </button>
                    <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-white truncate">{book.topic || 'New Book'}</h1>
                  </div>

                  {book.outline.length > 0 && (
                      <div className="flex-1 flex justify-center px-2">
                          <BookViewSwitcher activeView={activeView} setActiveView={setActiveView} />
                      </div>
                  )}

                  <div className="flex items-center space-x-2 flex-shrink-0 ml-4">
                    
                    {/* View Options Dropdown */}
                    <div className="relative">
                        <button 
                            onClick={(e) => { e.stopPropagation(); setIsViewMenuOpen(!isViewMenuOpen); }}
                            className={`p-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-1 ${isViewMenuOpen ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300' : 'hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-600 dark:text-gray-300'}`}
                            title="View Options"
                        >
                            <Icon name="LAYOUT" className="w-5 h-5" />
                            <span className="hidden lg:inline">Display</span>
                        </button>
                        
                        {isViewMenuOpen && (
                            <div 
                                className="absolute right-0 mt-2 w-56 bg-white dark:bg-zinc-800 rounded-lg shadow-xl border border-zinc-200 dark:border-zinc-700 z-50 animate-fade-in-up p-2"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="space-y-3">
                                    {/* Focus Mode Toggle */}
                                    <div className="flex items-center justify-between px-2 py-1">
                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Focus Mode</span>
                                        <button 
                                            onClick={() => setViewSettings(s => ({...s, focusMode: !s.focusMode}))}
                                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${viewSettings.focusMode ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-zinc-600'}`}
                                        >
                                            <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${viewSettings.focusMode ? 'translate-x-5' : 'translate-x-1'}`} />
                                        </button>
                                    </div>
                                    
                                    <hr className="border-zinc-200 dark:border-zinc-700" />
                                    
                                    {/* Width Selector */}
                                    <div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 px-2 mb-1 uppercase tracking-wider">Editor Width</p>
                                        <div className="flex bg-gray-100 dark:bg-zinc-700/50 rounded-md p-1">
                                            {(['narrow', 'standard', 'wide'] as const).map((w) => (
                                                <button
                                                    key={w}
                                                    onClick={() => setViewSettings(s => ({...s, width: w}))}
                                                    className={`flex-1 text-xs py-1.5 rounded-sm capitalize transition-all ${viewSettings.width === w ? 'bg-white dark:bg-zinc-600 shadow-sm text-indigo-600 dark:text-indigo-300 font-semibold' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                                                >
                                                    {w}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Font Selector */}
                                    <div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 px-2 mb-1 uppercase tracking-wider">Typography</p>
                                        <div className="flex bg-gray-100 dark:bg-zinc-700/50 rounded-md p-1">
                                            <button
                                                onClick={() => setViewSettings(s => ({...s, font: 'serif'}))}
                                                className={`flex-1 text-xs py-1.5 rounded-sm transition-all font-serif ${viewSettings.font === 'serif' ? 'bg-white dark:bg-zinc-600 shadow-sm text-indigo-600 dark:text-indigo-300 font-semibold' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                                            >
                                                Serif
                                            </button>
                                            <button
                                                onClick={() => setViewSettings(s => ({...s, font: 'sans'}))}
                                                className={`flex-1 text-xs py-1.5 rounded-sm transition-all font-sans ${viewSettings.font === 'sans' ? 'bg-white dark:bg-zinc-600 shadow-sm text-indigo-600 dark:text-indigo-300 font-semibold' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                                            >
                                                Sans
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={handleSaveAndSync}
                        disabled={isSyncing || isLoading}
                        className={`hidden sm:flex items-center space-x-2 px-4 py-2 text-sm font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50
                            ${saveStatus === 'unsaved' 
                                ? 'bg-indigo-600 text-white hover:bg-indigo-700' 
                                : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-100 hover:bg-zinc-300 dark:hover:bg-zinc-600'}`}
                    >
                        <Icon name={isSyncing ? 'ROTATE_CW' : 'CLOUD'} className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />
                        <span>{isSyncing ? 'Syncing...' : 'Save & Sync'}</span>
                    </button>
                  </div>
              </div>
            </div>
        </header>

        {/* Layout Split: Sidebar Pane + Content Pane */}
        <div className="flex-1 flex overflow-hidden pt-[calc(4rem+env(safe-area-inset-top))]">
            
            {/* Sidebar Pane (Desktop) */}
            {!viewSettings.focusMode && (
                <aside className="hidden lg:block w-[350px] h-full overflow-y-auto border-r border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/50 p-6 scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-600">
                    <EditorSidebar onSaveAndClose={handleSaveAndClose} />
                </aside>
            )}

            {/* Content Pane */}
            <main ref={mainScrollRef} className="flex-1 h-full overflow-y-auto scroll-smooth">
                <div className={`max-w-full mx-auto p-4 sm:p-6 lg:p-10 transition-all duration-300 ${viewSettings.focusMode ? 'container' : 'lg:max-w-4xl'}`}>
                    
                    {/* Mobile Sidebar (Visible on mobile if not focus mode) */}
                    {!viewSettings.focusMode && (
                        <div className="lg:hidden mb-8">
                             <EditorSidebar onSaveAndClose={handleSaveAndClose} />
                        </div>
                    )}

                    <div className="space-y-6">
                        {book.outline.length > 0 ? (
                            <>
                                {activeView === 'editor' && <EditorContent viewSettings={viewSettings} />}
                                {activeView === 'corkboard' && <CorkboardView />}
                                {activeView === 'outliner' && <OutlinerView />}
                            </>
                        ) : (
                            <EditorContent viewSettings={viewSettings} />
                        )}
                    </div>
                </div>
            </main>
        </div>
        <EditorFooter />
      </div>
      <FloatingChatButton />
    </div>
  );
};

export default BookEditor;
