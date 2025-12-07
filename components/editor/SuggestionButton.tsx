
import React from 'react';
import { Editor } from '@tiptap/core';
// Workaround for missing export type definition in some versions
import * as TiptapReact from '@tiptap/react';
import { useBookEditor } from '../../contexts/BookEditorContext';
import { ICONS } from '../../constants';
import Icon from '../Icon';

const FloatingMenu = (TiptapReact as any).FloatingMenu;

interface SuggestionButtonProps {
  editor: Editor;
}

const SuggestionButton: React.FC<SuggestionButtonProps> = ({ editor }) => {
  const { handleAssistantAction, isAssistantLoading, isAiEnabled } = useBookEditor();

  if (!editor || editor.isDestroyed || !isAiEnabled) return null;

  const shouldShow = ({ state }: { state: any }) => {
    const { $from } = state.selection;
    const isAtStart = $from.pos === 1;
    const isAnEmptyParagraph = $from.parent.isEmpty;
    const isAtTheEnd = $from.pos === $from.end();
    return (isAtStart || isAnEmptyParagraph) && isAtTheEnd;
  };
  
  return (
    <FloatingMenu editor={editor} tippyOptions={{ duration: 100, placement: 'right-start' }} shouldShow={shouldShow}>
        <button
          onClick={() => handleAssistantAction('suggest')}
          disabled={isAssistantLoading}
          className="flex items-center space-x-2 text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors bg-white dark:bg-gray-800 px-3 py-1.5 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700"
        >
          <Icon name={isAssistantLoading ? 'ROTATE_CW' : 'WAND'} className={`w-4 h-4 ${isAssistantLoading ? 'animate-spin' : ''}`} />
          <span>{isAssistantLoading ? 'Generating...' : 'Continue writing'}</span>
        </button>
    </FloatingMenu>
  );
};

export default SuggestionButton;
