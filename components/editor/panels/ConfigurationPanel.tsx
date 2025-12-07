
import React from 'react';
import { ICONS } from '../../../constants';
import { useBookEditor } from '../../../contexts/BookEditorContext';
import Icon from '../../Icon';

const ConfigurationPanel: React.FC = () => {
    const {
        book,
        handleInputChange,
        instructions,
        selectedInstruction,
        handleUpdateInstructions,
        handleSaveNewInstructionTemplate,
        handleUpdateInstructionTemplate,
        handleSuggestBookInstructionImprovement,
        isSuggestingInstructions,
        instructionSuggestion,
        setInstructionSuggestion,
        handleStartOutlineBrainstorm,
        isAiEnabled
    } = useBookEditor();

    if (!book) return null;

    const originalTemplate = instructions.find(i => i.prompt === selectedInstruction);
    const currentTextIsAnExistingTemplate = instructions.some(i => i.prompt === book.instructions);
    const showUpdateTemplateButton = originalTemplate && book.instructions !== selectedInstruction;
    const showSaveNewTemplateButton = book.instructions.trim() !== '' && !currentTextIsAnExistingTemplate;

    return (
        <div className="bg-white dark:bg-zinc-800 p-6 rounded-lg shadow-md border border-zinc-200 dark:border-zinc-700">
            <h2 className="text-xl font-bold mb-4">1. Configure Your Book</h2>
            <div className="space-y-4">
                <div>
                    <label htmlFor="topic" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Book Topic</label>
                    <input type="text" id="topic" name="topic" value={book.topic} onChange={handleInputChange} className="mt-1 block w-full bg-white dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"/>
                </div>
                <div>
                    <label htmlFor="language" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Language</label>
                    <select
                        id="language"
                        name="language"
                        value={book.language || 'en'}
                        onChange={handleInputChange}
                        className="mt-1 block w-full bg-white dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    >
                        <option value="en">English</option>
                        <option value="sv">Swedish</option>
                    </select>
                </div>
                <div>
                    <label htmlFor="instructions" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Writing Style & Instructions</label>
                    <select value={selectedInstruction} onChange={(e) => handleUpdateInstructions(e.target.value)} className="mt-1 block w-full bg-white dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500">
                        <option value="">-- Select or type custom --</option>
                        {instructions.map(i => <option key={i.id} value={i.prompt}>{i.name}</option>)}
                    </select>
                    <textarea name="instructions" value={book.instructions} onChange={(e) => handleUpdateInstructions(e.target.value)} rows={4} className="mt-2 block w-full bg-white dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500" placeholder="e.g., Write in a humorous tone for beginners..."/>
                    
                    <div className="mt-2 space-x-2 flex justify-end">
                        {showUpdateTemplateButton && originalTemplate && (
                            <button 
                                onClick={() => handleUpdateInstructionTemplate(originalTemplate)}
                                className="px-3 py-1 text-xs font-semibold rounded-md bg-amber-500 text-white hover:bg-amber-600 transition-colors animate-fade-in"
                                title={`Update the "${originalTemplate.name}" template`}
                            >
                                Update Template
                            </button>
                        )}
                        {showSaveNewTemplateButton && (
                            <button 
                                onClick={handleSaveNewInstructionTemplate}
                                className="px-3 py-1 text-xs font-semibold rounded-md bg-emerald-500 text-white hover:bg-emerald-600 transition-colors animate-fade-in"
                                title="Save current instructions as a new template"
                            >
                                Save as New Template
                            </button>
                        )}
                    </div>
                    
                    {isAiEnabled && (
                    <div className="mt-2 flex justify-end">
                        <button
                            onClick={handleSuggestBookInstructionImprovement}
                            disabled={isSuggestingInstructions || book.topic.trim() === '' || book.instructions.trim() === ''}
                            className="flex items-center space-x-2 text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            title={book.topic.trim() === '' ? "Please enter a book topic first" : book.instructions.trim() === '' ? "Please enter some instructions first" : "Get an AI-powered suggestion"}
                        >
                            <Icon name="WAND" className={`w-4 h-4 ${isSuggestingInstructions ? 'animate-spin' : ''}`} />
                            <span>{isSuggestingInstructions ? 'Generating...' : 'Suggest Improvement'}</span>
                        </button>
                    </div>
                    )}
                    {instructionSuggestion && (
                        <div className="mt-4 p-4 bg-indigo-50 dark:bg-zinc-700/50 border border-indigo-200 dark:border-zinc-600 rounded-lg animate-fade-in-up">
                            <h4 className="font-semibold text-zinc-800 dark:text-zinc-100 mb-2">Suggestion:</h4>
                            <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">{instructionSuggestion}</p>
                            <div className="mt-3 flex justify-end space-x-2">
                                <button onClick={() => setInstructionSuggestion(null)} className="px-3 py-1 text-xs font-semibold rounded-md bg-zinc-200 dark:bg-zinc-600 text-zinc-800 dark:text-white hover:bg-zinc-300 dark:hover:bg-zinc-500">
                                    Dismiss
                                </button>
                                <button onClick={() => { if (book) { handleUpdateInstructions(instructionSuggestion); setInstructionSuggestion(null); } }} className="px-3 py-1 text-xs font-semibold rounded-md bg-indigo-600 text-white hover:bg-indigo-700">
                                    Use this suggestion
                                </button>
                            </div>
                        </div>
                    )}
                </div>
                <div>
                    <label htmlFor="wordCountGoal" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Approximate Word Count <span className="text-zinc-400 font-normal">(Optional)</span></label>
                    <input type="number" id="wordCountGoal" name="wordCountGoal" value={book.wordCountGoal || ''} onChange={handleInputChange} step="1000" className="mt-1 block w-full bg-white dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500" placeholder="e.g., 50000"/>
                </div>
                
                {isAiEnabled && (
                <>
                <div className="flex items-center">
                    <input id="generateImages" name="generateImages" type="checkbox" checked={book.generateImages} onChange={handleInputChange} className="h-4 w-4 text-indigo-600 border-zinc-300 rounded focus:ring-indigo-500"/>
                    <label htmlFor="generateImages" className="ml-3 block text-sm text-zinc-900 dark:text-zinc-200">Generate images for chapters</label>
                </div>
                {book.generateImages && (
                    <div className="animate-fade-in space-y-1">
                        <label htmlFor="imageGenerationInstructions" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Image Generation Instructions</label>
                        <textarea 
                            id="imageGenerationInstructions"
                            name="imageGenerationInstructions" 
                            value={book.imageGenerationInstructions} 
                            onChange={handleInputChange} 
                            rows={4} 
                            className="mt-1 block w-full bg-white dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500" 
                            placeholder="e.g., A minimalist line drawing, in the style of a vintage storybook..."
                        />
                    </div>
                )}
                <button onClick={handleStartOutlineBrainstorm} className="w-full flex justify-center items-center space-x-2 bg-indigo-600 text-white px-4 py-3 rounded-lg shadow-md font-semibold hover:bg-indigo-700 transition-colors">
                    <Icon name="WAND" />
                    <span>Brainstorm Outline...</span>
                </button>
                </>
                )}
            </div>
        </div>
    );
};

export default ConfigurationPanel;