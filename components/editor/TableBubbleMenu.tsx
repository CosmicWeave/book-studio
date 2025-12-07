
import React from 'react';
import * as TiptapReact from '@tiptap/react';
import { Editor } from '@tiptap/core';
import Icon from '../Icon';

// Safe import for BubbleMenu which sometimes has export issues in certain environments
const BubbleMenu = (TiptapReact as any).BubbleMenu;

interface TableBubbleMenuProps {
    editor: Editor;
}

const TableBubbleMenu: React.FC<TableBubbleMenuProps> = ({ editor }) => {
    if (!editor) return null;

    const shouldShow = ({ editor }: { editor: Editor }) => {
        return editor.isActive('table');
    };

    const buttonClass = "p-1.5 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded transition-colors";
    const deleteButtonClass = "p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors";

    return (
        <BubbleMenu 
            editor={editor} 
            tippyOptions={{ duration: 100, placement: 'top', maxWidth: 500 }} 
            shouldShow={shouldShow}
            className="flex items-center gap-1 bg-white dark:bg-zinc-800 p-1 rounded-lg shadow-xl border border-zinc-200 dark:border-zinc-700"
        >
            {/* Row Controls */}
            <div className="flex items-center p-1 border-r border-zinc-200 dark:border-zinc-700 gap-1">
                 <button onClick={() => editor.chain().focus().addRowBefore().run()} className={buttonClass} title="Add Row Before">
                    <Icon name="ROW_PLUS" className="w-4 h-4 rotate-180" />
                 </button>
                 <button onClick={() => editor.chain().focus().addRowAfter().run()} className={buttonClass} title="Add Row After">
                    <Icon name="ROW_PLUS" className="w-4 h-4" />
                 </button>
                 <button onClick={() => editor.chain().focus().deleteRow().run()} className={deleteButtonClass} title="Delete Row">
                    <Icon name="DELETE_ROW" className="w-4 h-4" />
                 </button>
            </div>

            {/* Column Controls */}
            <div className="flex items-center p-1 border-r border-zinc-200 dark:border-zinc-700 gap-1">
                 <button onClick={() => editor.chain().focus().addColumnBefore().run()} className={buttonClass} title="Add Col Before">
                    <Icon name="COL_PLUS" className="w-4 h-4 rotate-180" />
                 </button>
                 <button onClick={() => editor.chain().focus().addColumnAfter().run()} className={buttonClass} title="Add Col After">
                    <Icon name="COL_PLUS" className="w-4 h-4" />
                 </button>
                 <button onClick={() => editor.chain().focus().deleteColumn().run()} className={deleteButtonClass} title="Delete Column">
                    <Icon name="DELETE_COL" className="w-4 h-4" />
                 </button>
            </div>

            {/* Cell Controls */}
             <div className="flex items-center p-1 gap-1">
                 <button onClick={() => editor.chain().focus().mergeCells().run()} className={buttonClass} title="Merge Cells">
                    <Icon name="MERGE" className="w-4 h-4" />
                 </button>
                 <button onClick={() => editor.chain().focus().splitCell().run()} className={buttonClass} title="Split Cell">
                    <Icon name="MERGE" className="w-4 h-4 rotate-90" />
                 </button>
                 <div className="w-px h-4 bg-zinc-200 dark:bg-zinc-700 mx-1" />
                 <button onClick={() => editor.chain().focus().deleteTable().run()} className={deleteButtonClass} title="Delete Table">
                    <Icon name="TRASH" className="w-4 h-4" />
                 </button>
            </div>
        </BubbleMenu>
    );
};

export default TableBubbleMenu;