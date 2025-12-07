
import { Book, InstructionTemplate, StylePreset, BookSnapshot, Macro, Series, ReadingProgress, GeneralDoc } from '../types';
import { PRESET_STYLES, PRESET_INSTRUCTIONS } from '../constants';
import { triggerBackup } from './backupService';
import { historyService } from './historyService';

const DB_NAME = 'AIBookStudioDB';
const DB_VERSION = 9; // Incremented version for documents
const STORES = {
  BOOKS: 'books',
  INSTRUCTIONS: 'instructions',
  STYLES: 'styles',
  SNAPSHOTS: 'snapshots',
  SETTINGS: 'settings',
  HISTORY: 'history',
  MACROS: 'macros',
  SERIES: 'series',
  READING_PROGRESS: 'readingProgress',
  AUDIO_CACHE: 'audioCache',
  DOCUMENTS: 'documents',
};

class DBService {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;
  private backupsDisabled = false;

  init(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onblocked = () => {
        this.initPromise = null; 
        reject(new Error('Database upgrade blocked. Please close other tabs running this application and reload.'));
      };

      request.onerror = (event) => {
        this.initPromise = null; 
        const error = (event.target as IDBOpenDBRequest).error;
        reject(new Error(`Failed to open IndexedDB. Reason: ${error?.message || 'Unknown'}.`));
      };
      
      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        this.db.onversionchange = () => {
          this.db?.close();
          window.dispatchEvent(new CustomEvent('dbversionchange'));
        };
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const transaction = (event.target as IDBOpenDBRequest).transaction;
        
        if (!db.objectStoreNames.contains(STORES.BOOKS)) {
          db.createObjectStore(STORES.BOOKS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.INSTRUCTIONS)) {
          const instructionsStore = db.createObjectStore(STORES.INSTRUCTIONS, { keyPath: 'id' });
          PRESET_INSTRUCTIONS.forEach(instr => instructionsStore.add(instr));
        }
        if (!db.objectStoreNames.contains(STORES.STYLES)) {
          const stylesStore = db.createObjectStore(STORES.STYLES, { keyPath: 'id' });
          PRESET_STYLES.forEach(style => stylesStore.add(style));
        }
        if (!db.objectStoreNames.contains(STORES.SNAPSHOTS)) {
            const snapshotStore = db.createObjectStore(STORES.SNAPSHOTS, { keyPath: 'id' });
            snapshotStore.createIndex('bookId', 'bookId', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
            db.createObjectStore(STORES.SETTINGS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.HISTORY)) {
            db.createObjectStore(STORES.HISTORY, { keyPath: 'id' });
        }
        if (event.oldVersion < 5 && !db.objectStoreNames.contains(STORES.MACROS)) {
            db.createObjectStore(STORES.MACROS, { keyPath: 'id' });
        }
        if (event.oldVersion < 6) {
            if (!db.objectStoreNames.contains(STORES.SERIES)) {
                db.createObjectStore(STORES.SERIES, { keyPath: 'id' });
            }
            if (transaction) {
                const booksStore = transaction.objectStore(STORES.BOOKS);
                if (!booksStore.indexNames.contains('seriesId')) {
                    booksStore.createIndex('seriesId', 'seriesId', { unique: false });
                }
            }
        }
        if (event.oldVersion < 7) {
            if (!db.objectStoreNames.contains(STORES.READING_PROGRESS)) {
                db.createObjectStore(STORES.READING_PROGRESS, { keyPath: 'bookId' });
            }
        }
        if (event.oldVersion < 8) {
            if (!db.objectStoreNames.contains(STORES.AUDIO_CACHE)) {
                db.createObjectStore(STORES.AUDIO_CACHE);
            }
        }
        if (event.oldVersion < 9) {
            if (!db.objectStoreNames.contains(STORES.DOCUMENTS)) {
                db.createObjectStore(STORES.DOCUMENTS, { keyPath: 'id' });
            }
        }
      };
    });
    return this.initPromise;
  }

  private async getStore(storeName: string, mode: IDBTransactionMode): Promise<IDBObjectStore> {
    if (!this.initPromise) {
      this.init();
    }
    await this.initPromise;
    if (!this.db) {
        throw new Error('DB could not be initialized.');
    }
    return this.db.transaction(storeName, mode).objectStore(storeName);
  }

  private async getAll<T>(storeName: string): Promise<T[]> {
    const store = await this.getStore(storeName, 'readonly');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onerror = () => reject(`Error getting all from ${storeName}`);
      request.onsuccess = () => resolve(request.result);
    });
  }

  private async getAllByIndex<T>(storeName: string, indexName: string, query: IDBValidKey): Promise<T[]> {
    const store = await this.getStore(storeName, 'readonly');
    const index = store.index(indexName);
    return new Promise((resolve, reject) => {
      const request = index.getAll(query);
      request.onerror = () => reject(`Error getting all by index ${indexName} from ${storeName}`);
      request.onsuccess = () => resolve(request.result);
    });
  }
  
  private async get<T>(storeName: string, id: string): Promise<T | undefined> {
    const store = await this.getStore(storeName, 'readonly');
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onerror = () => reject(`Error getting ${id} from ${storeName}`);
      request.onsuccess = () => resolve(request.result);
    });
  }
  
  private async _captureStateForHistory() {
    if (this.backupsDisabled || historyService.isRestoring) {
        return;
    }
    const state = await this.backup();
    await historyService.addHistoryStep(state);
  }

  private async put<T>(storeName: string, item: T, options: { key?: IDBValidKey, skipHistory?: boolean, skipBackup?: boolean } = {}): Promise<void> {
     if (!options.skipHistory) {
        await this._captureStateForHistory();
     }
     const store = await this.getStore(storeName, 'readwrite');
     return new Promise((resolve, reject) => {
      const request = options.key ? store.put(item, options.key) : store.put(item);
      request.onerror = () => reject(`Error putting item in ${storeName}`);
      request.onsuccess = () => {
        if (!options.skipBackup && !this.backupsDisabled) {
            triggerBackup();
        }
        resolve();
      };
    });
  }
  
  private async delete(storeName: string, id: string): Promise<void> {
    await this._captureStateForHistory();
    const store = await this.getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onerror = () => reject(`Error deleting ${id} from ${storeName}`);
      request.onsuccess = () => {
        if (!this.backupsDisabled) {
            triggerBackup();
        }
        resolve();
      };
    });
  }

  private async clear(storeName: string): Promise<void> {
    await this._captureStateForHistory();
    const store = await this.getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.clear();
      request.onerror = () => reject(`Error clearing ${storeName}`);
      request.onsuccess = () => {
        if (!this.backupsDisabled) {
            triggerBackup();
        }
        resolve();
      };
    });
  }

  // Specific store accessors
  public books = {
    getAll: () => this.getAll<Book>(STORES.BOOKS),
    get: (id: string) => this.get<Book>(STORES.BOOKS, id),
    put: (book: Book) => this.put<Book>(STORES.BOOKS, book),
    delete: (id: string) => this.delete(STORES.BOOKS, id),
    clear: () => this.clear(STORES.BOOKS),
  };
  
  public documents = {
    getAll: () => this.getAll<GeneralDoc>(STORES.DOCUMENTS),
    get: (id: string) => this.get<GeneralDoc>(STORES.DOCUMENTS, id),
    put: (doc: GeneralDoc) => this.put<GeneralDoc>(STORES.DOCUMENTS, doc),
    delete: (id: string) => this.delete(STORES.DOCUMENTS, id),
    clear: () => this.clear(STORES.DOCUMENTS),
  };

  public instructions = {
    getAll: () => this.getAll<InstructionTemplate>(STORES.INSTRUCTIONS),
    get: (id: string) => this.get<InstructionTemplate>(STORES.INSTRUCTIONS, id),
    put: (instruction: InstructionTemplate) => this.put<InstructionTemplate>(STORES.INSTRUCTIONS, instruction),
    delete: (id: string) => this.delete(STORES.INSTRUCTIONS, id),
    clear: () => this.clear(STORES.INSTRUCTIONS),
  };

  public styles = {
    getAll: () => this.getAll<StylePreset>(STORES.STYLES),
    get: (id: string) => this.get<StylePreset>(STORES.STYLES, id),
    put: (style: StylePreset) => this.put<StylePreset>(STORES.STYLES, style),
    delete: (id: string) => this.delete(STORES.STYLES, id),
    clear: () => this.clear(STORES.STYLES),
  };

  public snapshots = {
    getAll: () => this.getAll<BookSnapshot>(STORES.SNAPSHOTS),
    getAllForBook: (bookId: string) => this.getAllByIndex<BookSnapshot>(STORES.SNAPSHOTS, 'bookId', bookId),
    get: (id: string) => this.get<BookSnapshot>(STORES.SNAPSHOTS, id),
    put: (snapshot: BookSnapshot) => this.put<BookSnapshot>(STORES.SNAPSHOTS, snapshot),
    delete: (id: string) => this.delete(STORES.SNAPSHOTS, id),
    clear: () => this.clear(STORES.SNAPSHOTS),
  };
  
  public settings = {
    get: (id: string) => this.get<{id: string; value: any}>(STORES.SETTINGS, id),
    put: (setting: {id: string; value: any}) => this.put<{id: string; value: any}>(STORES.SETTINGS, setting, { skipHistory: true }),
  };
  
  public history = {
    get: (id: 'undoStack' | 'redoStack') => this.get<{ id: string, value: string[] }>(STORES.HISTORY, id),
    put: (item: { id: string, value: string[] }) => this.put<{ id: string, value: string[] }>(STORES.HISTORY, item, { skipHistory: true }),
  }

  public macros = {
    getAll: () => this.getAll<Macro>(STORES.MACROS),
    get: (id: string) => this.get<Macro>(STORES.MACROS, id),
    put: (macro: Macro) => this.put<Macro>(STORES.MACROS, macro),
    delete: (id: string) => this.delete(STORES.MACROS, id),
    clear: () => this.clear(STORES.MACROS),
  };

  public series = {
    getAll: () => this.getAll<Series>(STORES.SERIES),
    get: (id: string) => this.get<Series>(STORES.SERIES, id),
    put: (series: Series) => this.put<Series>(STORES.SERIES, series),
    delete: (id: string) => this.delete(STORES.SERIES, id),
    clear: () => this.clear(STORES.SERIES),
  };

  public readingProgress = {
    getAll: () => this.getAll<ReadingProgress>(STORES.READING_PROGRESS),
    get: (bookId: string) => this.get<ReadingProgress>(STORES.READING_PROGRESS, bookId),
    put: (progress: ReadingProgress) => this.put<ReadingProgress>(STORES.READING_PROGRESS, progress, { skipHistory: true }),
    delete: (bookId: string) => this.delete(STORES.READING_PROGRESS, bookId),
    clear: () => this.clear(STORES.READING_PROGRESS),
  };
  
  public audioCache = {
    get: (id: string) => this.get<ArrayBuffer>(STORES.AUDIO_CACHE, id),
    put: (id: string, data: ArrayBuffer) => this.put<ArrayBuffer>(STORES.AUDIO_CACHE, data, { key: id, skipHistory: true, skipBackup: true }),
    clear: () => this.clear(STORES.AUDIO_CACHE),
  };

  public async getLatestUpdateTimestamp(): Promise<number> {
    const allBooks = await this.books.getAll();
    const allDocs = await this.documents.getAll();
    if (allBooks.length === 0 && allDocs.length === 0) {
        return 0;
    }
    const maxBookTime = allBooks.length ? Math.max(...allBooks.map(b => b.updatedAt)) : 0;
    const maxDocTime = allDocs.length ? Math.max(...allDocs.map(d => d.updatedAt)) : 0;
    return Math.max(maxBookTime, maxDocTime);
  }

  public async backup(): Promise<string> {
    const readerSettings = await this.settings.get('readerSettings');
    const data = {
        books: await this.books.getAll(),
        documents: await this.documents.getAll(),
        instructions: await this.instructions.getAll(),
        styles: await this.styles.getAll(),
        snapshots: await this.snapshots.getAll(),
        macros: await this.macros.getAll(),
        series: await this.series.getAll(),
        readerSettings: readerSettings?.value ?? null,
        readingProgress: await this.readingProgress.getAll(),
    };
    return JSON.stringify(data, null, 2);
  }

  public async restore(jsonString: string): Promise<void> {
      if (!historyService.isRestoring) {
        await this._captureStateForHistory();
      }
      this.backupsDisabled = true;
      try {
        const data = JSON.parse(jsonString);
        
        await this.books.clear();
        if (data.books && Array.isArray(data.books)) {
            for (const book of data.books) {
                await this.books.put(book);
            }
        }

        await this.documents.clear();
        if (data.documents && Array.isArray(data.documents)) {
            for (const doc of data.documents) {
                await this.documents.put(doc);
            }
        }

        await this.instructions.clear();
        const instructionsToRestore = (data.instructions && Array.isArray(data.instructions)) ? data.instructions : [];
        const instructionsMap = new Map<string, InstructionTemplate>();
        for (const instr of PRESET_INSTRUCTIONS) {
            instructionsMap.set(instr.id, instr);
        }
        for (const instr of instructionsToRestore) {
            instructionsMap.set(instr.id, instr);
        }
        for (const instruction of instructionsMap.values()) {
            await this.instructions.put(instruction);
        }
        
        await this.styles.clear();
        const stylesToRestore = (data.styles && Array.isArray(data.styles)) ? data.styles : [];
        const stylesMap = new Map<string, StylePreset>();
        for (const style of PRESET_STYLES) {
            stylesMap.set(style.id, style);
        }
        for (const style of stylesToRestore) {
          stylesMap.set(style.id, style);
        }
        for (const style of stylesMap.values()) {
          await this.styles.put(style);
        }

        await this.snapshots.clear();
        if (data.snapshots && Array.isArray(data.snapshots)) {
            for (const snapshot of data.snapshots) {
                await this.snapshots.put(snapshot);
            }
        }

        await this.macros.clear();
        if (data.macros && Array.isArray(data.macros)) {
            for (const macro of data.macros) {
                await this.macros.put(macro);
            }
        }
        
        await this.series.clear();
        if (data.series && Array.isArray(data.series)) {
            for (const series of data.series) {
                await this.series.put(series);
            }
        }

        if (data.readerSettings) {
            await this.settings.put({ id: 'readerSettings', value: data.readerSettings });
        }

        await this.readingProgress.clear();
        if (data.readingProgress && Array.isArray(data.readingProgress)) {
            for (const progress of data.readingProgress) {
                await this.readingProgress.put(progress);
            }
        }
      } finally {
          this.backupsDisabled = false;
      }
  }
  
  // Merge logic would also need update for documents, but omitting for brevity unless requested
  public async merge(jsonString: string, options: { selectedNewBooks: string[], overwriteExisting: boolean }): Promise<void> {
     // ... existing implementation ...
      if (!historyService.isRestoring) {
            await this._captureStateForHistory();
        }
        this.backupsDisabled = true;
        try {
            const data = JSON.parse(jsonString);
            
            // Existing Book Merge Logic
            if (data.books && Array.isArray(data.books)) {
                for (const book of data.books as Book[]) {
                    const existingBook = await this.books.get(book.id);
                    let shouldProcess = false;
                    if (!existingBook && options.selectedNewBooks.includes(book.id)) {
                        shouldProcess = true;
                    } else if (existingBook && options.overwriteExisting) {
                        shouldProcess = true;
                    }
                    if (shouldProcess) {
                        await this.books.put(book);
                        if (data.snapshots && Array.isArray(data.snapshots)) {
                            if (existingBook && options.overwriteExisting) {
                                const existingSnaps = await this.snapshots.getAllForBook(book.id);
                                for (const snap of existingSnaps) {
                                    await this.snapshots.delete(snap.id);
                                }
                            }
                            const bookSnapshots = data.snapshots.filter((s: BookSnapshot) => s.bookId === book.id);
                            for (const snapshot of bookSnapshots) {
                                const existingSnap = await this.snapshots.get(snapshot.id);
                                if (!existingSnap) {
                                    await this.snapshots.put(snapshot);
                                }
                            }
                        }
                    }
                }
            }

            // Simple Merge for Documents (Add if new, or overwrite if option selected)
            if (data.documents && Array.isArray(data.documents)) {
                for (const doc of data.documents as GeneralDoc[]) {
                    const existing = await this.documents.get(doc.id);
                    if (!existing || options.overwriteExisting) {
                        await this.documents.put(doc);
                    }
                }
            }

             // Handle instructions, styles, and macros: add if they don't exist, but don't overwrite.
            if (data.instructions && Array.isArray(data.instructions)) {
                for (const instruction of data.instructions as InstructionTemplate[]) {
                    const existing = await this.instructions.get(instruction.id);
                    if (!existing) {
                        await this.instructions.put(instruction);
                    }
                }
            }

            if (data.styles && Array.isArray(data.styles)) {
                for (const style of data.styles as StylePreset[]) {
                    const existing = await this.styles.get(style.id);
                    if (!existing) {
                        await this.styles.put(style);
                    }
                }
            }

            if (data.macros && Array.isArray(data.macros)) {
                for (const macro of data.macros as Macro[]) {
                    const existing = await this.macros.get(macro.id);
                    if (!existing) {
                        await this.macros.put(macro);
                    }
                }
            }
            
            if (data.series && Array.isArray(data.series)) {
                for (const series of data.series as Series[]) {
                    const existing = await this.series.get(series.id);
                    if (!existing) {
                        await this.series.put(series);
                    }
                }
            }

            if (data.readerSettings) {
                const existing = await this.settings.get('readerSettings');
                if (!existing) {
                    await this.settings.put({ id: 'readerSettings', value: data.readerSettings });
                }
            }
            
            if (data.readingProgress && Array.isArray(data.readingProgress)) {
                 for (const progress of data.readingProgress as ReadingProgress[]) {
                    const isForNewBook = options.selectedNewBooks.includes(progress.bookId);
                    const isForOverwrittenBook = options.overwriteExisting && (await this.books.get(progress.bookId));
                    if (isForNewBook || isForOverwrittenBook) {
                        await this.readingProgress.put(progress);
                    }
                }
            }

        } finally {
            this.backupsDisabled = false;
        }
  }
}

export const db = new DBService();