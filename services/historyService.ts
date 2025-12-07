
// services/historyService.ts

interface HistoryState {
  canUndo: boolean;
  canRedo: boolean;
}

type Subscriber = (state: HistoryState) => void;

class HistoryService {
  private undoStack: string[] = [];
  private redoStack: string[] = [];
  private subscribers: Set<Subscriber> = new Set();
  public isRestoring = false;

  private readonly MAX_HISTORY_SIZE = 50;
  private initPromise: Promise<void> | null = null;
  
  constructor() {
    // Constructor is now empty of DB logic to prevent circular dependency issues on module load.
  }

  // Public init method to be called from the main App component after db is initialized.
  init(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.loadStateFromDB();
    }
    return this.initPromise;
  }

  subscribe(callback: Subscriber): () => void {
    this.subscribers.add(callback);
    callback(this.getState());
    return () => {
      this.subscribers.delete(callback);
    };
  }

  private notify(save: boolean = true): void {
    this.subscribers.forEach(callback => callback(this.getState()));
    if (save) {
      this.saveStateToDB();
    }
  }

  getState(): HistoryState {
    return {
      canUndo: this.undoStack.length > 0,
      canRedo: this.redoStack.length > 0,
    };
  }
  
  private async saveStateToDB() {
    try {
      // Dynamic import to avoid circular dependency with db.ts
      const { db } = await import('./db');
      // Ensure service is initialized before saving.
      await this.init();
      await db.history.put({ id: 'undoStack', value: this.undoStack });
      await db.history.put({ id: 'redoStack', value: this.redoStack });
    } catch (e) {
      console.warn("Could not save history to IndexedDB.", e);
    }
  }

  private async loadStateFromDB() {
    try {
      // Dynamic import to avoid circular dependency with db.ts
      const { db } = await import('./db');
      const undoData = await db.history.get('undoStack');
      const redoData = await db.history.get('redoStack');
      if (undoData && Array.isArray(undoData.value)) {
        this.undoStack = undoData.value;
      }
      if (redoData && Array.isArray(redoData.value)) {
        this.redoStack = redoData.value;
      }
    } catch (e) {
      console.error("Could not load history from IndexedDB.", e);
      this.undoStack = [];
      this.redoStack = [];
    } finally {
        this.notify(false);
    }
  }
  
  async addHistoryStep(currentState: string) {
    if (this.isRestoring) return;
    await this.init();

    if (this.undoStack.length > 0 && this.undoStack[this.undoStack.length - 1] === currentState) {
        return;
    }

    this.undoStack.push(currentState);
    
    if (this.undoStack.length > this.MAX_HISTORY_SIZE) {
        this.undoStack.shift();
    }
    
    if (this.redoStack.length > 0) {
        this.redoStack = [];
    }
    this.notify();
  }
  
  async undo(currentState: string): Promise<string | undefined> {
    await this.init();
    if (this.undoStack.length === 0) return undefined;
    this.redoStack.push(currentState);
    if (this.redoStack.length > this.MAX_HISTORY_SIZE) this.redoStack.shift();
    
    const stateToRestore = this.undoStack.pop()!;
    this.notify();
    return stateToRestore;
  }
  
  async redo(currentState: string): Promise<string | undefined> {
    await this.init();
    if (this.redoStack.length === 0) return undefined;
    this.undoStack.push(currentState);
    if (this.undoStack.length > this.MAX_HISTORY_SIZE) this.undoStack.shift();

    const stateToRestore = this.redoStack.pop()!;
    this.notify();
    return stateToRestore;
  }
}

export const historyService = new HistoryService();
