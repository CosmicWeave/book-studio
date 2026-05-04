
import { Book, GeneralDoc } from '../types';
import { db } from './apiClient';
import { setLastBackupTimestamp, setLastBackupHash } from './backupMetadata';

export type ConflictResolutionStrategy = 'use_local' | 'use_remote' | 'smart_merge';

export interface ConflictState {
    isConflict: boolean;
    localData: string | null;
    remoteData: string | null;
    remoteTimestamp: number;
    localTimestamp: number;
}

type Subscriber = (state: ConflictState) => void;

class ConflictService {
    private state: ConflictState = {
        isConflict: false,
        localData: null,
        remoteData: null,
        remoteTimestamp: 0,
        localTimestamp: 0
    };
    private subscribers = new Set<Subscriber>();

    subscribe(callback: Subscriber): () => void {
        this.subscribers.add(callback);
        callback(this.state);
        return () => {
            this.subscribers.delete(callback);
        };
    }

    private notify() {
        this.subscribers.forEach(cb => cb(this.state));
    }

    private async computeHash(text: string): Promise<string> {
        const encoder = new TextEncoder();
        const data = encoder.encode(text);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    public triggerConflict(localData: string, remoteData: string, remoteTimestamp: number) {
        this.state = {
            isConflict: true,
            localData,
            remoteData,
            remoteTimestamp,
            localTimestamp: Date.now()
        };
        this.notify();
    }

    public dismiss() {
        this.state = {
            isConflict: false,
            localData: null,
            remoteData: null,
            remoteTimestamp: 0,
            localTimestamp: 0
        };
        this.notify();
    }

    public async resolve(strategy: ConflictResolutionStrategy): Promise<void> {
        if (!this.state.localData || !this.state.remoteData) return;

        try {
            switch (strategy) {
                case 'use_local':
                    // User intentionally keeps local content.
                    // Persist a new sync baseline to avoid recurring conflict prompts on refresh.
                    void setLastBackupTimestamp(Date.now());
                    void setLastBackupHash(await this.computeHash(this.state.localData));
                    break;
                case 'use_remote':
                    await db.restore(this.state.remoteData);
                    void setLastBackupTimestamp(this.state.remoteTimestamp);
                    void setLastBackupHash(await this.computeHash(this.state.remoteData));
                    break;
                case 'smart_merge':
                    await db.smartMerge(this.state.remoteData);
                    // Mark current moment as a conflict resolution baseline.
                    void setLastBackupTimestamp(Date.now());
                    // Force next backup to recalculate and upload merged state.
                    void setLastBackupHash(null);
                    break;
            }

            // Allow other services/UI to react to conflict resolution consistently.
            window.dispatchEvent(new CustomEvent('backup-conflict-resolved', { detail: { strategy } }));
        } finally {
            this.dismiss();
        }
    }

    public findConflictingItems(localDataStr: string, remoteDataStr: string, lastSyncTimestamp: number): string[] {
        try {
            const local = JSON.parse(localDataStr);
            const remote = JSON.parse(remoteDataStr);
            
            const conflicts: string[] = [];
            
            // Helper to check collections
            const checkCollection = (localItems: any[], remoteItems: any[], nameField: string = 'id') => {
                if (!Array.isArray(localItems) || !Array.isArray(remoteItems)) return;

                const localMap = new Map(localItems.map(i => [i.id, i]));
                const remoteMap = new Map(remoteItems.map(i => [i.id, i]));
                
                // Identify items modified on BOTH sides since the last sync
                for (const remoteItem of remoteItems) {
                    const localItem = localMap.get(remoteItem.id);
                    if (localItem) {
                        const localMod = localItem.updatedAt > lastSyncTimestamp;
                        const remoteMod = remoteItem.updatedAt > lastSyncTimestamp;
                        
                        // If both changed since last sync, and timestamps differ (meaning not same edit), it's a conflict
                        // We add a small buffer (1s) to equality check to avoid clock drift issues
                        if (localMod && remoteMod && Math.abs(localItem.updatedAt - remoteItem.updatedAt) > 1000) {
                            const label = localItem[nameField] || localItem.title || localItem.name || localItem.id;
                            conflicts.push(label);
                        }
                    }
                }
            };

            checkCollection(local.books, remote.books, 'topic');
            checkCollection(local.documents, remote.documents, 'title');
            // We can add other collections here, but books/docs are the main content risks.
            
            return conflicts;
        } catch (e) {
            console.warn("Failed to analyze conflicts", e);
            return ["Unknown Data Error"]; // Force manual resolution on error
        }
    }

    public getDiffSummary() {
        if (!this.state.localData || !this.state.remoteData) return null;

        const local = JSON.parse(this.state.localData);
        const remote = JSON.parse(this.state.remoteData);

        const localBooks = (local.books || []) as Book[];
        const remoteBooks = (remote.books || []) as Book[];

        const localDocs = (local.documents || []) as GeneralDoc[];
        const remoteDocs = (remote.documents || []) as GeneralDoc[];

        // Calculate differences
        const localBookMap = new Map(localBooks.map(b => [b.id, b]));
        const remoteBookMap = new Map(remoteBooks.map(b => [b.id, b]));

        const booksOnlyInLocal = localBooks.filter(b => !remoteBookMap.has(b.id));
        const booksOnlyInRemote = remoteBooks.filter(b => !localBookMap.has(b.id));
        
        const newerInLocal = localBooks.filter(b => {
            const rb = remoteBookMap.get(b.id);
            return rb && b.updatedAt > rb.updatedAt;
        });

        const newerInRemote = remoteBooks.filter(b => {
            const lb = localBookMap.get(b.id);
            return lb && b.updatedAt > lb.updatedAt;
        });

        return {
            localCount: localBooks.length,
            remoteCount: remoteBooks.length,
            localDocCount: localDocs.length,
            remoteDocCount: remoteDocs.length,
            booksOnlyInLocal,
            booksOnlyInRemote,
            newerInLocal,
            newerInRemote
        };
    }
}

export const conflictService = new ConflictService();
