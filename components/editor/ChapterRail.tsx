import React, { useMemo } from 'react';
import { ChapterContent, ChapterOutline } from '../../types';

interface ChapterRailProps {
    outline: ChapterOutline[];
    content: ChapterContent[];
    activeChapterIndex: number;
    onJumpToChapter: (index: number) => void;
}

const chapterWordCount = (html: string): number => {
    if (!html) return 0;
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    const text = tempDiv.textContent || '';
    if (!text.trim()) return 0;
    return text.trim().split(/\s+/).filter(Boolean).length;
};

const ChapterRail: React.FC<ChapterRailProps> = ({ outline, content, activeChapterIndex, onJumpToChapter }) => {
    const chapterStats = useMemo(
        () =>
            outline.map((chapter, index) => {
                const words = chapterWordCount(content[index]?.htmlContent || '');
                const isWritten = words > 0;
                return {
                    title: chapter.title,
                    words,
                    isWritten,
                };
            }),
        [outline, content],
    );

    return (
        <aside className="sticky top-24 hidden h-fit w-20 shrink-0 md:block">
            <div className="rounded-xl border border-zinc-200 bg-white/90 p-2 shadow-sm backdrop-blur-sm dark:border-zinc-700 dark:bg-zinc-800/80">
                <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Chapters</p>
                <div className="max-h-[70vh] space-y-1 overflow-y-auto pr-1">
                    {chapterStats.map((chapter, index) => (
                        <button
                            key={outline[index].id || `rail-${index}`}
                            onClick={() => onJumpToChapter(index)}
                            className={`group flex w-full flex-col items-center rounded-lg px-1.5 py-2 text-center transition-colors ${
                                activeChapterIndex === index
                                    ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
                                    : 'text-zinc-500 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700/60'
                            }`}
                            title={chapter.title}
                        >
                            <span
                                className={`mb-1 h-2.5 w-2.5 rounded-full border ${
                                    chapter.isWritten
                                        ? 'border-indigo-500 bg-indigo-500 dark:border-indigo-300 dark:bg-indigo-300'
                                        : 'border-zinc-300 bg-transparent dark:border-zinc-600'
                                }`}
                            />
                            <span className="text-xs font-semibold">{index + 1}</span>
                            <span className="mt-0.5 text-[10px] leading-none opacity-80">{chapter.words.toLocaleString()}</span>
                        </button>
                    ))}
                </div>
            </div>
        </aside>
    );
};

export default ChapterRail;