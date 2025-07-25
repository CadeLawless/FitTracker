import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTheme = async () => {
      const userResult = await supabase.auth.getUser();
      const user = userResult?.data.user;

      if (user?.user_metadata?.theme === 'dark' || user?.user_metadata?.theme === 'light') {
        setTheme(user.user_metadata.theme);
      } else {
        // Fallback: system preference
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const defaultTheme: Theme = prefersDark ? 'dark' : 'light';
        setTheme(defaultTheme);
      }

      setLoading(false);
    };

    loadTheme();
  }, []);
  
  useEffect(() => {
    // Apply theme to document
    if (loading) return;

    // Apply theme to document
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme, loading]);

  const toggleTheme = async () => {
    const newTheme: Theme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);

    const user = await supabase.auth.getUser();

    if (user) {
      await supabase.auth.updateUser({
        data: { theme: newTheme }
      });
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {!loading && children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}