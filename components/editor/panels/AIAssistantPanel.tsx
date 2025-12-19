
import React, { useState } from 'react';
import { useBookEditor } from '../../../contexts/BookEditorContext';
import Icon from '../../Icon';
import PersonaManagerModal from '../PersonaManagerModal';
import { PERSONA_INSTRUCTIONS } from '../../../services/gemini';

const DEFAULT_PERSONAS = Object.keys(PERSONA_INSTRUCTIONS);

const AIAssistantPanel: React.FC = () => {
    const { 
        book, 
        handleUpdatePersona, 
        isAutocompleteEnabled, 
        toggleAutocomplete,
        customPersonas 
    } = useBookEditor();
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [isPersonaManagerOpen, setIsPersonaManagerOpen] = useState(false);

    if (!book) return null;

    return (
        <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 overflow-hidden transition-all duration-200 hover:shadow-md hover:border-purple-200 dark:hover:border-purple-900/50 group">
            <button 
                onClick={() => setIsPanelOpen(!isPanelOpen)} 
                className="w-full flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-700/30 transition-colors"
            >
                <div className="flex items-center space-x-3">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform">
                        <Icon name="SPARKLES" className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                        <span className="block font-semibold text-zinc-800 dark:text-zinc-100 text-sm">AI Assistant</span>
                        <span className="block text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{book.aiPersona || 'Standard'}</span>
                    </div>
                </div>
                <Icon name="CHEVRON_LEFT" className={`w-4 h-4 text-zinc-400 transform transition-transform duration-300 ${isPanelOpen ? '-rotate-90' : 'rotate-0'}`} />
            </button>
            
            {isPanelOpen && (
                <div className="p-4 pt-0 space-y-4 border-t border-zinc-100 dark:border-zinc-700/50 animate-slide-in-down bg-zinc-50/50 dark:bg-zinc-900/30">
                    
                    <div className="mt-4">
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">AI Persona</label>
                            <button 
                                onClick={() => setIsPersonaManagerOpen(true)}
                                className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
                            >
                                <Icon name="SETTINGS" className="w-3 h-3" />
                                Manage
                            </button>
                        </div>
                        <select
                            value={book.aiPersona || 'Standard Co-Author'}
                            onChange={(e) => handleUpdatePersona(e.target.value)}
                            className="w-full text-sm bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded-lg p-2 focus:ring-purple-500 focus:border-purple-500"
                        >
                            <optgroup label="Standard Personas">
                                {DEFAULT_PERSONAS.map(p => (
                                    <option key={p} value={p}>{p}</option>
                                ))}
                            </optgroup>
                            {customPersonas.length > 0 && (
                                <optgroup label="Custom Personas">
                                    {customPersonas.map(p => (
                                        <option key={p.id} value={p.name}>{p.name}</option>
                                    ))}
                                </optgroup>
                            )}
                        </select>
                        <p className="text-xs text-zinc-500 mt-1">Changes the tone of chat and analysis.</p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-zinc-200 dark:border-zinc-700">
                        <div>
                            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200 block">Ghost Text Autocomplete</span>
                            <span className="text-xs text-zinc-500 dark:text-zinc-400">Suggest text as you type</span>
                        </div>
                        <button 
                            onClick={toggleAutocomplete}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${isAutocompleteEnabled ? 'bg-purple-600' : 'bg-zinc-200 dark:bg-zinc-700'}`}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isAutocompleteEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                    </div>
                </div>
            )}
            
            <PersonaManagerModal isOpen={isPersonaManagerOpen} onClose={() => setIsPersonaManagerOpen(false)} />
        </div>
    );
};

export default AIAssistantPanel;