
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
import { ChapterContent } from '../types';
import Toolbar from './Toolbar';
import AIAssistantToolbar from './editor/AIAssistantToolbar';
import SuggestionButton from './editor/SuggestionButton';
import TableBubbleMenu from './editor/TableBubbleMenu';
import { useBookEditor } from '../contexts/BookEditorContext';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import { marked } from 'marked';
import Icon from './Icon';

interface ChapterEditorProps {
    chapter: ChapterContent;
    chapterIndex: number;
    onUpdate: (newHtml: string) => void;
    onEditImage: (imageData: { chapterIndex: number, src: string, alt: string }) => void;
    isGenerating: boolean;
}

const ChapterEditor: React.FC<ChapterEditorProps> = ({ chapter, chapterIndex, onUpdate, onEditImage, isGenerating }) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const { setActiveEditorInstance, registerEditor, unregisterEditor, activeEditorInstance } = useBookEditor();
    
    const [viewMode, setViewMode] = useState<'visual' | 'markdown' | 'html'>('visual');
    const [textContent, setTextContent] = useState(''); 
    const isUpdatingFromEditor = useRef(false);
    
    const turndownService = useMemo(() => {
        const service = new TurndownService({ 
            headingStyle: 'atx', 
            codeBlockStyle: 'fenced',
            emDelimiter: '*',
        });
        service.use(gfm);
        // Keep HTML for complex elements to prevent data loss (e.g., merged table cells, image dimensions)
        service.keep(['table', 'tbody', 'tr', 'td', 'th', 'thead', 'tfoot', 'span', 'div', 'iframe', 'sub', 'sup', 'u', 'img', 'video', 'audio']);
        return service;
    }, []);

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
            openOnClick: false, // Editing mode
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
            class: `prose-base dark:prose-invert max-w-none tiptap outline-none min-h-[200px]`,
        },
    }), []);

    const editor = useEditor({
        extensions,
        content: chapter.htmlContent,
        onUpdate: ({ editor }) => {
            if (viewMode === 'visual') {
                isUpdatingFromEditor.current = true;
                const html = editor.getHTML();
                onUpdate(html);
            }
        },
        onFocus: ({ editor }) => {
            setActiveEditorInstance(editor);
        },
        onSelectionUpdate: ({ editor }) => {
             setActiveEditorInstance(editor);
        },
        editorProps,
    }, [extensions, editorProps]);

    // Register/unregister the editor instance with the context
    useEffect(() => {
        if (editor && !editor.isDestroyed) {
            registerEditor(chapterIndex, editor);
            return () => unregisterEditor(chapterIndex);
        }
    }, [editor, chapterIndex, registerEditor, unregisterEditor]);

    // Apply/remove the 'is-ai-writing' class for visual feedback
    useEffect(() => {
        if (editor && !editor.isDestroyed) {
            const baseClass = 'prose-base dark:prose-invert max-w-none tiptap outline-none min-h-[200px]';
            // Cast to any to avoid TS error about 'class' property not existing on union type
            const currentClass = (editor.options.editorProps.attributes as any)?.class;
            const targetClass = isGenerating ? `${baseClass} is-ai-writing` : baseClass;
            
            if (currentClass !== targetClass) {
                editor.setOptions({
                    editorProps: {
                        attributes: {
                            class: targetClass,
                        },
                    },
                });
            }
        }
    }, [isGenerating, editor]);


    useEffect(() => {
        if (!editor || editor.isDestroyed) {
            return;
        }

        if (viewMode === 'visual') {
            if (isUpdatingFromEditor.current) {
                isUpdatingFromEditor.current = false;
                return;
            }

            const currentContent = editor.getHTML();
            const newContent = chapter.htmlContent;

            if (currentContent === newContent) {
                return;
            }
            
            if (!isGenerating) {
                // Only update if content is different to avoid cursor jumping
                // But check if we need to preserve selection
                const { from, to } = editor.state.selection;
                editor.commands.setContent(newContent, { emitUpdate: false });
                editor.commands.setTextSelection({ from, to });
            }
        }
    }, [chapter.htmlContent, editor, isGenerating, viewMode]);
    
    useEffect(() => {
        const editorElement = editorRef.current;
        if (!editorElement || !editor) return;

        const handleClick = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (target.tagName === 'IMG') {
                const imgElement = target as HTMLImageElement;
                onEditImage({
                    chapterIndex,
                    src: imgElement.src,
                    alt: imgElement.alt,
                });
            }
        };

        const proseMirrorElement = editorElement.querySelector('.ProseMirror');
        proseMirrorElement?.addEventListener('click', handleClick);

        return () => {
            proseMirrorElement?.removeEventListener('click', handleClick);
        };
    }, [editor, chapterIndex, onEditImage]);

    const handleViewChange = async (mode: 'visual' | 'markdown' | 'html') => {
        if (mode === viewMode) return;

        let html = '';
        
        if (viewMode === 'visual') {
            html = editor?.getHTML() || '';
        } else if (viewMode === 'markdown') {
            // Convert current markdown text back to HTML
            html = await marked.parse(textContent);
        } else { 
            // HTML mode
            html = textContent;
        }

        if (mode === 'visual') {
            // Set HTML to editor
            editor?.commands.setContent(html, { emitUpdate: true });
            // Trigger update to save to state/DB
            onUpdate(html);
        } else if (mode === 'markdown') {
            const md = turndownService.turndown(html);
            setTextContent(md);
        } else { 
            // HTML mode
            setTextContent(html);
        }

        setViewMode(mode);
    };

    const handleTextChange = async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setTextContent(val);
        
        // Auto-save functionality for non-visual modes
        if (viewMode === 'html') {
            onUpdate(val);
        } else if (viewMode === 'markdown') {
            // We don't constantly parse markdown to HTML for the update because it might be partial.
            // But we should probably debounce update the model content so "Save" works.
            // For now, let's update on change for consistency with visual mode.
            const html = await marked.parse(val);
            onUpdate(html);
        }
    };

    return (
        <div ref={editorRef} className="relative group/editor-wrapper">
            <Toolbar 
                editor={editor} 
                viewMode={viewMode} 
                onViewChange={handleViewChange} 
            />

            <div style={{ display: viewMode === 'visual' ? 'block' : 'none' }}>
                {editor && (
                    <>
                        <AIAssistantToolbar editor={editor} />
                        <TableBubbleMenu editor={editor} />
                        <SuggestionButton editor={editor} />
                        <EditorContent editor={editor} />
                    </>
                )}
            </div>

            {viewMode !== 'visual' && (
                <textarea
                    value={textContent}
                    onChange={handleTextChange}
                    className="w-full min-h-[600px] p-4 font-mono text-sm bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-700 rounded-md focus:ring-indigo-500 focus:border-indigo-500 resize-y outline-none"
                    placeholder={viewMode === 'markdown' ? "Type markdown here..." : "Type HTML here..."}
                    spellCheck={false}
                />
            )}
        </div>
    );
};

export default ChapterEditor;
