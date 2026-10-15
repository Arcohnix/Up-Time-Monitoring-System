import React, { useState } from 'react';
import {
  Play,
  Edit2,
  Trash2,
  Power,
  ExternalLink,
  Search,
  Activity,
  Plus,
  Server,
  ShieldAlert,
} from 'lucide-react';
import StatusBadge from './StatusBadge';
import ResponseTimeChart from './ResponseTimeChart';

export default function OverviewView({
  dashboardData,
  onSelectService,
  onEditService,
  onDeleteService,
  onTriggerCheck,
  onToggleActive,
  onOpenCreateModal,
  probingId = null,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterState, setFilterState] = useState('ALL'); // ALL, HEALTHY, DEGRADED, DOWN, DISABLED

  if (!dashboardData) return null;

  const {
    system_status,
    overall_uptime_percentage,
    overall_avg_response_time_ms,
    total_services,
    healthy_services,
    degraded_services,
    down_services,
    services = [],
    recent_response_times = [],
    active_incidents = [],
  } = dashboardData;

  const filteredServices = services.filter((svc) => {
    // Search
    const matchesSearch =
      svc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      svc.url.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;

    // Filter tab
    if (filterState === 'ALL') return true;
    if (filterState === 'DISABLED') return !svc.is_active;
    if (!svc.is_active) return false; // Other filters only apply to active services
    if (filterState === 'HEALTHY') return svc.current_state === 'HEALTHY';
    if (filterState === 'DEGRADED') return svc.current_state === 'FAILING';
    if (filterState === 'DOWN') return svc.current_state === 'DOWN';
    return true;
  });

  return (
    <div className="space-y-6">

      {/* 1. Overview Statistics (Matching Requirement 1) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {/* Overall Uptime */}
        <div className="p-4 bg-zinc-900/90 border border-zinc-800 rounded-xl">
          <div className="text-[11px] text-zinc-500 uppercase tracking-widest font-mono">
            Overall Uptime
          </div>
          <div className="text-2xl font-black font-mono mt-1 text-zinc-100">
            {overall_uptime_percentage.toFixed(2)}%
          </div>
          <div className="text-[11px] text-zinc-500 mt-1 font-mono">
            Global probe success
          </div>
        </div>

        {/* Avg Response Time */}
        <div className="p-4 bg-zinc-900/90 border border-zinc-800 rounded-xl">
          <div className="text-[11px] text-zinc-500 uppercase tracking-widest font-mono">
            Avg Latency
          </div>
          <div className="text-2xl font-black font-mono mt-1 text-cyan-400">
            {overall_avg_response_time_ms !== null && overall_avg_response_time_ms !== undefined
              ? `${Math.round(overall_avg_response_time_ms)}ms`
              : '—'}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1 font-mono">
            Across active targets
          </div>
        </div>

        {/* Total Services */}
        <div className="p-4 bg-zinc-900/90 border border-zinc-800 rounded-xl">
          <div className="text-[11px] text-zinc-500 uppercase tracking-widest font-mono">
            Total Services
          </div>
          <div className="text-2xl font-black font-mono mt-1 text-zinc-100">
            {total_services}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1 font-mono">
            Registered endpoints
          </div>
        </div>

        {/* Healthy Services */}
        <div className="p-4 bg-zinc-900/90 border border-zinc-800 rounded-xl">
          <div className="text-[11px] text-zinc-500 uppercase tracking-widest font-mono">
            Healthy Services
          </div>
          <div className="text-2xl font-black font-mono mt-1 text-emerald-400">
            {healthy_services}
          </div>
          <div className="text-[11px] text-emerald-500/70 mt-1 font-mono">
            Meeting SLO / threshold
          </div>
        </div>

        {/* Failing / Active Incidents */}
        <div className="p-4 bg-zinc-900/90 border border-zinc-800 rounded-xl">
          <div className="text-[11px] text-zinc-500 uppercase tracking-widest font-mono">
            Active Incidents
          </div>
          <div className={`text-2xl font-black font-mono mt-1 ${active_incidents.length > 0 || down_services > 0 ? 'text-rose-400' : 'text-zinc-100'}`}>
            {active_incidents.length}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1 font-mono">
            {down_services > 0 ? `${down_services} endpoint(s) down` : '0 ongoing outages'}
          </div>
        </div>
      </div>

      {/* Active Incidents Alert Banner */}
      {active_incidents.length > 0 && (
        <div className="p-4 bg-rose-950/20 border border-rose-800/40 rounded-xl">
          <div className="flex items-center gap-2 text-rose-300 font-mono text-xs font-bold mb-2">
            <ShieldAlert size={16} className="text-rose-400" />
            <span>ACTIVE INCIDENT DETECTED ({active_incidents.length})</span>
          </div>
          <div className="space-y-1.5">
            {active_incidents.map((inc) => (
              <div
                key={inc.id}
                onClick={() => onSelectService(inc.service_id)}
                className="text-xs font-mono text-zinc-300 hover:text-white cursor-pointer flex items-center justify-between"
              >
                <span>
                  <strong className="text-rose-400">Incident #{inc.id}:</strong> Service #{inc.service_id} — {inc.last_error_message || 'Probe failure'}
                </span>
                <span className="text-zinc-500 text-[11px]">
                  Started: {new Date(inc.started_at).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. Global Latency Trend Chart */}
      <div className="p-6 bg-zinc-900/90 border border-zinc-800 rounded-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity size={16} className="text-cyan-400" />
            <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest font-mono">
              RESPONSE TIME OVER TIME
            </h2>
          </div>
          <span className="text-xs text-zinc-500 font-mono">Global health probe latency</span>
        </div>

        <ResponseTimeChart points={recent_response_times} height={160} />
      </div>

      {/* 3. Service List Table (Matching Requirement 2) */}
      <div className="p-6 bg-zinc-900/90 border border-zinc-800 rounded-xl space-y-4">
        
        {/* Table Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Server size={16} className="text-zinc-400" />
            <h2 className="text-xs font-bold text-zinc-300 uppercase tracking-widest font-mono">
              MONITORED SERVICES ({services.length})
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-2.5 text-zinc-500" />
              <input
                type="text"
                placeholder="Filter services..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-md text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-700 font-mono"
              />
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center p-0.5 bg-zinc-950 border border-zinc-800 rounded-md text-[11px] font-mono">
              {['ALL', 'HEALTHY', 'DEGRADED', 'DOWN', 'DISABLED'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilterState(f)}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    filterState === f
                      ? 'bg-zinc-800 text-zinc-100 font-semibold'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            {/* Add Service Trigger */}
            <button
              onClick={onOpenCreateModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-semibold rounded bg-emerald-500 hover:bg-emerald-400 text-zinc-950 transition-colors cursor-pointer"
            >
              <Plus size={13} />
              <span>Add Service</span>
            </button>
          </div>
        </div>

        {/* Services Table */}
        {filteredServices.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="text-[11px] text-zinc-500 uppercase border-b border-zinc-800 bg-zinc-950/40">
                <tr>
                  <th className="py-2.5 px-3 font-medium">Service Name</th>
                  <th className="py-2.5 px-3 font-medium">URL</th>
                  <th className="py-2.5 px-3 font-medium">Status</th>
                  <th className="py-2.5 px-3 font-medium text-right">Uptime</th>
                  <th className="py-2.5 px-3 font-medium text-right">Response Time</th>
                  <th className="py-2.5 px-3 font-medium text-center">Status Code</th>
                  <th className="py-2.5 px-3 font-medium">Last Check</th>
                  <th className="py-2.5 px-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {filteredServices.map((svc) => (
                  <tr
                    key={svc.id}
                    className="hover:bg-zinc-800/40 transition-colors group cursor-pointer"
                    onClick={() => onSelectService(svc.id)}
                  >
                    {/* Service Name */}
                    <td className="py-3 px-3">
                      <div className="font-semibold text-zinc-200 group-hover:text-cyan-400 flex items-center gap-1.5">
                        <span>{svc.name}</span>
                      </div>
                      <div className="text-[10px] text-zinc-500">
                        Method: {svc.http_method} • Every {svc.check_interval_seconds}s
                      </div>
                    </td>

                    {/* URL */}
                    <td className="py-3 px-3 max-w-xs truncate text-zinc-400">
                      <span title={svc.url}>{svc.url}</span>
                    </td>

                    {/* Current Status */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <StatusBadge state={svc.current_state} isActive={svc.is_active} />
                    </td>

                    {/* Uptime */}
                    <td className="py-3 px-3 text-right font-semibold text-zinc-200 whitespace-nowrap">
                      {svc.uptime_percentage.toFixed(2)}%
                    </td>

                    {/* Response Time */}
                    <td className="py-3 px-3 text-right text-cyan-400 whitespace-nowrap">
                      {svc.avg_response_time_ms !== null && svc.avg_response_time_ms !== undefined
                        ? `${Math.round(svc.avg_response_time_ms)}ms`
                        : '—'}
                    </td>

                    {/* Status Code */}
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      {svc.last_status_code ? (
                        <span
                          className={`px-1.5 py-0.5 rounded text-[11px] font-semibold ${
                            svc.last_status_code >= 200 && svc.last_status_code < 300
                              ? 'bg-emerald-950/80 text-emerald-300'
                              : 'bg-rose-950/80 text-rose-300'
                          }`}
                        >
                          {svc.last_status_code}
                        </span>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>

                    {/* Last Check */}
                    <td className="py-3 px-3 text-zinc-400 whitespace-nowrap">
                      {svc.last_checked_at
                        ? new Date(svc.last_checked_at).toLocaleTimeString()
                        : 'Never'}
                    </td>

                    {/* Actions */}
                    <td
                      className="py-3 px-3 text-right whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => onTriggerCheck(svc.id)}
                          disabled={probingId === svc.id}
                          title="Run probe now"
                          className="p-1 rounded text-cyan-400 hover:bg-zinc-800 disabled:opacity-50"
                        >
                          <Play size={13} fill="currentColor" className={probingId === svc.id ? 'animate-spin' : ''} />
                        </button>

                        <button
                          onClick={() => onToggleActive(svc.id, !svc.is_active)}
                          title={svc.is_active ? 'Pause monitoring' : 'Resume monitoring'}
                          className={`p-1 rounded hover:bg-zinc-800 ${svc.is_active ? 'text-zinc-400' : 'text-emerald-400'}`}
                        >
                          <Power size={13} />
                        </button>

                        <button
                          onClick={() => onEditService(svc)}
                          title="Edit configuration"
                          className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                        >
                          <Edit2 size={13} />
                        </button>

                        <button
                          onClick={() => onDeleteService(svc.id, svc.name)}
                          title="Delete service"
                          className="p-1 rounded text-zinc-500 hover:text-rose-400 hover:bg-zinc-800"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 text-center text-xs font-mono text-zinc-500 border border-dashed border-zinc-800 rounded-lg">
            {services.length === 0
              ? 'No services registered yet. Click "Add Service" above to start monitoring.'
              : 'No services match the current filter or search criteria.'}
          </div>
        )}

      </div>

    </div>
  );
}
