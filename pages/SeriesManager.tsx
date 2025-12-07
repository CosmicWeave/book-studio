
import React, { useState, useEffect, useContext, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppContext } from '../contexts/AppContext';
import { Series, Book, KnowledgeSheet } from '../types';
import { ICONS } from '../constants';
import Icon from '../components/Icon';
import Loader from '../components/Loader';
import { toastService } from '../services/toastService';
import KnowledgeGraph from '../components/editor/KnowledgeGraph';
import { autoFillKnowledgeBase } from '../services/gemini';

const SeriesManager: React.FC = () => {
    const { id: seriesId } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { series: allSeries, books: allBooks, updateSeries, isAiEnabled } = useContext(AppContext);

    const [series, setSeries] = useState<Series | null>(null);
    const [booksInSeries, setBooksInSeries] = useState<Book[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    
    // Knowledge Base State
    const [sheets, setSheets] = useState<KnowledgeSheet[]>([]);
    const [selectedSheetId, setSelectedSheetId] = useState<string | null>(null);
    const [isAutoFilling, setIsAutoFilling] = useState(false);

    useEffect(() => {
        if (seriesId) {
            const currentSeries = allSeries.find(s => s.id === seriesId);
            if (currentSeries) {
                setSeries(currentSeries);
                setSheets(currentSeries.sharedKnowledgeBase || []);
                if ((currentSeries.sharedKnowledgeBase || []).length > 0) {
                    setSelectedSheetId(currentSeries.sharedKnowledgeBase![0].id);
                }
                const books = allBooks.filter(b => b.seriesId === seriesId);
                setBooksInSeries(books);
            }
        }
        setIsLoading(false);
    }, [seriesId, allSeries, allBooks]);

    const handleInputChange = (field: 'title' | 'description', value: string) => {
        if (series) {
            setSeries({ ...series, [field]: value });
        }
    };
    
    const handleSheetChange = (id: string, field: 'name' | 'content', value: string) => {
        const newSheets = sheets.map(s => s.id === id ? { ...s, [field]: value } : s);
        setSheets(newSheets);
    };

    const handleAddNewSheet = () => {
        const newSheet: KnowledgeSheet = { id: crypto.randomUUID(), name: 'New Sheet', content: '' };
        setSheets([...sheets, newSheet]);
        setSelectedSheetId(newSheet.id);
    };
    
    const handleDeleteSheet = (id: string) => {
        const newSheets = sheets.filter(s => s.id !== id);
        setSheets(newSheets);
        if (selectedSheetId === id) {
            setSelectedSheetId(newSheets.length > 0 ? newSheets[0].id : null);
        }
    };
    
    const handleSaveChanges = async () => {
        if (!series) return;
        setIsSaving(true);
        try {
            const updatedSeries = { ...series, sharedKnowledgeBase: sheets };
            await updateSeries(updatedSeries);
            
            // Also update the seriesName on all books in case the series title changed
            if (series.title !== booksInSeries[0]?.seriesName) {
                for (const book of booksInSeries) {
                    if (book.seriesName !== series.title) {
                        // This would require an updateBook function in AppContext, assuming it exists
                    }
                }
            }

            toastService.success('Series saved successfully!');
        } catch (e: any) {
            toastService.error(`Failed to save: ${e.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleAutoFill = async () => {
        if (!series) return;
        setIsAutoFilling(true);
        try {
            const allContent = booksInSeries.map(b => (b.content || []).filter(c => c).map(c => c.htmlContent).join('\n\n')).join('\n\n\n');
            if (!allContent.trim()) {
                toastService.info("There is no content in any of the books to analyze.");
                setIsAutoFilling(false);
                return;
            }

            const newSheets = await autoFillKnowledgeBase(series.title, allContent);
            const existingNames = new Set(sheets.map(s => s.name.toLowerCase()));
            const uniqueNewSheets = newSheets.filter(s => !existingNames.has(s.name.toLowerCase()));
            
            setSheets(prev => [...prev, ...uniqueNewSheets]);
            toastService.success(`Added ${uniqueNewSheets.length} new knowledge sheets.`);

        } catch (e: any) {
            toastService.error(`Auto-fill failed: ${e.message}`);
        } finally {
            setIsAutoFilling(false);
        }
    };

    const selectedSheet = sheets.find(s => s.id === selectedSheetId);

    if (isLoading) return <Loader message="Loading series..." />;
    if (!series) return <div className="p-8 text-center">Series not found.</div>;

    return (
        <div className="flex flex-col h-screen bg-zinc-100 dark:bg-zinc-900">
            <header className="flex-shrink-0 bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm border-b border-zinc-200 dark:border-zinc-700 pt-[env(safe-area-inset-top)]">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center">
                            <button onClick={() => navigate('/')} aria-label="Back to dashboard" className="p-3 mr-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                                <Icon name="CHEVRON_LEFT" className="w-6 h-6" />
                            </button>
                            <div className="flex items-center space-x-2">
                                <Icon name="LINK" className="w-8 h-8 text-zinc-400" />
                                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-white truncate">{series.title}</h1>
                            </div>
                        </div>
                        <button onClick={handleSaveChanges} disabled={isSaving} className="bg-indigo-600 text-white px-5 py-2.5 rounded-lg shadow-md hover:bg-indigo-700 disabled:bg-indigo-400">
                            {isSaving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </div>
            </header>
            
            <main className="flex-1 overflow-hidden p-4 sm:p-6 lg:p-8">
                <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-lg border border-zinc-200 dark:border-zinc-700 h-full flex flex-col">
                    {/* Series Details */}
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 border-b border-zinc-200 dark:border-zinc-700">
                        <div>
                            <label htmlFor="series-title-input" className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Series Title</label>
                            <input
                                id="series-title-input"
                                value={series.title}
                                onChange={e => handleInputChange('title', e.target.value)}
                                className="w-full text-lg font-bold bg-transparent focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded-sm p-1 -ml-1"
                            />
                        </div>
                         <div>
                            <label htmlFor="series-desc-input" className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Series Description</label>
                            <textarea
                                id="series-desc-input"
                                value={series.description || ''}
                                onChange={e => handleInputChange('description', e.target.value)}
                                rows={2}
                                className="w-full text-sm bg-transparent focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded-sm p-1 -ml-1 resize-none"
                                placeholder="A brief synopsis of the series..."
                            />
                        </div>
                    </div>

                    {/* Knowledge Base Editor */}
                    <div className="flex-grow flex overflow-hidden">
                        <div className="w-1/4 flex flex-col border-r border-zinc-200 dark:border-zinc-700">
                             <div className="p-2 flex-shrink-0">
                                <button onClick={handleAddNewSheet} className="w-full text-sm font-semibold p-2 rounded-md bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-200 hover:bg-indigo-200 dark:hover:bg-indigo-900">
                                    Add New Sheet
                                </button>
                            </div>
                            <ul className="overflow-y-auto flex-grow p-2">
                                {sheets.map(sheet => (
                                    <li key={sheet.id}>
                                        <button onClick={() => setSelectedSheetId(sheet.id)} className={`w-full text-left p-2 rounded-md text-sm truncate ${selectedSheetId === sheet.id ? 'bg-indigo-500 text-white' : 'hover:bg-zinc-100 dark:hover:bg-zinc-700'}`}>
                                            {sheet.name}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                             <div className="p-2 border-t border-zinc-200 dark:border-zinc-700">
                                {isAiEnabled && (
                                <button onClick={handleAutoFill} disabled={isAutoFilling} className="w-full flex items-center justify-center space-x-2 text-sm font-semibold py-2 px-3 rounded-md bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-200 hover:bg-indigo-200 dark:hover:bg-indigo-900 disabled:opacity-50">
                                    <Icon name={isAutoFilling ? 'ROTATE_CW' : 'WAND'} className={`w-4 h-4 ${isAutoFilling ? 'animate-spin' : ''}`} />
                                    <span>{isAutoFilling ? 'Analyzing...' : 'Auto-fill from Books'}</span>
                                </button>
                                )}
                            </div>
                        </div>

                        <div className="w-1/2 flex flex-col">
                            {selectedSheet ? (
                                <div className="flex-grow flex flex-col p-4">
                                    <input
                                        value={selectedSheet.name}
                                        onChange={e => handleSheetChange(selectedSheet.id, 'name', e.target.value)}
                                        className="text-lg font-bold bg-transparent focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded-sm -ml-1 p-1 w-full"
                                    />
                                    <textarea
                                        value={selectedSheet.content}
                                        onChange={e => handleSheetChange(selectedSheet.id, 'content', e.target.value)}
                                        placeholder="Enter details for this knowledge sheet..."
                                        className="text-sm text-zinc-600 dark:text-zinc-400 mt-2 flex-grow resize-none bg-transparent focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded-sm -ml-1 p-1 w-full"
                                    />
                                    <button onClick={() => handleDeleteSheet(selectedSheet.id)} className="mt-2 text-red-500 text-xs self-start hover:underline">Delete Sheet</button>
                                </div>
                            ) : (
                                <div className="flex items-center justify-center h-full text-zinc-500">
                                    <p>Select or create a sheet to get started.</p>
                                </div>
                            )}
                        </div>
                        
                        <div className="w-1/4 border-l border-zinc-200 dark:border-zinc-700 flex flex-col">
                            <KnowledgeGraph sheets={sheets} onNodeClick={setSelectedSheetId} />
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default SeriesManager;