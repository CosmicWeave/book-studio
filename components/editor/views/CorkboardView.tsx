
import React, { useState } from 'react';
import { useBookEditor } from '../../../contexts/BookEditorContext';
import { ChapterOutline } from '../../../types';

const Card: React.FC<{ chapter: ChapterOutline; index: number }> = ({ chapter, index }) => {
    const { handleUpdateChapterOutline, handleMoveChapter } = useBookEditor();
    const [title, setTitle] = useState(chapter.title);
    const [summary, setSummary] = useState(chapter.summary);
    const [dragOver, setDragOver] = useState(false);

    const colors = ['gray', 'red', 'yellow', 'green', 'blue', 'indigo', 'purple', 'pink'];
    const colorClasses = {
        gray: 'bg-gray-400', red: 'bg-red-400', yellow: 'bg-yellow-400', green: 'bg-green-400',
        blue: 'bg-blue-400', indigo: 'bg-indigo-400', purple: 'bg-purple-400', pink: 'bg-pink-400',
    };

    const statusClasses = {
        todo: 'bg-gray-200 text-gray-800',
        in_progress: 'bg-blue-200 text-blue-800',
        done: 'bg-green-200 text-green-800',
    };
    
    const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
        e.dataTransfer.setData('text/plain', index.toString());
        e.currentTarget.style.opacity = '0.4';
    };

    const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
        e.currentTarget.style.opacity = '1';
        setDragOver(false);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        const oldIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
        handleMoveChapter(oldIndex, index);
        setDragOver(false);
    };

    return (
        <div
            draggable
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`w-72 h-80 bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-700 flex flex-col cursor-grab active:cursor-grabbing transition-all ${dragOver ? 'ring-2 ring-indigo-500' : ''}`}
        >
            <div className={`h-2 w-full rounded-t-lg ${colorClasses[chapter.color as keyof typeof colorClasses] || 'bg-gray-300'}`}></div>
            <div className="p-4 flex-grow flex flex-col overflow-hidden">
                <div className="flex justify-between items-start mb-2">
                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${statusClasses[chapter.status as keyof typeof statusClasses] || statusClasses.todo}`}>
                        {chapter.status?.replace('_', ' ') || 'To Do'}
                    </span>
                    <select
                        value={chapter.status || 'todo'}
                        onChange={e => handleUpdateChapterOutline(index, { status: e.target.value as ChapterOutline['status'] })}
                        className="text-xs bg-transparent dark:bg-zinc-800 border-none focus:ring-0"
                    >
                        <option value="todo">To Do</option>
                        <option value="in_progress">In Progress</option>
                        <option value="done">Done</option>
                    </select>
                </div>

                <input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    onBlur={() => handleUpdateChapterOutline(index, { title })}
                    className="font-bold text-lg bg-transparent focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded-sm -ml-1 p-1 w-full"
                />
                <textarea
                    value={summary}
                    onChange={e => setSummary(e.target.value)}
                    onBlur={() => handleUpdateChapterOutline(index, { summary })}
                    className="text-sm text-zinc-600 dark:text-zinc-400 mt-2 flex-grow resize-none bg-transparent focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded-sm -ml-1 p-1 w-full"
                />

                <div className="flex-shrink-0 mt-2 flex items-center justify-between">
                    <div className="flex space-x-1">
                        {colors.map(color => (
                            <button
                                key={color}
                                onClick={() => handleUpdateChapterOutline(index, { color })}
                                className={`w-5 h-5 rounded-full ${colorClasses[color as keyof typeof colorClasses]} ${chapter.color === color ? 'ring-2 ring-offset-2 ring-indigo-500 dark:ring-offset-zinc-800' : ''}`}
                                aria-label={`Set color to ${color}`}
                            />
                        ))}
                    </div>
                    <span className="text-xs font-mono text-zinc-400">Ch. {index + 1}</span>
                </div>
            </div>
        </div>
    );
};

const CorkboardView: React.FC = () => {
    const { book } = useBookEditor();
    
    if (!book) return null;

    return (
        <div className="flex flex-wrap gap-6 p-4 bg-zinc-100 dark:bg-zinc-900 rounded-lg min-h-screen">
            {book.outline.map((chapter, index) => (
                <Card key={chapter.id || `chapter-${index}`} chapter={chapter} index={index} />
            ))}
        </div>
    );
};

export default CorkboardView;
