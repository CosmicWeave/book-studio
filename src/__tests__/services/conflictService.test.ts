import { describe, it, expect, beforeEach, vi } from 'vitest';
import { conflictService } from '@/services/conflictService';

// Mock apiClient — conflictService imports db for restore/smartMerge
vi.mock('@/services/apiClient', () => ({
  db: {
    restore: vi.fn().mockResolvedValue(undefined),
    smartMerge: vi.fn().mockResolvedValue(undefined),
  },
}));

function resetConflictService() {
  (conflictService as any).state = {
    isConflict: false,
    localData: null,
    remoteData: null,
    remoteTimestamp: 0,
    localTimestamp: 0,
  };
  (conflictService as any).subscribers = new Set();
}

// Minimal book-shaped objects for conflict testing
function makeBook(id: string, updatedAt: number) {
  return { id, topic: id, title: id, updatedAt };
}

function makeSnapshot(books: any[], documents: any[] = []) {
  return JSON.stringify({ books, documents });
}

describe('ConflictService', () => {
  beforeEach(resetConflictService);

  describe('subscribe()', () => {
    it('immediately calls the callback with current state', () => {
      const states: any[] = [];
      conflictService.subscribe((s) => states.push(s));
      expect(states).toHaveLength(1);
      expect(states[0].isConflict).toBe(false);
    });

    it('returns an unsubscribe function', () => {
      const cb = vi.fn();
      const unsub = conflictService.subscribe(cb);
      cb.mockClear();
      unsub();
      conflictService.dismiss();
      expect(cb).not.toHaveBeenCalled();
    });
  });

  describe('triggerConflict()', () => {
    it('sets isConflict=true and stores data', () => {
      const states: any[] = [];
      conflictService.subscribe((s) => states.push(s));
      states.length = 0;

      conflictService.triggerConflict('local', 'remote', 12345);
      const last = states[states.length - 1];

      expect(last.isConflict).toBe(true);
      expect(last.localData).toBe('local');
      expect(last.remoteData).toBe('remote');
      expect(last.remoteTimestamp).toBe(12345);
      expect(last.localTimestamp).toBeGreaterThan(0);
    });

    it('notifies all subscribers', () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      conflictService.subscribe(cb1);
      conflictService.subscribe(cb2);
      cb1.mockClear();
      cb2.mockClear();

      conflictService.triggerConflict('l', 'r', 0);
      expect(cb1).toHaveBeenCalledTimes(1);
      expect(cb2).toHaveBeenCalledTimes(1);
    });
  });

  describe('dismiss()', () => {
    it('clears conflict state', () => {
      conflictService.triggerConflict('local', 'remote', 0);
      conflictService.dismiss();

      const state = (conflictService as any).state;
      expect(state.isConflict).toBe(false);
      expect(state.localData).toBeNull();
      expect(state.remoteData).toBeNull();
    });
  });

  describe('resolve()', () => {
    beforeEach(() => {
      conflictService.triggerConflict('local-data', 'remote-data', 100);
    });

    it('"use_local" dismisses without calling db.restore', async () => {
      const { db } = await import('@/services/apiClient');
      await conflictService.resolve('use_local');
      expect(db.restore).not.toHaveBeenCalled();
      expect((conflictService as any).state.isConflict).toBe(false);
    });

    it('"use_remote" calls db.restore with remote data', async () => {
      const { db } = await import('@/services/apiClient');
      await conflictService.resolve('use_remote');
      expect(db.restore).toHaveBeenCalledWith('remote-data');
      expect((conflictService as any).state.isConflict).toBe(false);
    });

    it('"smart_merge" calls db.smartMerge with remote data', async () => {
      const { db } = await import('@/services/apiClient');
      await conflictService.resolve('smart_merge');
      expect(db.smartMerge).toHaveBeenCalledWith('remote-data');
      expect((conflictService as any).state.isConflict).toBe(false);
    });

    it('always dismisses even if resolution throws', async () => {
      const { db } = await import('@/services/apiClient');
      (db.restore as any).mockRejectedValueOnce(new Error('DB error'));
      await expect(conflictService.resolve('use_remote')).rejects.toThrow('DB error');
      // The finally block still dismisses
      expect((conflictService as any).state.isConflict).toBe(false);
    });
  });

  describe('findConflictingItems()', () => {
    const lastSync = 1000;

    it('returns empty array when no conflicts', () => {
      const local = makeSnapshot([makeBook('a', 500)]);
      const remote = makeSnapshot([makeBook('a', 500)]);
      expect(conflictService.findConflictingItems(local, remote, lastSync)).toEqual([]);
    });

    it('detects book modified on both sides since last sync', () => {
      const local = makeSnapshot([makeBook('a', 2000)]);
      const remote = makeSnapshot([makeBook('a', 5000)]);
      const conflicts = conflictService.findConflictingItems(local, remote, lastSync);
      expect(conflicts).toContain('a');
    });

    it('does not flag items modified only on one side', () => {
      const local = makeSnapshot([makeBook('a', 500)]);
      const remote = makeSnapshot([makeBook('a', 2000)]);
      const conflicts = conflictService.findConflictingItems(local, remote, lastSync);
      expect(conflicts).toHaveLength(0);
    });

    it('handles invalid JSON gracefully', () => {
      const conflicts = conflictService.findConflictingItems('not-json', '{}', lastSync);
      expect(conflicts).toContain('Unknown Data Error');
    });
  });

  describe('getDiffSummary()', () => {
    it('returns null when no conflict data is set', () => {
      expect(conflictService.getDiffSummary()).toBeNull();
    });

    it('computes book counts correctly', () => {
      const localBooks = [makeBook('a', 1), makeBook('b', 1)];
      const remoteBooks = [makeBook('a', 1), makeBook('c', 1)];
      conflictService.triggerConflict(
        makeSnapshot(localBooks),
        makeSnapshot(remoteBooks),
        0
      );

      const diff = conflictService.getDiffSummary();
      expect(diff).not.toBeNull();
      expect(diff!.localCount).toBe(2);
      expect(diff!.remoteCount).toBe(2);
      expect(diff!.booksOnlyInLocal.map((b: any) => b.id)).toContain('b');
      expect(diff!.booksOnlyInRemote.map((b: any) => b.id)).toContain('c');
    });

    it('identifies books newer in local vs remote', () => {
      const localBooks = [makeBook('a', 500)];
      const remoteBooks = [{ ...makeBook('a', 100) }];
      conflictService.triggerConflict(makeSnapshot(localBooks), makeSnapshot(remoteBooks), 0);

      const diff = conflictService.getDiffSummary();
      expect(diff!.newerInLocal.map((b: any) => b.id)).toContain('a');
    });

    it('identifies books newer in remote vs local', () => {
      const localBooks = [makeBook('a', 100)];
      const remoteBooks = [{ ...makeBook('a', 500) }];
      conflictService.triggerConflict(makeSnapshot(localBooks), makeSnapshot(remoteBooks), 0);

      const diff = conflictService.getDiffSummary();
      expect(diff!.newerInRemote.map((b: any) => b.id)).toContain('a');
    });
  });
});
