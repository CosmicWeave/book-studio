import React from 'react';
import { ICONS } from '../../constants';
import Icon, { IconName } from '../Icon';

type EditorView = 'editor' | 'corkboard' | 'outliner';

interface BookViewSwitcherProps {
  activeView: EditorView;
  setActiveView: (view: EditorView) => void;
}

const BookViewSwitcher: React.FC<BookViewSwitcherProps> = ({ activeView, setActiveView }) => {
  const views: { id: EditorView; name: string; icon: IconName }[] = [
    { id: 'editor', name: 'Manuscript', icon: 'PEN_TOOL' },
    { id: 'corkboard', name: 'Corkboard', icon: 'LAYOUT' },
    { id: 'outliner', name: 'Outliner', icon: 'LIST' },
  ];

  const buttonClass = (isActive: boolean) => `flex items-center space-x-2 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-all ${
    isActive
      ? 'bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-300 shadow-sm'
      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50'
  }`;

  return (
    <div className="bg-zinc-100/50 dark:bg-zinc-800/50 p-1 rounded-lg border border-zinc-200 dark:border-zinc-700 flex items-center justify-center space-x-1">
      {views.map(view => (
        <button 
            key={view.id} 
            onClick={() => setActiveView(view.id)} 
            className={buttonClass(activeView === view.id)}
            title={view.name}
        >
          <Icon name={view.icon} className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="hidden sm:inline">{view.name}</span>
        </button>
      ))}
    </div>
  );
};

export default BookViewSwitcher;