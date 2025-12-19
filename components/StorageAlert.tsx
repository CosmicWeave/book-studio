
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStorageStats, StorageStats } from '../services/storageService';
import Icon from './Icon';

const StorageAlert: React.FC = () => {
    const navigate = useNavigate();
    const [stats, setStats] = useState<StorageStats | null>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [dismissed, setDismissed] = useState(false);

    const WARNING_THRESHOLD = 80;
    const CRITICAL_THRESHOLD = 90;

    useEffect(() => {
        const checkStorage = async () => {
            if (dismissed) return;
            
            const data = await getStorageStats();
            if (data && data.percentUsed > WARNING_THRESHOLD) {
                setStats(data);
                setIsVisible(true);
            } else {
                setIsVisible(false);
            }
        };

        checkStorage();
        const interval = setInterval(checkStorage, 60000); // Check every minute
        return () => clearInterval(interval);
    }, [dismissed]);

    if (!isVisible || !stats) return null;

    const isCritical = stats.percentUsed > CRITICAL_THRESHOLD;
    const bgColor = isCritical ? 'bg-red-50 dark:bg-red-900/30' : 'bg-amber-50 dark:bg-amber-900/30';
    const borderColor = isCritical ? 'border-red-200 dark:border-red-800' : 'border-amber-200 dark:border-amber-800';
    const iconColor = isCritical ? 'text-red-500' : 'text-amber-500';
    const textColor = isCritical ? 'text-red-800 dark:text-red-200' : 'text-amber-800 dark:text-amber-200';

    return (
        <div className={`fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-[9998] p-4 rounded-xl border shadow-lg backdrop-blur-md animate-slide-in-up ${bgColor} ${borderColor}`}>
            <div className="flex items-start gap-3">
                <div className={`p-2 rounded-full bg-white/50 dark:bg-black/20 ${iconColor}`}>
                    <Icon name="ALERT_TRIANGLE" className="w-6 h-6" />
                </div>
                <div className="flex-1">
                    <h3 className={`font-bold text-sm ${textColor}`}>
                        {isCritical ? 'Storage Critical' : 'Storage Running Low'}
                    </h3>
                    <p className={`text-xs mt-1 ${textColor} opacity-90`}>
                        You have used {stats.percentUsed.toFixed(1)}% of your available browser storage. 
                        {isCritical ? ' Please backup and delete old data immediately to prevent data loss.' : ' Consider backing up and clearing unused data.'}
                    </p>
                    <div className="mt-3 flex gap-2">
                        <button 
                            onClick={() => {
                                setDismissed(true);
                                navigate('/settings');
                            }}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-md shadow-sm bg-white dark:bg-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors ${iconColor}`}
                        >
                            Manage Data
                        </button>
                        <button 
                            onClick={() => setDismissed(true)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors hover:bg-black/5 dark:hover:bg-white/5 ${textColor}`}
                        >
                            Dismiss
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StorageAlert;
