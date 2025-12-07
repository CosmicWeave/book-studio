import React, { useState, useEffect, useCallback } from 'react';
import { Macro, MacroAction } from '../types';
import { db } from '../services/db';
import { AVAILABLE_MACRO_ACTIONS, ICONS } from '../constants';
import { toastService } from '../services/toastService';
import { modalService } from '../services/modalService';
import Icon from '../components/Icon';

const MacrosManager: React.FC = () => {
    const [macros, setMacros] = useState<Macro[]>([]);
    const [editingMacro, setEditingMacro] = useState<Macro | null>(null);
    const [isCreating, setIsCreating] = useState(false);

    const fetchMacros = useCallback(async () => {
        const data = await db.macros.getAll();
        setMacros(data);
    }, []);

    useEffect(() => {
        fetchMacros();
    }, [fetchMacros]);

    const handleEdit = (macro: Macro) => {
        setEditingMacro({ ...macro });
        setIsCreating(false);
    };

    const handleCreateNew = () => {
        setEditingMacro({
            id: crypto.randomUUID(),
            name: '',
            actions: []
        });
        setIsCreating(true);
    };

    const handleCancel = () => {
        setEditingMacro(null);
        setIsCreating(false);
    };

    const handleDelete = async (id: string) => {
        const confirmed = await modalService.confirm({
            title: 'Delete Macro?',
            message: 'Are you sure you want to delete this workflow macro?',
            danger: true,
            confirmText: 'Delete'
        });
        if (confirmed) {
            await db.macros.delete(id);
            fetchMacros();
        }
    };
    
    const handleSave = async () => {
        if (editingMacro && editingMacro.name) {
            await db.macros.put(editingMacro);
            fetchMacros();
            setEditingMacro(null);
            setIsCreating(false);
        } else {
            toastService.error("Please provide a name for the macro.");
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (editingMacro) {
            setEditingMacro({ ...editingMacro, name: e.target.value });
        }
    };
    
    const handleAddAction = (actionTemplate: Omit<MacroAction, 'id'>) => {
        if (!editingMacro) return;
        const newAction: MacroAction = {
            ...actionTemplate,
            id: crypto.randomUUID(),
        };
        setEditingMacro({ ...editingMacro, actions: [...editingMacro.actions, newAction] });
    };

    const handleRemoveAction = (actionId: string) => {
        if (!editingMacro) return;
        setEditingMacro({ ...editingMacro, actions: editingMacro.actions.filter(a => a.id !== actionId) });
    };

    const handleMoveAction = (index: number, direction: 'up' | 'down') => {
        if (!editingMacro) return;
        const newActions = [...editingMacro.actions];
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= newActions.length) return;
        [newActions[index], newActions[newIndex]] = [newActions[newIndex], newActions[index]];
        setEditingMacro({ ...editingMacro, actions: newActions });
    };

    const handleActionParamChange = (actionId: string, paramName: string, value: string) => {
        if (!editingMacro) return;
        const newActions = editingMacro.actions.map(action => {
            if (action.id === actionId) {
                return { ...action, params: { ...action.params, [paramName]: value } };
            }
            return action;
        });
        setEditingMacro({ ...editingMacro, actions: newActions });
    };

    const renderMacroEditor = () => {
        if (!editingMacro) return null;
        return (
            <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 animate-fade-in col-span-2">
                <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-gray-100">{isCreating ? 'Create New Macro' : 'Edit Macro'}</h2>
                <div className="space-y-6">
                    <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Macro Name</label>
                        <input type="text" name="name" value={editingMacro.name} onChange={handleInputChange} className="mt-1 block w-full bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"/>
                    </div>
                    <div>
                        <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-2">Actions</h3>
                        <div className="space-y-3 p-3 border border-dashed border-gray-300 dark:border-gray-600 rounded-md min-h-[10rem]">
                            {editingMacro.actions.map((action, index) => (
                                <div key={action.id} className="p-3 bg-gray-100 dark:bg-gray-700 rounded-md flex items-start gap-2 group">
                                    <div className="flex-grow">
                                        <p className="font-semibold text-gray-800 dark:text-gray-200">{action.name}</p>
                                        {action.params && action.type === 'rewrite_with_prompt' && (
                                            <textarea
                                                value={action.params.prompt || ''}
                                                onChange={(e) => handleActionParamChange(action.id, 'prompt', e.target.value)}
                                                placeholder="Enter rewrite prompt..."
                                                rows={2}
                                                className="mt-2 block w-full bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                                            />
                                        )}
                                    </div>
                                    <div className="flex flex-col items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => handleMoveAction(index, 'up')} disabled={index === 0} className="p-1 rounded-full text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-30">↑</button>
                                        <button onClick={() => handleMoveAction(index, 'down')} disabled={index === editingMacro.actions.length - 1} className="p-1 rounded-full text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-30">↓</button>
                                    </div>
                                    <button onClick={() => handleRemoveAction(action.id)} className="p-1 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-100 dark:hover:bg-gray-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Icon name="TRASH" className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                            {editingMacro.actions.length === 0 && (
                                <p className="text-center text-gray-500 dark:text-gray-400 py-4">Add actions from the list on the right.</p>
                            )}
                        </div>
                    </div>
                </div>
                <div className="mt-8 flex justify-end space-x-3">
                    <button onClick={handleCancel} className="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 px-4 py-2 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors">Cancel</button>
                    <button onClick={handleSave} className="bg-green-600 text-white px-6 py-2 rounded-lg shadow font-semibold hover:bg-green-700 transition-colors">Save Macro</button>
                </div>
            </div>
        );
    };

    return (
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white">Workflow Macros</h1>
                {!editingMacro && (
                    <button
                        onClick={handleCreateNew}
                        className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-indigo-600 text-white px-5 py-2.5 rounded-lg shadow-md hover:bg-indigo-700 transition-all duration-200 transform hover:scale-105"
                    >
                         <Icon name="PLUS" className="w-5 h-5" />
                        <span className="font-semibold">Create New Macro</span>
                    </button>
                )}
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {editingMacro ? (
                    <>
                        {renderMacroEditor()}
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
                            <h3 className="text-xl font-bold mb-4">Available Actions</h3>
                            <div className="space-y-2">
                                {AVAILABLE_MACRO_ACTIONS.map(action => (
                                    <button
                                        key={action.type}
                                        onClick={() => handleAddAction(action)}
                                        className="w-full flex items-center space-x-2 text-left p-3 rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
                                    >
                                        <Icon name="PLUS" className="w-4 h-4"/>
                                        <span>{action.name}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="lg:col-span-3">
                        {macros.length > 0 ? (
                            <div className="space-y-4">
                                {macros.map(macro => (
                                    <div key={macro.id} className="bg-white dark:bg-gray-800 p-5 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 flex justify-between items-start">
                                        <div className="flex-1">
                                            <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">{macro.name}</h3>
                                            <ol className="list-decimal list-inside mt-2 text-sm text-gray-600 dark:text-gray-400 space-y-1">
                                                {macro.actions.map(action => <li key={action.id}>{action.name}</li>)}
                                            </ol>
                                        </div>
                                        <div className="flex items-center space-x-1 flex-shrink-0 ml-4">
                                            <button onClick={() => handleEdit(macro)} className="p-2 rounded-full text-gray-400 hover:text-indigo-500 hover:bg-indigo-100 dark:hover:bg-gray-700 transition-colors">
                                                <Icon name="EDIT" className="w-5 h-5" />
                                            </button>
                                            <button onClick={() => handleDelete(macro.id)} className="p-2 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-100 dark:hover:bg-gray-700 transition-colors">
                                                <Icon name="TRASH" className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                             <div className="text-center py-20 bg-white dark:bg-zinc-800 rounded-lg shadow-sm border border-zinc-200 dark:border-zinc-700 empty-state-bg">
                                <Icon name="WORKFLOW" className="w-20 h-20 mx-auto text-zinc-300 dark:text-zinc-600" />
                                <h2 className="mt-4 text-2xl font-semibold text-zinc-800 dark:text-zinc-100">No Macros Created</h2>
                                <p className="mt-2 text-zinc-500 dark:text-zinc-400">Click "Create New Macro" to build a reusable workflow.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MacrosManager;
