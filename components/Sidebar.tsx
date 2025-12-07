
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Page } from '../types';
import { ICONS } from '../constants';
import { subscribeToBackupStatus, manualTriggerBackup, BackupStatus } from '../services/backupService';
import { onAuthStateChanged } from '../services/googleDrive';
import Icon, { IconName } from './Icon';
import { useTheme } from '../contexts/ThemeContext';

interface SidebarProps {
    currentPage: Page;
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
}

interface NavItemProps {
    label: string;
    page: Page;
    currentPage: Page;
    icon: IconName;
    onClick: () => void;
}

const NavItem: React.FC<NavItemProps> = ({ label, page, currentPage, icon, onClick }) => {
    const isActive = currentPage === page;
    return (
        <li>
            <Link
                to={`/${page}`}
                onClick={onClick}
                className={`flex items-center space-x-3 w-full px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group ${
                    isActive
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-indigo-900/20'
                        : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
            >
                <Icon 
                    name={icon} 
                    className={`w-5 h-5 transition-transform duration-200 ${isActive ? '' : 'group-hover:scale-110 text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-600 dark:group-hover:text-zinc-300'}`} 
                />
                <span>{label}</span>
            </Link>
        </li>
    );
};

const BackupStatusIndicator: React.FC = () => {
    const [status, setStatus] = useState<BackupStatus>('idle');
    const [lastBackup, setLastBackup] = useState<number | null>(null);
    const [timeAgo, setTimeAgo] = useState('');

    useEffect(() => {
        const unsubscribe = subscribeToBackupStatus((state) => {
            setStatus(state.status);
            setLastBackup(state.lastBackupTimestamp);
        });
        return unsubscribe;
    }, []);

    useEffect(() => {
        const formatTimeAgo = () => {
            if (!lastBackup) {
                setTimeAgo('');
                return;
            }
            const now = Date.now();
            const diffSeconds = Math.round((now - lastBackup) / 1000);
            
            if (diffSeconds < 10) setTimeAgo('just now');
            else if (diffSeconds < 60) setTimeAgo(`${diffSeconds}s ago`);
            else if (diffSeconds < 3600) setTimeAgo(`${Math.floor(diffSeconds / 60)}m ago`);
            else if (diffSeconds < 86400) setTimeAgo(`${Math.floor(diffSeconds / 3600)}h ago`);
            else setTimeAgo(`${Math.floor(diffSeconds / 86400)}d ago`);
        };
        
        formatTimeAgo();
        const interval = setInterval(formatTimeAgo, 10000);
        return () => clearInterval(interval);

    }, [lastBackup]);

    const getStatusContent = () => {
        switch (status) {
            case 'syncing':
                return { icon: 'ROTATE_CW', color: 'text-blue-500', text: 'Syncing...', spin: true };
            case 'synced':
                return { icon: 'CLOUD_CHECK', color: 'text-emerald-500', text: `Saved ${timeAgo}`, spin: false };
            case 'failed':
                return { icon: 'CLOUD_OFF', color: 'text-red-500', text: 'Backup Failed', spin: false };
            case 'disabled':
                return { icon: 'CLOUD_OFF', color: 'text-zinc-400', text: 'Backup Disabled', spin: false };
            case 'idle':
            default:
                return { icon: 'CLOUD', color: 'text-zinc-400', text: 'Backup Ready', spin: false };
        }
    };

    const { icon, color, text, spin } = getStatusContent();
    const isClickable = status !== 'syncing' && status !== 'disabled';

    return (
        <button 
            onClick={() => isClickable && manualTriggerBackup(true)} // Force backup on manual click
            disabled={!isClickable}
            className="flex items-center space-x-2 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors w-full px-2 py-1 rounded disabled:cursor-default"
            title={status === 'disabled' ? 'Enable in Settings' : 'Click to force backup now'}
        >
            <Icon name={icon as IconName} className={`w-4 h-4 ${color} ${spin ? 'animate-spin' : ''}`} />
            <span>{text}</span>
        </button>
    );
};

const UserProfile: React.FC = () => {
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged((isSignedIn, userProfile) => {
            if (isSignedIn && userProfile) {
                setUser(userProfile);
            } else {
                setUser(null);
            }
        });
        return () => { unsubscribe(); };
    }, []);

    if (!user) return null;

    return (
        <div className="flex items-center space-x-3 px-2 py-2 bg-zinc-50 dark:bg-zinc-700/30 rounded-xl border border-zinc-100 dark:border-zinc-700/50 mb-3">
            <img src={user.picture} alt={user.name} className="w-8 h-8 rounded-full border border-zinc-200 dark:border-zinc-600" />
            <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-zinc-800 dark:text-zinc-100 truncate">{user.name}</p>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">{user.email}</p>
            </div>
        </div>
    );
};

const Sidebar: React.FC<SidebarProps> = ({ currentPage, isOpen, setIsOpen }) => {
    const { theme, toggleTheme } = useTheme();
    
    const navItems: { page: Page; label: string; icon: IconName }[] = [
        { page: 'dashboard', label: 'Library', icon: 'GRID' },
        { page: 'documents', label: 'Documents', icon: 'FILE_TEXT' },
        { page: 'reading', label: 'Reading', icon: 'BOOK' },
        { page: 'instructions', label: 'Templates', icon: 'EDIT' },
        { page: 'macros', label: 'Workflows', icon: 'WORKFLOW' },
        { page: 'settings', label: 'Settings', icon: 'SETTINGS' },
    ];

    const utilityItems: { page: Page; label: string; icon: IconName }[] = [
        { page: 'archived', label: 'Archived', icon: 'ARCHIVE' },
        { page: 'trash', label: 'Trash', icon: 'TRASH' },
    ];

    return (
        <>
            {/* Overlay for mobile */}
            <div
                className={`fixed inset-0 bg-zinc-900/20 dark:bg-black/50 backdrop-blur-sm z-30 lg:hidden transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={() => setIsOpen(false)}
                aria-hidden="true"
            />
            
            <aside className={`fixed inset-y-0 left-0 w-72 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex flex-col z-40 transform transition-transform duration-300 ease-[cubic-bezier(0.2,0,0,1)] ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:shadow-none shadow-2xl pb-[env(safe-area-inset-bottom)]`}>
                
                {/* Header */}
                <div className="flex items-center justify-between p-6 pb-2 pt-[calc(1.5rem+env(safe-area-inset-top))]">
                    <Link to="/" className="flex items-center space-x-3 group" onClick={() => setIsOpen(false)}>
                        <div className="bg-indigo-600 text-white p-2 rounded-lg shadow-lg shadow-indigo-200 dark:shadow-none group-hover:bg-indigo-700 transition-colors">
                            <Icon name="BOOK" className="w-6 h-6" />
                        </div>
                        <div>
                            <span className="block text-lg font-bold text-zinc-900 dark:text-white leading-none">AI Book</span>
                            <span className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 tracking-wider uppercase mt-0.5">Studio</span>
                        </div>
                    </Link>
                     <button
                        onClick={() => setIsOpen(false)}
                        className="lg:hidden p-2 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                        aria-label="Close sidebar"
                    >
                        <Icon name="CLOSE" className="w-5 h-5"/>
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-4 py-6 space-y-8 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-700">
                    <div>
                        <p className="px-4 text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-3">Menu</p>
                        <ul className="space-y-1">
                            {navItems.map(item => (
                               <NavItem
                                    key={item.page}
                                    label={item.label}
                                    page={item.page}
                                    currentPage={currentPage}
                                    icon={item.icon}
                                    onClick={() => setIsOpen(false)}
                               />
                           ))}
                        </ul>
                    </div>
                    <div>
                        <p className="px-4 text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-3">Library</p>
                        <ul className="space-y-1">
                            {utilityItems.map(item => (
                                <NavItem
                                    key={item.page}
                                    label={item.label}
                                    page={item.page}
                                    currentPage={currentPage}
                                    icon={item.icon}
                                    onClick={() => setIsOpen(false)}
                                />
                            ))}
                        </ul>
                    </div>
                </nav>

                {/* Footer */}
                <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                    <UserProfile />
                    
                    <div className="flex items-center justify-between mb-3 px-2">
                        <BackupStatusIndicator />
                    </div>

                    <div className="flex items-center justify-between px-2 pt-2 border-t border-zinc-200/50 dark:border-zinc-700/50">
                        <button
                            onClick={toggleTheme}
                            className="flex items-center space-x-2 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors p-1.5 rounded-md hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50"
                            aria-label="Toggle theme"
                        >
                            <Icon name={theme === 'light' ? 'MOON' : 'SUN'} className="w-4 h-4" />
                            <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
                        </button>
                        <span className="text-[10px] text-zinc-300 dark:text-zinc-600">v1.3.2</span>
                    </div>
                </div>
            </aside>
        </>
    );
};

export default Sidebar;