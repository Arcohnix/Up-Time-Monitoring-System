import React, { useState } from 'react';
import {
  Activity,
  Server,
  ShieldAlert,
  BarChart3,
  Settings,
  Search,
  Plus,
  Play,
  Menu,
  X,
} from 'lucide-react';
import ThemeToggle from './ThemeToggle';

export default function AppShell({
  activeTab,
  onNavigateTab,
  systemStatus,
  activeIncidentCount = 0,
  probingAll = false,
  onTriggerCheckAll,
  onOpenCreateModal,
  onOpenCommandPalette,
  lastSync,
  children,
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isSystemOnline = systemStatus === 'SYSTEM ONLINE';

  const navItems = [
    { id: 'OVERVIEW', label: 'Overview', icon: Activity },
    { id: 'MONITORS', label: 'Monitors', icon: Server },
    {
      id: 'INCIDENTS',
      label: 'Incidents',
      icon: ShieldAlert,
      badge: activeIncidentCount > 0 ? activeIncidentCount : null,
    },
    { id: 'ANALYTICS', label: 'Analytics', icon: BarChart3 },
  ];

  const secondaryNavItems = [
    { id: 'SETTINGS', label: 'Settings', icon: Settings },
  ];

  const getBreadcrumbTitle = () => {
    switch (activeTab) {
      case 'OVERVIEW':
        return 'Overview';
      case 'MONITORS':
        return 'Monitors';
      case 'INCIDENTS':
        return 'Incidents';
      case 'ANALYTICS':
        return 'Analytics';
      case 'SETTINGS':
        return 'Settings';
      case 'SERVICE_DETAIL':
        return 'Monitor Detail';
      default:
        return 'Dashboard';
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] flex">
      {/* =====================================================================
          1. DESKTOP SIDEBAR
          Compact, deliberate, quiet confidence, whitespace
          ===================================================================== */}
      <aside className="hidden md:flex flex-col w-56 shrink-0 border-r border-[var(--border-subtle)] bg-[var(--bg-sidebar)] justify-between select-none">
        <div>
          {/* Brand Header */}
          <div className="h-14 flex items-center gap-2.5 px-5 border-b border-[var(--border-subtle)]">
            <div className="w-5 h-5 rounded-md bg-[var(--accent-subtle)] border border-[var(--accent-border)] flex items-center justify-center text-[var(--accent-primary)] font-semibold text-[11px] tracking-tight">
              U
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-xs tracking-tight text-[var(--text-primary)]">
                UTMS
              </span>
              <span className="text-[10px] text-[var(--text-muted)] font-mono">
                fleet
              </span>
            </div>
          </div>

          {/* Primary Navigation */}
          <nav className="p-3 space-y-0.5">
            <div className="px-2 pb-1.5 text-[10px] uppercase tracking-wider font-medium text-[var(--text-muted)]">
              Fleet
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => onNavigateTab(item.id)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-[var(--accent-subtle)] text-[var(--accent-text)] font-medium'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon size={14} className={isActive ? 'text-[var(--accent-primary)]' : 'text-[var(--text-muted)]'} />
                    <span>{item.label}</span>
                  </div>

                  {item.badge !== null && item.badge !== undefined && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-[var(--status-down-bg)] text-[var(--status-down-text)] border border-[var(--status-down-border)]">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}

            <div className="pt-3 pb-1.5 px-2 text-[10px] uppercase tracking-wider font-medium text-[var(--text-muted)]">
              System
            </div>
            {secondaryNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => onNavigateTab(item.id)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-[var(--accent-subtle)] text-[var(--accent-text)] font-medium'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon size={14} className={isActive ? 'text-[var(--accent-primary)]' : 'text-[var(--text-muted)]'} />
                    <span>{item.label}</span>
                  </div>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer: System Status & Version */}
        <div className="p-3 border-t border-[var(--border-subtle)] space-y-2">
          {/* Status Pill */}
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-md bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[11px]">
            <div className="flex items-center gap-2">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isSystemOnline ? 'bg-[var(--status-healthy-dot)] pulse-green' : 'bg-[var(--status-down-dot)] pulse-red'
                }`}
              />
              <span className="text-[var(--text-secondary)] font-medium">
                {isSystemOnline ? 'Operational' : 'Degraded'}
              </span>
            </div>
            {lastSync && (
              <span className="text-[10px] text-[var(--text-muted)] font-mono">
                {lastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
          </div>

          <div className="px-2 text-[10px] text-[var(--text-faint)] flex items-center justify-between">
            <span>UTMS Core</span>
            <span className="font-mono">v1.4.0</span>
          </div>
        </div>
      </aside>

      {/* =====================================================================
          2. MAIN CONTENT AREA & TOP BAR
          ===================================================================== */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Minimal Top Bar */}
        <header className="h-14 shrink-0 flex items-center justify-between px-4 sm:px-6 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] select-none">
          {/* Left: Breadcrumbs / Mobile Hamburger */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="md:hidden p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] cursor-pointer"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X size={16} /> : <Menu size={16} />}
            </button>

            <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
              <span>Fleet</span>
              <span>/</span>
              <span className="text-[var(--text-primary)] font-medium">
                {getBreadcrumbTitle()}
              </span>
            </div>
          </div>

          {/* Right: Quick Search, Check All, Add Service, Theme Toggle */}
          <div className="flex items-center gap-2">
            {/* Command Palette Trigger */}
            <button
              onClick={onOpenCommandPalette}
              className="hidden sm:inline-flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-md bg-[var(--bg-surface-subtle)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              title="Search monitors and commands (⌘K / Ctrl+K)"
            >
              <Search size={13} />
              <span>Search</span>
              <kbd className="px-1.5 py-0.2 text-[10px] font-mono rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-muted)]">
                ⌘K
              </kbd>
            </button>

            {/* Check All Probe */}
            <button
              onClick={onTriggerCheckAll}
              disabled={probingAll}
              title="Trigger health probe across all active targets"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Play size={11} fill="currentColor" className={probingAll ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">{probingAll ? 'Probing...' : 'Check All'}</span>
            </button>

            {/* Add Service (Soft Purple Accent) */}
            <button
              onClick={onOpenCreateModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white shadow-xs transition-colors cursor-pointer"
            >
              <Plus size={13} />
              <span>Add Monitor</span>
            </button>

            {/* Theme Switcher */}
            <ThemeToggle />
          </div>
        </header>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 space-y-1 animate-in slide-in-from-top-2 duration-150">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onNavigateTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-[var(--accent-subtle)] text-[var(--accent-text)] font-medium'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon size={15} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== null && item.badge !== undefined && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--status-down-bg)] text-[var(--status-down-text)]">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
            <div className="border-t border-[var(--border-subtle)] my-1" />
            {secondaryNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onNavigateTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-[var(--accent-subtle)] text-[var(--accent-text)] font-medium'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)]'
                  }`}
                >
                  <Icon size={15} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Page Content Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-6xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
