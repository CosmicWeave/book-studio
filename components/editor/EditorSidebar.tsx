
import React from 'react';
import { useBookEditor } from '../../contexts/BookEditorContext';
import ConfigurationPanel from './panels/ConfigurationPanel';
import MetadataPanel from './panels/MetadataPanel';
import ActionsPanel from './panels/ActionsPanel';
import SaveStatusIndicator from './SaveStatusIndicator';
import GenerationConfigPanel from './panels/GenerationConfigPanel';
import ResearchPanel from './panels/ResearchPanel';
import KnowledgeBasePanel from './panels/KnowledgeBasePanel';
import AudiobookPanel from './panels/AudiobookPanel';
import SeriesPanel from './panels/SeriesPanel';
import MacrosPanel from './panels/MacrosPanel';
import ImageSuggestionsPanel from './panels/ImageSuggestionsPanel';
import FindReplacePanel from './panels/FindReplacePanel';
import AIAssistantPanel from './panels/AIAssistantPanel';
import Icon from '../Icon';

interface EditorSidebarProps {
    onSaveAndClose: () => void;
}

const EditorSidebar: React.FC<EditorSidebarProps> = ({ onSaveAndClose }) => {
    const { 
        book, 
        saveStatus, 
        isAiEnabled, 
        handleAnalyzeCharacterVoice, 
        isAnalyzingCharacterVoice,
        handleAnalyzePlotHoles,
        isAnalyzingPlotHoles,
        handleAnalyzeLoreConsistency,
        isAnalyzingLore
    } = useBookEditor();

    if (!book) return null;

    const hasOutline = book.outline.length > 0;

    return (
        <div className="flex flex-col gap-5 pb-10">
            {!hasOutline && <ConfigurationPanel />}
            {hasOutline && (
                <>
                    <div className="space-y-4 mb-6">
                        <SaveStatusIndicator status={saveStatus} />
                        <ActionsPanel onSaveAndClose={onSaveAndClose} />
                    </div>
                    
                    {/* Secondary Tools Section */}
                    <div className="space-y-4">
                        <div className="flex items-center space-x-2 px-1 pb-2 border-b border-zinc-200 dark:border-zinc-700/50">
                            <Icon name="COMMAND" className="w-4 h-4 text-zinc-400" />
                            <h3 className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Project Tools</h3>
                        </div>
                        
                        <div className="grid gap-4">
                            {isAiEnabled && <AIAssistantPanel />}
                            
                            <FindReplacePanel />
                            
                            {isAiEnabled && (
                                <>
                                <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 overflow-hidden transition-all duration-200 hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-900/50">
                                    <button 
                                        onClick={handleAnalyzeCharacterVoice}
                                        disabled={isAnalyzingCharacterVoice}
                                        className="w-full flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-700/30 transition-colors group disabled:opacity-50"
                                    >
                                        <div className="flex items-center space-x-3">
                                            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform">
                                                <Icon name={isAnalyzingCharacterVoice ? "ROTATE_CW" : "USER"} className={`w-4 h-4 ${isAnalyzingCharacterVoice ? 'animate-spin' : ''}`} />
                                            </div>
                                            <span className="font-semibold text-zinc-800 dark:text-zinc-100 text-sm">
                                                {isAnalyzingCharacterVoice ? 'Analyzing...' : 'Check Character Voice'}
                                            </span>
                                        </div>
                                        <Icon name="CHEVRON_RIGHT" className="w-4 h-4 text-zinc-400 group-hover:text-indigo-500 transition-colors" />
                                    </button>
                                </div>

                                <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 overflow-hidden transition-all duration-200 hover:shadow-md hover:border-amber-200 dark:hover:border-amber-900/50">
                                    <button 
                                        onClick={handleAnalyzePlotHoles}
                                        disabled={isAnalyzingPlotHoles}
                                        className="w-full flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-700/30 transition-colors group disabled:opacity-50"
                                    >
                                        <div className="flex items-center space-x-3">
                                            <div className="p-2 bg-amber-50 dark:bg-amber-900/30 rounded-lg text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform">
                                                <Icon name={isAnalyzingPlotHoles ? "ROTATE_CW" : "ALERT_TRIANGLE"} className={`w-4 h-4 ${isAnalyzingPlotHoles ? 'animate-spin' : ''}`} />
                                            </div>
                                            <span className="font-semibold text-zinc-800 dark:text-zinc-100 text-sm">
                                                {isAnalyzingPlotHoles ? 'Analyzing...' : 'Detect Plot Holes'}
                                            </span>
                                        </div>
                                        <Icon name="CHEVRON_RIGHT" className="w-4 h-4 text-zinc-400 group-hover:text-amber-500 transition-colors" />
                                    </button>
                                </div>

                                <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 overflow-hidden transition-all duration-200 hover:shadow-md hover:border-teal-200 dark:hover:border-teal-900/50">
                                    <button 
                                        onClick={handleAnalyzeLoreConsistency}
                                        disabled={isAnalyzingLore}
                                        className="w-full flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-700/30 transition-colors group disabled:opacity-50"
                                    >
                                        <div className="flex items-center space-x-3">
                                            <div className="p-2 bg-teal-50 dark:bg-teal-900/30 rounded-lg text-teal-600 dark:text-teal-400 group-hover:scale-110 transition-transform">
                                                <Icon name={isAnalyzingLore ? "ROTATE_CW" : "BRAIN"} className={`w-4 h-4 ${isAnalyzingLore ? 'animate-spin' : ''}`} />
                                            </div>
                                            <span className="font-semibold text-zinc-800 dark:text-zinc-100 text-sm">
                                                {isAnalyzingLore ? 'Analyzing...' : 'Check Lore Consistency'}
                                            </span>
                                        </div>
                                        <Icon name="CHEVRON_RIGHT" className="w-4 h-4 text-zinc-400 group-hover:text-teal-500 transition-colors" />
                                    </button>
                                </div>
                                </>
                            )}

                            {isAiEnabled && <ImageSuggestionsPanel />}
                            <MetadataPanel />
                            {book.seriesId && <SeriesPanel />}
                            <KnowledgeBasePanel />
                            {isAiEnabled && <GenerationConfigPanel />}
                            {isAiEnabled && <ResearchPanel />}
                            {isAiEnabled && <MacrosPanel />}
                            {isAiEnabled && <AudiobookPanel />}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default EditorSidebar;
