
import React from 'react';
import Icon from './Icon';

interface HeaderProps {
    onMenuClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
    return (
        <header className="bg-white dark:bg-zinc-800/50 backdrop-blur-sm border-b border-zinc-200 dark:border-zinc-700 p-4 pt-[calc(1rem+env(safe-area-inset-top))] lg:hidden">
            <div className="flex items-center justify-between">
                <button
                    onClick={onMenuClick}
                    className="p-3 rounded-md text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                    aria-label="Open sidebar"
                >
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
                </button>
                <div className="flex items-center space-x-2">
                    <Icon name="BOOK" className="text-2xl w-8 h-8" />
                    <span className="text-xl font-bold text-zinc-800 dark:text-white">AI Book Studio</span>
                </div>
            </div>
        </header>
    );
};

export default Header;
