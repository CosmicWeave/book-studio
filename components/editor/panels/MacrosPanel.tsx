import React from 'react';
import { useBookEditor } from '../../../contexts/BookEditorContext';
import Icon from '../../Icon';

const MacrosPanel: React.FC = () => {
    const { book, macros, handleRunMacro } = useBookEditor();

    if (!book || macros.length === 0) {
        return null;
    }

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-bold mb-4">Run Workflow Macro</h2>
            <div className="space-y-2">
                {macros.map(macro => (
                    <button
                        key={macro.id}
                        onClick={() => handleRunMacro(macro.id)}
                        className="w-full flex items-center justify-between text-left p-3 rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                        <span className="font-semibold">{macro.name}</span>
                        <Icon name="PLAY" className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                    </button>
                ))}
            </div>
        </div>
    );
};

export default MacrosPanel;