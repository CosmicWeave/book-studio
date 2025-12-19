
import React, { useState } from 'react';
import { Editor } from '@tiptap/core';
// Workaround for missing export type definition in some versions
import * as TiptapReact from '@tiptap/react';
import { useBookEditor } from '../../contexts/BookEditorContext';
import { ICONS } from '../../constants';
import Icon from '../Icon';

const BubbleMenu = (TiptapReact as any).BubbleMenu;

interface AIAssistantToolbarProps {
  editor: Editor;
}

const AIAssistantToolbar: React.FC<AIAssistantToolbarProps> = ({ editor }) => {
  const { handleAssistantAction, isAssistantLoading, isAiEnabled, handleOpenTextToImage } = useBookEditor();
  const [isToneDropdownOpen, setIsToneDropdownOpen] = useState(false);

  if (!editor || editor.isDestroyed) return null;

  const buttonClass = "p-2 rounded-md transition-colors hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed";
  const activeClass = "bg-gray-200 dark:bg-gray-700 text-indigo-600 dark:text-indigo-400";

  const handleAction = (action: 'rephrase' | 'expand' | 'summarize') => {
    handleAssistantAction(action);
  };
  
  const handleToneChange = (tone: 'Formal' | 'Casual' | 'Humorous' | 'Concise') => {
    handleAssistantAction({ type: 'tone', tone });
    setIsToneDropdownOpen(false);
  };

  const handleImageClick = () => {
      handleOpenTextToImage(editor);
  };

  return (
    <BubbleMenu editor={editor} tippyOptions={{ duration: 100, placement: 'top-start' }}>
      <div className="bg-white dark:bg-gray-800 p-1.5 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 flex items-center gap-1">
        {/* Basic Formatting */}
        <button 
            onClick={() => (editor.chain().focus() as any).toggleBold().run()} 
            className={`${buttonClass} ${editor.isActive('bold') ? activeClass : ''}`} 
            title="Bold"
        >
             <Icon name="BOLD" className="w-4 h-4" />
        </button>
        <button 
            onClick={() => (editor.chain().focus() as any).toggleItalic().run()} 
            className={`${buttonClass} ${editor.isActive('italic') ? activeClass : ''}`} 
            title="Italic"
        >
             <Icon name="ITALIC" className="w-4 h-4" />
        </button>
        <button 
            onClick={() => (editor.chain().focus() as any).toggleUnderline().run()} 
            className={`${buttonClass} ${editor.isActive('underline') ? activeClass : ''}`} 
            title="Underline"
        >
             <Icon name="UNDERLINE" className="w-4 h-4" />
        </button>
        <button 
            onClick={() => (editor.chain().focus() as any).toggleHighlight().run()} 
            className={`${buttonClass} ${editor.isActive('highlight') ? activeClass : ''}`} 
            title="Highlight"
        >
             <Icon name="HIGHLIGHT" className="w-4 h-4" />
        </button>

        {isAiEnabled && (
        <>
            <div className="w-px h-5 bg-zinc-300 dark:bg-zinc-600 mx-1"></div>

            {isAssistantLoading ? (
            <div className="flex items-center space-x-2 px-2">
                <Icon name="ROTATE_CW" className="w-4 h-4 text-blue-500 animate-spin" />
            </div>
            ) : (
            <>
                <button onClick={() => handleAction('rephrase')} className={buttonClass} title="Rephrase">
                <Icon name="REPHRASE" className="w-5 h-5" />
                </button>
                <button onClick={() => handleAction('expand')} className={buttonClass} title="Expand">
                <Icon name="EXPAND" className="w-5 h-5" />
                </button>
                <button onClick={() => handleAction('summarize')} className={buttonClass} title="Summarize">
                <Icon name="SUMMARIZE" className="w-5 h-5" />
                </button>
                <div className="relative">
                <button onClick={() => setIsToneDropdownOpen(prev => !prev)} className={buttonClass} title="Change Tone">
                    <Icon name="TONE" className="w-5 h-5" />
                </button>
                {isToneDropdownOpen && (
                    <div className="absolute bottom-full mb-2 w-32 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-10 animate-fade-in-up">
                    <button onClick={() => handleToneChange('Formal')} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700">Formal</button>
                    <button onClick={() => handleToneChange('Casual')} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700">Casual</button>
                    <button onClick={() => handleToneChange('Humorous')} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700">Humorous</button>
                    <button onClick={() => handleToneChange('Concise')} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700">Concise</button>
                    </div>
                )}
                </div>
                <div className="w-px h-5 bg-zinc-300 dark:bg-zinc-600 mx-1"></div>
                <button onClick={handleImageClick} className={buttonClass} title="Generate Illustration">
                    <Icon name="IMAGE_PLUS" className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                </button>
            </>
            )}
        </>
        )}
      </div>
    </BubbleMenu>
  );
};

export default AIAssistantToolbar;
