import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'jobtrack_theme';

const CHART_COLORS = {
  dark: {
    grid: 'rgba(232,236,248,0.08)',
    axis: '#93a0bd',
    blue: '#6ea8ff',
    accent: '#3ee0b4',
    faded: 'rgba(147,160,189,0.35)',
    status: {
      Saved: '#93a0bd',
      Applied: '#6ea8ff',
      OA: '#f0b429',
      Interview: '#b79bff',
      Offer: '#3ee0b4',
      Rejected: '#ff7a7a',
    },
  },
  light: {
    grid: 'rgba(15,23,42,0.08)',
    axis: '#5b6680',
    blue: '#2563eb',
    accent: '#0e9f78',
    faded: 'rgba(91,102,128,0.3)',
    status: {
      Saved: '#7b8499',
      Applied: '#2563eb',
      OA: '#c27c0e',
      Interview: '#7c3aed',
      Offer: '#0e9f78',
      Rejected: '#dc2626',
    },
  },
};

function initialTheme() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(initialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      chart: CHART_COLORS[theme],
      toggleTheme: () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark')),
    }),
    [theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
