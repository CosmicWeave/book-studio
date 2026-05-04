
import React, { useState, useEffect, useCallback, useContext, useRef, useLayoutEffect } from 'react';
import { HashRouter as Router, Routes, Route, useLocation, useNavigate, Navigate, useParams } from 'react-router-dom';
import { AppContext, AppContextProvider } from './contexts/AppContext';
import { CommandPaletteProvider, useCommandPaletteActions } from './contexts/CommandPaletteContext';
import { BookEditorProvider } from './contexts/BookEditorContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { db, flushWriteQueue } from './services/apiClient';
import { initGoogleDriveService, attemptSilentSignIn } from './services/googleDrive';
import { initGoogleDriveConfig } from './services/googleDriveConfig';
import { historyService } from './services/historyService';
import { fetchLatestBackup, initBackupService, manualTriggerBackup } from './services/backupService';
import { toastService } from './services/toastService';
import { modalService } from './services/modalService';

import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import DocumentsDashboard from './pages/DocumentsDashboard';
import GeneralEditor from './pages/GeneralEditor';
import BookEditor from './pages/BookEditor';
import Settings from './pages/Settings';
import InstructionsManager from './pages/InstructionsManager';
import MacrosManager from './pages/MacrosManager';
import Reader from './pages/Reader';
import SeriesManager from './pages/SeriesManager';
import CurrentlyReading from './pages/CurrentlyReading';
import Archived from './pages/Archived';
import Trash from './pages/Trash';
import ToastContainer from './components/ToastContainer';
import ModalRenderer from './components/ModalRenderer';
import { ModalState } from './services/modalService';
import HistoryControls from './components/HistoryControls';
import RestoreFromServerModal from './components/RestoreFromServerModal';
import RestoreFromFileDropModal from './components/RestoreFromFileDropModal';
import Loader from './components/Loader';
import TaskQueueNotifier from './components/TaskQueueNotifier';
import CommandPalette from './components/CommandPalette';
import { ICONS } from './constants';
import Icon from './components/Icon';
import ErrorBoundary from './components/ErrorBoundary';
import FloatingAudioPlayer from './components/FloatingAudioPlayer';
import ImportModal from './components/ImportModal';
import AudiobookGenerationIndicator from './components/AudiobookGenerationIndicator';
import ConflictResolutionModal from './components/ConflictResolutionModal';
import StorageAlert from './components/StorageAlert';
import InstallPrompt from './components/InstallPrompt';
import PullToRefresh from './components/PullToRefresh';
import AppStatusBar from './components/AppStatusBar';

const App: React.FC = () => {
    return (
        <ErrorBoundary>
            <ThemeProvider>
                <AppContextProvider>
                    <CommandPaletteProvider>
                        <Router>
                            <MainApp />
                        </Router>
                    </CommandPaletteProvider>
                </AppContextProvider>
            </ThemeProvider>
        </ErrorBoundary>
    );
};

// Wrappers that read :id from the URL so the routes are always present
// and avoid the two-render race where editorBookId/readerBookId state is
// not yet set on the first render after navigation.
const BookEditorRoute: React.FC<{ onSave: () => void; onBack: () => void }> = ({ onSave, onBack }) => {
    const { id } = useParams<{ id: string }>();
    if (!id) return null;
    return (
        <BookEditorProvider bookId={id} onBack={onBack}>
            <BookEditor onSave={onSave} onBack={onBack} />
        </BookEditorProvider>
    );
};

const ReaderRoute: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    if (!id) return null;
    return <Reader bookId={id} />;
};

const MainApp: React.FC = () => {
    const START_PAGE_SETTING_ID = 'startPage';
    const location = useLocation();
    const navigate = useNavigate();
    const { createNewBook, createNewDocument } = useContext(AppContext);
    const { openPalette, registerCommands, unregisterCommands } = useCommandPaletteActions();

    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [currentPage, setCurrentPage] = useState<any>('dashboard');
    const [modalState, setModalState] = useState<ModalState | null>(null);
    const [isOffline, setIsOffline] = useState(!navigator.onLine);
    const [isInit, setIsInit] = useState(false);
    const [initError, setInitError] = useState<string | null>(null);
    const [startPage, setStartPage] = useState('dashboard');
    
    // Server restore state
    const [showRestoreModal, setShowRestoreModal] = useState(false);
    const [serverBackupContent, setServerBackupContent] = useState('');
    const [serverBackupTimestamp, setServerBackupTimestamp] = useState(0);
    const [localTimestamp, setLocalTimestamp] = useState(0);
    const [restoreProgress, setRestoreProgress] = useState<{ stage: string; pct: number } | null>(null);

    // File drop restore state
    const [droppedFileContent, setDroppedFileContent] = useState<string | null>(null);
    const [droppedImportFile, setDroppedImportFile] = useState<File | null>(null);

    // Manual server restore state
    const [isCheckingForRestore, setIsCheckingForRestore] = useState(false);

    // Scroll restoration ref
    const mainScrollRef = useRef<HTMLDivElement>(null);
    
    // Swipe handling refs
    const touchStartX = useRef<number | null>(null);

    // Stable navigation callback to prevent re-renders
    const navigateHome = useCallback(() => {
            navigate(`/${startPage}`);
        }, [navigate, startPage]);

    useEffect(() => {
        const initServices = async () => {
          try {
            await db.init();
            await historyService.init();
            await initBackupService();
            await initGoogleDriveConfig();
            await initGoogleDriveService();
                        const startPageSetting = await db.settings.get(START_PAGE_SETTING_ID);
                        if (typeof startPageSetting?.value === 'string' && startPageSetting.value.length > 0) {
                                setStartPage(startPageSetting.value);
                        } else {
                                const legacyStartPage = localStorage.getItem('start_page') || 'dashboard';
                                setStartPage(legacyStartPage);
                                await db.settings.put({ id: START_PAGE_SETTING_ID, value: legacyStartPage });
                                localStorage.removeItem('start_page');
                        }
            attemptSilentSignIn();
            
            // Check for Shared Content from PWA Share Target
            if ('caches' in window) {
                try {
                    const cache = await caches.open('share-target-cache');
                    const response = await cache.match('/shared-content');
                    if (response) {
                        const data = await response.json();
                        await cache.delete('/shared-content'); // Consume it
                        
                        if (data.text || data.url) {
                            const content = `${data.text}\n\n${data.url}`;
                            const newDocId = await createNewDocument(data.title || 'Shared Content');
                            // Update content immediately
                            const doc = await db.documents.get(newDocId);
                            if (doc) {
                                await db.documents.put({ ...doc, content: `<p>${content.replace(/\n/g, '<br/>')}</p>` });
                                toastService.success("Created document from shared content");
                                navigate(`/documents/${newDocId}`);
                            }
                        }
                    }
                } catch (e) {
                    console.warn("Error checking for shared content", e);
                }
            }

          } catch (e: any) {
            console.error("Initialization failed:", e);
            setInitError(e.message || "Unknown database error");
          } finally {
            setIsInit(true);
          }
        };
        initServices();
        
        const unsubscribeModal = modalService.subscribe(setModalState);
        return () => unsubscribeModal();
    }, []);

    useEffect(() => {
        const onStartPageChange = (event: Event) => {
            const detail = (event as CustomEvent<{ startPage?: string }>).detail;
            if (detail?.startPage) {
                setStartPage(detail.startPage);
            }
        };

        window.addEventListener('app-start-page-changed', onStartPageChange);
        return () => window.removeEventListener('app-start-page-changed', onStartPageChange);
    }, []);

    // Global Error Handling
    useEffect(() => {
        const handleError = (event: ErrorEvent) => {
            console.error('Global error caught in App effect:', event.error);
        };

        const handleRejection = (event: PromiseRejectionEvent) => {
            // Promise rejections are not caught by ErrorBoundary
            event.preventDefault();
            console.error('Global unhandled promise rejection:', event.reason);
            
            if (event.reason && typeof event.reason.message === 'string') {
                if (event.reason.message.includes('user-cancelled') || event.reason.message.includes('The user canceled the request')) {
                    return;
                }
            }
        };

        window.addEventListener('error', handleError);
        window.addEventListener('unhandledrejection', handleRejection);

        return () => {
            window.removeEventListener('error', handleError);
            window.removeEventListener('unhandledrejection', handleRejection);
        };
    }, []);
    
    // Online/Offline Status listener
    useEffect(() => {
        const handleStatusChange = () => {
            setIsOffline(!navigator.onLine);
            if (navigator.onLine) {
                toastService.success("You are back online.");
                flushWriteQueue();
            } else {
                toastService.info("You are offline. AI features are unavailable.");
            }
        };

        window.addEventListener('online', handleStatusChange);
        window.addEventListener('offline', handleStatusChange);

        return () => {
            window.removeEventListener('online', handleStatusChange);
            window.removeEventListener('offline', handleStatusChange);
        };
    }, []);

    const checkServerBackup = useCallback(async () => {
      if (!isInit || initError) return;
      try {
          const backup = await fetchLatestBackup();
          if (backup) {
              const localTs = await db.getLatestUpdateTimestamp();
              if (backup.contentTimestamp > localTs) {
                  setServerBackupContent(backup.content);
                  setServerBackupTimestamp(backup.backupTimestamp);
                  setLocalTimestamp(localTs);
                  setShowRestoreModal(true);
              }
          }
      } catch (e) {
          console.warn("Failed to check server backup", e);
      }
    }, [isInit, initError]);

    useEffect(() => {
        // Simplified route handling - let Router handle actual path, just update UI state
        const pathSegments = location.pathname.split('/');
        const rootPath = pathSegments[1] || 'dashboard';
        
        if (rootPath === 'editor' && pathSegments[2]) {
            setCurrentPage('editor');
        } else if (rootPath === 'reader' && pathSegments[2]) {
            setCurrentPage('reader');
        } else if (rootPath === 'series' && pathSegments[2]) {
            setCurrentPage('series');
        } else if (rootPath === 'documents' && pathSegments[2]) {
            setCurrentPage('editor'); // Re-use editor layout hiding logic
        } else {
            setCurrentPage(rootPath);
        }

        if (rootPath === 'dashboard' && isInit && !initError) {
            checkServerBackup();
        }
    }, [location.pathname, checkServerBackup, isInit, initError]);

    // Scroll Restoration Logic
    useLayoutEffect(() => {
        const scrollContainer = mainScrollRef.current;
        if (!scrollContainer) return;

        const key = `scroll_pos_${location.pathname}`;
        
        // Restore scroll position immediately
        const savedPosition = sessionStorage.getItem(key);
        if (savedPosition) {
            scrollContainer.scrollTop = parseInt(savedPosition, 10);
        } else {
            scrollContainer.scrollTop = 0;
        }

        // Save scroll position on scroll
        const handleScroll = () => {
            sessionStorage.setItem(key, scrollContainer.scrollTop.toString());
        };

        scrollContainer.addEventListener('scroll', handleScroll);
        return () => scrollContainer.removeEventListener('scroll', handleScroll);
    }, [location.pathname]);

    // Command Palette integration
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                openPalette();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [openPalette]);

    // Swipe to Open Sidebar Logic
    useEffect(() => {
        const handleTouchStart = (e: TouchEvent) => {
            // Only trigger if starting from the very left edge (20px)
            if (e.touches[0].clientX < 25) {
                touchStartX.current = e.touches[0].clientX;
            } else {
                touchStartX.current = null;
            }
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (touchStartX.current !== null) {
                const currentX = e.touches[0].clientX;
                const diff = currentX - touchStartX.current;
                
                // If dragged right by > 50px
                if (diff > 50) {
                    setIsSidebarOpen(true);
                    touchStartX.current = null; // Reset to prevent repeated triggering
                }
            }
        };

        const handleTouchEnd = () => {
            touchStartX.current = null;
        };

        document.addEventListener('touchstart', handleTouchStart, { passive: true });
        document.addEventListener('touchmove', handleTouchMove, { passive: true });
        document.addEventListener('touchend', handleTouchEnd);

        return () => {
            document.removeEventListener('touchstart', handleTouchStart);
            document.removeEventListener('touchmove', handleTouchMove);
            document.removeEventListener('touchend', handleTouchEnd);
        };
    }, []);

    useEffect(() => {
        if (initError) return; // Don't register commands if app is broken

        const globalCommands = [
            { id: 'nav-dashboard', name: 'Go to Dashboard', section: 'Navigation', icon: ICONS.GRID, action: () => navigate('/dashboard') },
            { id: 'nav-docs', name: 'Go to Documents', section: 'Navigation', icon: ICONS.FILE_TEXT, action: () => navigate('/documents') },
            { id: 'nav-reading', name: 'Go to Reading List', section: 'Navigation', icon: ICONS.BOOK, action: () => navigate('/reading') },
            { id: 'nav-instructions', name: 'Go to Instructions', section: 'Navigation', icon: ICONS.EDIT, action: () => navigate('/instructions') },
            { id: 'nav-macros', name: 'Go to Macros', section: 'Navigation', icon: ICONS.WORKFLOW, action: () => navigate('/macros') },
            { id: 'nav-settings', name: 'Go to Settings', section: 'Navigation', icon: ICONS.SETTINGS, action: () => navigate('/settings') },
            { id: 'create-book', name: 'Create New Book', section: 'Actions', icon: ICONS.PLUS, action: async () => {
                const newId = await createNewBook();
                navigate(`/editor/${newId}`);
            }},
            { id: 'create-doc', name: 'Create New Document', section: 'Actions', icon: ICONS.PLUS, action: async () => {
                const newId = await createNewDocument();
                navigate(`/documents/${newId}`);
            }},
        ];
        registerCommands(globalCommands);
        return () => unregisterCommands(globalCommands.map(c => c.id));
    }, [registerCommands, unregisterCommands, navigate, createNewBook, createNewDocument, initError]);

    const handleRestoreFromServer = async () => {
        setShowRestoreModal(false);
        setRestoreProgress({ stage: 'Starting…', pct: 0 });
        try {
            await db.restore(serverBackupContent, (stage, pct) => {
                setRestoreProgress({ stage, pct });
            });
            toastService.success('Restore from server successful!');
            window.location.reload();
        } catch (e: any) {
            toastService.error(`Restore failed: ${e.message}`);
        } finally {
            setRestoreProgress(null);
        }
    };
    
    const handleUndo = useCallback(async () => {
      historyService.isRestoring = true;
      try {
        const currentState = await db.backup();
        const stateToRestore = await historyService.undo(currentState);
        if (stateToRestore) {
          await db.restore(stateToRestore);
          window.location.reload();
        }
      } catch (e) {
        console.error("Undo failed:", e);
      } finally {
        historyService.isRestoring = false;
      }
    }, []);

    const handleRedo = useCallback(async () => {
      historyService.isRestoring = true;
      try {
        const currentState = await db.backup();
        const stateToRestore = await historyService.redo(currentState);
        if (stateToRestore) {
          await db.restore(stateToRestore);
          window.location.reload();
        }
      } catch (e) {
        console.error("Redo failed:", e);
      } finally {
        historyService.isRestoring = false;
      }
    }, []);
    
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey || e.metaKey) {
                if (e.key === 'z' && !e.shiftKey) { // Simple Ctrl+Z
                    e.preventDefault();
                    handleUndo();
                } else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) { // Ctrl+Y or Ctrl+Shift+Z
                    e.preventDefault();
                    handleRedo();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleUndo, handleRedo]);
    
    // File drop handlers
    useEffect(() => {
        const handleDragOver = (e: DragEvent) => e.preventDefault();
        const handleDrop = (e: DragEvent) => {
            e.preventDefault();
            const file = e.dataTransfer?.files[0];
            if (!file) return;

            const lowerName = file.name.toLowerCase();
            if (lowerName.endsWith('.json')) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const content = event.target?.result as string;
                    setDroppedFileContent(content);
                };
                reader.readAsText(file);
            } else if (/\.(epub|pdf|md|txt|zip)$/.test(lowerName)) {
                setDroppedImportFile(file);
            }
        };

        window.addEventListener('dragover', handleDragOver);
        window.addEventListener('drop', handleDrop);
        return () => {
            window.removeEventListener('dragover', handleDragOver);
            window.removeEventListener('drop', handleDrop);
        };
    }, []);

    const handleManualRestoreCheck = async () => {
        setIsCheckingForRestore(true);
        await checkServerBackup();
        setIsCheckingForRestore(false);
        if (!showRestoreModal) {
            toastService.info("Your local data is already up-to-date with the server.");
        }
    };
    
    const handleFactoryReset = async () => {
        if (confirm("Are you SURE? This will wipe all local data and attempt to fix the database corruption. You will lose any unsaved work.")) {
            try {
                await db.deleteDatabase();
                window.location.reload();
            } catch (e) {
                alert("Failed to reset database. Please clear browser data manually.");
            }
        }
    };
    
    const handleRefresh = async () => {
        try {
            await manualTriggerBackup(true);
            toastService.success("Synced with server.");
        } catch (e) {
            // Error handling is inside manualTriggerBackup, but we can catch connection errors here if needed
        }
    };

    if (initError) {
        return (
             <div className="flex h-screen w-screen items-center justify-center bg-zinc-100 dark:bg-zinc-900 fixed inset-0 z-[99999]">
                <div className="max-w-xl rounded-lg bg-white dark:bg-zinc-800 p-8 text-center shadow-2xl border border-red-200 dark:border-red-900">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
                        <Icon name="ALERT_TRIANGLE" className="w-8 h-8 text-red-600 dark:text-red-300" />
                    </div>
                    <h1 className="mt-4 text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Critical Database Error</h1>
                    <p className="mt-2 text-zinc-600 dark:text-zinc-400">
                        The application could not initialize the local database. This usually happens due to browser storage corruption or a version mismatch.
                    </p>
                    <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-left text-xs font-mono overflow-auto max-h-32">
                        {initError}
                    </div>
                    <div className="mt-6 flex flex-col gap-3">
                        <button
                            onClick={() => window.location.reload()}
                            className="inline-flex items-center justify-center rounded-md bg-zinc-600 px-5 py-2.5 text-center text-sm font-semibold text-white shadow-sm hover:bg-zinc-700"
                        >
                            Try Reloading
                        </button>
                        <button
                            onClick={handleFactoryReset}
                            className="inline-flex items-center justify-center rounded-md bg-red-600 px-5 py-2.5 text-center text-sm font-semibold text-white shadow-sm hover:bg-red-700"
                        >
                            Factory Reset (Wipe Data)
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (!isInit) {
        return (
            <div className="flex h-screen items-center justify-center bg-zinc-100 dark:bg-zinc-900">
                <Loader message="Initializing Studio..." />
            </div>
        );
    }

    const isFullScreenPage = currentPage === 'editor' || currentPage === 'reader' || currentPage === 'series';
    const isReaderPage = currentPage === 'reader';
    const isGeneralEditor = location.pathname.startsWith('/documents/');

    return (
        <div className="flex h-screen flex-col bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">
            {isOffline && (
                <div className="fixed top-0 left-0 right-0 bg-amber-500 text-white text-xs font-bold text-center py-1 z-[10000]">
                    OFFLINE MODE - Changes saved locally
                </div>
            )}
            <div className="flex min-h-0 flex-1">
                {!isFullScreenPage && !isGeneralEditor && <Sidebar currentPage={currentPage} isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />}
                <div className={`flex min-h-0 flex-1 flex-col transition-all duration-300 ease-in-out ${(!isFullScreenPage && !isGeneralEditor) && 'lg:ml-64'}`}>
                    {!isFullScreenPage && !isGeneralEditor && <Header onMenuClick={() => setIsSidebarOpen(true)} />}
                    
                    {/* Wrap main content area with PullToRefresh */}
                    <PullToRefresh onRefresh={handleRefresh} scrollRef={mainScrollRef} className={isOffline ? 'pt-6' : ''}>
                        <main ref={mainScrollRef} className="flex-1 min-h-0">
                            <Routes>
                                <Route path="/" element={<Navigate to={`/${startPage}`} replace />} />
                                <Route path="/dashboard" element={<Dashboard />} />
                                <Route path="/documents" element={<DocumentsDashboard />} />
                                <Route path="/documents/:id" element={<GeneralEditor />} />
                                <Route path="/reading" element={<CurrentlyReading />} />
                                <Route path="/instructions" element={<InstructionsManager />} />
                                <Route path="/macros" element={<MacrosManager />} />
                                <Route path="/settings" element={<Settings onRestoreSuccess={async () => navigateHome()} onManualRestoreCheck={handleManualRestoreCheck} />} />
                                <Route path="/archived" element={<Archived />} />
                                <Route path="/trash" element={<Trash />} />
                                <Route path="/series/:id" element={<SeriesManager />} />
                                <Route path="/editor/:id" element={<BookEditorRoute onSave={navigateHome} onBack={navigateHome} />} />
                                <Route path="/reader/:id" element={<ReaderRoute />} />
                            </Routes>
                        </main>
                    </PullToRefresh>
                </div>
            </div>
            <AppStatusBar isOffline={isOffline} />
            <ToastContainer />
            <ModalRenderer modalState={modalState} />
            <ConflictResolutionModal />
            <StorageAlert />
            {!isReaderPage && <HistoryControls onUndo={handleUndo} onRedo={handleRedo} />}
            <CommandPalette />
            <FloatingAudioPlayer />
            <AudiobookGenerationIndicator />
            <InstallPrompt />
            {restoreProgress && (
                <div className="fixed inset-0 z-[99999] bg-black/70 backdrop-blur-sm flex items-center justify-center">
                    <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-2xl p-8 w-full max-w-sm mx-4 text-center">
                        <div className="text-4xl mb-4">☁️</div>
                        <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-100 mb-1">Restoring from backup…</h2>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-5">{restoreProgress.stage}</p>
                        <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-2.5 overflow-hidden">
                            <div
                                className="bg-indigo-500 h-2.5 rounded-full transition-all duration-300"
                                style={{ width: `${restoreProgress.pct}%` }}
                            />
                        </div>
                        <p className="text-xs text-zinc-400 mt-2">{restoreProgress.pct}%</p>
                    </div>
                </div>
            )}
            {showRestoreModal && (
                <RestoreFromServerModal
                    backupTimestamp={serverBackupTimestamp}
                    localTimestamp={localTimestamp}
                    onRestore={handleRestoreFromServer}
                    onDecline={() => setShowRestoreModal(false)}
                />
            )}
            {droppedFileContent && (
                <RestoreFromFileDropModal
                    fileContent={droppedFileContent}
                    onClose={() => setDroppedFileContent(null)}
                    onRestoreSuccess={async () => {
                        setDroppedFileContent(null);
                        window.location.reload();
                    }}
                />
            )}
            {droppedImportFile && (
                <ImportModal
                    isOpen={true}
                    onClose={() => setDroppedImportFile(null)}
                    initialFile={droppedImportFile}
                />
            )}
            {isCheckingForRestore && <Loader message="Checking for server backup..." />}
            <TaskQueueNotifier />
        </div>
    );
};

export default App;
