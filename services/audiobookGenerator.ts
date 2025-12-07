
import { toastService } from './toastService';
import * as gemini from './gemini';

declare const JSZip: any;

// --- Audio Helper Functions ---
function decode(base64: string) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

function createWavBlob(pcmData: Uint8Array, sampleRate: number, numChannels: number, bitsPerSample: number): Blob {
    const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
    const blockAlign = numChannels * (bitsPerSample / 8);
    const dataSize = pcmData.length;
    const chunkSize = 36 + dataSize;
    
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    // RIFF header
    view.setUint8(0, 'R'.charCodeAt(0)); view.setUint8(1, 'I'.charCodeAt(0)); view.setUint8(2, 'F'.charCodeAt(0)); view.setUint8(3, 'F'.charCodeAt(0));
    view.setUint32(4, chunkSize, true);
    view.setUint8(8, 'W'.charCodeAt(0)); view.setUint8(9, 'A'.charCodeAt(0)); view.setUint8(10, 'V'.charCodeAt(0)); view.setUint8(11, 'E'.charCodeAt(0));
    // fmt sub-chunk
    view.setUint8(12, 'f'.charCodeAt(0)); view.setUint8(13, 'm'.charCodeAt(0)); view.setUint8(14, 't'.charCodeAt(0)); view.setUint8(15, ' '.charCodeAt(0));
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    // data sub-chunk
    view.setUint8(36, 'd'.charCodeAt(0)); view.setUint8(37, 'a'.charCodeAt(0)); view.setUint8(38, 't'.charCodeAt(0)); view.setUint8(39, 'a'.charCodeAt(0));
    view.setUint32(40, dataSize, true);

    const pcmAsUint8 = new Uint8Array(pcmData.buffer);
    for (let i = 0; i < dataSize; i++) {
        view.setUint8(44 + i, pcmAsUint8[i]);
    }

    return new Blob([view], { type: 'audio/wav' });
}

export type GeneratorStatus = 'idle' | 'generating' | 'zipping' | 'completed' | 'error' | 'cancelled';

export interface ChapterTask {
    chapterIndex: number; // 1-based for display/filename
    title: string;
    htmlContent: string;
}

export interface GeneratorState {
    status: GeneratorStatus;
    progress: number; // 0-100
    message: string;
    error: string | null;
    bookTitle: string;
    totalFiles: number;
    completedFiles: number;
}

type Subscriber = (state: GeneratorState) => void;

class AudiobookGeneratorService {
    private state: GeneratorState = {
        status: 'idle',
        progress: 0,
        message: '',
        error: null,
        bookTitle: '',
        totalFiles: 0,
        completedFiles: 0,
    };
    private subscribers = new Set<Subscriber>();
    private abortController: AbortController | null = null;
    private currentZip: any | null = null;

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

    private setState(newState: Partial<GeneratorState>) {
        this.state = { ...this.state, ...newState };
        this.notify();
    }

    public async startDownload(
        bookTitle: string,
        chapters: ChapterTask[],
        voiceName: string,
        voiceInstructions: string
    ) {
        if (this.state.status === 'generating' || this.state.status === 'zipping') {
            toastService.info("A download is already in progress.");
            return;
        }

        this.currentZip = new JSZip();
        this.abortController = new AbortController();
        
        this.setState({
            status: 'generating',
            progress: 0,
            message: 'Initializing...',
            error: null,
            bookTitle: bookTitle,
            totalFiles: chapters.length,
            completedFiles: 0,
        });

        try {
            for (let i = 0; i < chapters.length; i++) {
                if (this.abortController.signal.aborted) {
                    this.setState({ status: 'cancelled', message: 'Download cancelled.' });
                    return;
                }

                const chapter = chapters[i];
                this.setState({ 
                    message: `Generating Chapter ${chapter.chapterIndex}: ${chapter.title}`,
                    progress: (i / chapters.length) * 100
                });

                // Extract text
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = chapter.htmlContent;
                const chapterText = Array.from(tempDiv.querySelectorAll('p, h1, h2, h3, h4, li'))
                    .map(p => p.textContent)
                    .join(' ');

                if (chapterText.trim()) {
                    // API Call
                    const base64Audio = await gemini.generateSpeech(chapterText, voiceName, voiceInstructions);
                    
                    if (this.abortController.signal.aborted) return;

                    const pcmData = decode(base64Audio);
                    const wavBlob = createWavBlob(pcmData, 24000, 1, 16);
                    
                    // Add to ZIP
                    const fileName = `Chapter_${String(chapter.chapterIndex).padStart(2, '0')}_${chapter.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.wav`;
                    this.currentZip.file(fileName, wavBlob);
                }

                this.setState({ completedFiles: i + 1 });
            }

            // Zipping Phase
            if (this.abortController.signal.aborted) return;
            
            this.setState({ status: 'zipping', message: 'Zipping files...', progress: 100 });
            
            await this.finalizeDownload();

        } catch (error: any) {
            console.error("Audiobook generation failed:", error);
            this.setState({ 
                status: 'error', 
                error: error.message || "Unknown error occurred.",
                message: "Generation failed. You can download partial results."
            });
        }
    }

    public async cancel() {
        if (this.abortController) {
            this.abortController.abort();
        }
        this.setState({ status: 'cancelled', message: 'Cancelled by user.' });
        this.currentZip = null;
        setTimeout(() => this.reset(), 3000);
    }

    public async downloadPartial() {
        if (!this.currentZip || Object.keys(this.currentZip.files).length === 0) {
            toastService.info("No files were generated to download.");
            return;
        }
        
        this.setState({ status: 'zipping', message: 'Zipping partial files...' });
        try {
            await this.finalizeDownload();
        } catch (e: any) {
            toastService.error("Failed to zip partial files.");
            this.setState({ status: 'error', error: e.message });
        }
    }

    public reset() {
        this.currentZip = null;
        this.setState({
            status: 'idle',
            progress: 0,
            message: '',
            error: null,
            bookTitle: '',
            totalFiles: 0,
            completedFiles: 0,
        });
    }

    private async finalizeDownload() {
        if (!this.currentZip) return;

        const zipBlob = await this.currentZip.generateAsync({ type: 'blob' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(zipBlob);
        a.download = `${this.state.bookTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_audiobook.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);

        this.setState({ status: 'completed', message: 'Download complete!' });
        toastService.success("Audiobook download complete!");
        
        // Auto-reset after a delay
        setTimeout(() => {
            if (this.state.status === 'completed') {
                this.reset();
            }
        }, 5000);
    }
}

export const audiobookGenerator = new AudiobookGeneratorService();
