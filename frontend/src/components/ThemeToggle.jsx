import React, { useState, useRef, useEffect } from 'react';
import { Sun, Moon, Laptop } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] transition-colors cursor-pointer flex items-center justify-center"
        aria-label="Toggle color theme"
        title={`Theme: ${theme}`}
      >
        {resolvedTheme === 'dark' ? (
          <Moon size={14} className="transition-transform duration-200" />
        ) : (
          <Sun size={14} className="transition-transform duration-200" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-1.5 w-32 py-1 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg shadow-[var(--shadow-dropdown)] z-50 text-xs">
          <button
            onClick={() => {
              setTheme('light');
              setOpen(false);
            }}
            className={`w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors cursor-pointer ${
              theme === 'light'
                ? 'text-[var(--accent-text)] bg-[var(--accent-subtle)] font-medium'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]'
            }`}
          >
            <Sun size={13} />
            <span>Light</span>
          </button>
          <button
            onClick={() => {
              setTheme('dark');
              setOpen(false);
            }}
            className={`w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors cursor-pointer ${
              theme === 'dark'
                ? 'text-[var(--accent-text)] bg-[var(--accent-subtle)] font-medium'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]'
            }`}
          >
            <Moon size={13} />
            <span>Dark</span>
          </button>
          <button
            onClick={() => {
              setTheme('system');
              setOpen(false);
            }}
            className={`w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors cursor-pointer ${
              theme === 'system'
                ? 'text-[var(--accent-text)] bg-[var(--accent-subtle)] font-medium'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]'
            }`}
          >
            <Laptop size={13} />
            <span>System</span>
          </button>
        </div>
      )}
    </div>
  );
}
