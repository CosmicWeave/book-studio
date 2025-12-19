
import React, { useState, useRef } from 'react';
import Icon from './Icon';

interface PullToRefreshProps {
    onRefresh: () => Promise<void>;
    children: React.ReactNode;
    className?: string;
    scrollRef?: React.RefObject<HTMLElement>;
}

const PullToRefresh: React.FC<PullToRefreshProps> = ({ onRefresh, children, className = '', scrollRef }) => {
    const [pullDistance, setPullDistance] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    
    // Internal ref fallback if one isn't provided
    const internalRef = useRef<HTMLDivElement>(null);
    const targetRef = (scrollRef as React.RefObject<HTMLDivElement>) || internalRef;
    
    const startY = useRef(0);
    const THRESHOLD = 80;

    const handleTouchStart = (e: React.TouchEvent) => {
        if (targetRef.current && targetRef.current.scrollTop <= 1) {
            startY.current = e.touches[0].clientY;
        } else {
            startY.current = 0;
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!startY.current || isRefreshing || (targetRef.current && targetRef.current.scrollTop > 1)) return;
        
        const currentY = e.touches[0].clientY;
        const diff = currentY - startY.current;

        if (diff > 0) {
            // Add resistance
            // f(x) = x^0.7 to dampen the pull
            const damped = Math.pow(diff, 0.8) * 1.5;
            setPullDistance(Math.min(damped, THRESHOLD * 2));
            
            // Prevent browser's native pull-to-refresh if possible (overscroll-behavior helps too)
            if (e.cancelable && diff < 200) {
                // e.preventDefault(); // Can interfere with some scrolling
            }
        } else {
            setPullDistance(0);
        }
    };

    const handleTouchEnd = async () => {
        if (!startY.current || isRefreshing) return;
        
        if (pullDistance > THRESHOLD) {
            setIsRefreshing(true);
            setPullDistance(THRESHOLD); // Snap to threshold
            try {
                await onRefresh();
            } finally {
                setIsRefreshing(false);
            }
        }
        setPullDistance(0);
        startY.current = 0;
    };

    return (
        <div 
            className={`relative flex flex-col h-full overflow-hidden ${className}`}
        >
            {/* Refresh Indicator */}
            <div 
                className="absolute top-0 left-0 right-0 flex justify-center items-start pointer-events-none z-20"
                style={{ 
                    height: `${Math.max(pullDistance, isRefreshing ? THRESHOLD : 0)}px`,
                    transition: isRefreshing ? 'height 0.2s' : 'height 0.2s cubic-bezier(0,0,0.2,1)'
                }}
            >
                <div 
                    className="bg-white dark:bg-zinc-800 rounded-full p-2 shadow-md border border-zinc-200 dark:border-zinc-700 mt-4 flex items-center justify-center transform transition-all"
                    style={{
                        transform: `scale(${Math.min(pullDistance / THRESHOLD, 1)}) rotate(${pullDistance * 2}deg)`,
                        opacity: Math.min(pullDistance / (THRESHOLD * 0.5), 1)
                    }}
                >
                    <Icon name={isRefreshing ? "ROTATE_CW" : "CLOUD_CHECK"} className={`w-5 h-5 text-indigo-600 ${isRefreshing ? 'animate-spin' : ''}`} />
                </div>
            </div>
            
            <div 
                ref={targetRef}
                className="flex-1 overflow-y-auto overscroll-y-contain relative z-10"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                style={{
                    transform: `translateY(${pullDistance}px)`,
                    transition: isRefreshing ? 'transform 0.2s' : 'transform 0.2s cubic-bezier(0,0,0.2,1)' 
                }}
            >
                {children}
            </div>
        </div>
    );
};
export default PullToRefresh;
