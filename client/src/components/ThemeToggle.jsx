import { useTheme } from '../context/ThemeContext';

export default function ThemeToggle({ compact = false }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      className={`theme-toggle ${compact ? 'compact' : ''}`}
      role="switch"
      aria-checked={!isDark}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      onClick={toggleTheme}
    >
      <span className="theme-track">
        <span className="theme-thumb">{isDark ? '🌙' : '☀️'}</span>
      </span>
      {compact ? null : <span>{isDark ? 'Dark mode' : 'Light mode'}</span>}
    </button>
  );
}
