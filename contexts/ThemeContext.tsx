import React, { createContext, useState, useEffect, useContext, ReactNode, useCallback, useMemo } from 'react';
import { db } from '../services/apiClient';

type Theme = 'light' | 'dark';
const THEME_SETTING_ID = 'theme';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [theme, setTheme] = useState<Theme>(() => {
        if (typeof window !== 'undefined') {
            const storedTheme = localStorage.getItem('theme') as Theme;
            if (storedTheme) {
                return storedTheme;
            }
            return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        return 'light';
    });
    const [themeLoaded, setThemeLoaded] = useState(false);

    useEffect(() => {
        let cancelled = false;

        const loadTheme = async () => {
            try {
                const setting = await db.settings.get(THEME_SETTING_ID);
                if (cancelled) return;
                if (setting?.value === 'light' || setting?.value === 'dark') {
                    setTheme(setting.value);
                } else {
                    const legacyTheme = localStorage.getItem('theme') as Theme | null;
                    if (legacyTheme === 'light' || legacyTheme === 'dark') {
                        setTheme(legacyTheme);
                        await db.settings.put({ id: THEME_SETTING_ID, value: legacyTheme });
                        localStorage.removeItem('theme');
                    }
                }
            } catch (error) {
                console.error('Failed to load theme from db.settings', error);
            } finally {
                if (!cancelled) {
                    setThemeLoaded(true);
                }
            }
        };

        void loadTheme();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        const root = window.document.documentElement;
        if (theme === 'dark') {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
        if (themeLoaded) {
            void db.settings.put({ id: THEME_SETTING_ID, value: theme });
            localStorage.removeItem('theme');
        }
    }, [theme, themeLoaded]);

    const toggleTheme = useCallback(() => {
        setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
    }, []);

    const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};