/**
 * apiClient.ts
 *
 * Drop-in replacement for services/db.ts.
 *
 * Exposes the same `db` singleton shape that the rest of the app uses, but
 * stores data on the backend server instead of IndexedDB.
 *
 * Call sites need only change their import:
 *   import { db } from './db'  →  import { db } from './apiClient'
 */

import { logError } from './errorLogger';

const API_BASE = '/api';

// ─── Change notifications ────────────────────────────────────────────────────

// 'dbdatachange' fires in the current tab after every successful write so that
// UI widgets (storage stats, etc.) can refresh without a full reload.
// 'dbversionchange' via BroadcastChannel fires in OTHER tabs so they can react
// to remote changes — this is what the "another tab" toast is wired to.

const _bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('book_studio_db') : null;

if (_bc) {
  _bc.onmessage = () => {
    window.dispatchEvent(new Event('dbversionchange'));
  };
}

function dispatchChange() {
  // Notify the current tab's UI widgets
  window.dispatchEvent(new Event('dbdatachange'));
  // Notify other open tabs
  try { _bc?.postMessage('change'); } catch { /* ignore */ }
}

// ─── Offline write queue ──────────────────────────────────────────────────────

const QUEUE_KEY = 'api_write_queue_v1';
const MAX_QUEUE_BYTES = 4 * 1024 * 1024; // 4 MB safety limit

interface QueuedWrite {
  path: string;
  method: 'PUT' | 'DELETE';
  body?: string;
  enqueuedAt: number;
}

let _memQueue: QueuedWrite[] = [];

function _loadQueue(): QueuedWrite[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    _memQueue = JSON.parse(raw) as QueuedWrite[];
    return _memQueue;
  } catch {
    return _memQueue;
  }
}

function _saveQueue(q: QueuedWrite[]): void {
  _memQueue = q;
  try {
    const s = JSON.stringify(q);
    localStorage.setItem(QUEUE_KEY, s.length <= MAX_QUEUE_BYTES ? s : JSON.stringify(q.slice(-20)));
  } catch {
    // localStorage unavailable (e.g. private mode) — in-memory only
  }
  window.dispatchEvent(new CustomEvent('writequeuechange', { detail: { count: q.length } }));
}

function _enqueueWrite(path: string, method: 'PUT' | 'DELETE', body?: string): void {
  // Deduplicate by path: most-recent intent wins
  const q = _loadQueue().filter(op => op.path !== path);
  q.push({ path, method, body: method === 'PUT' ? body : undefined, enqueuedAt: Date.now() });
  _saveQueue(q);
}

/** Returns the number of writes currently queued for replay. */
export function getPendingWriteCount(): number {
  return _loadQueue().length;
}

/** Replays all queued writes. Call when the connection is restored. */
export async function flushWriteQueue(): Promise<void> {
  const q = _loadQueue();
  if (q.length === 0) return;
  const failed: QueuedWrite[] = [];
  let anySucceeded = false;
  for (const op of q) {
    try {
      await fetch(`${API_BASE}${op.path}`, {
        method: op.method,
        headers: { 'Content-Type': 'application/json' },
        body: op.body,
      }).then(res => {
        if (!res.ok) throw new Error(`${res.status}`);
      });
      anySucceeded = true;
    } catch {
      failed.push(op);
    }
  }
  _saveQueue(failed);
  // Notify once after the entire flush — not once per write — to avoid
  // triggering a cascade of cross-tab toasts for each replayed operation.
  if (anySucceeded) {
    window.dispatchEvent(new Event('dbdatachange'));
    try { _bc?.postMessage('change'); } catch { /* ignore */ }
  }
}

// ─── Fetch wrapper ────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T & { _status?: number }> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
  } catch {
    // Network error — server unreachable. Queue mutating ops and resolve optimistically.
    const method = (options?.method ?? 'GET').toUpperCase();
    if (method === 'PUT' || method === 'DELETE') {
      _enqueueWrite(path, method as 'PUT' | 'DELETE', options?.body as string | undefined);
      dispatchChange();
      return undefined as unknown as T;
    }
    throw new Error('Network error: server unreachable');
  }
  if (!res.ok) {
    let msg = `API error ${res.status}`;
    try {
      const body = await res.json();
      msg = body.error ?? msg;
    } catch {
      // ignore
    }
    const err = new Error(msg) as Error & { status: number };
    err.status = res.status;
    logError(err, 'api', { path, method: options?.method ?? 'GET', status: res.status });
    throw err;
  }
  // 204 No Content has no body
  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

// ─── Generic store factory ────────────────────────────────────────────────────

function makeStore<T extends object>(endpoint: string, keyField: keyof T = 'id' as keyof T) {
  return {
    async getAll(): Promise<T[]> {
      return apiFetch<T[]>(`/${endpoint}`);
    },
    async get(id: string): Promise<T | undefined> {
      try {
        return await apiFetch<T>(`/${endpoint}/${id}`);
      } catch (e) {
        if (e instanceof Error && (e as Error & { status?: number }).status === 404) return undefined;
        throw e;
      }
    },
    async put(item: T): Promise<void> {
      const id = item[keyField] as string;
      await apiFetch<T>(`/${endpoint}/${id}`, {
        method: 'PUT',
        body: JSON.stringify(item),
      });
      dispatchChange();
    },
    async delete(id: string): Promise<void> {
      await apiFetch<{ ok: boolean }>(`/${endpoint}/${id}`, { method: 'DELETE' });
      dispatchChange();
    },
    async clear(): Promise<void> {
      await apiFetch<{ ok: boolean }>(`/${endpoint}`, { method: 'DELETE' });
      dispatchChange();
    },
  };
}

// ─── Snapshot store (extra getAllForBook) ─────────────────────────────────────

function makeSnapshotStore() {
  const base = makeStore<import('../types.js').BookSnapshot>('snapshots');
  return {
    ...base,
    async getAllForBook(bookId: string) {
      return apiFetch<import('../types.js').BookSnapshot[]>(
        `/snapshots?bookId=${encodeURIComponent(bookId)}`,
      );
    },
  };
}

// ─── Audio cache stub ─────────────────────────────────────────────────────────
// Audio is now generated on-demand via /api/ai/tts and served as file URLs.
// The local cache is no longer needed; these stubs keep the call sites happy.

const audioCacheStub = {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  get: async (_key: string): Promise<ArrayBuffer | undefined> => undefined,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  put: async (_key: string, _data: ArrayBuffer): Promise<void> => undefined,
};

// ─── DB singleton ─────────────────────────────────────────────────────────────

class ApiDB {
  public books = makeStore<import('../types.js').Book>('books');
  public documents = makeStore<import('../types.js').GeneralDoc>('documents');
  public instructions = makeStore<import('../types.js').InstructionTemplate>('instructions');
  public styles = makeStore<import('../types.js').StylePreset>('styles');
  public snapshots = makeSnapshotStore();
  public macros = makeStore<import('../types.js').Macro>('macros');
  public series = makeStore<import('../types.js').Series>('series');
  public readingProgress = makeStore<import('../types.js').ReadingProgress>(
    'reading-progress',
    'bookId',
  );
  public settings = makeStore<{ id: string; value: unknown }>('settings');
  public history = makeStore<{ id: string; value: unknown }>('history');
  public audioCache = audioCacheStub;

  /** No-op – server is always ready. Kept for API compatibility. */
  async init(): Promise<void> {
    return Promise.resolve();
  }

  /** Not applicable in server mode. */
  async deleteDatabase(): Promise<void> {
    console.warn('deleteDatabase() is not supported in server mode.');
  }

  async getLatestUpdateTimestamp(): Promise<number> {
    const [books, docs] = await Promise.all([
      this.books.getAll(),
      this.documents.getAll(),
    ]);
    const bTime = books.length > 0 ? Math.max(...(books as any[]).map((b: any) => b.updatedAt ?? 0)) : 0;
    const dTime = docs.length > 0 ? Math.max(...(docs as any[]).map((d: any) => d.updatedAt ?? 0)) : 0;
    return Math.max(bTime, dTime);
  }

  async backup(options?: { excludeImages?: boolean }): Promise<string> {
    const [books, docs, instructions, styles, snapshots, macros, series, readingProgress, readerSetting] =
      await Promise.all([
        this.books.getAll(),
        this.documents.getAll(),
        this.instructions.getAll(),
        this.styles.getAll(),
        this.snapshots.getAll(),
        this.macros.getAll(),
        this.series.getAll(),
        this.readingProgress.getAll(),
        this.settings.get('readerSettings'),
      ]);

    let booksOut: typeof books = books;
    if (options?.excludeImages) {
      booksOut = (books as any[]).map((b: any) => ({
        ...b,
        coverImage: undefined,
        content: (b.content ?? []).map((c: any) => ({
          ...c,
          htmlContent: (c.htmlContent ?? '').replace(/src="data:image\/[^;]+;base64,[^"]+"/g, 'src="" data-stripped="true"'),
        })),
      })) as typeof books;
    }

    return JSON.stringify({
      books: booksOut,
      documents: docs,
      instructions,
      styles,
      snapshots,
      macros,
      series,
      readerSettings: (readerSetting as any)?.value ?? null,
      readingProgress,
    }, null, 2);
  }

  async restore(jsonString: string, onProgress?: (stage: string, pct: number) => void): Promise<void> {
    const data = JSON.parse(jsonString);

    const stores: Array<{ label: string; store: ReturnType<typeof makeStore<any>>; items: any[] }> = [
      { label: 'Books', store: this.books as any, items: data.books ?? [] },
      { label: 'Documents', store: this.documents as any, items: data.documents ?? [] },
      { label: 'Instructions', store: this.instructions as any, items: data.instructions ?? [] },
      { label: 'Styles', store: this.styles as any, items: data.styles ?? [] },
      { label: 'Snapshots', store: this.snapshots as any, items: data.snapshots ?? [] },
      { label: 'Macros', store: this.macros as any, items: data.macros ?? [] },
      { label: 'Series', store: this.series as any, items: data.series ?? [] },
      { label: 'Reading progress', store: this.readingProgress as any, items: data.readingProgress ?? [] },
    ];

    const total = stores.length + (data.readerSettings ? 1 : 0);
    for (let i = 0; i < stores.length; i++) {
      const { label, store, items } = stores[i];
      onProgress?.(label, Math.round((i / total) * 100));
      await store.clear();
      for (const item of items) await store.put(item);
    }

    if (data.readerSettings) {
      onProgress?.('Settings', Math.round((stores.length / total) * 100));
      await this.settings.put({ id: 'readerSettings', value: data.readerSettings });
    }

    onProgress?.('Done', 100);
  }

  async merge(jsonString: string, options: { selectedNewBooks: string[]; overwriteExisting: boolean }): Promise<void> {
    const data = JSON.parse(jsonString);
    const { selectedNewBooks, overwriteExisting } = options;

    if (data.books) {
      for (const book of data.books) {
        if (selectedNewBooks.includes(book.id) || overwriteExisting) {
          await this.books.put(book);
        }
      }
    }

    const mergeStore = async (store: ReturnType<typeof makeStore<any>>, items: any[]) => {
      if (!items) return;
      for (const item of items) {
        const existing = await store.get(item.id);
        if (!existing || overwriteExisting) await store.put(item);
      }
    };

    await mergeStore(this.documents as any, data.documents);
    await mergeStore(this.instructions as any, data.instructions);
    await mergeStore(this.styles as any, data.styles);
    await mergeStore(this.macros as any, data.macros);
    await mergeStore(this.series as any, data.series);

    if (data.readingProgress) {
      for (const prog of data.readingProgress) {
        if (selectedNewBooks.includes(prog.bookId) || overwriteExisting) {
          await this.readingProgress.put(prog);
        }
      }
    }
  }

  async smartMerge(remoteJsonString: string): Promise<void> {
    const remoteData = JSON.parse(remoteJsonString);

    const smartMergeStore = async (store: ReturnType<typeof makeStore<any>>, remoteItems: any[]) => {
      if (!remoteItems) return;
      for (const remoteItem of remoteItems) {
        const localItem = await store.get(remoteItem.id || remoteItem.bookId);
        if (!localItem) {
          await store.put(remoteItem);
        } else if (remoteItem.updatedAt && localItem.updatedAt) {
          if (remoteItem.updatedAt > (localItem as any).updatedAt) await store.put(remoteItem);
        } else {
          await store.put(remoteItem);
        }
      }
    };

    await smartMergeStore(this.books as any, remoteData.books);
    await smartMergeStore(this.documents as any, remoteData.documents);
    await smartMergeStore(this.instructions as any, remoteData.instructions);
    await smartMergeStore(this.styles as any, remoteData.styles);
    await smartMergeStore(this.macros as any, remoteData.macros);
    await smartMergeStore(this.series as any, remoteData.series);
    await smartMergeStore(this.readingProgress as any, remoteData.readingProgress);
  }
}

export const db = new ApiDB();
