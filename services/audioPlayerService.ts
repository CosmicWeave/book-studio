
import { Book, AudiobookState } from '../types';
import * as gemini from './gemini';
import { db } from './db';
import { toastService } from './toastService';

// --- Audio Helper Functions ---
function decode(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

async function decodeAudioData(
    data: Uint8Array,
    ctx: AudioContext,
    sampleRate: number,
    numChannels: number,
): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        for (let i = 0; i < frameCount; i++) {
            channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
        }
    }
    return buffer;
}


type AudioQueueItem = {
    text: string;
    chapterIndex: number;
    paragraphIndex: number;
    bookId: string;
    key: string; // Unique key for caching: "bookId-chapter-paragraph"
};

export class AudioPlayerService {
    private onStateChange: (state: AudiobookState) => void;
    private _state: AudiobookState;
    
    private _audioContext: AudioContext | null = null;
    private _gainNode: GainNode | null = null;
    private _volume = 1;
    private _currentSource: AudioBufferSourceNode | null = null;
    private _audioQueue: AudioQueueItem[] = [];
    private _audioBufferQueue = new Map<string, AudioBuffer>();
    private _currentQueueIndex = 0;
    private _isStopping = false;
    private _isBuffering = false;
    private _book: Book | null = null;
    
    private readonly BUFFER_LOOKAHEAD = 5;

    constructor(onStateChange: (state: AudiobookState) => void) {
        this.onStateChange = onStateChange;
        this._state = {
            playbackState: 'stopped',
            bookId: null,
            bookTitle: null,
            currentChapterIndex: -1,
            currentChapterTitle: null,
            currentParagraphIndex: -1,
            chapterProgress: 0,
            playbackRate: 1,
            totalParagraphsInChapter: 0,
        };
    }

    private _setState(newState: Partial<AudiobookState>) {
        this._state = { ...this._state, ...newState };
        this.onStateChange(this._state);
    }
    
    // --- Public API ---
    public async play(book: Book, startChapterIndex: number) {
        if (this._state.playbackState !== 'stopped') {
            await this.stop();
        }
        this._isStopping = false;
        this._book = book;
        this._setState({ playbackState: 'loading', bookId: book.id, bookTitle: book.topic });

        this._audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        
        // Initialize volume
        this._gainNode = this._audioContext.createGain();
        this._gainNode.gain.value = this._volume;
        this._gainNode.connect(this._audioContext.destination);

        this._buildQueue(book, startChapterIndex);
        this._currentQueueIndex = 0;
        this._audioBufferQueue.clear();

        if (this._audioQueue.length === 0) {
            toastService.info("No text content found to play.");
            this.stop();
            return;
        }

        this._playNext();
        this._fillBuffer(); // Fire-and-forget background buffering
    }
    
    public stop() {
        this._isStopping = true;
        if (this._currentSource) {
            this._currentSource.onended = null;
            try { this._currentSource.stop(); } catch (e) {}
            this._currentSource = null;
        }
        if (this._audioContext) {
            this._audioContext.close();
            this._audioContext = null;
            this._gainNode = null;
        }
        this._audioQueue = [];
        this._audioBufferQueue.clear();
        this._book = null;
        this._isBuffering = false;
        this._setState({
            playbackState: 'stopped', bookId: null, bookTitle: null,
            currentChapterIndex: -1, currentChapterTitle: null,
            currentParagraphIndex: -1, chapterProgress: 0,
            totalParagraphsInChapter: 0
        });
    }
    
    public pause() {
        if (this._audioContext && this._state.playbackState === 'playing') {
            this._audioContext.suspend();
            this._setState({ playbackState: 'paused' });
        }
    }
    
    public resume() {
        if (this._audioContext && this._state.playbackState === 'paused') {
            this._audioContext.resume();
            this._setState({ playbackState: 'playing' });
        }
    }

    public setPlaybackRate(rate: number) {
        this._setState({ playbackRate: rate });
        if (this._currentSource) {
            this._currentSource.playbackRate.value = rate;
        }
    }
    
    public setVolume(volume: number) {
        this._volume = Math.max(0, Math.min(1, volume));
        if (this._gainNode) {
            this._gainNode.gain.value = this._volume;
        }
    }

    public skipChapter(direction: 'next' | 'prev') {
        if (this._isStopping || this._audioQueue.length === 0) return;

        const currentChapter = this._audioQueue[this._currentQueueIndex]?.chapterIndex;
        if (currentChapter === undefined) return;

        const targetChapterIndex = direction === 'next' ? currentChapter + 1 : currentChapter - 1;
        const nextUtteranceIndex = this._audioQueue.findIndex(item => item.chapterIndex === targetChapterIndex);

        if (nextUtteranceIndex !== -1) {
            if (this._currentSource) {
                this._currentSource.onended = null;
                this._currentSource.stop();
            }
            this._currentQueueIndex = nextUtteranceIndex;
            this._playNext();
        } else if (direction === 'next') {
            this.stop();
        }
    }

    public skipParagraph(direction: 'next' | 'prev') {
        if (this._isStopping) return;
        const newIndex = this._currentQueueIndex + (direction === 'next' ? 1 : -1);
        if (newIndex >= 0 && newIndex < this._audioQueue.length) {
            if (this._currentSource) {
                this._currentSource.onended = null;
                this._currentSource.stop();
            }
            this._currentQueueIndex = newIndex;
            this._playNext();
        } else if (direction === 'next') {
            this.stop();
        }
    }

    public jumpToParagraph(paragraphIndex: number) {
        const { currentChapterIndex } = this._state;
        if (this._isStopping || currentChapterIndex === -1) return;

        const firstParagraphOfChapterIndex = this._audioQueue.findIndex(p => p.chapterIndex === currentChapterIndex);
        if (firstParagraphOfChapterIndex === -1) return;
        
        const newGlobalIndex = firstParagraphOfChapterIndex + paragraphIndex;

        if (newGlobalIndex >= 0 && newGlobalIndex < this._audioQueue.length) {
            if (this._currentSource) {
                this._currentSource.onended = null;
                this._currentSource.stop();
            }
            this._currentQueueIndex = newGlobalIndex;
            this._playNext();
        }
    }

    // --- Private Methods ---
    private _buildQueue(book: Book, startChapterIndex: number) {
        const newQueue: AudioQueueItem[] = [];
        book.content.slice(startChapterIndex).forEach((chapter, i) => {
            const chapterIndex = startChapterIndex + i;
            if (!chapter) return;
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = chapter.htmlContent;
            let paragraphIndex = 0;
            tempDiv.querySelectorAll('p, h1, h2, h3, h4, li').forEach(el => {
                const text = (el as HTMLElement).textContent || '';
                if (text.trim().length > 10) { // Simple filter for meaningful text
                    const key = `${book.id}-${chapterIndex}-${paragraphIndex}`;
                    newQueue.push({ text: text.trim(), chapterIndex, paragraphIndex, bookId: book.id, key });
                    paragraphIndex++;
                }
            });
        });
        this._audioQueue = newQueue;
    }

    private async _fillBuffer() {
        if (this._isBuffering) return;
        this._isBuffering = true;
        
        while (!this._isStopping && this._currentQueueIndex < this._audioQueue.length) {
            const lookaheadIndex = this._currentQueueIndex + this.BUFFER_LOOKAHEAD;
            const itemsToBuffer = this._audioQueue.slice(this._currentQueueIndex, lookaheadIndex);
            
            const promises = itemsToBuffer
                .filter(item => item && !this._audioBufferQueue.has(item.key))
                .map(item => this._fetchAndCacheAudio(item));

            if (promises.length > 0) {
                await Promise.allSettled(promises);
            }
            
            const currentItem = this._audioQueue[this._currentQueueIndex];
            if (this._state.playbackState === 'buffering' && currentItem && this._audioBufferQueue.has(currentItem.key)) {
                this._playNext(); // Resume playback if we were waiting for the current item
            }
            
            await new Promise(resolve => setTimeout(resolve, 200)); // Short delay between buffer checks
        }
        this._isBuffering = false;
    }

    private async _fetchAudioWithRetries(text: string): Promise<string> {
        const MAX_RETRIES = 3;
        let attempt = 0;
    
        while (attempt < MAX_RETRIES) {
            try {
                // This is the network call
                return await gemini.generateSpeech(text, 'Kore');
            } catch (error) {
                attempt++;
                if (attempt >= MAX_RETRIES) {
                    // Rethrow the final error to be caught by the caller
                    throw error;
                }
                // Exponential backoff with jitter
                const delay = Math.pow(2, attempt - 1) * 1000 + Math.random() * 250;
                console.warn(`Audio generation failed (attempt ${attempt}/${MAX_RETRIES}). Retrying in ${Math.round(delay)}ms...`, error);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        // This should not be reachable due to the throw inside the loop, but it satisfies TypeScript.
        throw new Error('Audio generation failed after multiple retries.');
    }

    private _gracefulFallback(error: any) {
        console.error(`Audio generation failed permanently after retries. Pausing playback.`, error);
        
        // 1. Announce the problem using the browser's built-in speech synthesis
        try {
            const utterance = new SpeechSynthesisUtterance("Sorry, I'm having trouble loading the next section. Playback has been paused.");
            window.speechSynthesis.speak(utterance);
        } catch (synthError) {
            console.warn("SpeechSynthesis fallback failed.", synthError);
        }
    
        // 2. Automatically pause playback. This will also update the UI state.
        this.pause();
    }

    private async _fetchAndCacheAudio(item: AudioQueueItem) {
        if (!this._audioContext || this._isStopping) return;
        
        try {
            const cachedData = await db.audioCache.get(item.key);
    
            let pcmData: Uint8Array;
            if (cachedData) {
                pcmData = new Uint8Array(cachedData);
            } else {
                try {
                    const base64Audio = await this._fetchAudioWithRetries(item.text);
                    pcmData = decode(base64Audio);
                    // Don't await this, let it save in the background
                    db.audioCache.put(item.key, pcmData.buffer).catch(e => console.warn("Failed to cache audio", e));
                } catch (error) {
                    // After all retries have failed, trigger the graceful fallback.
                    this._gracefulFallback(error);
                    // Re-throw to stop processing this specific item.
                    throw error;
                }
            }
    
            // Ensure context is still valid after async operations
            if (this._audioContext && !this._isStopping) {
                const audioBuffer = await decodeAudioData(pcmData, this._audioContext, 24000, 1);
                if (!this._isStopping) { // Check again after decoding
                    this._audioBufferQueue.set(item.key, audioBuffer);
                }
            }
        } catch (e) {
            // This outer catch now primarily handles the re-thrown error from the retry logic,
            // signaling that this item has failed permanently. The main _fillBuffer loop will
            // naturally move to the next item, effectively skipping this failed one.
            console.error(`Skipping audio item due to processing failure: ${item.key}`, e);
        }
    }

    private async _playNext() {
        if (this._isStopping || this._currentQueueIndex >= this._audioQueue.length) {
            this.stop();
            return;
        }

        const currentItem = this._audioQueue[this._currentQueueIndex];
        const audioBuffer = this._audioBufferQueue.get(currentItem.key);

        if (!audioBuffer) {
            this._setState({ playbackState: 'buffering' });
            // _fillBuffer is responsible for fetching and then calling _playNext again.
            return;
        }
        
        const isNewChapter = this._state.currentChapterIndex !== currentItem.chapterIndex;
        const totalInChapter = isNewChapter
            ? this._audioQueue.filter(item => item.chapterIndex === currentItem.chapterIndex).length
            : this._state.totalParagraphsInChapter;

        const currentIndexInChapter = this._audioQueue.slice(0, this._currentQueueIndex + 1).filter(item => item.chapterIndex === currentItem.chapterIndex).length - 1;

        this._setState({
            playbackState: 'playing',
            currentChapterIndex: currentItem.chapterIndex,
            currentChapterTitle: this._book?.outline[currentItem.chapterIndex]?.title || null,
            currentParagraphIndex: currentItem.paragraphIndex,
            chapterProgress: totalInChapter > 0 ? ((currentIndexInChapter + 1) / totalInChapter) * 100 : 0,
            totalParagraphsInChapter: totalInChapter,
        });
        
        const source = this._audioContext!.createBufferSource();
        this._currentSource = source;
        source.buffer = audioBuffer;
        source.playbackRate.value = this._state.playbackRate;
        // Connect to gain node instead of directly to destination
        source.connect(this._gainNode!);
        source.start();

        source.onended = () => {
            if (!this._isStopping) {
                this._currentQueueIndex++;
                this._audioBufferQueue.delete(currentItem.key); // Clean up played buffer
                this._playNext();
            }
        };
    }
}
