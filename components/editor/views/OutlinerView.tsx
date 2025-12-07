
import React, { useState } from 'react';
import { useBookEditor } from '../../../contexts/BookEditorContext';
import { ICONS } from '../../../constants';
import { Scene } from '../../../types';
import Icon from '../../Icon';

const SceneItem: React.FC<{ scene: Scene, chapterIndex: number, sceneIndex: number }> = ({ scene, chapterIndex, sceneIndex }) => {
    const { handleUpdateScene, handleDeleteScene } = useBookEditor();
    const [title, setTitle] = useState(scene.title);
    const [summary, setSummary] = useState(scene.summary);
    
    return (
        <li
            draggable
            onDragStart={(e) => {
                e.stopPropagation();
                e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'scene', chapterIndex, sceneIndex }));
                e.currentTarget.style.opacity = '0.4';
            }}
            onDragEnd={(e) => e.currentTarget.style.opacity = '1'}
            className="ml-8 p-3 bg-white dark:bg-zinc-800 rounded-md border border-zinc-200 dark:border-zinc-700 cursor-grab group"
        >
            <div className="flex justify-between items-start">
                <input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    onBlur={() => handleUpdateScene(chapterIndex, scene.id, { title })}
                    className="font-semibold bg-transparent focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded-sm -ml-1 p-1 w-full"
                />
                <button
                    onClick={() => handleDeleteScene(chapterIndex, scene.id)}
                    className="p-1 rounded-full text-zinc-400 hover:text-red-500 hover:bg-red-100 dark:hover:bg-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Delete scene"
                >
                    <Icon name="TRASH" className="w-4 h-4" />
                </button>
            </div>
            <textarea
                value={summary}
                onChange={e => setSummary(e.target.value)}
                onBlur={() => handleUpdateScene(chapterIndex, scene.id, { summary })}
                placeholder="Scene summary..."
                rows={2}
                className="text-sm text-zinc-600 dark:text-zinc-400 mt-1 w-full resize-none bg-transparent focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded-sm -ml-1 p-1"
            />
        </li>
    );
};

const OutlinerView: React.FC = () => {
    const { book, handleMoveChapter, handleAddScene, handleUpdateChapterOutline, handleMoveScene, handleAddChapter, handlePropagatePart } = useBookEditor();
    const [dragOverIndex, setDragOverIndex] = useState<{ type: 'chapter' | 'scene', chapterIndex: number, sceneIndex?: number } | null>(null);

    if (!book) return null;

    const handleDrop = (e: React.DragEvent, chapterIndex: number, sceneIndex?: number) => {
        e.preventDefault();
        e.stopPropagation();
        const data = JSON.parse(e.dataTransfer.getData('text/plain'));

        if (data.type === 'chapter' && sceneIndex === undefined) {
            handleMoveChapter(data.chapterIndex, chapterIndex);
        } else if (data.type === 'scene' && sceneIndex !== undefined) {
            if (data.chapterIndex === chapterIndex) {
                handleMoveScene(chapterIndex, data.sceneIndex, sceneIndex);
            } else {
                // Moving scene between chapters would be more complex, skipping for now
            }
        }
        setDragOverIndex(null);
    };
    
    let lastPart = '';

    return (
        <div className="p-4 bg-zinc-100 dark:bg-zinc-900 rounded-lg min-h-screen">
            <ul className="space-y-4">
                {book.outline.map((chapter, index) => {
                    const showPartHeader = chapter.part && chapter.part !== lastPart;
                    if (showPartHeader) lastPart = chapter.part!;

                    return (
                    <li
                        key={chapter.id || `chapter-${index}`}
                        draggable
                        onDragStart={(e) => {
                            e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'chapter', chapterIndex: index }));
                            e.currentTarget.style.opacity = '0.4';
                        }}
                        onDragEnd={(e) => e.currentTarget.style.opacity = '1'}
                        onDragOver={(e) => { e.preventDefault(); setDragOverIndex({ type: 'chapter', chapterIndex: index }); }}
                        onDragLeave={() => setDragOverIndex(null)}
                        onDrop={(e) => handleDrop(e, index)}
                        className={`bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-700 transition-all ${dragOverIndex?.type === 'chapter' && dragOverIndex.chapterIndex === index ? 'ring-2 ring-indigo-500' : ''}`}
                    >
                        <details open className="group">
                            <summary className="p-3 cursor-pointer flex justify-between items-center font-bold text-lg text-zinc-800 dark:text-zinc-100">
                                <div className="flex-grow mr-2">
                                    <input
                                        value={chapter.title}
                                        onChange={e => handleUpdateChapterOutline(index, { title: e.target.value })}
                                        onClick={e => e.preventDefault()} // Prevent summary click
                                        className="bg-transparent focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded-sm -ml-1 p-1 w-full cursor-text"
                                    />
                                </div>
                                <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={(e) => { e.preventDefault(); handleAddChapter(index, 'before'); }}
                                        className="p-1.5 rounded-full text-zinc-400 hover:text-indigo-500 hover:bg-indigo-100 dark:hover:bg-zinc-700"
                                        title="Insert Chapter Above"
                                    >
                                        <Icon name="CHEVRON_LEFT" className="w-5 h-5 rotate-90" />
                                    </button>
                                    <button
                                        onClick={(e) => { e.preventDefault(); handleAddChapter(index, 'after'); }}
                                        className="p-1.5 rounded-full text-zinc-400 hover:text-indigo-500 hover:bg-indigo-100 dark:hover:bg-zinc-700"
                                        title="Insert Chapter Below"
                                    >
                                        <Icon name="PLUS" className="w-5 h-5" />
                                    </button>
                                    <button
                                        onClick={(e) => { e.preventDefault(); handleAddScene(index); }}
                                        className="p-1.5 rounded-full text-zinc-400 hover:text-indigo-500 hover:bg-indigo-100 dark:hover:bg-zinc-700"
                                        title="Add Scene"
                                    >
                                        <Icon name="LIST" className="w-5 h-5" />
                                    </button>
                                </div>
                            </summary>
                            <div className="p-4 border-t border-zinc-200 dark:border-zinc-700">
                                <div className="mb-4">
                                    <label className="block text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1">Part / Section</label>
                                    <div className="flex gap-2">
                                        <input
                                            value={chapter.part || ''}
                                            onChange={e => handleUpdateChapterOutline(index, { part: e.target.value })}
                                            className="flex-grow text-sm bg-white dark:bg-zinc-700 border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1 focus:ring-indigo-500 focus:border-indigo-500"
                                            placeholder="e.g. Part 1: The Beginning"
                                        />
                                        <button 
                                            onClick={() => handlePropagatePart(index)} 
                                            className="p-1.5 bg-zinc-200 dark:bg-zinc-600 text-zinc-600 dark:text-zinc-300 rounded-md hover:bg-zinc-300 dark:hover:bg-zinc-500 transition-colors"
                                            title="Fill Down: Apply this part name to subsequent chapters in this section"
                                        >
                                           <Icon name="CHEVRON_LEFT" className="w-4 h-4 -rotate-90" />
                                        </button>
                                    </div>
                                </div>
                                
                                {showPartHeader && (
                                    <div className="mb-4 p-3 bg-zinc-100 dark:bg-zinc-700/30 rounded-md border border-zinc-200 dark:border-zinc-600/50">
                                        <label className="block text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1">Part Intro / Description</label>
                                        <textarea
                                            value={chapter.partContent || ''}
                                            onChange={e => handleUpdateChapterOutline(index, { partContent: e.target.value })}
                                            rows={3}
                                            className="w-full text-sm text-zinc-600 dark:text-zinc-400 bg-transparent focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded-sm -ml-1 p-1 placeholder-zinc-400"
                                            placeholder={`Introduction for ${chapter.part}...`}
                                        />
                                    </div>
                                )}

                                <label className="block text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1">Summary</label>
                                <textarea
                                    value={chapter.summary}
                                    onChange={e => handleUpdateChapterOutline(index, { summary: e.target.value })}
                                    rows={3}
                                    className="w-full text-sm text-zinc-600 dark:text-zinc-400 bg-transparent focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded-sm -ml-1 p-1"
                                />
                                <h4 className="text-sm font-semibold mt-4 mb-2 text-zinc-500 dark:text-zinc-400">Scenes</h4>
                                <ul className="space-y-2">
                                    {chapter.scenes?.map((scene, sIndex) => (
                                        <div 
                                            key={scene.id}
                                            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverIndex({ type: 'scene', chapterIndex: index, sceneIndex: sIndex }); }}
                                            onDragLeave={(e) => { e.stopPropagation(); setDragOverIndex(null); }}
                                            onDrop={(e) => handleDrop(e, index, sIndex)}
                                            className={`transition-all ${dragOverIndex?.type === 'scene' && dragOverIndex.chapterIndex === index && dragOverIndex.sceneIndex === sIndex ? 'pt-2 border-t-2 border-indigo-500' : ''}`}
                                        >
                                           <SceneItem scene={scene} chapterIndex={index} sceneIndex={sIndex} />
                                        </div>
                                    ))}
                                    {(!chapter.scenes || chapter.scenes.length === 0) && (
                                        <p className="text-center text-sm text-zinc-400 py-4">No scenes yet. Click the list icon to add one.</p>
                                    )}
                                </ul>
                            </div>
                        </details>
                    </li>
                    );
                })}
            </ul>
            
            <button
                onClick={() => handleAddChapter(book.outline.length - 1, 'after')}
                className="w-full mt-4 py-3 bg-white dark:bg-zinc-800 border border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 dark:hover:border-indigo-700 rounded-lg flex items-center justify-center space-x-2 transition-all"
            >
                <Icon name="PLUS" className="w-5 h-5" />
                <span>Add New Chapter at End</span>
            </button>
        </div>
    );
};

export default OutlinerView;
