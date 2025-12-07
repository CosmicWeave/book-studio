
import React, { useState } from 'react';
import { useBookEditor } from '../../contexts/BookEditorContext';
import { ICONS } from '../../constants';
import Icon from '../Icon';

interface OutlineSidebarProps {
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
}

const OutlineSidebar: React.FC<OutlineSidebarProps> = ({ isOpen, setIsOpen }) => {
    const { book, activeChapterIndex, handleMoveChapter } = useBookEditor();
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

    if (!book || !book.outline.length) {
        return null;
    }

    const handleChapterJump = (index: number) => {
        const element = document.getElementById(`chapter-${index}`);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };
    
    const getDragClass = (index: number) => {
        if (index === draggedIndex) return 'opacity-30';
        if (index === dragOverIndex) return 'border-t-2 border-indigo-500';
        return '';
    };

    let lastPart = '';

    return (
        <aside className={`transition-all duration-300 ease-in-out bg-zinc-50 dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-700 flex flex-col flex-shrink-0 ${isOpen ? 'w-72' : 'w-16'}`}>
            <div className={`p-3 flex items-center border-b border-zinc-200 dark:border-zinc-700 ${isOpen ? 'justify-between' : 'justify-center'}`}>
                {isOpen && <h3 className="font-bold text-lg text-zinc-800 dark:text-zinc-100 animate-fade-in">Outline</h3>}
                <button onClick={() => setIsOpen(!isOpen)} className="p-2 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700">
                    <Icon name="CHEVRON_LEFT" className={`w-5 h-5 block transform transition-transform ${isOpen ? '' : 'rotate-180'}`} />
                </button>
            </div>
            <nav className="flex-1 overflow-y-auto">
                <ul className="space-y-1 p-2">
                    {book.outline.map((chapter, index) => {
                        const showPartHeader = chapter.part && chapter.part !== lastPart;
                        if (showPartHeader) lastPart = chapter.part!;

                        return (
                            <React.Fragment key={chapter.title + index}>
                                {showPartHeader && isOpen && (
                                    <li className="pt-4 pb-2 pl-2 text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                                        {chapter.part}
                                    </li>
                                )}
                                <li
                                    draggable={true}
                                    onDragStart={(e) => {
                                        e.dataTransfer.setData('text/plain', index.toString());
                                        setDraggedIndex(index);
                                    }}
                                    onDragOver={(e) => {
                                        e.preventDefault();
                                        if (draggedIndex !== null && draggedIndex !== index) {
                                            setDragOverIndex(index);
                                        }
                                    }}
                                    onDragLeave={() => setDragOverIndex(null)}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        const oldIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
                                        handleMoveChapter(oldIndex, index);
                                        setDragOverIndex(null);
                                    }}
                                     onDragEnd={() => {
                                        setDraggedIndex(null);
                                        setDragOverIndex(null);
                                    }}
                                    className={`transition-all duration-150 ${getDragClass(index)}`}
                                >
                                    <button
                                        onClick={() => handleChapterJump(index)}
                                        title={chapter.title}
                                        className={`w-full text-left flex items-start space-x-3 p-2 rounded-md transition-colors text-sm border-l-4 ${
                                            activeChapterIndex === index
                                                ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-200 font-semibold border-indigo-500'
                                                : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 border-transparent'
                                        }`}
                                    >
                                        <span className={`flex-shrink-0 mt-0.5 w-5 text-center font-mono text-xs ${activeChapterIndex === index ? 'text-indigo-500 dark:text-indigo-300' : 'text-zinc-400 dark:text-zinc-500'}`}>
                                            {index + 1}
                                        </span>
                                        {isOpen && <span className="flex-grow truncate">{chapter.title.replace(/Part \w+:.*? - /, '')}</span>}
                                    </button>
                                </li>
                            </React.Fragment>
                        );
                    })}
                </ul>
            </nav>
        </aside>
    );
};

export default OutlineSidebar;