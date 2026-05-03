import { describe, it, expect, beforeEach, vi } from 'vitest';
import { historyService } from '@/services/historyService';

// Mock the dynamic import of apiClient inside historyService
vi.mock('@/services/apiClient', () => ({
  db: {
    history: {
      get: vi.fn().mockResolvedValue(null),
      put: vi.fn().mockResolvedValue(undefined),
    },
  },
}));

function resetHistoryService() {
  (historyService as any).undoStack = [];
  (historyService as any).redoStack = [];
  (historyService as any).initPromise = null;
  (historyService as any).isRestoring = false;
  (historyService as any).subscribers = new Set();
}

describe('HistoryService', () => {
  beforeEach(resetHistoryService);

  describe('getState()', () => {
    it('returns canUndo=false and canRedo=false initially', () => {
      const state = historyService.getState();
      expect(state.canUndo).toBe(false);
      expect(state.canRedo).toBe(false);
    });

    it('returns canUndo=true after a step is added', async () => {
      await historyService.addHistoryStep('step1');
      expect(historyService.getState().canUndo).toBe(true);
    });
  });

  describe('subscribe()', () => {
    it('immediately calls callback with current state', () => {
      const states: any[] = [];
      historyService.subscribe((s) => states.push(s));
      expect(states).toHaveLength(1);
      expect(states[0]).toEqual({ canUndo: false, canRedo: false });
    });

    it('returns an unsubscribe function', async () => {
      const cb = vi.fn();
      const unsub = historyService.subscribe(cb);
      cb.mockClear();
      unsub();
      await historyService.addHistoryStep('x');
      expect(cb).not.toHaveBeenCalled();
    });
  });

  describe('addHistoryStep()', () => {
    it('adds a step to the undo stack', async () => {
      await historyService.addHistoryStep('state-a');
      expect((historyService as any).undoStack).toEqual(['state-a']);
    });

    it('ignores duplicate consecutive steps', async () => {
      await historyService.addHistoryStep('state-a');
      await historyService.addHistoryStep('state-a');
      expect((historyService as any).undoStack).toHaveLength(1);
    });

    it('clears the redo stack when a new step is added', async () => {
      await historyService.addHistoryStep('state-a');
      await historyService.undo('state-b');
      // Now redoStack should have something
      expect((historyService as any).redoStack).toHaveLength(1);

      await historyService.addHistoryStep('state-c');
      expect((historyService as any).redoStack).toHaveLength(0);
    });

    it('trims undo stack to MAX_HISTORY_SIZE (50)', async () => {
      for (let i = 0; i < 55; i++) {
        await historyService.addHistoryStep(`state-${i}`);
      }
      expect((historyService as any).undoStack).toHaveLength(50);
    });

    it('is a no-op when isRestoring is true', async () => {
      historyService.isRestoring = true;
      await historyService.addHistoryStep('should-be-ignored');
      expect((historyService as any).undoStack).toHaveLength(0);
      historyService.isRestoring = false;
    });
  });

  describe('undo()', () => {
    it('returns undefined when undo stack is empty', async () => {
      const result = await historyService.undo('current');
      expect(result).toBeUndefined();
    });

    it('pops from undo stack and returns the state', async () => {
      await historyService.addHistoryStep('step-1');
      const result = await historyService.undo('current');
      expect(result).toBe('step-1');
      expect((historyService as any).undoStack).toHaveLength(0);
    });

    it('pushes current state onto redo stack when undoing', async () => {
      await historyService.addHistoryStep('step-1');
      await historyService.undo('current-state');
      expect((historyService as any).redoStack).toEqual(['current-state']);
    });

    it('sets canRedo=true after an undo', async () => {
      await historyService.addHistoryStep('step-1');
      await historyService.undo('cur');
      expect(historyService.getState().canRedo).toBe(true);
    });
  });

  describe('redo()', () => {
    it('returns undefined when redo stack is empty', async () => {
      const result = await historyService.redo('current');
      expect(result).toBeUndefined();
    });

    it('pops from redo stack and returns the state', async () => {
      await historyService.addHistoryStep('step-1');
      await historyService.undo('current');
      const result = await historyService.redo('step-0');
      expect(result).toBe('current');
    });

    it('pushes current state onto undo stack when redoing', async () => {
      await historyService.addHistoryStep('step-1');
      await historyService.undo('current');
      (historyService as any).undoStack = []; // clear for clean assertion
      await historyService.redo('step-0');
      expect((historyService as any).undoStack).toEqual(['step-0']);
    });
  });
});
