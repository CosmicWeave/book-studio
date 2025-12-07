import React, { createContext, useState, useContext, useCallback, ReactNode, useMemo } from 'react';

export interface Command {
  id: string;
  name: string;
  keywords?: string;
  action: () => void;
  icon?: string;
  section: string;
}

interface CommandPaletteState {
  isOpen: boolean;
  commands: Command[];
}

interface CommandPaletteActions {
  openPalette: () => void;
  closePalette: () => void;
  registerCommands: (commands: Command[]) => void;
  unregisterCommands: (commandIds: string[]) => void;
}

const CommandPaletteStateContext = createContext<CommandPaletteState | undefined>(undefined);
const CommandPaletteActionsContext = createContext<CommandPaletteActions | undefined>(undefined);

export const CommandPaletteProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [commands, setCommands] = useState<Command[]>([]);

    const openPalette = useCallback(() => setIsOpen(true), []);
    const closePalette = useCallback(() => setIsOpen(false), []);

    const registerCommands = useCallback((newCommands: Command[]) => {
        setCommands(prev => {
            const newCommandIds = new Set(newCommands.map(c => c.id));
            const filteredPrev = prev.filter(c => !newCommandIds.has(c.id));
            return [...filteredPrev, ...newCommands];
        });
    }, []);

    const unregisterCommands = useCallback((commandIds: string[]) => {
        setCommands(prev => prev.filter(c => !commandIds.includes(c.id)));
    }, []);

    const actions = useMemo(() => ({ openPalette, closePalette, registerCommands, unregisterCommands }), 
        [openPalette, closePalette, registerCommands, unregisterCommands]);
    
    const state = useMemo(() => ({ isOpen, commands }), [isOpen, commands]);

    return (
        <CommandPaletteActionsContext.Provider value={actions}>
            <CommandPaletteStateContext.Provider value={state}>
                {children}
            </CommandPaletteStateContext.Provider>
        </CommandPaletteActionsContext.Provider>
    );
};

// Main hook for components that need everything (like CommandPalette itself)
export const useCommandPalette = () => {
  const actions = useContext(CommandPaletteActionsContext);
  const state = useContext(CommandPaletteStateContext);
  if (actions === undefined || state === undefined) {
    throw new Error('useCommandPalette must be used within a CommandPaletteProvider');
  }
  return { ...actions, ...state };
};

// Granular hooks for performance optimization
export const useCommandPaletteActions = () => {
    const context = useContext(CommandPaletteActionsContext);
    if (context === undefined) {
        throw new Error('useCommandPaletteActions must be used within a CommandPaletteProvider');
    }
    return context;
};

export const useCommandPaletteState = () => {
    const context = useContext(CommandPaletteStateContext);
    if (context === undefined) {
        throw new Error('useCommandPaletteState must be used within a CommandPaletteProvider');
    }
    return context;
};
