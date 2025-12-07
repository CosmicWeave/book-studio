
import React, { useState, useEffect } from 'react';
import { useBookEditor } from '../../contexts/BookEditorContext';
import { KnowledgeSheet, KnowledgeSheetCategory } from '../../types';
import { ICONS, KNOWLEDGE_SHEET_CATEGORIES, VALUE_SYSTEM_TEMPLATE, TECHNOLOGY_MAGIC_TEMPLATE, CULTURE_SOCIETY_TEMPLATE, HISTORY_TIMELINE_TEMPLATE, PLOT_NARRATIVE_TEMPLATE, THEME_TONE_TEMPLATE } from '../../constants';
import KnowledgeGraph from './KnowledgeGraph';
import Icon from '../Icon';

interface KnowledgeBaseModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const KnowledgeBaseModal: React.FC<KnowledgeBaseModalProps> = ({ isOpen, onClose }) => {
    const { book, handleKnowledgeBaseUpdate, handleAutoFillKnowledgeBase, isAutoFillingKb, isAiEnabled } = useBookEditor();
    const [sheets, setSheets] = useState<KnowledgeSheet[]>([]);
    const [selectedSheetId, setSelectedSheetId] = useState<string | null>(null);
    const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);

    useEffect(() => {
        if (book?.knowledgeBase) {
            setSheets(book.knowledgeBase);
            if (book.knowledgeBase.length > 0 && !selectedSheetId) {
                setSelectedSheetId(book.knowledgeBase[0].id);
            } else if (book.knowledgeBase.length === 0) {
                setSelectedSheetId(null);
            }
        }
    }, [book?.knowledgeBase, selectedSheetId]);

    if (!isOpen || !book) return null;

    const selectedSheet = sheets.find(s => s.id === selectedSheetId);

    const handleSheetChange = (id: string, field: 'name' | 'content' | 'category', value: string) => {
        const newSheets = sheets.map(s => s.id === id ? { ...s, [field]: value } : s);
        setSheets(newSheets);
    };

    const handleSaveChanges = () => {
        handleKnowledgeBaseUpdate(sheets);
    };
    
    const handleAddNewSheet = (category?: KnowledgeSheetCategory, template?: string) => {
        const newSheet: KnowledgeSheet = { 
            id: crypto.randomUUID(), 
            name: category ? `New ${category}` : 'New Sheet', 
            content: template || '',
            category: category || 'Other'
        };
        setSheets([...sheets, newSheet]);
        setSelectedSheetId(newSheet.id);
        setIsAddMenuOpen(false);
    };
    
    const handleDeleteSheet = (id: string) => {
        const newSheets = sheets.filter(s => s.id !== id);
        setSheets(newSheets);
        if (selectedSheetId === id) {
            setSelectedSheetId(newSheets.length > 0 ? newSheets[0].id : null);
        }
        handleKnowledgeBaseUpdate(newSheets);
    };
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col border border-zinc-200 dark:border-zinc-700" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b border-zinc-200 dark:border-zinc-700 flex-shrink-0">
                    <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 flex items-center space-x-2">
                        <Icon name="BRAIN" className="text-indigo-500" />
                        <span>Knowledge Base for "{book.topic}"</span>
                    </h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700" aria-label="Close modal">
                        <Icon name="CLOSE" className="w-6 h-6" />
                    </button>
                </div>

                <div className="flex-grow flex overflow-hidden">
                    {/* Left: Sheet List */}
                    <div className="w-1/4 flex flex-col border-r border-zinc-200 dark:border-zinc-700">
                        <div className="p-2 flex-shrink-0 relative">
                            <button onClick={() => setIsAddMenuOpen(prev => !prev)} className="w-full text-sm font-semibold p-2 rounded-md bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-200 hover:bg-indigo-200 dark:hover:bg-indigo-900 flex items-center justify-center space-x-1">
                                <Icon name="PLUS" className="w-4 h-4" />
                                <span>Add New Sheet</span>
                            </button>
                            {isAddMenuOpen && (
                                <div className="absolute z-10 top-full mt-1 w-full bg-white dark:bg-zinc-700 rounded-md shadow-lg border border-zinc-200 dark:border-zinc-600 p-1">
                                    <button onClick={() => handleAddNewSheet('Other', '')} className="w-full text-left text-sm p-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-600">Blank Sheet</button>
                                    <div className="my-1 h-px bg-zinc-200 dark:bg-zinc-600"></div>
                                    <h4 className="px-2 py-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400">From Template...</h4>
                                    <button onClick={() => handleAddNewSheet('Plot & Narrative Structure', PLOT_NARRATIVE_TEMPLATE)} className="w-full text-left text-sm p-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-600">Plot & Narrative</button>
                                    <button onClick={() => handleAddNewSheet('Theme & Tone', THEME_TONE_TEMPLATE)} className="w-full text-left text-sm p-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-600">Theme & Tone</button>
                                    <button onClick={() => handleAddNewSheet('Value System & Beliefs', VALUE_SYSTEM_TEMPLATE)} className="w-full text-left text-sm p-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-600">Value System</button>
                                    <button onClick={() => handleAddNewSheet('History & Timeline', HISTORY_TIMELINE_TEMPLATE)} className="w-full text-left text-sm p-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-600">History & Timeline</button>
                                    <button onClick={() => handleAddNewSheet('Culture & Society', CULTURE_SOCIETY_TEMPLATE)} className="w-full text-left text-sm p-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-600">Culture & Society</button>
                                    <button onClick={() => handleAddNewSheet('Technology & Magic Systems', TECHNOLOGY_MAGIC_TEMPLATE)} className="w-full text-left text-sm p-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-600">Tech & Magic</button>
                                </div>
                            )}
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
                    </div>

                    {/* Middle: Editor */}
                    <div className="w-1/2 flex flex-col">
                        {selectedSheet ? (
                            <div className="flex-grow flex flex-col p-4 space-y-2">
                                <div className="flex items-center space-x-2">
                                    <input
                                        value={selectedSheet.name}
                                        onChange={e => handleSheetChange(selectedSheet.id, 'name', e.target.value)}
                                        onBlur={handleSaveChanges}
                                        className="text-lg font-bold bg-transparent focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded-sm p-1 w-full"
                                    />
                                    <select
                                        value={selectedSheet.category || 'Other'}
                                        onChange={(e) => handleSheetChange(selectedSheet.id, 'category', e.target.value)}
                                        onBlur={handleSaveChanges}
                                        className="text-xs bg-zinc-100 dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                                    >
                                        {KNOWLEDGE_SHEET_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                    </select>
                                </div>
                                <textarea
                                    value={selectedSheet.content}
                                    onChange={e => handleSheetChange(selectedSheet.id, 'content', e.target.value)}
                                    onBlur={handleSaveChanges}
                                    placeholder="Enter details for this knowledge sheet. You can link to other sheets using [[Sheet Name]]."
                                    className="text-sm text-zinc-600 dark:text-zinc-400 mt-2 flex-grow resize-none bg-transparent focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded-sm p-1 w-full"
                                />
                                <button onClick={() => handleDeleteSheet(selectedSheet.id)} className="mt-2 text-red-500 text-xs self-start hover:underline">Delete Sheet</button>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-full text-zinc-500">
                                <p>Select or create a sheet to get started.</p>
                            </div>
                        )}
                    </div>
                    
                    {/* Right: Graph View */}
                    <div className="w-1/4 border-l border-zinc-200 dark:border-zinc-700 flex flex-col">
                        <KnowledgeGraph sheets={sheets} onNodeClick={setSelectedSheetId} />
                    </div>
                </div>

                <div className="p-4 border-t border-zinc-200 dark:border-zinc-700 flex justify-between items-center flex-shrink-0">
                    {isAiEnabled && (
                    <button onClick={handleAutoFillKnowledgeBase} disabled={isAutoFillingKb} className="flex items-center space-x-2 text-sm font-semibold py-2 px-3 rounded-md bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-200 hover:bg-indigo-200 dark:hover:bg-indigo-900 disabled:opacity-50">
                        <Icon name={isAutoFillingKb ? 'ROTATE_CW' : 'WAND'} className={`w-4 h-4 ${isAutoFillingKb ? 'animate-spin' : ''}`} />
                        <span>{isAutoFillingKb ? 'Analyzing...' : 'Auto-fill from Content'}</span>
                    </button>
                    )}
                    <button onClick={onClose} className="bg-indigo-600 text-white px-6 py-2 rounded-lg shadow font-semibold hover:bg-indigo-700">Done</button>
                </div>
            </div>
        </div>
    );
};

export default KnowledgeBaseModal;
