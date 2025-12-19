
import { Content, Part } from '@google/genai';

export type Page = 'dashboard' | 'documents' | 'editor' | 'reader' | 'instructions' | 'macros' | 'settings' | 'series' | 'reading' | 'archived' | 'trash';

export type SyncProvider = 'google_drive' | 'dropbox' | 'onedrive';

export interface Book {
    id: string;
    topic: string;
    subtitle?: string;
    author?: string;
    description?: string;
    instructions: string;
    wordCountGoal?: number;
    generateImages: boolean;
    imageGenerationInstructions: string;
    voiceStyleInstructions?: string;
    aiPersona?: string; // New: AI Personality
    status: 'configuring' | 'outlining' | 'writing' | 'complete' | 'archived';
    deletedAt?: number; // Timestamp if soft-deleted
    outline: ChapterOutline[];
    content: ChapterContent[];
    createdAt: number;
    updatedAt: number;
    coverImage?: string;
    seriesId?: string;
    seriesName?: string;
    publisher?: string;
    publicationDate?: string;
    language?: string;
    creationConfig?: BookCreationConfig;
    knowledgeBase?: KnowledgeSheet[];
    bookChatHistory?: ChatMessage[];
}

export interface CustomPersona {
    id: string;
    name: string;
    description: string;
    instructions: string;
}

export interface GeneralDoc {
    id: string;
    title: string;
    content: string; // HTML content
    createdAt: number;
    updatedAt: number;
}

export interface AudiobookState {
    playbackState: 'stopped' | 'loading' | 'playing' | 'paused' | 'buffering';
    bookId: string | null;
    bookTitle: string | null;
    currentChapterIndex: number;
    currentChapterTitle: string | null;
    currentParagraphIndex: number;
    chapterProgress: number; // 0-100
    playbackRate: number;
    totalParagraphsInChapter: number;
}

export interface ReaderSettings {
    theme: 'light' | 'dark' | 'sepia' | 'high-contrast';
    fontFamily: 'literata' | 'merriweather' | 'inter' | 'roboto-mono';
    fontSize: number;
    lineHeight: number;
    paragraphSpacing: number;
    textIndent: number;
    viewMode: 'scroll' | 'paginate';
    maxWidth: string; // e.g. '600px' or '100%'
    textAlign: 'left' | 'justify';
    paddingX: number;
}

export interface Bookmark {
    id: string;
    chapterIndex: number;
    elementIndex: number;
    title: string;
    previewText: string;
    timestamp: number;
    note?: string;
}

export interface ReadingProgress {
    bookId: string;
    scroll?: number;
    paginate?: number;
    percentage?: number;
    updatedAt: number;
    // Responsive positioning fields
    chapterIndex?: number;
    elementIndex?: number;
    // Bookmarks
    bookmarks: Bookmark[];
    // Legacy single bookmark field (for migration or simple toggle)
    bookmark?: {
        chapterIndex: number;
        elementIndex: number;
        timestamp: number;
        previewText?: string;
    } | null;
}

export interface Series {
    id: string;
    title: string;
    description?: string;
    bookIds: string[];
    sharedKnowledgeBase?: KnowledgeSheet[];
}

export interface BookCreationConfig {
    topic: string;
    instructions: string;
    wordCountGoal?: number;
    generateImages: boolean;
    imageGenerationInstructions: string;
}

export interface ChapterOutline {
    id?: string;
    part?: string;
    partContent?: string;
    title: string;
    summary: string;
    subSections?: SubSection[];
    // For corkboard view
    color?: string;
    status?: 'todo' | 'in_progress' | 'done';
    scenes?: Scene[];
}

export interface Scene {
    id: string;
    title: string;
    summary: string;
}

export interface SubSection {
    prompt: string;
    isGenerated: boolean;
}

export interface ChapterContent {
    title: string;
    htmlContent: string;
}

export interface InstructionTemplate {
    id: string;
    name: string;
    prompt: string;
}

export interface StylePreset {
    id: string;
    name: string;
    description: string;
}

export interface BookSnapshot {
    id: string;
    bookId: string;
    name: string;
    bookData: string; // The full Book object as a JSON string
    createdAt: number;
}

export interface Macro {
    id: string;
    name: string;
    actions: MacroAction[];
}

export interface MacroAction {
    id: string;
    type: string;
    name: string;
    params?: Record<string, any>;
}

export interface GroundingChunk {
    web: {
        uri: string;
        title: string;
    };
}

export interface AnalysisResult {
    feedback: string;
    suggestions: {
        title: string;
        description: string;
        prompt: string;
    }[];
}

export type KnowledgeSheetCategory = 'Character' | 'Place' | 'Object' | 'Event' | 'Lore' | 'Value System & Beliefs' | 'Technology & Magic Systems' | 'Culture & Society' | 'History & Timeline' | 'Plot & Narrative Structure' | 'Theme & Tone' | 'Other';

export interface KnowledgeSheet {
    id: string;
    name: string;
    content: string;
    category?: KnowledgeSheetCategory;
}

export interface EpubExportOptions {
    includeToc: boolean;
    includeCover: boolean;
    customCss: string;
}

export interface GoogleDriveFile {
    id: string;
    name: string;
    modifiedTime: string;
}

export interface ChatMessage {
    role: string;
    parts: Part[];
}

export interface BackgroundTask {
  id: string;
  name: string;
  bookId?: string;
  execute: (updateProgress: (message: string, current: number, total: number) => void) => Promise<any>;
  onComplete?: (result: any) => void;
}

export interface BackgroundTaskState {
  currentTask: BackgroundTask | null;
  queue: BackgroundTask[];
  progress: {
    message: string;
    percentage: number;
  } | null;
  isProcessing: boolean;
}

export interface PacingAnalysisResult {
    sentenceLengthHistogram: { range: string; count: number }[];
    dialogueRatio: number;
    pacingFeedback: string;
}

export interface ShowTellAnalysisResult {
    passage: string;
    suggestion: string;
}

export interface SeriesInconsistency {
    inconsistentPassage: string;
    contradictionSource: string;
    explanation: string;
}

export interface CharacterVoiceInconsistency {
    characterName: string;
    dialogue: string;
    inconsistencyReason: string;
    suggestedFix: string;
}

export interface PlotHole {
    issue: string;
    location: string;
    severity: 'High' | 'Medium' | 'Low';
    explanation: string;
    suggestion: string;
}

export interface LoreInconsistency {
    passage: string;
    contradiction: string;
    knowledgeSheetName: string;
    suggestion: string;
}

export type MacroResult = {
    actionId: string;
    actionName: string;
    type: string;
    result?: any;
    error?: string;
}

// For knowledge graph
export interface GraphNode {
    id: string;
    name: string;
    category?: string;
    isOrphan?: boolean;
    x: number;
    y: number;
    vx: number;
    vy: number;
}

export interface GraphEdge {
    source: string;
    target: string;
}

export interface ImageSuggestion {
    id: string;
    chapterIndex: number;
    prompt: string;
}

export interface StyleSuggestion {
    originalPassage: string;
    suggestedRewrite: string;
    explanation: string;
}