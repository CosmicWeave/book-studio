
import React, { createContext, useState, useEffect, useCallback, useContext, useRef, useMemo } from 'react';
import { Book, ChapterContent, ChapterOutline, BookSnapshot, Macro, InstructionTemplate, AnalysisResult, StyleSuggestion, PacingAnalysisResult, ShowTellAnalysisResult, MacroResult, KnowledgeSheet, ChatMessage, ImageSuggestion, Scene, CharacterVoiceInconsistency, PlotHole, LoreInconsistency, CustomPersona } from '../types';
import { db } from '../services/db';
import * as gemini from '../services/gemini';
import { toastService } from '../services/toastService';
import { modalService } from '../services/modalService';
import { exportToPdf, exportToEpub } from '../services/export';
import { Content, FunctionCall } from '@google/genai';
import { Editor } from '@tiptap/core';
import { produce } from 'immer';
import { useNavigate } from 'react-router-dom';
import { backgroundTaskService } from '../services/backgroundTaskService';
import { manualTriggerBackup } from '../services/backupService';
import { AppContext } from './AppContext';

interface BookEditorContextType {
    book: Book | null;
    isLoading: boolean;
    loadingMessage: string;
    saveStatus: 'saved' | 'saving' | 'unsaved';
    isSyncing: boolean;
    activeChapterIndex: number;
    setActiveChapterIndex: (index: number) => void;
    
    // Input Handlers
    handleInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
    handleTitleChange: (e: React.FocusEvent<HTMLElement>) => void;
    handleSubtitleChange: (e: React.FocusEvent<HTMLElement>) => void;
    handleChapterTitleChange: (e: React.FocusEvent<HTMLElement>, index: number) => void;
    handleContentChange: (index: number, newContent: string) => void;
    handleUpdatePart: (index: number, newPartTitle: string) => void;
    handleUpdatePartContent: (index: number, newContent: string) => void;
    handlePropagatePart: (index: number) => void;
    
    // Instructions
    instructions: InstructionTemplate[];
    selectedInstruction: string;
    handleUpdateInstructions: (newInstructions: string) => void;
    handleSaveNewInstructionTemplate: () => Promise<void>;
    handleUpdateInstructionTemplate: (template: InstructionTemplate) => Promise<void>;
    isSuggestingInstructions: boolean;
    instructionSuggestion: string | null;
    setInstructionSuggestion: (suggestion: string | null) => void;
    handleSuggestBookInstructionImprovement: () => void;

    // Images
    isImageModalOpen: boolean;
    setIsImageModalOpen: (isOpen: boolean) => void;
    editingImageData: { chapterIndex: number, src: string, alt: string } | null;
    handleEditImage: (data: { chapterIndex: number, src: string, alt: string }) => void;
    isRegeneratingImage: boolean;
    handleRegenerateImage: (newInstructions: string) => Promise<void>;
    imageSuggestions: ImageSuggestion[];
    setImageSuggestions: React.Dispatch<React.SetStateAction<ImageSuggestion[]>>;
    suggestionToGenerate: ImageSuggestion | null;
    openImageSuggestionModal: (suggestion: ImageSuggestion) => void;
    closeImageSuggestionModal: () => void;
    generateImageFromSuggestion: (prompt: string) => Promise<void>;
    
    // Text to Image
    isTextToImageModalOpen: boolean;
    setIsTextToImageModalOpen: (isOpen: boolean) => void;
    textToImageContext: { text: string; from: number; to: number } | null;
    handleOpenTextToImage: (editor?: Editor) => void;
    handleInsertGeneratedImage: (imageUrl: string, prompt: string) => void;

    // Export
    isEpubModalOpen: boolean;
    setIsEpubModalOpen: (isOpen: boolean) => void;
    handleStartEpubExport: (options: any) => void;
    handleExportPdf: () => void;
    handleDownloadAudiobook: (chapterIndex?: number) => void;
    isDownloadModalOpen: boolean;
    setIsDownloadModalOpen: (isOpen: boolean) => void;
    downloadModalInitialSelection: number[];

    // Persistence
    handleSaveToDB: () => Promise<void>;
    handleSaveAndSync: () => Promise<void>;
    
    // Snapshots
    isSnapshotsPanelOpen: boolean;
    setIsSnapshotsPanelOpen: (isOpen: boolean) => void;
    snapshots: BookSnapshot[];
    createSnapshot: (name: string) => Promise<void>;
    handleRestoreSnapshot: (snapshot: BookSnapshot) => Promise<void>;
    handleDeleteSnapshot: (id: string) => Promise<void>;

    // AI Generation & Analysis
    isBrainstormModalOpen: boolean;
    setIsBrainstormModalOpen: (isOpen: boolean) => void;
    handleStartOutlineBrainstorm: () => void;
    handleBrainstormComplete: (outline: ChapterOutline[], finalTitle: string) => void;
    
    isGeneratingChapter: number | null; // index of chapter being generated
    handleGenerateChapters: () => Promise<void>;
    handleGenerateFullBook: () => Promise<void>;
    
    isAnalysisModalOpen: boolean;
    setIsAnalysisModalOpen: (isOpen: boolean) => void;
    analysisData: { chapterIndex: number; result: AnalysisResult | null };
    isAnalyzing: boolean;
    handleOpenAnalysisModal: (chapterIndex: number) => void;
    handleExecuteAnalysisAction: (prompt: string) => void;

    isStyleAnalysisModalOpen: boolean;
    setIsStyleAnalysisModalOpen: (isOpen: boolean) => void;
    styleAnalysisResult: StyleSuggestion[] | null;
    analyzingStyleChapterIndex: number | null;
    isAnalyzingStyle: boolean;
    handleAnalyzeChapterStyle: (chapterIndex: number) => void;
    handleApplyStyleSuggestion: (original: string, replacement: string) => void;

    // Character Voice Analysis
    isCharacterVoiceAnalysisModalOpen: boolean;
    setIsCharacterVoiceAnalysisModalOpen: (isOpen: boolean) => void;
    characterVoiceAnalysisResult: CharacterVoiceInconsistency[] | null;
    isAnalyzingCharacterVoice: boolean;
    handleAnalyzeCharacterVoice: () => void;
    handleApplyCharacterVoiceSuggestion: (original: string, replacement: string) => void;

    // Plot Hole Analysis
    isPlotHoleModalOpen: boolean;
    setIsPlotHoleModalOpen: (isOpen: boolean) => void;
    plotHoleResults: PlotHole[] | null;
    isAnalyzingPlotHoles: boolean;
    handleAnalyzePlotHoles: () => void;
    
    // Lore Consistency Analysis
    isLoreConsistencyModalOpen: boolean;
    setIsLoreConsistencyModalOpen: (isOpen: boolean) => void;
    loreConsistencyResults: LoreInconsistency[] | null;
    isAnalyzingLore: boolean;
    handleAnalyzeLoreConsistency: () => void;
    handleApplyLoreSuggestion: (original: string, replacement: string) => void;

    // AI Assistant Config
    handleUpdatePersona: (persona: string) => void;
    isAutocompleteEnabled: boolean;
    toggleAutocomplete: () => void;
    customPersonas: CustomPersona[];
    addCustomPersona: (persona: Omit<CustomPersona, 'id'>) => Promise<void>;
    deleteCustomPersona: (id: string) => Promise<void>;

    // Chat
    isChatOpen: boolean;
    setIsChatOpen: (isOpen: boolean) => void;
    chatMessages: Content[] | null;
    handleSendChatMessage: (message: string) => void;
    isChatLoading: boolean;
    handleApplyEdit: (chapterIndex: number, newContent: string) => void;
    handleExecuteTool: (functionCall: FunctionCall) => void;

    // Tiptap Editors Management
    activeEditorInstance: Editor | null;
    setActiveEditorInstance: (editor: Editor | null) => void;
    registerEditor: (index: number, editor: Editor) => void;
    unregisterEditor: (index: number) => void;
    handleAssistantAction: (action: 'rephrase' | 'expand' | 'summarize' | 'suggest' | { type: 'tone', tone: string }) => void;
    isAssistantLoading: boolean;

    // Chapter Management
    handleAddChapter: (index: number, position: 'before' | 'after') => void;
    handleDeleteChapter: (index: number) => void;
    handleMoveChapter: (fromIndex: number, toIndex: number) => void;
    handleMergeChapters: (index: number) => void;
    handleUpdateChapterOutline: (index: number, updates: Partial<ChapterOutline>) => void;

    // Advanced Tools
    isDeepAnalysisModalOpen: boolean;
    setIsDeepAnalysisModalOpen: (isOpen: boolean) => void;
    deepAnalysisResult: any;
    deepAnalysisType: 'pacing' | 'show_tell' | null;
    handleApplyShowTellSuggestion: (original: string, replacement: string) => void;

    isMacroResultModalOpen: boolean;
    setIsMacroResultModalOpen: (isOpen: boolean) => void;
    macroResults: MacroResult[];
    handleRunMacro: (macroId: string) => void;
    handleApplyMacroShowTellSuggestion: (original: string, replacement: string) => void;
    handleApplyMacroOpeningSuggestion: (replacement: string) => void;
    
    macros: Macro[];

    // Knowledge Base
    isKnowledgeBaseOpen: boolean;
    setIsKnowledgeBaseOpen: (isOpen: boolean) => void;
    handleKnowledgeBaseUpdate: (sheets: KnowledgeSheet[]) => void;
    handleAutoFillKnowledgeBase: () => void;
    isAutoFillingKb: boolean;

    // Sub-sections
    generatingSubSection: { chapter: number, section: number } | null;
    handleGenerateSubSection: (chapterIndex: number, sectionIndex: number) => void;
    handleGenerateChapterBreakdown: (chapterIndex: number) => void;
    handleUpdateSubSectionPrompt: (chapterIndex: number, sectionIndex: number, newPrompt: string) => void;
    handleRemoveSubSection: (chapterIndex: number, sectionIndex: number) => void;
    handleAnalyzePlanCompleteness: (chapterIndex: number) => void;
    isAnalyzingPlan: number | null;

    // Scenes
    handleUpdateScene: (chapterIndex: number, sceneId: string, updates: Partial<Scene>) => void;
    handleAddScene: (chapterIndex: number) => void;
    handleDeleteScene: (chapterIndex: number, sceneId: string) => void;
    handleMoveScene: (chapterIndex: number, fromIndex: number, toIndex: number) => void;

    // Audiobook
    geminiTTSVoices: string[];
    audiobookState: any; // inherited from AppContext
    handlePlayFullBook: () => void;
    handlePlayChapter: (index: number) => void;
    handleSetVoice: (voice: string) => void;
    handleUpdateVoiceStyle: (style: string) => void;
    handlePauseAudiobook: () => void;
    handleResumeAudiobook: () => void;
    handleStopAudiobook: () => void;
    handleSkipChapter: (direction: 'next' | 'prev') => void;

    // Metadata
    isMetadataOpen: boolean;
    setIsMetadataOpen: (isOpen: boolean) => void;
    
    isAiEnabled: boolean;
}

const BookEditorContext = createContext<BookEditorContextType | undefined>(undefined);

export const BookEditorProvider: React.FC<{ bookId: string; onBack: () => void; children: React.ReactNode }> = ({ bookId, onBack, children }) => {
    const navigate = useNavigate();
    // App Context for global data
    const appContext = useContext(AppContext);
    
    if (!appContext) {
        throw new Error('BookEditorProvider must be used within an AppContextProvider');
    }

    const { 
        updateBook, 
        fetchSnapshotsForBook, 
        createSnapshot: appCreateSnapshot, 
        restoreSnapshot: appRestoreSnapshot, 
        deleteSnapshot: appDeleteSnapshot,
        macros,
        playAudiobook,
        pauseAudiobook,
        resumeAudiobook,
        stopAudiobook,
        skipAudiobookChapter,
        audiobookState,
        isAiEnabled
    } = appContext;

    // --- STATE ---
    const [book, setBook] = useState<Book | null>(null);
    const [seriesKnowledgeBase, setSeriesKnowledgeBase] = useState<KnowledgeSheet[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadingMessage, setLoadingMessage] = useState('Loading book...');
    const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');
    const [activeChapterIndex, setActiveChapterIndex] = useState(0);
    const [isSyncing, setIsSyncing] = useState(false);
    
    const editorsRef = useRef<Map<number, Editor>>(new Map());
    const [activeEditorInstance, setActiveEditorInstance] = useState<Editor | null>(null);
    const [isAssistantLoading, setIsAssistantLoading] = useState(false);

    // Modals State
    const [isImageModalOpen, setIsImageModalOpen] = useState(false);
    const [editingImageData, setEditingImageData] = useState<{ chapterIndex: number, src: string, alt: string } | null>(null);
    const [isEpubModalOpen, setIsEpubModalOpen] = useState(false);
    const [isBrainstormModalOpen, setIsBrainstormModalOpen] = useState(false);
    const [isSnapshotsPanelOpen, setIsSnapshotsPanelOpen] = useState(false);
    const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false);
    const [isStyleAnalysisModalOpen, setIsStyleAnalysisModalOpen] = useState(false);
    const [isDeepAnalysisModalOpen, setIsDeepAnalysisModalOpen] = useState(false);
    const [isMacroResultModalOpen, setIsMacroResultModalOpen] = useState(false);
    const [isKnowledgeBaseOpen, setIsKnowledgeBaseOpen] = useState(false);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
    const [isMetadataOpen, setIsMetadataOpen] = useState(false);
    const [isTextToImageModalOpen, setIsTextToImageModalOpen] = useState(false);
    const [isCharacterVoiceAnalysisModalOpen, setIsCharacterVoiceAnalysisModalOpen] = useState(false);
    const [isPlotHoleModalOpen, setIsPlotHoleModalOpen] = useState(false);
    const [isLoreConsistencyModalOpen, setIsLoreConsistencyModalOpen] = useState(false);
    
    const [textToImageContext, setTextToImageContext] = useState<{ text: string; from: number; to: number } | null>(null);

    // Data State
    const [instructions, setInstructions] = useState<InstructionTemplate[]>([]);
    const [selectedInstruction, setSelectedInstruction] = useState('');
    const [isSuggestingInstructions, setIsSuggestingInstructions] = useState(false);
    const [instructionSuggestion, setInstructionSuggestion] = useState<string | null>(null);
    
    const [isRegeneratingImage, setIsRegeneratingImage] = useState(false);
    const [isGeneratingChapter, setIsGeneratingChapter] = useState<number | null>(null);
    const [generatingSubSection, setGeneratingSubSection] = useState<{ chapter: number, section: number } | null>(null);
    
    const [snapshots, setSnapshots] = useState<BookSnapshot[]>([]);
    const [analysisData, setAnalysisData] = useState<{ chapterIndex: number; result: AnalysisResult | null }>({ chapterIndex: 0, result: null });
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    
    const [styleAnalysisResult, setStyleAnalysisResult] = useState<StyleSuggestion[] | null>(null);
    const [analyzingStyleChapterIndex, setAnalyzingStyleChapterIndex] = useState<number | null>(null);
    const [isAnalyzingStyle, setIsAnalyzingStyle] = useState(false);
    
    const [deepAnalysisResult, setDeepAnalysisResult] = useState<any>(null);
    const [deepAnalysisType, setDeepAnalysisType] = useState<'pacing' | 'show_tell' | null>(null);
    
    const [macroResults, setMacroResults] = useState<MacroResult[]>([]);
    
    const [imageSuggestions, setImageSuggestions] = useState<ImageSuggestion[]>([]);
    const [suggestionToGenerate, setSuggestionToGenerate] = useState<ImageSuggestion | null>(null);
    
    const [characterVoiceAnalysisResult, setCharacterVoiceAnalysisResult] = useState<CharacterVoiceInconsistency[] | null>(null);
    const [isAnalyzingCharacterVoice, setIsAnalyzingCharacterVoice] = useState(false);
    
    const [plotHoleResults, setPlotHoleResults] = useState<PlotHole[] | null>(null);
    const [isAnalyzingPlotHoles, setIsAnalyzingPlotHoles] = useState(false);
    
    const [loreConsistencyResults, setLoreConsistencyResults] = useState<LoreInconsistency[] | null>(null);
    const [isAnalyzingLore, setIsAnalyzingLore] = useState(false);
    
    const [chatMessages, setChatMessages] = useState<Content[] | null>(null);
    const [isChatLoading, setIsChatLoading] = useState(false);
    
    const [isAutoFillingKb, setIsAutoFillingKb] = useState(false);
    const [isAnalyzingPlan, setIsAnalyzingPlan] = useState<number | null>(null);
    
    const [downloadModalInitialSelection, setDownloadModalInitialSelection] = useState<number[]>([]);
    
    const [isAutocompleteEnabled, setIsAutocompleteEnabled] = useState(false); // Default off
    const [customPersonas, setCustomPersonas] = useState<CustomPersona[]>([]);

    const geminiTTSVoices = ['Kore', 'Puck', 'Charon', 'Fenrir', 'Zephyr'];

    // --- LOAD ---
    useEffect(() => {
        const loadBook = async () => {
            try {
                setIsLoading(true);
                const bookData = await db.books.get(bookId);
                if (!bookData) {
                    toastService.error("Book not found");
                    onBack();
                    return;
                }
                
                let changed = false;
                const outlineWithIds = bookData.outline.map(ch => {
                    if (!ch.id) {
                        changed = true;
                        return { ...ch, id: crypto.randomUUID() };
                    }
                    return ch;
                });
                if (changed) bookData.outline = outlineWithIds;

                setBook(bookData);
                setChatMessages(bookData.bookChatHistory || []);
                
                if (bookData.seriesId) {
                    const seriesData = await db.series.get(bookData.seriesId);
                    setSeriesKnowledgeBase(seriesData?.sharedKnowledgeBase || []);
                }

                const instrs = await db.instructions.getAll();
                setInstructions(instrs);
                
                const snaps = await fetchSnapshotsForBook(bookId);
                setSnapshots(snaps.sort((a, b) => b.createdAt - a.createdAt));
                
                const personaSetting = await db.settings.get('customPersonas');
                if (personaSetting && Array.isArray(personaSetting.value)) {
                    setCustomPersonas(personaSetting.value);
                }

            } catch (e) {
                console.error(e);
                toastService.error("Failed to load book");
            } finally {
                setIsLoading(false);
            }
        };
        loadBook();
    }, [bookId, onBack, fetchSnapshotsForBook]);

    // --- HELPERS ---
    const updateLocalBook = (updates: Partial<Book>) => {
        setBook(prev => {
            if (!prev) return null;
            return { ...prev, ...updates };
        });
        setSaveStatus('unsaved');
    };
    
    const getPersonaInstructionText = useCallback((personaName: string) => {
        const defaultInst = gemini.PERSONA_INSTRUCTIONS[personaName];
        if (defaultInst) return defaultInst;
        const custom = customPersonas.find(p => p.name === personaName);
        return custom ? custom.instructions : gemini.PERSONA_INSTRUCTIONS['Standard Co-Author'];
    }, [customPersonas]);

    // --- DEFINITIONS FOR HANDLERS ---
    const handleUpdateInstructions = useCallback((newInstructions: string) => {
        setSelectedInstruction(newInstructions); // Update selector logic if needed
        updateLocalBook({ instructions: newInstructions });
    }, []);

    const handleSaveNewInstructionTemplate = useCallback(async () => {
        if(!book) return;
        const name = await modalService.prompt({ title: "Save Template", inputLabel: "Template Name" });
        if(name) {
            const newTmpl: InstructionTemplate = { id: crypto.randomUUID(), name, prompt: book.instructions };
            await db.instructions.put(newTmpl);
            setInstructions(prev => [...prev, newTmpl]);
            toastService.success("Template saved.");
        }
    }, [book]);

    const handleUpdateInstructionTemplate = useCallback(async (tmpl: InstructionTemplate) => {
        if(!book) return;
        const confirmed = await modalService.confirm({ title: "Update Template?", message: `Update "${tmpl.name}" with current instructions?` });
        if(confirmed) {
            const updatedTmpl = { ...tmpl, prompt: book.instructions };
            await db.instructions.put(updatedTmpl);
            setInstructions(prev => prev.map(i => i.id === tmpl.id ? updatedTmpl : i));
            toastService.success("Template updated.");
        }
    }, [book]);

    const handleSuggestBookInstructionImprovement = useCallback(async () => {
        if(!book) return;
        setIsSuggestingInstructions(true);
        try {
            const improved = await gemini.improveBookInstructions(book.topic, book.instructions);
            setInstructionSuggestion(improved);
        } catch(e: any) { toastService.error("Failed to generate suggestion: " + e.message); }
        finally { setIsSuggestingInstructions(false); }
    }, [book]);

    const handleStartOutlineBrainstorm = useCallback(() => {
        setIsBrainstormModalOpen(true);
    }, []);
    
    // Other handlers
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => { const { name, value, type } = e.target; const checked = (e.target as HTMLInputElement).checked; updateLocalBook({ [name]: type === 'checkbox' ? checked : value }); };
    const handleTitleChange = (e: React.FocusEvent<HTMLElement>) => { updateLocalBook({ topic: e.currentTarget.textContent || '' }); };
    const handleSubtitleChange = (e: React.FocusEvent<HTMLElement>) => { updateLocalBook({ subtitle: e.currentTarget.textContent || '' }); };
    const handleChapterTitleChange = (e: React.FocusEvent<HTMLElement>, index: number) => { if (!book) return; const newOutline = produce(book.outline, draft => { draft[index].title = e.currentTarget.textContent || ''; }); updateLocalBook({ outline: newOutline }); const newContent = produce(book.content, draft => { if (draft[index]) { draft[index].title = e.currentTarget.textContent || ''; } }); updateLocalBook({ content: newContent }); };
    const handleContentChange = useCallback((index: number, newHtml: string) => { if (!book) return; setBook(prev => { if (!prev) return null; if (prev.content[index]?.htmlContent === newHtml) return prev; const newContent = [...prev.content]; while (newContent.length <= index) { newContent.push({ title: prev.outline[newContent.length]?.title || '', htmlContent: '' }); } newContent[index] = { ...newContent[index], htmlContent: newHtml }; return { ...prev, content: newContent }; }); setSaveStatus('unsaved'); }, [book]);
    const handleUpdatePart = (index: number, newPartTitle: string) => { if (!book) return; const newOutline = produce(book.outline, draft => { draft[index].part = newPartTitle; }); updateLocalBook({ outline: newOutline }); };
    const handleUpdatePartContent = (index: number, newContent: string) => { if (!book) return; const newOutline = produce(book.outline, draft => { draft[index].partContent = newContent; }); updateLocalBook({ outline: newOutline }); };
    const handlePropagatePart = (index: number) => { if (!book) return; const partName = book.outline[index].part; if (!partName) return; const newOutline = produce(book.outline, draft => { for (let i = index + 1; i < draft.length; i++) { if (draft[i].part && draft[i].part !== partName) break; draft[i].part = partName; } }); updateLocalBook({ outline: newOutline }); toastService.success(`Applied "${partName}" to subsequent chapters.`); };
    const handleSaveToDB = useCallback(async () => { if (!book) return; setSaveStatus('saving'); try { const chatHistoryToSave = (chatMessages || []).map(m => ({ ...m, role: m.role || 'model' })) as ChatMessage[]; await updateBook({ ...book, bookChatHistory: chatHistoryToSave }); setSaveStatus('saved'); } catch (e) { console.error(e); setSaveStatus('unsaved'); toastService.error("Failed to save"); } }, [book, updateBook, chatMessages]);
    useEffect(() => { const interval = setInterval(() => { if (saveStatus === 'unsaved') { handleSaveToDB(); } }, 5000); return () => clearInterval(interval); }, [saveStatus, handleSaveToDB]);
    const handleSaveAndSync = async () => { await handleSaveToDB(); setIsSyncing(true); try { await manualTriggerBackup(); } catch (e) { } finally { setIsSyncing(false); } };
    const handleAddChapter = useCallback((index: number, position: 'before' | 'after') => { if (!book) return; const newIndex = position === 'after' ? index + 1 : index; const newChapter: ChapterOutline = { id: crypto.randomUUID(), title: 'New Chapter', summary: 'Describe the chapter here...', status: 'todo' }; if (book.outline[index]) { newChapter.part = book.outline[index].part; } const newOutline = [...book.outline]; newOutline.splice(newIndex, 0, newChapter); const newContent = [...book.content]; newContent.splice(newIndex, 0, { title: newChapter.title, htmlContent: '' }); setBook({ ...book, outline: newOutline, content: newContent }); setSaveStatus('unsaved'); setActiveChapterIndex(newIndex); toastService.success("Chapter added."); }, [book]);
    const handleDeleteChapter = useCallback(async (index: number) => { if (!book) return; const confirmed = await modalService.confirm({ title: 'Delete Chapter?', message: `Are you sure you want to delete "${book.outline[index].title}"? This action cannot be undone.`, danger: true, confirmText: 'Delete' }); if (confirmed) { const newOutline = [...book.outline]; const newContent = [...book.content]; newOutline.splice(index, 1); newContent.splice(index, 1); const updatedBook = { ...book, outline: newOutline, content: newContent }; setBook(updatedBook); setSaveStatus('unsaved'); if (activeChapterIndex >= newOutline.length) { setActiveChapterIndex(Math.max(0, newOutline.length - 1)); } toastService.info("Chapter deleted."); } }, [book, activeChapterIndex]);
    const handleMoveChapter = useCallback((fromIndex: number, toIndex: number) => { if (!book) return; if (fromIndex === toIndex) return; const newOutline = [...book.outline]; const newContent = [...book.content]; const [movedOutline] = newOutline.splice(fromIndex, 1); newOutline.splice(toIndex, 0, movedOutline); const [movedContent] = newContent.splice(fromIndex, 1); newContent.splice(toIndex, 0, movedContent); setBook({ ...book, outline: newOutline, content: newContent }); setSaveStatus('unsaved'); if (activeChapterIndex === fromIndex) { setActiveChapterIndex(toIndex); } else if (activeChapterIndex > fromIndex && activeChapterIndex <= toIndex) { setActiveChapterIndex(activeChapterIndex - 1); } else if (activeChapterIndex < fromIndex && activeChapterIndex >= toIndex) { setActiveChapterIndex(activeChapterIndex + 1); } }, [book, activeChapterIndex]);
    const handleMergeChapters = async (index: number) => { if (!book || index >= book.outline.length - 1) return; const confirmed = await modalService.confirm({ title: 'Merge Chapters?', message: `Merge "${book.outline[index+1].title}" into "${book.outline[index].title}"? The content will be combined and the second chapter removed.`, confirmText: 'Merge' }); if (confirmed) { const currentContent = book.content[index]?.htmlContent || ''; const nextContent = book.content[index+1]?.htmlContent || ''; const mergedContent = `${currentContent}<hr/><p><em>(Merged from ${book.outline[index+1].title})</em></p>${nextContent}`; const newContent = [...book.content]; newContent[index] = { ...newContent[index], htmlContent: mergedContent }; newContent.splice(index + 1, 1); const newOutline = [...book.outline]; newOutline[index].summary += `\n\n(Merged): ${newOutline[index+1].summary}`; newOutline.splice(index + 1, 1); setBook({ ...book, outline: newOutline, content: newContent }); setSaveStatus('unsaved'); toastService.success("Chapters merged."); } };
    const handleUpdateChapterOutline = (index: number, updates: Partial<ChapterOutline>) => { if (!book) return; const newOutline = produce(book.outline, draft => { Object.assign(draft[index], updates); }); let newContent = book.content; if (updates.title && book.content[index]) { newContent = produce(book.content, draft => { draft[index].title = updates.title!; }); } setBook({ ...book, outline: newOutline, content: newContent }); setSaveStatus('unsaved'); };

    // Define handleExecuteTool explicitly
    const handleExecuteTool = async (fc: FunctionCall) => {
        if (!book) return;
        const args = fc.args as any;
        if (fc.name === 'updateBookMetadata') {
            updateLocalBook({
                topic: args.topic || book.topic,
                subtitle: args.subtitle || book.subtitle,
                author: args.author || book.author,
                description: args.description || book.description
            });
            toastService.success("Book metadata updated.");
        } else if (fc.name === 'updateChapterMetadata') {
            const idx = args.chapterIndex;
            if (book.outline[idx]) {
                handleUpdateChapterOutline(idx, {
                    title: args.title,
                    part: args.part,
                    partContent: args.partContent,
                    summary: args.summary
                });
                toastService.success(`Chapter ${idx+1} updated.`);
            }
        } else if (fc.name === 'addChapter') {
            const idx = args.index ?? book.outline.length;
            const newChapter: ChapterOutline = { id: crypto.randomUUID(), title: args.title, part: args.part, summary: args.summary || '', status: 'todo' };
            const newOutline = [...book.outline];
            newOutline.splice(idx, 0, newChapter);
            const newContent = [...book.content];
            newContent.splice(idx, 0, { title: args.title, htmlContent: '' });
            setBook({ ...book, outline: newOutline, content: newContent });
            setSaveStatus('unsaved');
            toastService.success(`Chapter added: ${args.title}`);
        } else if (fc.name === 'deleteChapter') {
            handleDeleteChapter(args.chapterIndex);
        } else if (fc.name === 'updateChapter') {
             // Handled by chat review flow, but if direct execution is needed:
             // handleContentChange(args.chapterIndex, args.newContent);
        }
    };

    // ... (Existing methods omitted for brevity)
    const handleGenerateChapters = async () => { /* ... */ if (!book) return; const targetIndex = book.content.length < book.outline.length ? book.content.length : -1; if (targetIndex === -1) { toastService.info("All chapters appear to be written!"); return; } setIsGeneratingChapter(targetIndex); setActiveChapterIndex(targetIndex); try { const chapterOutline = book.outline[targetIndex]; if (!book.content[targetIndex]) { handleContentChange(targetIndex, ''); } await gemini.generateChapterContent( book.topic, book.instructions, book.knowledgeBase, seriesKnowledgeBase, chapterOutline, book.bookChatHistory || [], (chunk) => { setBook(prev => { if (!prev) return null; const newContent = [...prev.content]; const currentHtml = newContent[targetIndex]?.htmlContent || ''; newContent[targetIndex] = { title: chapterOutline.title, htmlContent: currentHtml + chunk }; return { ...prev, content: newContent }; }); }, book.language || 'en' ); toastService.success(`Chapter "${chapterOutline.title}" generated.`); setSaveStatus('unsaved'); } catch (e: any) { toastService.error(`Generation failed: ${e.message}`); } finally { setIsGeneratingChapter(null); } };
    const handleGenerateFullBook = async () => { /* ... */ if (!book) return; let nextIndex = book.content.findIndex(c => !c || !c.htmlContent.trim()); if (nextIndex === -1 && book.content.length < book.outline.length) { nextIndex = book.content.length; } if (nextIndex === -1) { toastService.info("All chapters written."); return; } const confirmed = await modalService.confirm({ title: 'Generate Remaining Book?', message: `This will auto-generate chapters starting from ${book.outline[nextIndex].title}. This may take a while. Ensure you have a stable connection.`, confirmText: 'Start Generation' }); if (!confirmed) return; for (let i = nextIndex; i < book.outline.length; i++) { setIsGeneratingChapter(i); setActiveChapterIndex(i); document.getElementById(`chapter-${i}`)?.scrollIntoView(); try { await new Promise(r => setTimeout(r, 500)); const outline = book.outline[i]; setBook(prev => { if(!prev) return null; const nc = [...prev.content]; if (!nc[i]) nc[i] = { title: outline.title, htmlContent: '' }; return { ...prev, content: nc }; }); await gemini.generateChapterContent( book.topic, book.instructions, book.knowledgeBase, seriesKnowledgeBase, outline, chatMessages || [], (chunk) => { setBook(prev => { if (!prev) return null; const newContent = [...prev.content]; const currentHtml = newContent[i]?.htmlContent || ''; newContent[i] = { title: outline.title, htmlContent: currentHtml + chunk }; return { ...prev, content: newContent }; }); }, book.language || 'en' ); await handleSaveToDB(); } catch (e: any) { toastService.error(`Stopped at chapter ${i+1}: ${e.message}`); break; } } setIsGeneratingChapter(null); toastService.success("Batch generation complete."); };
    const handleStartEpubExport = async (options: any) => { if (!book) return; setIsEpubModalOpen(false); toastService.info("Generating ePub..."); try { await exportToEpub(book, options); toastService.success("ePub Downloaded!"); } catch (e: any) { toastService.error(`Export failed: ${e.message}`); } };
    const handleExportPdf = async () => { if (!book) return; toastService.info("Generating PDF..."); try { await exportToPdf(book); toastService.success("PDF Downloaded!"); } catch (e: any) { toastService.error(`Export failed: ${e.message}`); } };
    const createSnapshot = async (name: string) => { if (!book) return; await appCreateSnapshot(book, name); const snaps = await fetchSnapshotsForBook(book.id); setSnapshots(snaps.sort((a, b) => b.createdAt - a.createdAt)); };
    const handleRestoreSnapshot = async (snapshot: BookSnapshot) => { await appRestoreSnapshot(snapshot); };
    const handleDeleteSnapshot = async (id: string) => { await appDeleteSnapshot(id); const snaps = await fetchSnapshotsForBook(bookId); setSnapshots(snaps.sort((a, b) => b.createdAt - a.createdAt)); };
    const registerEditor = (index: number, editor: Editor) => { editorsRef.current.set(index, editor); };
    const unregisterEditor = (index: number) => editorsRef.current.delete(index);
    const handleAssistantAction = async (action: 'rephrase' | 'expand' | 'summarize' | 'suggest' | { type: 'tone', tone: string }) => { if (!activeEditorInstance || isAssistantLoading) return; const { from, to } = activeEditorInstance.state.selection; const text = activeEditorInstance.state.doc.textBetween(from, to, ' '); const context = activeEditorInstance.getText(); if (!text && action !== 'suggest') { toastService.info("Please select some text first."); return; } setIsAssistantLoading(true); try { let result = ''; if (action === 'rephrase') result = await gemini.rephraseText(text, context); else if (action === 'expand') result = await gemini.expandText(text, context); else if (action === 'summarize') result = await gemini.summarizeText(text); else if (action === 'suggest') { const beforeCursor = activeEditorInstance.state.doc.textBetween(Math.max(0, from - 500), from, ' '); result = await gemini.predictNextText(beforeCursor, book?.instructions || ''); } else if (typeof action === 'object' && action.type === 'tone') { result = await gemini.changeTone(text, action.tone, context); } if (result) { if (action === 'suggest') { activeEditorInstance.commands.insertContent(result); } else { activeEditorInstance.commands.insertContent(result); } } } catch (e: any) { toastService.error(`AI Action failed: ${e.message}`); } finally { setIsAssistantLoading(false); } };
    const handleApplyEdit = useCallback((chapterIndex: number, newContent: string) => { if (!book) return; handleContentChange(chapterIndex, newContent); toastService.success("Changes applied to chapter."); }, [book, handleContentChange]);
    const handleSendChatMessage = useCallback(async (msg: string) => { if(!book) return; setIsChatLoading(true); const newMsg: Content = { role: 'user', parts: [{ text: msg }] }; const updatedHistory = [...(chatMessages || []), newMsg]; setChatMessages(updatedHistory); try { const currentChapter = book.content[activeChapterIndex]; const contextData = { topic: book.topic, outline: book.outline, currentChapter: currentChapter ? { title: currentChapter.title, content: currentChapter.htmlContent } : undefined, knowledgeBase: book.knowledgeBase, seriesKnowledgeBase }; const personaText = getPersonaInstructionText(book.aiPersona || 'Standard Co-Author'); const responseHistory = await gemini.streamChatWithBook( msg, updatedHistory, contextData, personaText, (chunk) => { setChatMessages(prev => { if(!prev) return null; const last = prev[prev.length - 1]; if (last.role === 'model') { const text = last.parts[0].text || ''; return [...prev.slice(0, -1), { role: 'model', parts: [{ text: text + chunk }] }]; } else { return [...prev, { role: 'model', parts: [{ text: chunk }] }]; } }); }, (toolCall) => { setChatMessages(prev => [...(prev || []), { role: 'model', parts: [{ functionCall: toolCall }] }]); } ); setChatMessages(responseHistory); } catch(e: any) { toastService.error(e.message || String(e)); } finally { setIsChatLoading(false); } }, [book, chatMessages, activeChapterIndex, seriesKnowledgeBase, getPersonaInstructionText]);
    const handleExecuteAnalysisAction = useCallback((prompt: string) => { setIsAnalysisModalOpen(false); setIsChatOpen(true); handleSendChatMessage(prompt); }, [handleSendChatMessage]);
    const handleOpenTextToImage = useCallback((editorOverride?: Editor) => { const editor = editorOverride || activeEditorInstance; if (!editor) { console.warn("No active editor instance found for Text to Image"); return; } if (editorOverride) { setActiveEditorInstance(editorOverride); } const { from, to } = editor.state.selection; const text = editor.state.doc.textBetween(from, to, ' '); if (!text.trim()) { toastService.info("Please select some text to describe the image."); return; } setTextToImageContext({ text, from, to }); setIsTextToImageModalOpen(true); }, [activeEditorInstance]);
    const handleInsertGeneratedImage = useCallback((imageUrl: string, prompt: string) => { if (!activeEditorInstance || !textToImageContext) return; activeEditorInstance.chain().focus().setTextSelection(textToImageContext.to).insertContent([ { type: 'paragraph' }, { type: 'image', attrs: { src: imageUrl, alt: prompt } }, { type: 'paragraph' } ]).run(); setIsTextToImageModalOpen(false); setTextToImageContext(null); }, [activeEditorInstance, textToImageContext]);
    const handleEditImage = (data: { chapterIndex: number, src: string, alt: string }) => { setEditingImageData(data); setIsImageModalOpen(true); };
    const handleRegenerateImage = async (prompt: string) => { if(!editingImageData) return; setIsRegeneratingImage(true); try { const fullPrompt = `${prompt} (Style: ${book?.imageGenerationInstructions || ''})`; const newImage = await gemini.regenerateImageWithPrompt(fullPrompt); const chapterContent = book?.content[editingImageData.chapterIndex]; if(chapterContent) { const tempDiv = document.createElement('div'); tempDiv.innerHTML = chapterContent.htmlContent; const img = tempDiv.querySelector(`img[src="${editingImageData.src}"]`); if(img) { img.setAttribute('src', newImage); handleContentChange(editingImageData.chapterIndex, tempDiv.innerHTML); setEditingImageData({ ...editingImageData, src: newImage }); toastService.success("Image regenerated!"); } } } catch(e: any) { toastService.error(e.message); } finally { setIsRegeneratingImage(false); } };
    const generateImageFromSuggestion = async (prompt: string) => { if(!suggestionToGenerate || !book) return; setIsLoading(true); try { const fullPrompt = `${prompt} (Style: ${book.imageGenerationInstructions || ''})`; const imageUrl = await gemini.generateCoverImage(fullPrompt, ""); const { chapterIndex, id } = suggestionToGenerate; const chapter = book.content[chapterIndex]; const spanRegex = new RegExp(`<span[^>]*data-suggestion-id="${id}"[^>]*></span>`, 'i'); if (spanRegex.test(chapter.htmlContent)) { const imgHtml = `<img src="${imageUrl}" alt="${prompt}" />`; const newHtml = chapter.htmlContent.replace(spanRegex, imgHtml); handleContentChange(chapterIndex, newHtml); setImageSuggestions(prev => prev.filter(s => s.id !== id)); setSuggestionToGenerate(null); toastService.success("Image generated and inserted."); } else { toastService.error("Could not find insertion point."); } } catch(e: any) { toastService.error(e.message); } finally { setIsLoading(false); } };
    const openImageSuggestionModal = (s: ImageSuggestion) => { setSuggestionToGenerate(s); };
    const closeImageSuggestionModal = () => { setSuggestionToGenerate(null); };
    const handleDownloadAudiobook = (chapterIndex?: number) => { if (chapterIndex !== undefined) { setDownloadModalInitialSelection([chapterIndex]); } else { setDownloadModalInitialSelection([]); } setIsDownloadModalOpen(true); };
    const handleBrainstormComplete = (outline: ChapterOutline[], finalTitle: string) => { if(!book) return; const newContent = outline.map(ch => { const existing = book.content.find(c => c && c.title === ch.title); return existing || { title: ch.title, htmlContent: '' }; }); setBook({ ...book, topic: finalTitle, outline, content: newContent }); setIsBrainstormModalOpen(false); setSaveStatus('unsaved'); toastService.success("Outline applied!"); };
    const handleOpenAnalysisModal = async (index: number) => { if(!book) return; const content = book.content[index]?.htmlContent; if(!content) { toastService.info("Chapter is empty."); return; } setIsAnalysisModalOpen(true); setIsAnalyzing(true); setAnalysisData({ chapterIndex: index, result: null }); try { const tempDiv = document.createElement('div'); tempDiv.innerHTML = content; const personaText = getPersonaInstructionText(book.aiPersona || 'Standard Co-Author'); const res = await gemini.analyzeChapterContent(content, book, seriesKnowledgeBase, personaText); setAnalysisData({ chapterIndex: index, result: res }); } catch(e: any) { toastService.error(e.message); setIsAnalysisModalOpen(false); } finally { setIsAnalyzing(false); } };
    const handleAnalyzeChapterStyle = async (index: number) => { if(!book) return; setIsStyleAnalysisModalOpen(true); setIsAnalyzingStyle(true); setAnalyzingStyleChapterIndex(index); try { const res = await gemini.analyzeChapterStyle(book.content[index].htmlContent, book.topic, book.instructions); setStyleAnalysisResult(res); } catch(e: any) { toastService.error(e.message); setIsStyleAnalysisModalOpen(false); } finally { setIsAnalyzingStyle(false); } };
    const handleApplyStyleSuggestion = (original: string, replacement: string) => { if (analyzingStyleChapterIndex === null || !book) return; const content = book.content[analyzingStyleChapterIndex].htmlContent; const newContent = content.replace(original, replacement); handleContentChange(analyzingStyleChapterIndex, newContent); setStyleAnalysisResult(prev => prev ? prev.filter(s => s.originalPassage !== original) : null); toastService.success("Suggestion applied."); };
    const handleApplyShowTellSuggestion = (original: string, replacement: string) => { if (analysisData.chapterIndex === null || !book) return; const content = book.content[analysisData.chapterIndex].htmlContent; const newContent = content.replace(original, replacement); handleContentChange(analysisData.chapterIndex, newContent); if (deepAnalysisType === 'show_tell') { setDeepAnalysisResult((prev: any) => prev.filter((i: any) => i.passage !== original)); } toastService.success("Suggestion applied."); };
    const handleRunMacro = async (macroId: string) => { const macro = macros.find(m => m.id === macroId); if (!macro || !book) return; setIsMacroResultModalOpen(true); setMacroResults([]); for (const action of macro.actions) { const tempResult: MacroResult = { actionId: action.id, actionName: action.name, type: action.type, result: 'Running...' }; setMacroResults(prev => [...prev, tempResult]); try { let res: any; const content = book.content[activeChapterIndex]?.htmlContent || ''; if (action.type === 'analyze_pacing') { const text = content.replace(/<[^>]*>/g, ''); res = await gemini.analyzePacingAndFlow(text); } else if (action.type === 'analyze_show_dont_tell') { const text = content.replace(/<[^>]*>/g, ''); res = await gemini.analyzeShowDontTell(text); } else if (action.type === 'generate_alt_openings') { const text = content.replace(/<[^>]*>/g, ''); res = await gemini.generateAlternativeOpenings(text); } else if (action.type === 'analyze_series_consistency') { const otherBooks = (await db.books.getAll()).filter(b => b.seriesId === book.seriesId && b.id !== book.id); const series = book.seriesId ? await db.series.get(book.seriesId) : null; if (series) { res = await gemini.analyzeSeriesConsistency(content, book, otherBooks, series); } else { throw new Error("Book is not part of a series."); } } else if (action.type === 'rewrite_with_prompt') { res = await gemini.rewriteChapterWithPrompt(content, book, seriesKnowledgeBase, action.params?.prompt || ''); handleContentChange(activeChapterIndex, res); res = "Chapter rewritten and updated."; } setMacroResults(prev => prev.map(r => r.actionId === action.id ? { ...r, result: res } : r)); } catch (e: any) { setMacroResults(prev => prev.map(r => r.actionId === action.id ? { ...r, error: e.message } : r)); } } };
    const handleApplyMacroShowTellSuggestion = (original: string, replacement: string) => { if (!book) return; const content = book.content[activeChapterIndex].htmlContent; const newContent = content.replace(original, replacement); handleContentChange(activeChapterIndex, newContent); toastService.success("Applied."); };
    const handleApplyMacroOpeningSuggestion = (replacement: string) => { if (!book) return; const content = book.content[activeChapterIndex].htmlContent; const match = content.match(/<p>(.*?)<\/p>/); if (match) { const newContent = content.replace(match[0], `<p>${replacement}</p>`); handleContentChange(activeChapterIndex, newContent); toastService.success("Opening updated."); } else { toastService.error("Could not identify opening paragraph to replace."); } };
    const handleKnowledgeBaseUpdate = (sheets: KnowledgeSheet[]) => { if (!book) return; updateLocalBook({ knowledgeBase: sheets }); };
    const handleAutoFillKnowledgeBase = async () => { if (!book) return; setIsAutoFillingKb(true); try { const allText = book.content.map(c => c.htmlContent).join('\n'); const newSheets = await gemini.autoFillKnowledgeBase(book.topic, allText); const existingNames = new Set((book.knowledgeBase || []).map(s => s.name.toLowerCase())); const uniqueNew = newSheets.filter(s => !existingNames.has(s.name.toLowerCase())); updateLocalBook({ knowledgeBase: [...(book.knowledgeBase || []), ...uniqueNew] }); toastService.success(`Added ${uniqueNew.length} new entries.`); } catch(e: any) { toastService.error(e.message); } finally { setIsAutoFillingKb(false); } };
    const handleGenerateSubSection = async (chIdx: number, secIdx: number) => { if (!book) return; const subSection = book.outline[chIdx].subSections?.[secIdx]; if (!subSection) return; setGeneratingSubSection({ chapter: chIdx, section: secIdx }); setIsGeneratingChapter(chIdx); try { const chapterOutline = book.outline[chIdx]; const subTopic = subSection.prompt; if (!book.content[chIdx]) { handleContentChange(chIdx, ''); } const chatHist: Content[] = []; const onStream = (chunk: string) => { setBook(prev => { if (!prev) return null; const newContent = [...prev.content]; const currentHtml = newContent[chIdx]?.htmlContent || ''; newContent[chIdx] = { title: chapterOutline.title, htmlContent: currentHtml + chunk }; return { ...prev, content: newContent }; }); }; await gemini.generateSingleSection( book.topic, book.instructions, book.knowledgeBase, seriesKnowledgeBase, chapterOutline, subTopic, chatHist, onStream, book.language || 'en' ); const newOutline = produce(book.outline, draft => { if (draft[chIdx].subSections?.[secIdx]) { draft[chIdx].subSections![secIdx].isGenerated = true; } }); setBook(prev => prev ? { ...prev, outline: newOutline } : null); setSaveStatus('unsaved'); } catch(e: any) { toastService.error(e.message); } finally { setGeneratingSubSection(null); setIsGeneratingChapter(null); } };
    const handleGenerateChapterBreakdown = async (chIdx: number) => { if (!book) return; setIsGeneratingChapter(chIdx); try { const outline = book.outline[chIdx]; const breakdown = await gemini.breakdownChapterSummary(book.topic, book.instructions, outline); const subSections = breakdown.map(prompt => ({ prompt, isGenerated: false })); const newOutline = produce(book.outline, draft => { draft[chIdx].subSections = subSections; }); updateLocalBook({ outline: newOutline }); toastService.success("Chapter plan generated."); } catch(e: any) { toastService.error(e.message); } finally { setIsGeneratingChapter(null); } };
    const handleUpdateSubSectionPrompt = (chIdx: number, secIdx: number, val: string) => { if (!book) return; const newOutline = produce(book.outline, draft => { if (draft[chIdx].subSections?.[secIdx]) { draft[chIdx].subSections![secIdx].prompt = val; } }); updateLocalBook({ outline: newOutline }); };
    const handleRemoveSubSection = (chIdx: number, secIdx: number) => { if (!book) return; const newOutline = produce(book.outline, draft => { if (draft[chIdx].subSections) { draft[chIdx].subSections!.splice(secIdx, 1); } }); updateLocalBook({ outline: newOutline }); };
    const handleAnalyzePlanCompleteness = async (chIdx: number) => { if (!book) return; const outline = book.outline[chIdx]; const content = book.content[chIdx]?.htmlContent || ''; const prompts = outline.subSections?.map(s => s.prompt) || []; if (prompts.length === 0) return; setIsAnalyzingPlan(chIdx); try { const results = await gemini.analyzePlanCompleteness(content, prompts); const newOutline = produce(book.outline, draft => { if (draft[chIdx].subSections) { draft[chIdx].subSections!.forEach((s, i) => { s.isGenerated = results[i]; }); } }); updateLocalBook({ outline: newOutline }); toastService.success("Plan analysis complete."); } catch(e: any) { toastService.error(e.message); } finally { setIsAnalyzingPlan(null); } };
    const handleUpdateScene = (chIdx: number, sceneId: string, updates: Partial<Scene>) => { if (!book) return; const newOutline = produce(book.outline, draft => { const scene = draft[chIdx].scenes?.find(s => s.id === sceneId); if (scene) Object.assign(scene, updates); }); updateLocalBook({ outline: newOutline }); };
    const handleAddScene = (chIdx: number) => { if (!book) return; const newScene: Scene = { id: crypto.randomUUID(), title: 'New Scene', summary: '' }; const newOutline = produce(book.outline, draft => { if (!draft[chIdx].scenes) draft[chIdx].scenes = []; draft[chIdx].scenes!.push(newScene); }); updateLocalBook({ outline: newOutline }); };
    const handleDeleteScene = (chIdx: number, sceneId: string) => { if (!book) return; const newOutline = produce(book.outline, draft => { if (draft[chIdx].scenes) { draft[chIdx].scenes = draft[chIdx].scenes!.filter(s => s.id !== sceneId); } }); updateLocalBook({ outline: newOutline }); };
    const handleMoveScene = (chIdx: number, fromIdx: number, toIdx: number) => { if (!book) return; const newOutline = produce(book.outline, draft => { const scenes = draft[chIdx].scenes; if (scenes) { const [moved] = scenes.splice(fromIdx, 1); scenes.splice(toIdx, 0, moved); } }); updateLocalBook({ outline: newOutline }); };
    const handlePlayFullBook = () => playAudiobook(bookId, 0);
    const handlePlayChapter = (idx: number) => playAudiobook(bookId, idx);
    const handleUpdateVoiceStyle = (style: string) => updateLocalBook({ voiceStyleInstructions: style });
    
    // --- Character Voice Handler ---
    const handleAnalyzeCharacterVoice = async () => {
        if (!book || !book.knowledgeBase || book.knowledgeBase.length === 0) {
            toastService.error("No character profiles in Knowledge Base to analyze against.");
            return;
        }
        
        const currentContent = book.content[activeChapterIndex]?.htmlContent || '';
        if (!currentContent.trim()) {
            toastService.info("Current chapter is empty.");
            return;
        }
        
        const plainText = currentContent.replace(/<[^>]*>/g, ''); // Simple strip for analysis
        
        setIsCharacterVoiceAnalysisModalOpen(true);
        setIsAnalyzingCharacterVoice(true);
        setCharacterVoiceAnalysisResult(null);
        
        try {
            const results = await gemini.analyzeCharacterVoice(plainText, book.knowledgeBase);
            setCharacterVoiceAnalysisResult(results);
        } catch (e: any) {
            toastService.error(e.message);
            setIsCharacterVoiceAnalysisModalOpen(false);
        } finally {
            setIsAnalyzingCharacterVoice(false);
        }
    };

    const handleApplyCharacterVoiceSuggestion = (original: string, replacement: string) => {
        if (!book) return;
        const content = book.content[activeChapterIndex].htmlContent;
        const newContent = content.replace(original, replacement);
        
        if (newContent === content) {
             toastService.error("Could not find exact match to replace in HTML. You may need to edit manually.");
        } else {
             handleContentChange(activeChapterIndex, newContent);
             setCharacterVoiceAnalysisResult(prev => prev ? prev.filter(i => i.dialogue !== original) : null);
             toastService.success("Voice fix applied.");
        }
    };
    
    // --- Plot Hole Handler ---
    const handleAnalyzePlotHoles = async () => {
        if (!book || book.outline.length === 0) {
            toastService.error("No outline to analyze against.");
            return;
        }
        
        const currentContent = book.content[activeChapterIndex]?.htmlContent || '';
        if (!currentContent.trim()) {
            toastService.info("Current chapter is empty.");
            return;
        }
        
        const plainText = currentContent.replace(/<[^>]*>/g, '');
        
        setIsPlotHoleModalOpen(true);
        setIsAnalyzingPlotHoles(true);
        setPlotHoleResults(null);
        
        try {
            const results = await gemini.analyzePlotHoles(plainText, book.outline, book.knowledgeBase || []);
            setPlotHoleResults(results);
        } catch (e: any) {
            toastService.error(e.message);
            setIsPlotHoleModalOpen(false);
        } finally {
            setIsAnalyzingPlotHoles(false);
        }
    };

    // --- Lore Consistency Handler ---
    const handleAnalyzeLoreConsistency = async () => {
        if (!book || !book.knowledgeBase || book.knowledgeBase.length === 0) {
            toastService.error("No knowledge base to analyze against.");
            return;
        }
        
        const currentContent = book.content[activeChapterIndex]?.htmlContent || '';
        if (!currentContent.trim()) {
            toastService.info("Current chapter is empty.");
            return;
        }
        
        const plainText = currentContent.replace(/<[^>]*>/g, '');
        
        setIsLoreConsistencyModalOpen(true);
        setIsAnalyzingLore(true);
        setLoreConsistencyResults(null);
        
        try {
            const results = await gemini.analyzeLoreConsistency(plainText, book.knowledgeBase);
            setLoreConsistencyResults(results);
        } catch (e: any) {
            toastService.error(e.message);
            setIsLoreConsistencyModalOpen(false);
        } finally {
            setIsAnalyzingLore(false);
        }
    };

    const handleApplyLoreSuggestion = (original: string, replacement: string) => {
        if (!book) return;
        const content = book.content[activeChapterIndex].htmlContent;
        const newContent = content.replace(original, replacement);
        
        if (newContent === content) {
             toastService.error("Could not find exact match. Please edit manually.");
        } else {
             handleContentChange(activeChapterIndex, newContent);
             setLoreConsistencyResults(prev => prev ? prev.filter(i => i.passage !== original) : null);
             toastService.success("Lore fix applied.");
        }
    };

    const handleUpdatePersona = (persona: string) => {
        updateLocalBook({ aiPersona: persona });
    };

    const toggleAutocomplete = () => {
        setIsAutocompleteEnabled(prev => !prev);
    };

    const addCustomPersona = async (persona: Omit<CustomPersona, 'id'>) => {
        const newPersona = { ...persona, id: crypto.randomUUID() };
        const updated = [...customPersonas, newPersona];
        setCustomPersonas(updated);
        await db.settings.put({ id: 'customPersonas', value: updated });
        toastService.success("Custom persona added.");
    };

    const deleteCustomPersona = async (id: string) => {
        const updated = customPersonas.filter(p => p.id !== id);
        setCustomPersonas(updated);
        await db.settings.put({ id: 'customPersonas', value: updated });
        toastService.info("Persona deleted.");
    };

    // Expose context
    const contextValue: BookEditorContextType = {
        book, isLoading, loadingMessage, saveStatus, isSyncing, activeChapterIndex, setActiveChapterIndex,
        handleInputChange, handleTitleChange, handleSubtitleChange, handleChapterTitleChange, handleContentChange,
        handleUpdatePart, handleUpdatePartContent, handlePropagatePart,
        instructions, selectedInstruction, handleUpdateInstructions, handleSaveNewInstructionTemplate, handleUpdateInstructionTemplate,
        isSuggestingInstructions, instructionSuggestion, setInstructionSuggestion, handleSuggestBookInstructionImprovement,
        isImageModalOpen, setIsImageModalOpen, editingImageData, handleEditImage, isRegeneratingImage, handleRegenerateImage,
        imageSuggestions, setImageSuggestions, suggestionToGenerate, openImageSuggestionModal, closeImageSuggestionModal, generateImageFromSuggestion,
        isEpubModalOpen, setIsEpubModalOpen, handleStartEpubExport, handleExportPdf, handleDownloadAudiobook,
        isDownloadModalOpen, setIsDownloadModalOpen, downloadModalInitialSelection,
        handleSaveToDB, handleSaveAndSync,
        isSnapshotsPanelOpen, setIsSnapshotsPanelOpen, snapshots, createSnapshot, handleRestoreSnapshot, handleDeleteSnapshot,
        isBrainstormModalOpen, setIsBrainstormModalOpen, handleStartOutlineBrainstorm, handleBrainstormComplete,
        isGeneratingChapter, handleGenerateChapters, handleGenerateFullBook,
        isAnalysisModalOpen, setIsAnalysisModalOpen, analysisData, isAnalyzing, handleOpenAnalysisModal, handleExecuteAnalysisAction,
        isStyleAnalysisModalOpen, setIsStyleAnalysisModalOpen, styleAnalysisResult, analyzingStyleChapterIndex, isAnalyzingStyle, handleAnalyzeChapterStyle, handleApplyStyleSuggestion,
        isCharacterVoiceAnalysisModalOpen, setIsCharacterVoiceAnalysisModalOpen, characterVoiceAnalysisResult, isAnalyzingCharacterVoice, handleAnalyzeCharacterVoice, handleApplyCharacterVoiceSuggestion,
        isPlotHoleModalOpen, setIsPlotHoleModalOpen, plotHoleResults, isAnalyzingPlotHoles, handleAnalyzePlotHoles,
        isLoreConsistencyModalOpen, setIsLoreConsistencyModalOpen, loreConsistencyResults, isAnalyzingLore, handleAnalyzeLoreConsistency, handleApplyLoreSuggestion,
        isChatOpen, setIsChatOpen, chatMessages, handleSendChatMessage, isChatLoading, handleApplyEdit, handleExecuteTool,
        activeEditorInstance, setActiveEditorInstance, registerEditor, unregisterEditor, handleAssistantAction, isAssistantLoading,
        handleAddChapter, handleDeleteChapter, handleMoveChapter, handleMergeChapters, handleUpdateChapterOutline,
        isDeepAnalysisModalOpen, setIsDeepAnalysisModalOpen, deepAnalysisResult, deepAnalysisType, handleApplyShowTellSuggestion,
        isMacroResultModalOpen, setIsMacroResultModalOpen, macroResults, handleRunMacro, handleApplyMacroShowTellSuggestion, handleApplyMacroOpeningSuggestion,
        macros,
        isKnowledgeBaseOpen, setIsKnowledgeBaseOpen, handleKnowledgeBaseUpdate, handleAutoFillKnowledgeBase, isAutoFillingKb,
        generatingSubSection, handleGenerateSubSection, handleGenerateChapterBreakdown, handleUpdateSubSectionPrompt, handleRemoveSubSection, handleAnalyzePlanCompleteness, isAnalyzingPlan,
        handleUpdateScene, handleAddScene, handleDeleteScene, handleMoveScene,
        geminiTTSVoices, audiobookState, handlePlayFullBook, handlePlayChapter, handleSetVoice: () => {}, handleUpdateVoiceStyle, handlePauseAudiobook: pauseAudiobook, handleResumeAudiobook: resumeAudiobook, handleStopAudiobook: stopAudiobook, handleSkipChapter: skipAudiobookChapter,
        isMetadataOpen, setIsMetadataOpen, isAiEnabled,
        isTextToImageModalOpen, setIsTextToImageModalOpen, textToImageContext, handleOpenTextToImage, handleInsertGeneratedImage,
        handleUpdatePersona, isAutocompleteEnabled, toggleAutocomplete,
        customPersonas, addCustomPersona, deleteCustomPersona
    };

    return (
        <BookEditorContext.Provider value={contextValue}>
            {children}
        </BookEditorContext.Provider>
    );
};

export const useBookEditor = () => {
    const context = useContext(BookEditorContext);
    if (context === undefined) {
        throw new Error('useBookEditor must be used within a BookEditorProvider');
    }
    return context;
};