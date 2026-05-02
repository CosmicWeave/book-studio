/**
 * migrationHelper.ts
 *
 * Reads all data from the browser's IndexedDB and sends it to the server
 * via POST /api/migrate.
 *
 * Import and call `exportIndexedDBToServer()` from the Settings page.
 */

const DB_NAME = 'ai-book-studio-db';
const DB_VERSION = 4;

const STORES = [
  'books',
  'documents',
  'instructions',
  'styles',
  'snapshots',
  'macros',
  'series',
  'readingProgress',
  'settings',
  'history',
] as const;

type StoreName = typeof STORES[number];

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onupgradeneeded = () => {
      // We're only reading – don't upgrade, just open
    };
  });
}

function getAllFromStore<T>(db: IDBDatabase, storeName: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains(storeName)) {
      resolve([]);
      return;
    }
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

export interface MigrationResult {
  ok: boolean;
  results?: Record<string, { imported: number; errors: number }>;
  error?: string;
}

export async function exportIndexedDBToServer(
  onProgress?: (message: string) => void,
): Promise<MigrationResult> {
  onProgress?.('Opening IndexedDB…');

  let db: IDBDatabase;
  try {
    db = await openDB();
  } catch {
    return { ok: false, error: 'Could not open IndexedDB. It may not exist yet.' };
  }

  const payload: Record<string, unknown[]> = {};
  let totalRecords = 0;

  for (const storeName of STORES) {
    onProgress?.(`Reading ${storeName}…`);
    // Map the IndexedDB store name to the payload key the server expects
    const key = storeName === 'readingProgress' ? 'readingProgress' : storeName;
    const records = await getAllFromStore(db, storeName);
    payload[key] = records;
    totalRecords += records.length;
  }

  db.close();
  onProgress?.(`Sending ${totalRecords} records to server…`);

  try {
    const res = await fetch('/api/migrate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error ?? `Server error ${res.status}` };
    onProgress?.('Migration complete.');
    return { ok: true, results: data.results };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Network error' };
  }
}
