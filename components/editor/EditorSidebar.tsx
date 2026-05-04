
import React, { useMemo, useState } from 'react';
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

type SidebarTab = 'write' | 'research' | 'ai-tools' | 'media' | 'settings';

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
    const [activeTab, setActiveTab] = useState<SidebarTab>('write');

    if (!book) return null;

    const hasOutline = book.outline.length > 0;

    const tabs = useMemo(
        () => [
            { id: 'write' as const, label: 'Write', icon: 'EDIT' as const },
            { id: 'research' as const, label: 'Research', icon: 'BRAIN' as const },
            { id: 'ai-tools' as const, label: 'AI Tools', icon: 'SPARKLES' as const },
            { id: 'media' as const, label: 'Media', icon: 'IMAGE' as const },
            { id: 'settings' as const, label: 'Settings', icon: 'SETTINGS' as const },
        ],
        [],
    );

    const renderTabContent = () => {
        if (!hasOutline) {
            return <ConfigurationPanel />;
        }

        switch (activeTab) {
            case 'write':
                return (
                    <>
                        <SaveStatusIndicator status={saveStatus} />
                        <ActionsPanel onSaveAndClose={onSaveAndClose} />
                        <FindReplacePanel />
                        {isAiEnabled && <GenerationConfigPanel />}
                    </>
                );
            case 'research':
                return (
                    <>
                        <KnowledgeBasePanel />
                        {isAiEnabled && <ResearchPanel />}
                    </>
                );
            case 'ai-tools':
                return (
                    <>
                        {isAiEnabled && <AIAssistantPanel />}

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

                                <ImageSuggestionsPanel />
                                <MacrosPanel />
                            </>
                        )}
                    </>
                );
            case 'media':
                return (
                    <>
                        {isAiEnabled && <AudiobookPanel />}
                        <ImageSuggestionsPanel />
                    </>
                );
            case 'settings':
                return (
                    <>
                        <MetadataPanel />
                        {book.seriesId && <SeriesPanel />}
                    </>
                );
            default:
                return null;
        }
    };

    return (
        <div className="flex flex-col gap-5 pb-10">
            {hasOutline && (
                <div className="flex items-center gap-1 rounded-xl border border-zinc-200 bg-white/80 p-1 dark:border-zinc-700 dark:bg-zinc-800/60">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs font-semibold transition-colors ${
                                activeTab === tab.id
                                    ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
                                    : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700/60'
                            }`}
                            title={tab.label}
                        >
                            <Icon name={tab.icon} className="h-3.5 w-3.5" />
                            <span className="hidden xl:inline">{tab.label}</span>
                        </button>
                    ))}
                </div>
            )}

            <div className="grid gap-4">{renderTabContent()}</div>
        </div>
    );
};

export default EditorSidebar;
