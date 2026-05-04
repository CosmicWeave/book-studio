import { db } from './apiClient';

export type PersistedEditorView = 'editor' | 'corkboard' | 'outliner';

export interface PersistedViewSettings {
    focusMode: boolean;
    width: 'narrow' | 'standard' | 'wide';
    font: 'serif' | 'sans';
}

export interface BookEditorUiState {
    activeView: PersistedEditorView;
    isOutlineOpen: boolean;
    isMetadataOpen: boolean;
    viewSettings: PersistedViewSettings;
}

const BOOK_EDITOR_UI_STATE_ID = 'bookEditorUiState';

export const DEFAULT_BOOK_EDITOR_UI_STATE: BookEditorUiState = {
    activeView: 'editor',
    isOutlineOpen: true,
    isMetadataOpen: false,
    viewSettings: {
        focusMode: false,
        width: 'standard',
        font: 'serif',
    },
};

let cachedBookEditorUiState: BookEditorUiState | null = null;
let loadPromise: Promise<BookEditorUiState> | null = null;
let writeQueue: Promise<BookEditorUiState> = Promise.resolve(DEFAULT_BOOK_EDITOR_UI_STATE);

const sanitiseBookEditorUiState = (raw: unknown): BookEditorUiState => {
    const candidate = (raw && typeof raw === 'object' ? raw : {}) as Partial<BookEditorUiState> & {
        viewSettings?: Partial<PersistedViewSettings>;
    };
    const activeView = candidate.activeView;
    const width = candidate.viewSettings?.width;
    const font = candidate.viewSettings?.font;

    return {
        activeView: activeView === 'corkboard' || activeView === 'outliner' || activeView === 'editor'
            ? activeView
            : DEFAULT_BOOK_EDITOR_UI_STATE.activeView,
        isOutlineOpen: typeof candidate.isOutlineOpen === 'boolean'
            ? candidate.isOutlineOpen
            : DEFAULT_BOOK_EDITOR_UI_STATE.isOutlineOpen,
        isMetadataOpen: typeof candidate.isMetadataOpen === 'boolean'
            ? candidate.isMetadataOpen
            : DEFAULT_BOOK_EDITOR_UI_STATE.isMetadataOpen,
        viewSettings: {
            focusMode: typeof candidate.viewSettings?.focusMode === 'boolean'
                ? candidate.viewSettings.focusMode
                : DEFAULT_BOOK_EDITOR_UI_STATE.viewSettings.focusMode,
            width: width === 'narrow' || width === 'standard' || width === 'wide'
                ? width
                : DEFAULT_BOOK_EDITOR_UI_STATE.viewSettings.width,
            font: font === 'serif' || font === 'sans'
                ? font
                : DEFAULT_BOOK_EDITOR_UI_STATE.viewSettings.font,
        },
    };
};

export const loadBookEditorUiState = async (): Promise<BookEditorUiState> => {
    if (cachedBookEditorUiState) {
        return cachedBookEditorUiState;
    }
    if (!loadPromise) {
        loadPromise = (async () => {
            const setting = await db.settings.get(BOOK_EDITOR_UI_STATE_ID);
            const loaded = sanitiseBookEditorUiState(setting?.value);
            cachedBookEditorUiState = loaded;
            return loaded;
        })();
    }
    return loadPromise;
};

export const patchBookEditorUiState = async (updates: Partial<BookEditorUiState>): Promise<BookEditorUiState> => {
    writeQueue = writeQueue.then(async () => {
        const current = await loadBookEditorUiState();
        const next = sanitiseBookEditorUiState({
            ...current,
            ...updates,
            viewSettings: updates.viewSettings
                ? { ...current.viewSettings, ...updates.viewSettings }
                : current.viewSettings,
        });
        cachedBookEditorUiState = next;
        await db.settings.put({ id: BOOK_EDITOR_UI_STATE_ID, value: next });
        return next;
    });
    return writeQueue;
};