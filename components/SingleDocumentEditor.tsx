
import React, { useEffect, useRef, useMemo, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import BubbleMenu from '@tiptap/extension-bubble-menu';
import FloatingMenu from '@tiptap/extension-floating-menu';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Link from '@tiptap/extension-link';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Toolbar from './Toolbar';
import TableBubbleMenu from './editor/TableBubbleMenu';

interface SingleDocumentEditorProps {
    content: string;
    onUpdate: (newHtml: string) => void;
}

const SingleDocumentEditor: React.FC<SingleDocumentEditorProps> = ({ content, onUpdate }) => {
    const [viewMode, setViewMode] = useState<'visual' | 'markdown' | 'html'>('visual');
    
    const extensions = useMemo(() => [
        StarterKit.configure({
            heading: {
                levels: [1, 2, 3, 4, 5, 6],
            },
        }),
        Image.configure({
            inline: false,
            allowBase64: true,
        }),
        Underline,
        Subscript,
        Superscript,
        TextAlign.configure({
            types: ['heading', 'paragraph'],
        }),
        (Table as any).configure({
            resizable: true,
        }),
        TableRow,
        TableHeader,
        TableCell,
        TaskList,
        TaskItem.configure({
            nested: true,
        }),
        Link.configure({
            openOnClick: false,
            autolink: true,
        }),
        TextStyle,
        Color,
        Highlight.configure({ multicolor: true }),
        BubbleMenu,
        FloatingMenu,
    ], []);

    const editorProps = useMemo(() => ({
        attributes: {
            class: `prose-base dark:prose-invert max-w-none tiptap outline-none min-h-[200px] focus:outline-none`,
        },
    }), []);

    const editor = useEditor({
        extensions,
        content: content,
        onUpdate: ({ editor }) => {
            const html = editor.getHTML();
            onUpdate(html);
        },
        editorProps,
    }, [extensions]);
    
    // Update editor content if prop changes from outside (e.g. restore)
    useEffect(() => {
        if (editor && content && content !== editor.getHTML()) {
             // Check to avoid cursor jump if typing
             if (!editor.isFocused) {
                 editor.commands.setContent(content);
             }
        }
    }, [content, editor]);

    return (
        <div className="flex flex-col h-full">
            <div className="sticky top-0 z-40 bg-white dark:bg-zinc-900 px-4 py-2 border-b border-zinc-200 dark:border-zinc-800">
                 <Toolbar 
                    editor={editor} 
                    viewMode={viewMode} 
                    onViewChange={setViewMode} 
                />
            </div>

            <div className="flex-1 bg-zinc-100 dark:bg-zinc-900 overflow-y-auto p-4 sm:p-8 flex justify-center">
                <div className="bg-white dark:bg-zinc-800 w-full max-w-[816px] min-h-[1056px] shadow-lg p-8 sm:p-12 rounded-sm">
                    {editor && (
                        <>
                            <TableBubbleMenu editor={editor} />
                            <EditorContent editor={editor} />
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SingleDocumentEditor;
