
import React, { useState, useContext, useEffect } from 'react';
import { AppContext } from '../contexts/AppContext';
import { toastService } from '../services/toastService';
import { previewImportFile, importFromGoogleDoc } from '../services/importService';
import { 
    requestManualSignIn, 
    onAuthStateChanged, 
    subscribeToDriveInit, 
    DriveInitState, 
    configureDrive, 
    openDrivePicker 
} from '../services/googleDrive';
import Icon from './Icon';
import Loader from './Loader';
import { useNavigate } from 'react-router-dom';
import { Book } from '../types';
import { backgroundTaskService } from '../services/backgroundTaskService';
import { autoFillKnowledgeBase } from '../services/gemini';
import { db } from '../services/db';

const GOOGLE_ICON = `<svg viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path><path fill="none" d="M0 0h48v48H0z"></path></svg>`;

interface ImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialFile?: File | null;
}

type ImportStep = 'select' | 'preview';
type SourceType = 'file' | 'google-docs';

const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, initialFile }) => {
    const { createNewBook } = useContext(AppContext);
    const navigate = useNavigate();
    
    const [step, setStep] = useState<ImportStep>('select');
    const [source, setSource] = useState<SourceType>('file');
    const [file, setFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [previewData, setPreviewData] = useState<Partial<Book> | null>(null);
    const [markdownSplitLevel, setMarkdownSplitLevel] = useState<1 | 2 | 3>(2);
    const [partSplitLevel, setPartSplitLevel] = useState<null | 1 | 2>(1);
    const [analyzeContent, setAnalyzeContent] = useState(true);
    const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
    
    // Google Drive State
    const [isSignedIn, setIsSignedIn] = useState(false);
    const [driveStatus, setDriveStatus] = useState<DriveInitState>('loading');
    
    // Inline Config State
    const [customClientId, setCustomClientId] = useState('');
    const [customApiKey, setCustomApiKey] = useState('');

    useEffect(() => {
        if (isOpen) {
            if (initialFile) {
                setFile(initialFile);
                handlePreview(initialFile, markdownSplitLevel, partSplitLevel);
            } else {
                resetState();
            }
        }
    }, [isOpen, initialFile]);

    useEffect(() => {
        if (previewData?.outline) {
            setSelectedIndices(new Set(previewData.outline.map((_, i) => i)));
        }
    }, [previewData]);

    // Listen for Google Auth changes
    useEffect(() => {
        const unsubAuth = onAuthStateChanged((signedIn) => {
            setIsSignedIn(signedIn);
        });
        const unsubDrive = subscribeToDriveInit(setDriveStatus);
        return () => {
            unsubAuth();
            unsubDrive();
        };
    }, []);

    if (!isOpen) return null;

    const resetState = () => {
        setStep('select');
        setFile(null);
        setSource('file');
        setIsLoading(false);
        setLoadingMessage('');
        setPreviewData(null);
        setAnalyzeContent(true);
        setSelectedIndices(new Set());
        setMarkdownSplitLevel(2);
        setPartSplitLevel(1);
    };

    const handleFileChange = (selectedFile: File | null) => {
        if (selectedFile) {
            setFile(selectedFile);
            handlePreview(selectedFile, markdownSplitLevel, partSplitLevel);
        }
    };
    
    const handlePreview = async (fileToPreview: File, mdSplitLevel: 1 | 2 | 3, ptSplitLevel: null | 1 | 2) => {
        setIsLoading(true);
        setLoadingMessage('Analyzing file...');
        try {
            const data = await previewImportFile(fileToPreview, { markdownSplitLevel: mdSplitLevel, partSplitLevel: ptSplitLevel });
            setPreviewData(data);
            setStep('preview');
        } catch (error) {
            resetState();
        } finally {
            setIsLoading(false);
        }
    };

    const handleConfigureDrive = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!customClientId.trim() || !customApiKey.trim()) {
            toastService.error("Please enter both Client ID and API Key.");
            return;
        }
        setIsLoading(true);
        setLoadingMessage('Initializing Google Drive Service...');
        try {
            await configureDrive(customClientId.trim(), customApiKey.trim());
            toastService.success("Google Drive configured!");
        } catch (e: any) {
            toastService.error("Failed to configure: " + e.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handlePickerOpen = async () => {
        try {
            await openDrivePicker(async (fileId, fileName) => {
                setIsLoading(true);
                setLoadingMessage('Downloading and analyzing Google Doc...');
                try {
                    const data = await importFromGoogleDoc(fileId, fileName, { markdownSplitLevel: markdownSplitLevel, partSplitLevel: partSplitLevel });
                    setPreviewData(data);
                    setStep('preview');
                } catch (e: any) {
                    toastService.error(e.message);
                } finally {
                    setIsLoading(false);
                }
            });
        } catch (e: any) {
            toastService.error(e.message);
        }
    };
    
    const handleMarkdownSplitChange = (level: 1 | 2 | 3) => {
        setMarkdownSplitLevel(level);
        // If chapter split is less than or equal to part split, disable part split logic temporarily or warn?
        // Better: disable conflicting Part Split options in UI.
        if (partSplitLevel && level <= partSplitLevel) {
            setPartSplitLevel(null); // Disable part splitting if chapter splitting overrides it
        }
        
        refreshPreview(level, partSplitLevel && level > partSplitLevel ? partSplitLevel : null);
    }

    const handlePartSplitChange = (level: null | 1 | 2) => {
        setPartSplitLevel(level);
        if (level && markdownSplitLevel <= level) {
            setMarkdownSplitLevel((level + 1) as 1 | 2 | 3); // Ensure chapter split is deeper
            refreshPreview((level + 1) as 1 | 2 | 3, level);
        } else {
            refreshPreview(markdownSplitLevel, level);
        }
    }

    const refreshPreview = (mdLevel: 1 | 2 | 3, ptLevel: null | 1 | 2) => {
        if(file) {
            handlePreview(file, mdLevel, ptLevel);
        } else if (previewData && source === 'google-docs') {
            // For Google Docs, we'd need to re-fetch if we didn't cache the raw HTML. 
            // importFromGoogleDoc fetches then parses. To avoid re-fetching, we'd need to refactor.
            // For now, asking user to re-select is safer/easier or just trigger re-fetch if token valid.
            toastService.info("Please re-select the document to apply split level changes.");
            setStep('select');
        }
    }

    const toggleChapter = (index: number) => {
        const newSet = new Set(selectedIndices);
        if (newSet.has(index)) newSet.delete(index);
        else newSet.add(index);
        setSelectedIndices(newSet);
    }

    const toggleAll = () => {
        if (previewData?.outline && selectedIndices.size === previewData.outline.length) {
            setSelectedIndices(new Set());
        } else if (previewData?.outline) {
            setSelectedIndices(new Set(previewData.outline.map((_, i) => i)));
        }
    }

    const handleImport = async () => {
        if (!previewData) return;
        setIsLoading(true);
        setLoadingMessage('Importing book...');
        try {
            // Filter data based on selection
            const bookData = { ...previewData };
            if (bookData.outline && bookData.content) {
                // Filter outline and content. Assuming arrays are parallel and same length
                const filteredOutline = bookData.outline.filter((_, i) => selectedIndices.has(i));
                const filteredContent = bookData.content.filter((_, i) => selectedIndices.has(i));
                bookData.outline = filteredOutline;
                bookData.content = filteredContent;
            }

            if (bookData.outline && bookData.outline.length === 0) {
                toastService.error("Please select at least one chapter to import.");
                setIsLoading(false);
                return;
            }

            const newBookId = await createNewBook(bookData);
            
            if (analyzeContent) {
                const fullText = (bookData.content || [])
                    .map(c => {
                        const tempDiv = document.createElement('div');
                        tempDiv.innerHTML = c.htmlContent;
                        return tempDiv.textContent || '';
                    })
                    .join('\n\n');

                if (fullText.trim()) {
                    backgroundTaskService.addTask({
                        name: `Building Knowledge Base for "${bookData.topic}"`,
                        bookId: newBookId,
                        execute: async () => {
                            const newSheets = await autoFillKnowledgeBase(bookData.topic || 'Untitled', fullText);
                            return newSheets;
                        },
                        onComplete: async (result) => {
                            const newSheets = result as any;
                            if (newSheets && newSheets.length > 0) {
                                const book = await db.books.get(newBookId);
                                if (book) {
                                    await db.books.put({ ...book, knowledgeBase: newSheets });
                                    toastService.success(`Knowledge Base for "${book.topic}" created with ${newSheets.length} entries.`);
                                }
                            }
                        },
                    });
                }
            }

            toastService.success(`Successfully imported "${bookData.topic}"`);
            navigate(`/editor/${newBookId}`);
            onClose();
            resetState();
        } catch (error: any) {
            toastService.error(`Import failed: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const renderSourceSelector = () => (
        <div className="flex space-x-4 mb-6 border-b border-zinc-200 dark:border-zinc-700">
            <button 
                onClick={() => setSource('file')}
                className={`pb-2 text-sm font-medium transition-colors border-b-2 ${source === 'file' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400'}`}
            >
                Upload File
            </button>
            <button 
                onClick={() => setSource('google-docs')}
                className={`pb-2 text-sm font-medium transition-colors border-b-2 ${source === 'google-docs' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400'}`}
            >
                Google Docs
            </button>
        </div>
    );

    const renderFileSelect = () => (
        <>
            <p className="text-sm text-zinc-500 mt-4">Import content from .epub, .zip (for epubs), .pdf, or .md/.txt files.</p>
            <div className="mt-4">
                <input 
                    type="file" 
                    onChange={e => handleFileChange(e.target.files ? e.target.files[0] : null)} 
                    accept=".epub,.zip,.pdf,.md,.txt" 
                    className="w-full text-sm text-zinc-600 dark:text-zinc-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-indigo-900/50 dark:file:text-indigo-200 dark:hover:file:bg-indigo-900"
                />
            </div>
        </>
    );

    const renderGoogleDocsSelect = () => {
        if (driveStatus === 'unconfigured' || driveStatus === 'error') {
             return (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                     <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-full mb-4">
                        <Icon name="SETTINGS" className="w-8 h-8 text-zinc-400" />
                     </div>
                     <h3 className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">Setup Google Drive</h3>
                     <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6 max-w-xs">
                        Enter your Google Cloud credentials to access your documents.
                     </p>
                     
                     <form onSubmit={handleConfigureDrive} className="w-full max-w-sm space-y-3 text-left">
                        <div>
                            <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Client ID</label>
                            <input 
                                type="text" 
                                value={customClientId} 
                                onChange={e => setCustomClientId(e.target.value)} 
                                placeholder="apps.googleusercontent.com"
                                className="w-full rounded-md border-zinc-300 dark:border-zinc-600 dark:bg-zinc-800 text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">API Key</label>
                            <input 
                                type="text" 
                                value={customApiKey} 
                                onChange={e => setCustomApiKey(e.target.value)} 
                                className="w-full rounded-md border-zinc-300 dark:border-zinc-600 dark:bg-zinc-800 text-sm"
                            />
                        </div>
                        <button 
                            type="submit" 
                            className="w-full py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
                        >
                            Save & Connect
                        </button>
                    </form>
                    <p className="text-xs text-zinc-400 mt-4">
                        Don't have these? <a href="https://console.cloud.google.com/" target="_blank" rel="noreferrer" className="underline">Create a project</a> with Google Drive API enabled.
                    </p>
                </div>
            );
        }

        if (driveStatus === 'loading') {
            return (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                     <div className="w-8 h-8 border-4 border-t-indigo-500 border-gray-200 rounded-full animate-spin mb-4"></div>
                     <p className="text-zinc-600 dark:text-zinc-400">Initializing Google Services...</p>
                </div>
            );
        }

        if (!isSignedIn) {
            return (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-4">
                        <div className="w-8 h-8" dangerouslySetInnerHTML={{ __html: GOOGLE_ICON }} />
                    </div>
                    <h3 className="text-lg font-semibold text-zinc-800 dark:text-zinc-100 mb-2">Connect Google Drive</h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6 max-w-xs">
                        Sign in to browse and import your Google Docs directly.
                    </p>
                    <button onClick={requestManualSignIn} className="flex items-center justify-center space-x-3 bg-white border border-zinc-300 text-zinc-700 px-6 py-3 rounded-lg shadow-sm hover:bg-zinc-50 transition-colors">
                        <div className="w-5 h-5" dangerouslySetInnerHTML={{ __html: GOOGLE_ICON }} />
                        <span className="font-semibold">Sign in with Google</span>
                    </button>
                </div>
            );
        }

        return (
            <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/20 rounded-full flex items-center justify-center mb-4">
                    <Icon name="CLOUD" className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h3 className="text-lg font-semibold text-zinc-800 dark:text-zinc-100 mb-2">Ready to Import</h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
                    Open the Google Picker to select a document from your Drive.
                </p>
                <button onClick={handlePickerOpen} className="bg-indigo-600 text-white px-6 py-3 rounded-lg shadow-md font-semibold hover:bg-indigo-700 transition-colors flex items-center space-x-2">
                    <Icon name="SEARCH" className="w-5 h-5" />
                    <span>Browse Google Drive</span>
                </button>
            </div>
        );
    };
    
    const renderPreviewStep = () => (
        <>
            <div className="flex justify-between items-center pb-4 border-b border-zinc-200 dark:border-zinc-700">
                <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">Preview & Configure Import</h2>
                <button onClick={onClose} className="p-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700"><Icon name="CLOSE" /></button>
            </div>
            <div className="space-y-4 mt-4 max-h-[60vh] overflow-y-auto pr-2 -mr-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="text-sm font-medium">Book Title</label>
                        <input type="text" value={previewData?.topic || ''} onChange={e => setPreviewData(p => p ? ({...p, topic: e.target.value}) : null)} className="w-full mt-1 bg-white dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600 rounded-md shadow-sm"/>
                    </div>
                     <div>
                        <label className="text-sm font-medium">Author</label>
                        <input type="text" value={previewData?.author || ''} onChange={e => setPreviewData(p => p ? ({...p, author: e.target.value}) : null)} className="w-full mt-1 bg-white dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600 rounded-md shadow-sm"/>
                    </div>
                </div>
                <div>
                    <label className="text-sm font-medium">Subtitle <span className="text-zinc-400 font-normal">(Optional)</span></label>
                    <input type="text" value={previewData?.subtitle || ''} onChange={e => setPreviewData(p => p ? ({...p, subtitle: e.target.value}) : null)} className="w-full mt-1 bg-white dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600 rounded-md shadow-sm"/>
                </div>
                {(file?.name.endsWith('.md') || source === 'google-docs') && (
                    <div className="grid grid-cols-2 gap-4 p-3 bg-zinc-50 dark:bg-zinc-900/50 rounded-lg border border-zinc-200 dark:border-zinc-700">
                        <div>
                            <label className="text-xs font-bold uppercase text-zinc-500 mb-1 block">Split Parts by...</label>
                            <div className="flex space-x-1">
                                <button onClick={() => handlePartSplitChange(null)} className={`px-2 py-1 text-xs rounded-md ${partSplitLevel === null ? 'bg-zinc-600 text-white' : 'bg-zinc-200 dark:bg-zinc-600'}`}>None</button>
                                <button onClick={() => handlePartSplitChange(1)} className={`px-2 py-1 text-xs rounded-md ${partSplitLevel === 1 ? 'bg-indigo-600 text-white' : 'bg-zinc-200 dark:bg-zinc-600'}`}>H1</button>
                                <button onClick={() => handlePartSplitChange(2)} disabled={markdownSplitLevel <= 2} className={`px-2 py-1 text-xs rounded-md ${partSplitLevel === 2 ? 'bg-indigo-600 text-white' : 'bg-zinc-200 dark:bg-zinc-600 disabled:opacity-30'}`}>H2</button>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold uppercase text-zinc-500 mb-1 block">Split Chapters by...</label>
                            <div className="flex space-x-1">
                                {(['H1', 'H2', 'H3'] as const).map((level, i) => (
                                    <button 
                                        key={level} 
                                        onClick={() => handleMarkdownSplitChange((i + 1) as 1 | 2 | 3)} 
                                        disabled={partSplitLevel !== null && (i + 1) <= partSplitLevel}
                                        className={`px-2 py-1 text-xs rounded-md ${markdownSplitLevel === i + 1 ? 'bg-indigo-600 text-white' : 'bg-zinc-200 dark:bg-zinc-600 disabled:opacity-30'}`}
                                    >
                                        {level}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="col-span-2 text-[10px] text-zinc-500 italic">
                            {partSplitLevel ? `H${partSplitLevel} creates a Part folder. H${markdownSplitLevel} creates a Chapter inside it.` : `H${markdownSplitLevel} creates a Chapter.`}
                        </div>
                    </div>
                )}
                <div>
                    <div className="flex justify-between items-end mb-1">
                        <label className="text-sm font-medium">Detected Structure</label>
                        <button onClick={toggleAll} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
                            {selectedIndices.size === previewData?.outline?.length ? 'Deselect All' : 'Select All'}
                        </button>
                    </div>
                    <div className="h-64 overflow-y-auto border border-zinc-300 dark:border-zinc-600 rounded-md bg-zinc-50 dark:bg-zinc-900/50 divide-y divide-zinc-200 dark:divide-zinc-700">
                        {previewData?.outline?.map((ch, i) => (
                            <label key={i} className="flex items-center p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors">
                                <input 
                                    type="checkbox" 
                                    checked={selectedIndices.has(i)} 
                                    onChange={() => toggleChapter(i)}
                                    className="h-4 w-4 text-indigo-600 border-zinc-300 rounded focus:ring-indigo-500 flex-shrink-0"
                                />
                                <div className="ml-3 overflow-hidden">
                                    {ch.part && <span className="block text-[10px] text-zinc-500 uppercase font-bold tracking-wide">{ch.part}</span>}
                                    <span className="text-sm text-zinc-700 dark:text-zinc-300 truncate block select-none">{ch.title}</span>
                                </div>
                            </label>
                        ))}
                        {(!previewData?.outline || previewData.outline.length === 0) && (
                            <div className="p-4 text-center text-zinc-500 text-sm">No chapters detected.</div>
                        )}
                    </div>
                    <p className="text-xs text-zinc-500 mt-1">{selectedIndices.size} of {previewData?.outline?.length || 0} selected</p>
                </div>
                <div className="flex items-start p-2 rounded-md bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800">
                    <input
                        id="analyzeContent"
                        type="checkbox"
                        checked={analyzeContent}
                        onChange={(e) => setAnalyzeContent(e.target.checked)}
                        className="h-5 w-5 mt-0.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <label htmlFor="analyzeContent" className="ml-3 text-sm text-gray-700 dark:text-gray-300">
                        <span className="font-semibold">Analyze content to build Knowledge Base</span>
                        <br />
                        <span className="text-xs text-gray-500 dark:text-gray-400">Helps the AI understand your book's characters, plot, and world for better-contexted assistance. (Recommended)</span>
                    </label>
                </div>
            </div>
            <div className="mt-6 flex justify-between items-center">
                <button onClick={resetState} className="text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:underline">
                    &larr; Back
                </button>
                <button onClick={handleImport} className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-semibold">
                    Import Book
                </button>
            </div>
        </>
    );

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[10001] p-4 animate-fade-in" onClick={onClose}>
            {isLoading && <Loader message={loadingMessage} />}
            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-2xl w-full max-w-2xl p-6" onClick={e => e.stopPropagation()}>
                {step === 'select' ? (
                    <>
                        <div className="flex justify-between items-center pb-4">
                            <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">Import Book</h2>
                            <button onClick={onClose} className="p-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700"><Icon name="CLOSE" /></button>
                        </div>
                        {renderSourceSelector()}
                        {source === 'file' ? renderFileSelect() : renderGoogleDocsSelect()}
                    </>
                ) : renderPreviewStep()}
            </div>
        </div>
    );
};

export default ImportModal;
