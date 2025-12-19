
import { Book, GeneralDoc, InstructionTemplate, StylePreset, BookSnapshot, Macro, Series, ReadingProgress } from '../types';

const DB_NAME = 'ai-book-studio-db';
const DB_VERSION = 4;

interface Store<T> {
    getAll(): Promise<T[]>;
    get(id: string): Promise<T | undefined>;
    put(item: T): Promise<void>;
    delete(id: string): Promise<void>;
    clear(): Promise<void>;
}

interface BookRelatedStore<T> extends Store<T> {
    getAllForBook(bookId: string): Promise<T[]>;
}

class ObjectStore<T> implements Store<T> {
    constructor(private db: IDBDatabase, private storeName: string) {}

    private transaction(mode: IDBTransactionMode): IDBObjectStore {
        return this.db.transaction(this.storeName, mode).objectStore(this.storeName);
    }

    async getAll(): Promise<T[]> {
        return new Promise((resolve, reject) => {
            const request = this.transaction('readonly').getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async get(id: string): Promise<T | undefined> {
        return new Promise((resolve, reject) => {
            const request = this.transaction('readonly').get(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async put(item: T): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = this.transaction('readwrite').put(item);
            request.onsuccess = () => {
                window.dispatchEvent(new Event('dbversionchange'));
                resolve();
            };
            request.onerror = () => reject(request.error);
        });
    }

    async delete(id: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = this.transaction('readwrite').delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async clear(): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = this.transaction('readwrite').clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
}

class SnapshotStore extends ObjectStore<BookSnapshot> implements BookRelatedStore<BookSnapshot> {
    async getAllForBook(bookId: string): Promise<BookSnapshot[]> {
        const all = await this.getAll();
        return all.filter(s => s.bookId === bookId);
    }
}

// --- Fallback In-Memory Stores ---
class InMemoryStore<T> implements Store<T> {
    private cache: Map<string, T> = new Map();
    private storageKey: string;

    constructor(private storeName: string, private keyPath: string = 'id') {
        this.storageKey = `aibookstudio_fallback_${storeName}`;
        this.load();
    }

    private load() {
        try {
            const raw = localStorage.getItem(this.storageKey);
            if (raw) {
                const items: T[] = JSON.parse(raw);
                items.forEach(item => {
                    const key = (item as any)[this.keyPath];
                    if (key) this.cache.set(String(key), item);
                });
            }
        } catch (e) {
            console.warn(`Failed to load ${this.storeName} from localStorage fallback`, e);
        }
    }

    private save() {
        try {
            const items = Array.from(this.cache.values());
            localStorage.setItem(this.storageKey, JSON.stringify(items));
        } catch (e) {
            console.warn(`Failed to save ${this.storeName} to localStorage fallback (quota exceeded?)`, e);
        }
    }

    async getAll(): Promise<T[]> {
        return Array.from(this.cache.values());
    }

    async get(id: string): Promise<T | undefined> {
        return this.cache.get(id);
    }

    async put(item: T): Promise<void> {
        const key = (item as any)[this.keyPath];
        if (key) {
            this.cache.set(String(key), item);
            this.save();
            window.dispatchEvent(new Event('dbversionchange'));
        }
    }

    async delete(id: string): Promise<void> {
        if (this.cache.delete(id)) {
            this.save();
        }
    }

    async clear(): Promise<void> {
        this.cache.clear();
        localStorage.removeItem(this.storageKey);
    }
}

class InMemorySnapshotStore extends InMemoryStore<BookSnapshot> implements BookRelatedStore<BookSnapshot> {
    async getAllForBook(bookId: string): Promise<BookSnapshot[]> {
        const all = await this.getAll();
        return all.filter(s => s.bookId === bookId);
    }
}

// Dummy store to prevent "undefined" errors before init
class DummyStore<T> implements Store<T> {
    async getAll(): Promise<T[]> { throw new Error("Database not initialized"); }
    async get(id: string): Promise<T | undefined> { throw new Error("Database not initialized"); }
    async put(item: T): Promise<void> { throw new Error("Database not initialized"); }
    async delete(id: string): Promise<void> { throw new Error("Database not initialized"); }
    async clear(): Promise<void> { throw new Error("Database not initialized"); }
}

class DummySnapshotStore extends DummyStore<BookSnapshot> implements BookRelatedStore<BookSnapshot> {
    async getAllForBook(bookId: string): Promise<BookSnapshot[]> { throw new Error("Database not initialized"); }
}

class DB {
    private db: IDBDatabase | null = null;
    private initPromise: Promise<void> | null = null;
    
    public books: Store<Book> = new DummyStore();
    public documents: Store<GeneralDoc> = new DummyStore();
    public instructions: Store<InstructionTemplate> = new DummyStore();
    public styles: Store<StylePreset> = new DummyStore();
    public snapshots: BookRelatedStore<BookSnapshot> = new DummySnapshotStore();
    public macros: Store<Macro> = new DummyStore();
    public series: Store<Series> = new DummyStore();
    public readingProgress: Store<ReadingProgress> = new DummyStore();
    public settings: Store<{ id: string; value: any }> = new DummyStore();
    public history: Store<{ id: string; value: any }> = new DummyStore();
    public audioCache: { get(key: string): Promise<ArrayBuffer | undefined>; put(key: string, data: ArrayBuffer): Promise<void>; } = {
        get: async () => undefined,
        put: async () => {}
    };

    async init(): Promise<void> {
        if (this.db) return Promise.resolve();
        if (this.initPromise) return this.initPromise;

        this.initPromise = new Promise((resolve, reject) => {
            // Safety check for environments without indexedDB support
            if (typeof window === 'undefined' || !window.indexedDB) {
                 console.warn("IndexedDB not supported in this environment. Using In-Memory Fallback.");
                 this.useInMemory();
                 resolve();
                 return;
            }

            try {
                const request = indexedDB.open(DB_NAME, DB_VERSION);

                request.onerror = () => {
                    console.warn("IndexedDB failed to open (likely restricted environment). Switching to In-Memory Fallback.", request.error);
                    this.useInMemory();
                    resolve(); // Resolve successfully using fallback
                };

                request.onupgradeneeded = (event) => {
                    const db = (event.target as IDBOpenDBRequest).result;
                    
                    const createStore = (name: string, options: IDBObjectStoreParameters = { keyPath: 'id' }) => {
                        if (!db.objectStoreNames.contains(name)) {
                            db.createObjectStore(name, options);
                        }
                    };

                    createStore('books');
                    createStore('documents');
                    createStore('instructions');
                    createStore('styles');
                    createStore('snapshots');
                    createStore('macros');
                    createStore('series');
                    
                    if (!db.objectStoreNames.contains('readingProgress')) {
                        db.createObjectStore('readingProgress', { keyPath: 'bookId' });
                    }

                    createStore('settings');
                    createStore('history');
                    
                    if (!db.objectStoreNames.contains('audioCache')) {
                        db.createObjectStore('audioCache');
                    }
                };

                request.onsuccess = (event) => {
                    this.db = (event.target as IDBOpenDBRequest).result;
                    
                    // Initialize real stores
                    this.books = new ObjectStore<Book>(this.db, 'books');
                    this.documents = new ObjectStore<GeneralDoc>(this.db, 'documents');
                    this.instructions = new ObjectStore<InstructionTemplate>(this.db, 'instructions');
                    this.styles = new ObjectStore<StylePreset>(this.db, 'styles');
                    this.snapshots = new SnapshotStore(this.db, 'snapshots');
                    this.macros = new ObjectStore<Macro>(this.db, 'macros');
                    this.series = new ObjectStore<Series>(this.db, 'series');
                    this.readingProgress = new ObjectStore<ReadingProgress>(this.db, 'readingProgress');
                    this.settings = new ObjectStore<{ id: string; value: any }>(this.db, 'settings');
                    this.history = new ObjectStore<{ id: string; value: any }>(this.db, 'history');
                    
                    this.audioCache = {
                        get: (key: string) => new Promise((res, rej) => {
                            if (!this.db) return res(undefined);
                            const req = this.db.transaction('audioCache', 'readonly').objectStore('audioCache').get(key);
                            req.onsuccess = () => res(req.result);
                            req.onerror = () => rej(req.error);
                        }),
                        put: (key: string, data: ArrayBuffer) => new Promise((res, rej) => {
                            if (!this.db) return rej("DB not initialized");
                            const req = this.db.transaction('audioCache', 'readwrite').objectStore('audioCache').put(data, key);
                            req.onsuccess = () => res();
                            req.onerror = () => rej(req.error);
                        })
                    };

                    resolve();
                };
            } catch (e) {
                console.warn("Exception opening IndexedDB. Using In-Memory Fallback.", e);
                this.useInMemory();
                resolve();
            }
        });
        
        return this.initPromise;
    }

    private useInMemory() {
        console.log("%c AI Book Studio: Using LocalStorage/Memory Fallback ", "background: #f59e0b; color: white; padding: 4px; border-radius: 4px;");
        this.books = new InMemoryStore<Book>('books');
        this.documents = new InMemoryStore<GeneralDoc>('documents');
        this.instructions = new InMemoryStore<InstructionTemplate>('instructions');
        this.styles = new InMemoryStore<StylePreset>('styles');
        this.snapshots = new InMemorySnapshotStore('snapshots');
        this.macros = new InMemoryStore<Macro>('macros');
        this.series = new InMemoryStore<Series>('series');
        this.readingProgress = new InMemoryStore<ReadingProgress>('readingProgress', 'bookId');
        this.settings = new InMemoryStore<{ id: string; value: any }>('settings');
        this.history = new InMemoryStore<{ id: string; value: any }>('history');
        
        const ramAudio = new Map<string, ArrayBuffer>();
        this.audioCache = {
            get: async (key) => ramAudio.get(key),
            put: async (key, data) => { ramAudio.set(key, data); }
        };
    }
    
    public async deleteDatabase(): Promise<void> {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
        return new Promise((resolve, reject) => {
            const request = indexedDB.deleteDatabase(DB_NAME);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
            request.onblocked = () => console.warn("Delete blocked");
        });
    }

    public async backup(options?: { excludeImages?: boolean }): Promise<string> {
        await this.init();
        const readerSettings = await this.settings.get('readerSettings');
        let books = await this.books.getAll();
        
        if (options?.excludeImages) {
            books = books.map(b => ({
                ...b,
                coverImage: undefined,
                content: b.content.map(c => ({
                    ...c,
                    htmlContent: c.htmlContent.replace(/src="data:image\/[^;]+;base64,[^"]+"/g, 'src="" data-stripped="true"')
                }))
            }));
        }
    
        const data = {
            books,
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
        await this.init();
        const data = JSON.parse(jsonString);
        
        const restoreStore = async (store: Store<any>, items: any[]) => {
            if (!items) return;
            await store.clear();
            for (const item of items) {
                await store.put(item);
            }
        };

        await restoreStore(this.books, data.books);
        await restoreStore(this.documents, data.documents);
        await restoreStore(this.instructions, data.instructions);
        await restoreStore(this.styles, data.styles);
        await restoreStore(this.snapshots, data.snapshots);
        await restoreStore(this.macros, data.macros);
        await restoreStore(this.series, data.series);
        await restoreStore(this.readingProgress, data.readingProgress);
        
        if (data.readerSettings) {
            await this.settings.put({ id: 'readerSettings', value: data.readerSettings });
        }
    }

    public async merge(jsonString: string, options: { selectedNewBooks: string[], overwriteExisting: boolean }): Promise<void> {
        await this.init();
        const data = JSON.parse(jsonString);
        const { selectedNewBooks, overwriteExisting } = options;

        if (data.books) {
            for (const book of data.books) {
                if (selectedNewBooks.includes(book.id) || overwriteExisting) {
                    await this.books.put(book);
                }
            }
        }
        
        const mergeStore = async (store: Store<any>, items: any[]) => {
            if (!items) return;
            for (const item of items) {
                const existing = await store.get(item.id);
                if (!existing || overwriteExisting) {
                    await store.put(item);
                }
            }
        };

        await mergeStore(this.documents, data.documents);
        await mergeStore(this.instructions, data.instructions);
        await mergeStore(this.styles, data.styles);
        await mergeStore(this.macros, data.macros);
        await mergeStore(this.series, data.series);
        
        if (data.readingProgress) {
             for (const prog of data.readingProgress) {
                 if (selectedNewBooks.includes(prog.bookId) || overwriteExisting) {
                     await this.readingProgress.put(prog);
                 }
             }
        }
    }

    public async smartMerge(remoteJsonString: string): Promise<void> {
        await this.init();
        const remoteData = JSON.parse(remoteJsonString);
        
        const smartMergeStore = async (store: Store<any>, remoteItems: any[]) => {
            if (!remoteItems) return;
            for (const remoteItem of remoteItems) {
                const localItem = await store.get(remoteItem.id || remoteItem.bookId);
                if (!localItem) {
                    await store.put(remoteItem);
                } else if (remoteItem.updatedAt && localItem.updatedAt) {
                    if (remoteItem.updatedAt > localItem.updatedAt) {
                        await store.put(remoteItem);
                    }
                } else {
                    await store.put(remoteItem);
                }
            }
        };

        await smartMergeStore(this.books, remoteData.books);
        await smartMergeStore(this.documents, remoteData.documents);
        await smartMergeStore(this.instructions, remoteData.instructions);
        await smartMergeStore(this.styles, remoteData.styles);
        await smartMergeStore(this.macros, remoteData.macros);
        await smartMergeStore(this.series, remoteData.series);
        await smartMergeStore(this.readingProgress, remoteData.readingProgress);
        
        if (remoteData.readerSettings) {
            await this.settings.put({ id: 'readerSettings', value: remoteData.readerSettings });
        }
    }

    public async getLatestUpdateTimestamp(): Promise<number> {
        await this.init();
        const books = await this.books.getAll();
        const docs = await this.documents.getAll();
        const bTime = books.length > 0 ? Math.max(...books.map(b => b.updatedAt)) : 0;
        const dTime = docs.length > 0 ? Math.max(...docs.map(d => d.updatedAt)) : 0;
        return Math.max(bTime, dTime);
    }
}

export const db = new DB();
