import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useCommandPaletteState, useCommandPaletteActions, Command } from '../contexts/CommandPaletteContext';
import { ICONS } from '../constants';
import Icon from './Icon';

const CommandPalette: React.FC = () => {
  const { isOpen, commands } = useCommandPaletteState();
  const { closePalette } = useCommandPaletteActions();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const filteredCommands = useMemo(() => {
    if (!query) return commands;
    const lowerCaseQuery = query.toLowerCase();
    return commands.filter(cmd =>
      cmd.name.toLowerCase().includes(lowerCaseQuery) ||
      cmd.keywords?.toLowerCase().includes(lowerCaseQuery) ||
      cmd.section.toLowerCase().includes(lowerCaseQuery)
    );
  }, [query, commands]);

  const groupedCommands = useMemo(() => {
    return filteredCommands.reduce<Record<string, Command[]>>((groups, cmd) => {
      const section = cmd.section || 'General';
      if (!groups[section]) {
        groups[section] = [];
      }
      groups[section].push(cmd);
      return groups;
    }, {});
  }, [filteredCommands]);

  const executeCommand = useCallback((command: Command) => {
    command.action();
    closePalette();
  }, [closePalette]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => (prev > 0 ? prev - 1 : filteredCommands.length - 1));
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => (prev < filteredCommands.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'Enter') {
      const command = filteredCommands[activeIndex];
      if (command) {
        e.preventDefault();
        executeCommand(command);
      }
    } else if (e.key === 'Escape') {
      closePalette();
    }
  }, [activeIndex, filteredCommands, executeCommand, closePalette]);

  useEffect(() => {
    const activeItem = listRef.current?.querySelector(`[data-index="${activeIndex}"]`);
    activeItem?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10002] bg-black/60 backdrop-blur-sm p-4 pt-[20vh]" onClick={closePalette}>
      <div onClick={e => e.stopPropagation()} className="w-full max-w-xl mx-auto bg-white dark:bg-zinc-800 rounded-lg shadow-2xl overflow-hidden ring-1 ring-zinc-300 dark:ring-zinc-700 animate-slide-in-up">
        <div className="flex items-center p-3 border-b border-zinc-200 dark:border-zinc-700">
          <Icon name="SEARCH" className="w-5 h-5 text-zinc-400 mr-3" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setActiveIndex(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search..."
            className="w-full bg-transparent focus:outline-none text-zinc-800 dark:text-zinc-100"
          />
           <kbd className="ml-4 px-2 py-1 text-xs font-semibold text-zinc-500 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-md">ESC</kbd>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {filteredCommands.length > 0 ? (
            <ul ref={listRef}>
              {Object.entries(groupedCommands).map(([section, cmds]: [string, Command[]]) => (
                <li key={section}>
                  <h3 className="px-4 pt-3 pb-1 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">{section}</h3>
                  <ul>
                    {cmds.map((cmd) => {
                      const globalIndex = filteredCommands.findIndex(c => c.id === cmd.id);
                      return (
                        <li
                          key={cmd.id}
                          data-index={globalIndex}
                          onMouseEnter={() => setActiveIndex(globalIndex)}
                          onClick={() => executeCommand(cmd)}
                          className={`flex items-center justify-between px-4 py-2 mx-2 my-1 rounded-md cursor-pointer transition-colors ${globalIndex === activeIndex ? 'bg-indigo-600 text-white' : 'text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700'}`}
                        >
                          <div className="flex items-center space-x-3">
                            {cmd.icon && <Icon name={cmd.icon as any} className="w-5 h-5" />}
                            <span>{cmd.name}</span>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-6 text-center text-zinc-500">No results found for "{query}".</p>
          )}
        </div>
         <div className="p-2 bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-700 text-xs text-zinc-500 dark:text-zinc-400 flex items-center justify-between">
            <div className="flex items-center space-x-2">
                <span>Navigate: <kbd className="font-sans">↑</kbd> <kbd className="font-sans">↓</kbd></span>
                <span>Select: <kbd className="font-sans">↵</kbd></span>
            </div>
            <div className="flex items-center space-x-2">
                <Icon name="COMMAND" className="w-5 h-5" />
                <span>Command Palette</span>
            </div>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
