
import React, { useState, useEffect, useCallback, useContext } from 'react';
import { InstructionTemplate } from '../types';
import { db } from '../services/db';
import { improveInstructionPrompt } from '../services/gemini';
import { ICONS } from '../constants';
import { toastService } from '../services/toastService';
import { modalService } from '../services/modalService';
import Icon from '../components/Icon';
import { AppContext } from '../contexts/AppContext';

const InstructionsManager: React.FC = () => {
    const [instructions, setInstructions] = useState<InstructionTemplate[]>([]);
    const [editingInstruction, setEditingInstruction] = useState<InstructionTemplate | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [isSuggesting, setIsSuggesting] = useState(false);
    const [suggestion, setSuggestion] = useState<string | null>(null);
    const { isAiEnabled } = useContext(AppContext);


    const fetchInstructions = useCallback(async () => {
        const data = await db.instructions.getAll();
        setInstructions(data);
    }, []);

    useEffect(() => {
        fetchInstructions();
    }, [fetchInstructions]);

    const handleEdit = (instruction: InstructionTemplate) => {
        setEditingInstruction({ ...instruction });
        setIsCreating(false);
        setSuggestion(null);
    };

    const handleCreateNew = () => {
        setEditingInstruction({
            id: crypto.randomUUID(),
            name: '',
            prompt: ''
        });
        setIsCreating(true);
        setSuggestion(null);
    };

    const handleCancel = () => {
        setEditingInstruction(null);
        setIsCreating(false);
        setSuggestion(null);
    };

    const handleDelete = async (id: string) => {
        const confirmed = await modalService.confirm({
            title: 'Delete Template?',
            message: 'Are you sure you want to delete this instruction template?',
            danger: true,
            confirmText: 'Delete'
        });
        if (confirmed) {
            await db.instructions.delete(id);
            fetchInstructions();
        }
    };
    
    const handleSave = async () => {
        if (editingInstruction && editingInstruction.name && editingInstruction.prompt) {
            await db.instructions.put(editingInstruction);
            fetchInstructions();
            setEditingInstruction(null);
            setIsCreating(false);
            setSuggestion(null);
        } else {
            toastService.error("Please fill in both name and prompt.");
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (editingInstruction) {
            setEditingInstruction({
                ...editingInstruction,
                [e.target.name]: e.target.value
            });
        }
    };

    const handleSuggestImprovement = async () => {
        if (!editingInstruction || !editingInstruction.prompt.trim() || !editingInstruction.name.trim()) {
            return;
        }
        setIsSuggesting(true);
        setSuggestion(null);
        try {
            const improvedPrompt = await improveInstructionPrompt(editingInstruction.prompt, editingInstruction.name);
            setSuggestion(improvedPrompt);
        } catch (error) {
            console.error(error);
            toastService.error("Could not generate a suggestion. Please try again.");
        } finally {
            setIsSuggesting(false);
        }
    };

    const handleUseSuggestion = () => {
        if (editingInstruction && suggestion) {
            setEditingInstruction({
                ...editingInstruction,
                prompt: suggestion,
            });
            setSuggestion(null);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white">Instruction Templates</h1>
                {!editingInstruction && (
                    <button
                        onClick={handleCreateNew}
                        className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-indigo-600 text-white px-5 py-2.5 rounded-lg shadow-md hover:bg-indigo-700 transition-all duration-200 transform hover:scale-105"
                    >
                         <Icon name="PLUS" className="w-5 h-5" />
                        <span className="font-semibold">Create New</span>
                    </button>
                )}
            </div>
            
            {editingInstruction ? (
                <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 animate-fade-in">
                    <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-gray-100">{isCreating ? 'Create New Template' : 'Edit Template'}</h2>
                    <div className="space-y-6">
                        <div>
                            <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Template Name</label>
                            <input type="text" name="name" value={editingInstruction.name} onChange={handleInputChange} className="mt-1 block w-full bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"/>
                        </div>
                        <div>
                            <label htmlFor="prompt" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Instruction Prompt</label>
                            <textarea name="prompt" rows={5} value={editingInstruction.prompt} onChange={handleInputChange} className="mt-1 block w-full bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"/>
                            {isAiEnabled && (
                            <div className="mt-2 flex justify-end">
                                <button
                                    onClick={handleSuggestImprovement}
                                    disabled={isSuggesting || !editingInstruction.prompt.trim() || !editingInstruction.name.trim()}
                                    className="flex items-center space-x-2 text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    title={!editingInstruction.name.trim() ? "Please enter a template name first" : "Get an AI-powered suggestion"}
                                >
                                    <Icon name="WAND" className={`w-4 h-4 ${isSuggesting ? 'animate-spin' : ''}`} />
                                    <span>{isSuggesting ? 'Generating...' : 'Suggest Improvement'}</span>
                                </button>
                            </div>
                            )}
                        </div>

                        {suggestion && (
                            <div className="p-4 bg-indigo-50 dark:bg-gray-700/50 border border-indigo-200 dark:border-gray-600 rounded-lg animate-fade-in">
                                <h4 className="font-semibold text-gray-800 dark:text-gray-100 mb-2">Suggestion:</h4>
                                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{suggestion}</p>
                                <div className="mt-3 flex justify-end space-x-2">
                                     <button
                                        onClick={() => setSuggestion(null)}
                                        className="px-3 py-1 text-xs font-semibold rounded-md bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-500"
                                    >
                                        Dismiss
                                    </button>
                                    <button
                                        onClick={handleUseSuggestion}
                                        className="px-3 py-1 text-xs font-semibold rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
                                    >
                                        Use this suggestion
                                    </button>
                                </div>
                            </div>
                        )}

                    </div>
                    <div className="mt-8 flex justify-end space-x-3">
                        <button onClick={handleCancel} className="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 px-4 py-2 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors">Cancel</button>
                        <button onClick={handleSave} className="bg-green-600 text-white px-6 py-2 rounded-lg shadow font-semibold hover:bg-green-700 transition-colors">Save Template</button>
                    </div>
                </div>
            ) : (
                <>
                    {instructions.length > 0 ? (
                        <div className="space-y-4">
                            {instructions.map(instr => (
                                <div key={instr.id} className="bg-white dark:bg-gray-800 p-5 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 flex justify-between items-start">
                                   <div className="flex-1">
                                        <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">{instr.name}</h3>
                                        <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm">{instr.prompt}</p>
                                   </div>
                                   <div className="flex items-center space-x-1 flex-shrink-0 ml-4">
                                        <button onClick={() => handleEdit(instr)} className="p-2 rounded-full text-gray-400 hover:text-indigo-500 hover:bg-indigo-100 dark:hover:bg-gray-700 transition-colors">
                                            <Icon name="EDIT" className="w-5 h-5" />
                                        </button>
                                        <button onClick={() => handleDelete(instr.id)} className="p-2 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-100 dark:hover:bg-gray-700 transition-colors">
                                            <Icon name="TRASH" className="w-5 h-5" />
                                        </button>
                                   </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-20 bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-700 empty-state-bg">
                            <Icon name="EDIT" className="w-20 h-20 mx-auto text-zinc-300 dark:text-zinc-600" />
                            <h2 className="mt-4 text-2xl font-semibold text-zinc-800 dark:text-zinc-100">No Instruction Templates</h2>
                            <p className="mt-2 text-zinc-500 dark:text-zinc-400">Click "Create New" to save a reusable writing style.</p>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default InstructionsManager;
