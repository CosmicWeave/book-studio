
import React, { useState } from 'react';
import { Editor } from '@tiptap/core';
import Icon from './Icon';

interface ToolbarProps {
    editor: Editor | null;
    viewMode: 'visual' | 'markdown' | 'html';
    onViewChange: (mode: 'visual' | 'markdown' | 'html') => void;
}

const Toolbar: React.FC<ToolbarProps> = ({ editor, viewMode, onViewChange }) => {
  const [linkUrl, setLinkUrl] = useState('');

  // We allow the toolbar to render for the switcher even if editor is null, 
  // but formatting buttons require editor.
  const showFormatting = editor && viewMode === 'visual';

  const buttonClass = (isActive: boolean, disabled: boolean = false) =>
    `p-1.5 rounded-md transition-colors flex items-center justify-center h-8 w-8 ${
      disabled ? 'opacity-30 cursor-not-allowed text-zinc-400 dark:text-zinc-600' : 
      isActive
        ? 'bg-indigo-600 text-white shadow-sm'
        : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
    }`;

  const viewButtonClass = (mode: string) => 
    `px-3 py-1 text-xs font-medium transition-colors ${
        viewMode === mode 
        ? 'bg-white dark:bg-zinc-600 text-indigo-600 dark:text-indigo-300 shadow-sm' 
        : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
    }`;

  const Separator = () => <div className="w-[1px] h-5 bg-zinc-300 dark:bg-zinc-600 mx-1 self-center"></div>;

  const setLink = () => {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL', previousUrl);

    if (url === null) return;

    if (url === '') {
      (editor.chain().focus().extendMarkRange('link') as any).unsetLink().run();
      return;
    }

    (editor.chain().focus().extendMarkRange('link') as any).setLink({ href: url }).run();
  };

  const addImage = () => {
    if (!editor) return;
    const url = window.prompt('Enter image URL');
    if (url) {
      (editor.chain().focus() as any).setImage({ src: url }).run();
    }
  };

  return (
    <div className="sticky top-20 z-20 bg-zinc-50/95 dark:bg-zinc-800/95 backdrop-blur-md p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 mb-4 flex flex-wrap items-center gap-1 shadow-sm">
      
      {showFormatting && (
      <>
        {/* History */}
        <button
            onClick={() => (editor.chain().focus() as any).undo().run()}
            disabled={!(editor.can() as any).undo()}
            className={buttonClass(false, !(editor.can() as any).undo())}
            aria-label="Undo"
            title="Undo (Ctrl+Z)"
        >
            <Icon name="UNDO" className="w-4 h-4" />
        </button>
        <button
            onClick={() => (editor.chain().focus() as any).redo().run()}
            disabled={!(editor.can() as any).redo()}
            className={buttonClass(false, !(editor.can() as any).redo())}
            aria-label="Redo"
            title="Redo (Ctrl+Y)"
        >
            <Icon name="REDO" className="w-4 h-4" />
        </button>

        <Separator />

        {/* Headings */}
        <button
            onClick={() => (editor.chain().focus() as any).setParagraph().run()}
            className={buttonClass(editor.isActive('paragraph'))}
            aria-label="Paragraph"
            title="Paragraph"
        >
            <span className="font-serif font-bold text-xs">P</span>
        </button>
        <button onClick={() => (editor.chain().focus() as any).toggleHeading({ level: 1 }).run()} className={buttonClass(editor.isActive('heading', { level: 1 }))} title="Heading 1"><span className="font-bold text-xs">H1</span></button>
        <button onClick={() => (editor.chain().focus() as any).toggleHeading({ level: 2 }).run()} className={buttonClass(editor.isActive('heading', { level: 2 }))} title="Heading 2"><span className="font-bold text-xs">H2</span></button>
        <button onClick={() => (editor.chain().focus() as any).toggleHeading({ level: 3 }).run()} className={buttonClass(editor.isActive('heading', { level: 3 }))} title="Heading 3"><span className="font-bold text-xs">H3</span></button>
        <button onClick={() => (editor.chain().focus() as any).toggleHeading({ level: 4 }).run()} className={buttonClass(editor.isActive('heading', { level: 4 }))} title="Heading 4"><span className="font-bold text-xs">H4</span></button>
        <button onClick={() => (editor.chain().focus() as any).toggleHeading({ level: 5 }).run()} className={buttonClass(editor.isActive('heading', { level: 5 }))} title="Heading 5"><span className="font-bold text-xs">H5</span></button>
        <button onClick={() => (editor.chain().focus() as any).toggleHeading({ level: 6 }).run()} className={buttonClass(editor.isActive('heading', { level: 6 }))} title="Heading 6"><span className="font-bold text-xs">H6</span></button>
        
        <Separator />

        {/* Text Formatting */}
        <button onClick={() => (editor.chain().focus() as any).toggleBold().run()} disabled={!(editor.can() as any).toggleBold()} className={buttonClass(editor.isActive('bold'))} title="Bold (Ctrl+B)">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></svg>
        </button>
        <button onClick={() => (editor.chain().focus() as any).toggleItalic().run()} disabled={!(editor.can() as any).toggleItalic()} className={buttonClass(editor.isActive('italic'))} title="Italic (Ctrl+I)">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>
        </button>
        <button onClick={() => (editor.chain().focus() as any).toggleUnderline().run()} className={buttonClass(editor.isActive('underline'))} title="Underline (Ctrl+U)">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 4v6a6 6 0 0 0 12 0V4"/><line x1="4" y1="20" x2="20" y2="20"/></svg>
        </button>
        <button onClick={() => (editor.chain().focus() as any).toggleHighlight().run()} className={buttonClass(editor.isActive('highlight'))} title="Highlight">
            <Icon name="HIGHLIGHT" className="w-4 h-4" />
        </button>
        
        <Separator />

        {/* Lists & Blocks */}
        <button onClick={() => (editor.chain().focus() as any).toggleBulletList().run()} className={buttonClass(editor.isActive('bulletList'))} title="Bullet List">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
        </button>
        <button onClick={() => (editor.chain().focus() as any).toggleOrderedList().run()} className={buttonClass(editor.isActive('orderedList'))} title="Ordered List">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg>
        </button>
        <button onClick={() => (editor.chain().focus() as any).toggleTaskList().run()} className={buttonClass(editor.isActive('taskList'))} title="Checklist">
            <Icon name="CHECK_SQUARE" className="w-4 h-4" />
        </button>
        
        <Separator />

        {/* Insertions */}
        <button onClick={() => (editor.chain().focus() as any).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} className={buttonClass(false)} title="Insert Table">
            <Icon name="TABLE" className="w-4 h-4" />
        </button>
        <button onClick={addImage} className={buttonClass(false)} title="Insert Image">
            <Icon name="IMAGE" className="w-4 h-4" />
        </button>
        <button onClick={setLink} className={buttonClass(editor.isActive('link'))} title="Link">
            <Icon name="LINK" className="w-4 h-4" />
        </button>

        <Separator />

        {/* Alignment */}
        <button onClick={() => (editor.chain().focus() as any).setTextAlign('left').run()} className={buttonClass(editor.isActive({ textAlign: 'left' }))} title="Align Left">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></svg>
        </button>
        <button onClick={() => (editor.chain().focus() as any).setTextAlign('center').run()} className={buttonClass(editor.isActive({ textAlign: 'center' }))} title="Align Center">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="21" y1="6" x2="3" y2="6"/><line x1="17" y1="10" x2="7" y2="10"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="7" y2="18"/></svg>
        </button>
        <button onClick={() => (editor.chain().focus() as any).setTextAlign('justify').run()} className={buttonClass(editor.isActive({ textAlign: 'justify' }))} title="Justify">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="3" y1="14" x2="21" y2="14"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>

        <Separator />

        {/* Clear Formatting */}
        <button onClick={() => (editor.chain().focus() as any).unsetAllMarks().run()} className={buttonClass(false)} title="Clear Formatting">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 11l-5-5-5 5"/><path d="M18 21l-5-5-5 5"/><line x1="3" y1="3" x2="21" y2="21"/></svg>
        </button>
      </>
      )}

      {/* View Switcher - Always visible */}
      <div className="flex-grow flex justify-end">
          <div className="flex bg-zinc-100 dark:bg-zinc-700/50 p-0.5 rounded-md border border-zinc-200 dark:border-zinc-600">
              <button onClick={() => onViewChange('visual')} className={viewButtonClass('visual')} title="Rich Text Editor">
                  <Icon name="PEN_TOOL" className="w-3 h-3 inline mr-1"/>Visual
              </button>
              <button onClick={() => onViewChange('markdown')} className={viewButtonClass('markdown')} title="Markdown Editor">
                  <Icon name="CODE" className="w-3 h-3 inline mr-1"/>MD
              </button>
              <button onClick={() => onViewChange('html')} className={viewButtonClass('html')} title="HTML Source">
                  <span className="font-mono font-bold mr-1 text-[10px]">&lt;/&gt;</span>HTML
              </button>
          </div>
      </div>

    </div>
  );
};

export default Toolbar;
