import React, { useState } from 'react';
import {
  Play,
  Edit2,
  Trash2,
  Power,
  Search,
  Activity,
  Plus,
  Server,
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
    overall_uptime_percentage,
    overall_avg_response_time_ms,
    total_services,
    healthy_services,
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

      {/* 1. Overview Statistics (Neutral Metric Cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {/* Overall Uptime */}
        <div className="p-5 bg-white border border-[#E5E7EB] rounded-xl shadow-xs">
          <div className="text-xs font-medium text-[#71717A]">
            Overall Uptime
          </div>
          <div className="text-2xl sm:text-3xl font-semibold text-[#18181B] tracking-tight mt-1">
            {overall_uptime_percentage.toFixed(2)}%
          </div>
          <div className="text-[11px] text-[#A1A1AA] mt-1">
            Global probe success
          </div>
        </div>

        {/* Avg Response Time */}
        <div className="p-5 bg-white border border-[#E5E7EB] rounded-xl shadow-xs">
          <div className="text-xs font-medium text-[#71717A]">
            Avg Latency
          </div>
          <div className="text-2xl sm:text-3xl font-semibold text-[#18181B] tracking-tight mt-1">
            {overall_avg_response_time_ms !== null && overall_avg_response_time_ms !== undefined
              ? `${Math.round(overall_avg_response_time_ms)}ms`
              : '—'}
          </div>
          <div className="text-[11px] text-[#A1A1AA] mt-1">
            Across active targets
          </div>
        </div>

        {/* Total Services */}
        <div className="p-5 bg-white border border-[#E5E7EB] rounded-xl shadow-xs">
          <div className="text-xs font-medium text-[#71717A]">
            Total Services
          </div>
          <div className="text-2xl sm:text-3xl font-semibold text-[#18181B] tracking-tight mt-1">
            {total_services}
          </div>
          <div className="text-[11px] text-[#A1A1AA] mt-1">
            Registered endpoints
          </div>
        </div>

        {/* Healthy Services */}
        <div className="p-5 bg-white border border-[#E5E7EB] rounded-xl shadow-xs">
          <div className="text-xs font-medium text-[#71717A]">
            Healthy Services
          </div>
          <div className="text-2xl sm:text-3xl font-semibold text-[#18181B] tracking-tight mt-1">
            {healthy_services}
          </div>
          <div className="text-[11px] text-[#A1A1AA] mt-1">
            Meeting SLO / threshold
          </div>
        </div>

        {/* Active Incidents */}
        <div className="p-5 bg-white border border-[#E5E7EB] rounded-xl shadow-xs">
          <div className="text-xs font-medium text-[#71717A] flex items-center justify-between">
            <span>Active Incidents</span>
            {active_incidents.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-[#C75C62] pulse-red" />
            )}
          </div>
          <div className="text-2xl sm:text-3xl font-semibold text-[#18181B] tracking-tight mt-1">
            {active_incidents.length}
          </div>
          <div className="text-[11px] text-[#A1A1AA] mt-1">
            {down_services > 0 ? `${down_services} endpoint(s) down` : '0 ongoing outages'}
          </div>
        </div>
      </div>

      {/* Active Incidents Subtle Alert Banner (Soft Status Down Colors) */}
      {active_incidents.length > 0 && (
        <div className="p-4 bg-[#FBEDEE] border border-[#C75C62]/20 rounded-xl">
          <div className="flex items-center gap-2 text-[#A63F46] text-xs font-semibold mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#C75C62] pulse-red" />
            <span>ACTIVE INCIDENT DETECTED ({active_incidents.length})</span>
          </div>
          <div className="space-y-1.5">
            {active_incidents.map((inc) => (
              <div
                key={inc.id}
                onClick={() => onSelectService(inc.service_id)}
                className="text-xs text-[#18181B] hover:text-[#A63F46] cursor-pointer flex items-center justify-between transition-colors"
              >
                <span>
                  <strong className="text-[#A63F46] font-medium">Incident #{inc.id}:</strong> Service #{inc.service_id} — {inc.last_error_message || 'Probe failure'}
                </span>
                <span className="text-[#71717A] text-[11px]">
                  Started: {new Date(inc.started_at).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. Global Latency Trend Chart */}
      <div className="p-6 bg-white border border-[#E5E7EB] rounded-xl shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity size={16} className="text-[#5865D8]" />
            <h2 className="text-xs font-semibold text-[#71717A] uppercase tracking-wider">
              RESPONSE TIME OVER TIME
            </h2>
          </div>
          <span className="text-xs text-[#A1A1AA]">Global health probe latency</span>
        </div>

        <ResponseTimeChart points={recent_response_times} height={160} />
      </div>

      {/* 3. Service List Table */}
      <div className="p-6 bg-white border border-[#E5E7EB] rounded-xl shadow-xs space-y-4">
        
        {/* Table Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-[#E5E7EB]">
          <div className="flex items-center gap-2">
            <Server size={16} className="text-[#71717A]" />
            <h2 className="text-xs font-semibold text-[#18181B] uppercase tracking-wider">
              MONITORED SERVICES ({services.length})
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Input */}
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-2.5 text-[#A1A1AA]" />
              <input
                type="text"
                placeholder="Filter services..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs bg-[#F7F8FA] border border-[#E5E7EB] rounded-lg text-[#18181B] placeholder-[#A1A1AA] focus:outline-none focus:border-[#5865D8] focus:bg-white focus:ring-1 focus:ring-[#5865D8] transition-colors"
              />
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center p-0.5 bg-[#F3F4F6] border border-[#E5E7EB] rounded-lg text-[11px]">
              {['ALL', 'HEALTHY', 'DEGRADED', 'DOWN', 'DISABLED'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilterState(f)}
                  className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                    filterState === f
                      ? 'bg-white text-[#18181B] font-semibold shadow-xs'
                      : 'text-[#71717A] hover:text-[#18181B]'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            {/* Add Service Trigger (5% Accent Color) */}
            <button
              onClick={onOpenCreateModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#5865D8] hover:bg-[#4754C4] text-white shadow-xs transition-colors cursor-pointer"
            >
              <Plus size={13} />
              <span>Add Service</span>
            </button>
          </div>
        </div>

        {/* Services Table */}
        {filteredServices.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[11px] text-[#71717A] uppercase tracking-wider border-b border-[#E5E7EB] bg-[#F7F8FA]">
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
              <tbody className="divide-y divide-[#E5E7EB]">
                {filteredServices.map((svc) => (
                  <tr
                    key={svc.id}
                    className="hover:bg-[#F7F8FA] transition-colors group cursor-pointer"
                    onClick={() => onSelectService(svc.id)}
                  >
                    {/* Service Name */}
                    <td className="py-3 px-3">
                      <div className="font-medium text-[#18181B] group-hover:text-[#5865D8] transition-colors flex items-center gap-1.5">
                        <span>{svc.name}</span>
                      </div>
                      <div className="text-[11px] text-[#71717A] mt-0.5">
                        {svc.http_method} • Every {svc.check_interval_seconds}s
                      </div>
                    </td>

                    {/* URL */}
                    <td className="py-3 px-3 max-w-xs truncate text-[#71717A] font-mono text-xs">
                      <span title={svc.url}>{svc.url}</span>
                    </td>

                    {/* Current Status */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <StatusBadge state={svc.current_state} isActive={svc.is_active} />
                    </td>

                    {/* Uptime */}
                    <td className="py-3 px-3 text-right font-medium text-[#18181B] whitespace-nowrap">
                      {svc.uptime_percentage.toFixed(2)}%
                    </td>

                    {/* Response Time */}
                    <td className="py-3 px-3 text-right text-[#71717A] font-medium whitespace-nowrap">
                      {svc.avg_response_time_ms !== null && svc.avg_response_time_ms !== undefined
                        ? `${Math.round(svc.avg_response_time_ms)}ms`
                        : '—'}
                    </td>

                    {/* Status Code */}
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      {svc.last_status_code ? (
                        <span
                          className={`px-1.5 py-0.5 rounded-md text-[11px] font-medium ${
                            svc.last_status_code >= 200 && svc.last_status_code < 300
                              ? 'bg-[#ECF7F0] text-[#347A55]'
                              : 'bg-[#FBEDEE] text-[#A63F46]'
                          }`}
                        >
                          {svc.last_status_code}
                        </span>
                      ) : (
                        <span className="text-[#A1A1AA]">—</span>
                      )}
                    </td>

                    {/* Last Check */}
                    <td className="py-3 px-3 text-[#71717A] whitespace-nowrap text-xs">
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
                          className="p-1 rounded-md text-[#71717A] hover:text-[#5865D8] hover:bg-[#F3F4F6] transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          <Play size={13} fill="currentColor" className={probingId === svc.id ? 'animate-spin' : ''} />
                        </button>

                        <button
                          onClick={() => onToggleActive(svc.id, !svc.is_active)}
                          title={svc.is_active ? 'Pause monitoring' : 'Resume monitoring'}
                          className={`p-1 rounded-md hover:bg-[#F3F4F6] transition-colors cursor-pointer ${
                            svc.is_active ? 'text-[#71717A] hover:text-[#18181B]' : 'text-[#4D9F72]'
                          }`}
                        >
                          <Power size={13} />
                        </button>

                        <button
                          onClick={() => onEditService(svc)}
                          title="Edit configuration"
                          className="p-1 rounded-md text-[#71717A] hover:text-[#18181B] hover:bg-[#F3F4F6] transition-colors cursor-pointer"
                        >
                          <Edit2 size={13} />
                        </button>

                        <button
                          onClick={() => onDeleteService(svc.id, svc.name)}
                          title="Delete service"
                          className="p-1 rounded-md text-[#71717A] hover:text-[#C75C62] hover:bg-[#FBEDEE] transition-colors cursor-pointer"
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
          <div className="py-12 text-center text-xs text-[#71717A] border border-dashed border-[#E5E7EB] rounded-xl">
            {services.length === 0
              ? 'No services registered yet. Click "Add Service" above to start monitoring.'
              : 'No services match the current filter or search criteria.'}
          </div>
        )}

      </div>

    </div>
  );
}
