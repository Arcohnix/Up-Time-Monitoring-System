import React, { useState } from 'react';
import {
  Search,
  Plus,
  Play,
  Edit2,
  Trash2,
  Power,
  ExternalLink,
} from 'lucide-react';
import StatusIndicator from './StatusIndicator';

export default function MonitorsView({
  services = [],
  onSelectService,
  onEditService,
  onDeleteService,
  onTriggerCheck,
  onToggleActive,
  onOpenCreateModal,
  probingId = null,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterState, setFilterState] = useState('ALL'); // ALL, HEALTHY, DEGRADED, DOWN, PAUSED

  const filteredServices = services.filter((svc) => {
    // Search
    const matchesSearch =
      svc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      svc.url.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;

    // Filter
    if (filterState === 'ALL') return true;
    if (filterState === 'PAUSED') return !svc.is_active;
    if (!svc.is_active) return false;
    if (filterState === 'HEALTHY') return svc.current_state === 'HEALTHY';
    if (filterState === 'DEGRADED') return svc.current_state === 'FAILING' || svc.current_state === 'DEGRADED';
    if (filterState === 'DOWN') return svc.current_state === 'DOWN';
    return true;
  });

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      {/* Page Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold tracking-tight text-[var(--text-primary)]">
            Monitored Endpoints
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Active health probes and HTTP availability tracking
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Add Monitor Button */}
          <button
            onClick={onOpenCreateModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white shadow-xs transition-colors cursor-pointer"
          >
            <Plus size={13} />
            <span>Add Monitor</span>
          </button>
        </div>
      </div>

      {/* Table Toolbar */}
      <div className="p-3 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-[var(--shadow-subtle)] flex flex-wrap items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={13} className="absolute left-2.5 top-2.5 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Filter by name or URL..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1 text-xs bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] rounded-md text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)] transition-colors"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center p-0.5 bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] rounded-lg text-[11px]">
          {['ALL', 'HEALTHY', 'DEGRADED', 'DOWN', 'PAUSED'].map((f) => (
            <button
              key={f}
              onClick={() => setFilterState(f)}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                filterState === f
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] font-medium shadow-xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Monitors Table */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-[var(--shadow-subtle)] overflow-hidden">
        {filteredServices.length === 0 ? (
          <div className="py-16 text-center text-xs text-[var(--text-muted)]">
            No monitors matched your search or filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]">
                <tr>
                  <th className="py-2.5 px-4 font-medium">Service</th>
                  <th className="py-2.5 px-4 font-medium">Status</th>
                  <th className="py-2.5 px-4 font-medium text-right">Response Time</th>
                  <th className="py-2.5 px-4 font-medium text-right">Uptime</th>
                  <th className="py-2.5 px-4 font-medium text-center">Interval</th>
                  <th className="py-2.5 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {filteredServices.map((svc) => (
                  <tr
                    key={svc.id}
                    onClick={() => onSelectService(svc.id)}
                    className="hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer group"
                  >
                    {/* Service Name & URL */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[var(--text-primary)] group-hover:text-[var(--accent-text)] transition-colors">
                          {svc.name}
                        </span>
                        <a
                          href={svc.url}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="opacity-0 group-hover:opacity-100 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-opacity"
                          title="Open URL in new tab"
                        >
                          <ExternalLink size={11} />
                        </a>
                      </div>
                      <div className="text-[11px] text-[var(--text-muted)] font-mono truncate max-w-xs mt-0.5">
                        {svc.url}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4">
                      <StatusIndicator state={svc.current_state} isActive={svc.is_active} />
                    </td>

                    {/* Response Time */}
                    <td className="py-3 px-4 text-right font-mono">
                      {svc.recent_latency_ms !== null && svc.recent_latency_ms !== undefined ? (
                        <span className="text-[var(--text-primary)] font-medium">
                          {Math.round(svc.recent_latency_ms)}ms
                        </span>
                      ) : (
                        <span className="text-[var(--text-muted)]">—</span>
                      )}
                    </td>

                    {/* Uptime */}
                    <td className="py-3 px-4 text-right font-mono text-[var(--text-secondary)]">
                      {svc.uptime_percentage !== null && svc.uptime_percentage !== undefined
                        ? `${svc.uptime_percentage.toFixed(1)}%`
                        : '100%'}
                    </td>

                    {/* Interval */}
                    <td className="py-3 px-4 text-center font-mono text-[11px] text-[var(--text-muted)]">
                      {svc.check_interval_seconds || svc.check_interval}s
                    </td>

                    {/* Row Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        {/* Probe Now */}
                        <button
                          onClick={() => onTriggerCheck(svc.id)}
                          disabled={probingId === svc.id}
                          title="Probe endpoint now"
                          className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)] transition-colors cursor-pointer"
                        >
                          <Play
                            size={12}
                            fill="currentColor"
                            className={probingId === svc.id ? 'animate-spin text-[var(--accent-primary)]' : ''}
                          />
                        </button>

                        {/* Toggle Active / Pause */}
                        <button
                          onClick={() => onToggleActive(svc.id, !svc.is_active)}
                          title={svc.is_active ? 'Pause monitoring' : 'Resume monitoring'}
                          className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)] transition-colors cursor-pointer"
                        >
                          <Power size={12} className={svc.is_active ? 'text-[var(--status-healthy-dot)]' : 'text-[var(--text-muted)]'} />
                        </button>

                        {/* Edit */}
                        <button
                          onClick={() => onEditService(svc)}
                          title="Edit monitor settings"
                          className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)] transition-colors cursor-pointer"
                        >
                          <Edit2 size={12} />
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => onDeleteService(svc.id, svc.name)}
                          title="Delete monitor"
                          className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--status-down-dot)] hover:bg-[var(--bg-surface-subtle)] transition-colors cursor-pointer"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
