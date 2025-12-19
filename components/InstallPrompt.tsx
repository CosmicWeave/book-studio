
import React, { useState, useEffect } from 'react';
import Icon from './Icon';

const InstallPrompt: React.FC = () => {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const handler = (e: Event) => {
            // Prevent Chrome 67 and earlier from automatically showing the prompt
            e.preventDefault();
            // Stash the event so it can be triggered later.
            setDeferredPrompt(e);
            // Show the prompt UI
            setIsVisible(true);
        };

        window.addEventListener('beforeinstallprompt', handler);

        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;
        
        // Show the prompt
        deferredPrompt.prompt();
        
        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
            console.log('User accepted the install prompt');
        } else {
            console.log('User dismissed the install prompt');
        }
        
        // Clear the prompt
        setDeferredPrompt(null);
        setIsVisible(false);
    };

    if (!isVisible) return null;

    return (
        <div className="fixed bottom-4 left-4 right-4 z-[9999] animate-fade-in-up">
            <div className="bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 p-4 rounded-xl shadow-2xl flex items-center justify-between border border-zinc-700 dark:border-zinc-200">
                <div className="flex items-center space-x-3">
                    <div className="p-2 bg-indigo-600 rounded-lg text-white">
                        <Icon name="DOWNLOAD" className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="font-bold text-sm">Install App</h3>
                        <p className="text-xs opacity-80">Add to Home Screen for offline access</p>
                    </div>
                </div>
                <div className="flex items-center space-x-2">
                    <button 
                        onClick={() => setIsVisible(false)} 
                        className="p-2 hover:bg-zinc-800 dark:hover:bg-zinc-100 rounded-lg transition-colors"
                        aria-label="Dismiss"
                    >
                        <Icon name="CLOSE" className="w-4 h-4" />
                    </button>
                    <button 
                        onClick={handleInstallClick} 
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors"
                    >
                        Install
                    </button>
                </div>
            </div>
        </div>
    );
};

export default InstallPrompt;
