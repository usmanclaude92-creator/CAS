import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: ThemeMode;
  effectiveTheme: 'light' | 'dark';
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const THEME_STORAGE_KEY = 'construction_theme_pref_v1';

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  effectiveTheme: 'light',
  setTheme: () => {},
  toggleTheme: () => {},
});

// Non-sensitive cookie read/write helper
function getCookie(name: string): string | null {
  try {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
  } catch {
    return null;
  }
}

function setCookie(name: string, value: string, days = 365) {
  try {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
  } catch (e) {
    console.warn('Failed to set theme cookie:', e);
  }
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    // 1. Check non-sensitive cookie
    const cookieVal = getCookie(THEME_STORAGE_KEY);
    if (cookieVal === 'light' || cookieVal === 'dark' || cookieVal === 'system') {
      return cookieVal;
    }
    // 2. Fallback check local storage
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        return stored;
      }
    } catch {
      // ignore
    }
    return 'light'; // Default to clean light mode
  });

  const [effectiveTheme, setEffectiveTheme] = useState<'light' | 'dark'>('light');

  // Compute effective theme based on system media query
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const computeEffective = (currentTheme: ThemeMode): 'light' | 'dark' => {
      if (currentTheme === 'system') {
        return mediaQuery.matches ? 'dark' : 'light';
      }
      return currentTheme;
    };

    const resolved = computeEffective(theme);
    setEffectiveTheme(resolved);

    // Apply to <html> classList
    const root = document.documentElement;
    if (resolved === 'dark') {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    }

    const handleChange = () => {
      if (theme === 'system') {
        const nextEffective = mediaQuery.matches ? 'dark' : 'light';
        setEffectiveTheme(nextEffective);
        if (nextEffective === 'dark') {
          root.classList.add('dark');
          root.style.colorScheme = 'dark';
        } else {
          root.classList.remove('dark');
          root.style.colorScheme = 'light';
        }
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  const setTheme = (mode: ThemeMode) => {
    setThemeState(mode);
    setCookie(THEME_STORAGE_KEY, mode);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch {
      // ignore
    }
  };

  const toggleTheme = () => {
    setTheme(effectiveTheme === 'dark' ? 'light' : 'dark');
  };

  return (
    <ThemeContext.Provider value={{ theme, effectiveTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
export default ThemeProvider;
