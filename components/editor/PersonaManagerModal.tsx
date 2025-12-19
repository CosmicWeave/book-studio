
import React, { useState } from 'react';
import { useBookEditor } from '../../contexts/BookEditorContext';
import { ICONS } from '../../constants';
import Icon from '../Icon';
import { toastService } from '../../services/toastService';

interface PersonaManagerModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const PersonaManagerModal: React.FC<PersonaManagerModalProps> = ({ isOpen, onClose }) => {
    const { customPersonas, addCustomPersona, deleteCustomPersona } = useBookEditor();
    
    const [view, setView] = useState<'list' | 'add'>('list');
    const [newName, setNewName] = useState('');
    const [newDescription, setNewDescription] = useState('');
    const [newInstructions, setNewInstructions] = useState('');

    if (!isOpen) return null;

    const handleSave = async () => {
        if (!newName.trim() || !newInstructions.trim()) {
            toastService.error("Please provide a name and instructions.");
            return;
        }
        await addCustomPersona({
            name: newName.trim(),
            description: newDescription.trim(),
            instructions: newInstructions.trim()
        });
        resetForm();
        setView('list');
    };

    const handleDelete = async (id: string) => {
        await deleteCustomPersona(id);
    };

    const resetForm = () => {
        setNewName('');
        setNewDescription('');
        setNewInstructions('');
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[200] p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-2xl p-6 w-full max-w-lg flex flex-col border border-zinc-200 dark:border-zinc-700 max-h-[85vh]" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4 pb-4 border-b border-zinc-200 dark:border-zinc-700">
                    <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
                        <Icon name="USER" className="w-6 h-6 text-purple-500" />
                        Manage Custom Personas
                    </h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700" aria-label="Close">
                        <Icon name="CLOSE" className="w-6 h-6" />
                    </button>
                </div>

                {view === 'list' ? (
                    <div className="flex-grow overflow-y-auto pr-2">
                        {customPersonas.length === 0 ? (
                            <p className="text-center text-zinc-500 py-8">No custom personas created yet.</p>
                        ) : (
                            <div className="space-y-3">
                                {customPersonas.map(persona => (
                                    <div key={persona.id} className="p-4 bg-zinc-50 dark:bg-zinc-700/30 rounded-lg border border-zinc-200 dark:border-zinc-700 group relative">
                                        <div className="pr-8">
                                            <h3 className="font-bold text-zinc-800 dark:text-zinc-100">{persona.name}</h3>
                                            {persona.description && <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{persona.description}</p>}
                                            <p className="text-xs mt-2 italic text-zinc-600 dark:text-zinc-300 line-clamp-2">"{persona.instructions}"</p>
                                        </div>
                                        <button 
                                            onClick={() => handleDelete(persona.id)} 
                                            className="absolute top-2 right-2 p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                                            title="Delete Persona"
                                        >
                                            <Icon name="TRASH" className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex-grow overflow-y-auto pr-2 space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-1">Persona Name</label>
                            <input 
                                type="text" 
                                value={newName}
                                onChange={e => setNewName(e.target.value)}
                                className="w-full bg-white dark:bg-zinc-700 border border-zinc-300 dark:border-zinc-600 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 text-sm"
                                placeholder="e.g. Grumpy Historian"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-1">Short Description (Optional)</label>
                            <input 
                                type="text" 
                                value={newDescription}
                                onChange={e => setNewDescription(e.target.value)}
                                className="w-full bg-white dark:bg-zinc-700 border border-zinc-300 dark:border-zinc-600 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 text-sm"
                                placeholder="e.g. Focuses on historical accuracy"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-1">Instructions</label>
                            <textarea 
                                value={newInstructions}
                                onChange={e => setNewInstructions(e.target.value)}
                                rows={5}
                                className="w-full bg-white dark:bg-zinc-700 border border-zinc-300 dark:border-zinc-600 rounded-md shadow-sm focus:ring-purple-500 focus:border-purple-500 text-sm"
                                placeholder="Describe how the AI should behave. e.g., 'You are a grumpy historian. Correct any anachronisms rudely but accurately.'"
                            />
                        </div>
                    </div>
                )}

                <div className="mt-6 pt-4 border-t border-zinc-200 dark:border-zinc-700 flex justify-end gap-2">
                    {view === 'list' ? (
                        <button 
                            onClick={() => setView('add')} 
                            className="bg-purple-600 text-white px-4 py-2 rounded-lg shadow font-semibold hover:bg-purple-700 transition-colors flex items-center gap-2"
                        >
                            <Icon name="PLUS" className="w-4 h-4" />
                            Create New
                        </button>
                    ) : (
                        <>
                            <button onClick={() => setView('list')} className="px-4 py-2 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg transition-colors">
                                Cancel
                            </button>
                            <button onClick={handleSave} className="bg-green-600 text-white px-4 py-2 rounded-lg shadow font-semibold hover:bg-green-700 transition-colors">
                                Save Persona
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PersonaManagerModal;