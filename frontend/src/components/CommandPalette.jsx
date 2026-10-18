import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Activity,
  ShieldAlert,
  BarChart3,
  Settings,
  Plus,
  Play,
  Moon,
  Sun,
  Server,
  ArrowRight,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function CommandPalette({
  isOpen,
  onClose,
  services = [],
  onSelectService,
  onOpenCreateModal,
  onTriggerCheckAll,
  onNavigateTab,
}) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const { resolvedTheme, toggleTheme } = useTheme();

  // Reset query and focus when opening
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Global shortcut ⌘K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          // Open handled by parent or state
        }
      } else if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Assemble searchable items
  const items = React.useMemo(() => {
    const list = [];

    // Quick Actions
    list.push({
      id: 'action-create',
      category: 'Actions',
      label: 'Add New Monitor',
      icon: Plus,
      action: () => {
        onOpenCreateModal();
        onClose();
      },
    });

    list.push({
      id: 'action-check-all',
      category: 'Actions',
      label: 'Trigger Probe on All Targets',
      icon: Play,
      action: () => {
        onTriggerCheckAll();
        onClose();
      },
    });

    list.push({
      id: 'action-toggle-theme',
      category: 'Actions',
      label: `Switch to ${resolvedTheme === 'dark' ? 'Light' : 'Dark'} Mode`,
      icon: resolvedTheme === 'dark' ? Sun : Moon,
      action: () => {
        toggleTheme();
        onClose();
      },
    });

    // Navigation
    list.push({
      id: 'nav-overview',
      category: 'Navigation',
      label: 'Go to Overview',
      icon: Activity,
      action: () => {
        onNavigateTab('OVERVIEW');
        onClose();
      },
    });

    list.push({
      id: 'nav-monitors',
      category: 'Navigation',
      label: 'Go to Monitors',
      icon: Server,
      action: () => {
        onNavigateTab('MONITORS');
        onClose();
      },
    });

    list.push({
      id: 'nav-incidents',
      category: 'Navigation',
      label: 'Go to Incidents',
      icon: ShieldAlert,
      action: () => {
        onNavigateTab('INCIDENTS');
        onClose();
      },
    });

    list.push({
      id: 'nav-analytics',
      category: 'Navigation',
      label: 'Go to Analytics',
      icon: BarChart3,
      action: () => {
        onNavigateTab('ANALYTICS');
        onClose();
      },
    });

    list.push({
      id: 'nav-settings',
      category: 'Navigation',
      label: 'Go to Settings',
      icon: Settings,
      action: () => {
        onNavigateTab('SETTINGS');
        onClose();
      },
    });

    // Monitored Services
    services.forEach((s) => {
      list.push({
        id: `svc-${s.id}`,
        category: 'Monitors',
        label: s.name,
        meta: s.url,
        icon: Server,
        action: () => {
          onSelectService(s.id);
          onClose();
        },
      });
    });

    if (!query.trim()) return list;

    const q = query.toLowerCase();
    return list.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        (item.meta && item.meta.toLowerCase().includes(q)) ||
        item.category.toLowerCase().includes(q)
    );
  }, [
    query,
    services,
    resolvedTheme,
    onOpenCreateModal,
    onTriggerCheckAll,
    toggleTheme,
    onNavigateTab,
    onSelectService,
    onClose,
  ]);

  // Keyboard navigation within command palette
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, items.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + items.length) % Math.max(1, items.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (items[selectedIndex]) {
        items[selectedIndex].action();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-98 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[var(--border-subtle)]">
          <Search size={15} className="text-[var(--text-muted)] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search monitors, pages, commands... (Type to filter)"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            className="w-full text-xs bg-transparent text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none"
          />
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-[var(--text-muted)] bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] rounded">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto py-2">
          {items.length === 0 ? (
            <div className="py-8 text-center text-xs text-[var(--text-muted)]">
              No matching commands or monitors found.
            </div>
          ) : (
            items.map((item, index) => {
              const isSelected = index === selectedIndex;
              const IconComponent = item.icon;

              return (
                <div
                  key={item.id}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`flex items-center justify-between px-4 py-2 text-xs cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-[var(--accent-subtle)] text-[var(--text-primary)]'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <IconComponent
                      size={14}
                      className={isSelected ? 'text-[var(--accent-primary)]' : 'text-[var(--text-muted)]'}
                    />
                    <span className="font-medium truncate">{item.label}</span>
                    {item.meta && (
                      <span className="text-[11px] text-[var(--text-muted)] truncate max-w-xs font-mono">
                        {item.meta}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] px-1.5 py-0.5 rounded bg-[var(--bg-surface-subtle)]">
                      {item.category}
                    </span>
                    {isSelected && <ArrowRight size={12} className="text-[var(--accent-primary)]" />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Shortcut Hints */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] text-[11px] text-[var(--text-muted)]">
          <div className="flex items-center gap-3">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
          </div>
          <span>UTMS Command Palette</span>
        </div>
      </div>
    </div>
  );
}
