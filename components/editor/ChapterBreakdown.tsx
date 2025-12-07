import React, { useState, useEffect } from 'react';
import { useBookEditor } from '../../contexts/BookEditorContext';
import { ICONS } from '../../constants';
import Icon from '../Icon';

interface ChapterBreakdownProps {
    chapterIndex: number;
}

const ChapterBreakdown: React.FC<ChapterBreakdownProps> = ({ chapterIndex }) => {
    const { book, handleGenerateSubSection, generatingSubSection, handleUpdateSubSectionPrompt, handleRemoveSubSection, handleAnalyzePlanCompleteness, isAnalyzingPlan, isGeneratingChapter } = useBookEditor();
    
    const subSections = book?.outline[chapterIndex]?.subSections;
    const nextSectionIndex = subSections?.findIndex(s => !s.isGenerated) ?? -1;
    const isAnalyzingThisPlan = isAnalyzingPlan === chapterIndex;
    const isGeneratingAnySectionForThisChapter = isGeneratingChapter === chapterIndex;
    const isDisabled = isGeneratingAnySectionForThisChapter || isAnalyzingThisPlan;

    const [editablePrompt, setEditablePrompt] = useState('');

    useEffect(() => {
        if (nextSectionIndex !== -1 && subSections) {
            setEditablePrompt(subSections[nextSectionIndex].prompt);
        }
    }, [nextSectionIndex, subSections]);

    const handlePromptBlur = () => {
        if (nextSectionIndex !== -1 && subSections && editablePrompt !== subSections[nextSectionIndex].prompt) {
            handleUpdateSubSectionPrompt(chapterIndex, nextSectionIndex, editablePrompt);
        }
    };
    
    if (!book || !subSections) {
        return null;
    }

    if (nextSectionIndex === -1 && !isGeneratingAnySectionForThisChapter) {
        return null;
    }

    const isGeneratingThisSection = generatingSubSection?.chapter === chapterIndex && generatingSubSection?.section === nextSectionIndex;

    return (
        <div className="space-y-4 my-6 p-4 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-lg">
            <div className="flex justify-between items-center">
                <h4 className="font-bold text-lg text-zinc-800 dark:text-zinc-100">Chapter Writing Plan</h4>
                {nextSectionIndex === -1 ? (
                    <span className="text-sm font-semibold text-green-600">✓ All sections written</span>
                ) : (
                    <button
                        onClick={() => handleAnalyzePlanCompleteness(chapterIndex)}
                        disabled={isDisabled}
                        className="flex items-center space-x-2 text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        title="Use AI to check which sections are already written in the content below."
                    >
                        <Icon name={isAnalyzingThisPlan ? 'ROTATE_CW' : 'SPARKLES'} className={`w-4 h-4 ${isAnalyzingThisPlan ? 'animate-spin' : ''}`} />
                        <span>{isAnalyzingThisPlan ? 'Analyzing...' : 'Analyze Plan'}</span>
                    </button>
                )}
            </div>
            
            <ol className="space-y-3">
                {subSections.map((section, index) => {
                    const isCompleted = section.isGenerated;
                    const isCurrent = index === nextSectionIndex;
                    return (
                        <li key={index} className={`relative p-2 rounded-md transition-colors group ${isCurrent ? 'bg-indigo-50 dark:bg-indigo-900/30' : ''}`}>
                             <div className="flex items-start space-x-3">
                                <div className="flex-shrink-0 pt-1">
                                    {isCompleted ? (
                                        <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                        </div>
                                    ) : isCurrent ? (
                                        <div className="w-5 h-5 rounded-full border-2 border-indigo-500 bg-white dark:bg-indigo-900 flex items-center justify-center">
                                            <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                                        </div>
                                    ) : (
                                        <div className="w-5 h-5 rounded-full border-2 border-zinc-300 dark:border-zinc-600"></div>
                                    )}
                                </div>
                                <div className={`flex-1 ${isCompleted ? 'text-zinc-400 dark:text-zinc-500 line-through' : 'text-zinc-700 dark:text-zinc-300'}`}>
                                    <span className="font-semibold text-sm">Section {index + 1}</span>
                                    <p className="text-sm">{section.prompt}</p>
                                </div>
                            </div>
                            {!isCompleted && (
                                <button
                                    onClick={() => handleRemoveSubSection(chapterIndex, index)}
                                    className="absolute top-2 right-2 p-1 rounded-full text-zinc-400 hover:text-red-500 hover:bg-red-100 dark:hover:bg-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-0"
                                    title="Remove section from plan"
                                    disabled={isDisabled}
                                    aria-label="Remove section"
                                >
                                    <Icon name="TRASH" className="w-4 h-4" />
                                </button>
                            )}
                        </li>
                    );
                })}
            </ol>
            
            {nextSectionIndex !== -1 && (
                <div className="mt-6 pt-4 border-t border-zinc-200 dark:border-zinc-700 space-y-3">
                    <label htmlFor={`prompt-editor-${chapterIndex}`} className="block text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                        Next Step: Edit the prompt for Section {nextSectionIndex + 1}
                    </label>
                    <textarea
                        id={`prompt-editor-${chapterIndex}`}
                        value={editablePrompt}
                        onChange={e => setEditablePrompt(e.target.value)}
                        onBlur={handlePromptBlur}
                        rows={3}
                        className="w-full bg-white dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                        disabled={isDisabled}
                    />
                    <button
                        onClick={() => handleGenerateSubSection(chapterIndex, nextSectionIndex)}
                        disabled={isDisabled}
                        className="flex items-center justify-center w-full space-x-2 bg-indigo-600 text-white px-4 py-2 rounded-lg shadow font-semibold hover:bg-indigo-700 transition-colors disabled:bg-indigo-400 dark:disabled:bg-indigo-800 disabled:cursor-not-allowed"
                    >
                        <Icon name={isGeneratingThisSection ? 'ROTATE_CW' : 'WAND'} className={`w-5 h-5 ${isGeneratingThisSection ? 'animate-spin' : ''}`} />
                        <span>
                            {isGeneratingThisSection
                                ? 'Writing...'
                                : nextSectionIndex === 0
                                ? 'Generate First Section'
                                : 'Generate Next Section'}
                        </span>
                    </button>
                </div>
            )}
        </div>
    );
};

export default ChapterBreakdown;