import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  Play,
  Edit2,
  Trash2,
  Power,
  ExternalLink,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Activity,
  ShieldAlert,
} from 'lucide-react';
import {
  getService,
  getServiceSummary,
  getServiceChecks,
  getServiceIncidents,
  triggerServiceCheck,
  updateService,
  deleteService,
} from '../api';
import StatusBadge from './StatusBadge';
import ResponseTimeChart from './ResponseTimeChart';

export default function ServiceDetailView({ serviceId, onBack, onEdit, onDeleted }) {
  const [service, setService] = useState(null);
  const [summary, setSummary] = useState(null);
  const [checks, setChecks] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [probing, setProbing] = useState(false);
  const [error, setError] = useState(null);

  const loadServiceData = useCallback(async () => {
    try {
      const [svcData, sumData, checksData, incData] = await Promise.all([
        getService(serviceId),
        getServiceSummary(serviceId).catch(() => null),
        getServiceChecks(serviceId, { limit: 50 }),
        getServiceIncidents(serviceId).catch(() => []),
      ]);

      setService(svcData);
      setSummary(sumData);
      setChecks(checksData || []);
      setIncidents(incData || []);
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to load service details');
    } finally {
      setLoading(false);
    }
  }, [serviceId]);

  useEffect(() => {
    loadServiceData();
    const timer = setInterval(loadServiceData, 6000);
    return () => clearInterval(timer);
  }, [loadServiceData]);

  const handleManualCheck = async () => {
    setProbing(true);
    try {
      await triggerServiceCheck(serviceId);
      await loadServiceData();
    } catch (err) {
      alert(`Manual probe failed: ${err.message}`);
    } finally {
      setProbing(false);
    }
  };

  const handleToggleActive = async () => {
    if (!service) return;
    try {
      const updated = await updateService(service.id, { is_active: !service.is_active });
      setService(updated);
    } catch (err) {
      alert(`Failed to toggle service state: ${err.message}`);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete "${service?.name}"?`)) return;
    try {
      await deleteService(serviceId);
      onDeleted();
    } catch (err) {
      alert(`Failed to delete service: ${err.message}`);
    }
  };

  if (loading && !service) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-zinc-500 font-mono text-xs">
        <Activity className="animate-spin text-cyan-400 mb-3" size={24} />
        Loading service details...
      </div>
    );
  }

  if (error && !service) {
    return (
      <div className="py-12 px-6">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 mb-4 font-mono"
        >
          <ArrowLeft size={14} /> Back to Services
        </button>
        <div className="p-4 bg-rose-950/40 border border-rose-800 rounded-lg text-rose-300 text-xs">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-mono text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
        >
          <ArrowLeft size={14} />
          <span>SERVICES OVERVIEW</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handleManualCheck}
            disabled={probing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium rounded bg-zinc-800 hover:bg-zinc-700 text-cyan-300 border border-zinc-700 transition-colors disabled:opacity-50"
          >
            <Play size={12} fill="currentColor" className={probing ? 'animate-spin' : ''} />
            <span>{probing ? 'Probing...' : 'Check Now'}</span>
          </button>

          <button
            onClick={handleToggleActive}
            title={service.is_active ? 'Pause monitoring' : 'Resume monitoring'}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium rounded border transition-colors ${
              service.is_active
                ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700'
                : 'bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border-emerald-800/60'
            }`}
          >
            <Power size={12} />
            <span>{service.is_active ? 'Pause' : 'Resume'}</span>
          </button>

          <button
            onClick={() => onEdit(service)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition-colors"
          >
            <Edit2 size={12} />
            <span>Edit</span>
          </button>

          <button
            onClick={handleDelete}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium rounded bg-zinc-800 hover:bg-rose-950/60 text-zinc-400 hover:text-rose-300 border border-zinc-700 hover:border-rose-800 transition-colors"
          >
            <Trash2 size={12} />
            <span>Delete</span>
          </button>
        </div>
      </div>

      {/* Service Header Card */}
      <div className="p-6 bg-zinc-900/90 border border-zinc-800 rounded-xl space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold tracking-tight text-zinc-100 font-mono">
                {service.name}
              </h1>
              <StatusBadge state={service.current_state} isActive={service.is_active} />
            </div>

            <div className="flex items-center gap-2 mt-1.5 text-xs font-mono text-zinc-400">
              <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-semibold text-[10px]">
                {service.http_method}
              </span>
              <a
                href={service.url}
                target="_blank"
                rel="noreferrer"
                className="hover:text-cyan-400 hover:underline flex items-center gap-1"
              >
                <span>{service.url}</span>
                <ExternalLink size={11} />
              </a>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono text-zinc-400">
            <div>
              <span className="text-zinc-500">Interval:</span> <span className="text-zinc-200">{service.check_interval_seconds}s</span>
            </div>
            <div>
              <span className="text-zinc-500">Timeout:</span> <span className="text-zinc-200">{service.timeout_seconds}s</span>
            </div>
            <div>
              <span className="text-zinc-500">Threshold:</span> <span className="text-zinc-200">{service.consecutive_failures}/{service.failure_threshold}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-4 bg-zinc-900/60 border border-zinc-800/80 rounded-lg">
          <div className="text-xs text-zinc-500 uppercase tracking-wider font-mono">Uptime</div>
          <div className="text-2xl font-bold font-mono mt-1 text-zinc-100">
            {summary ? `${summary.uptime_percentage.toFixed(2)}%` : '—'}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1 font-mono">Historical ratio</div>
        </div>

        <div className="p-4 bg-zinc-900/60 border border-zinc-800/80 rounded-lg">
          <div className="text-xs text-zinc-500 uppercase tracking-wider font-mono">Avg Latency</div>
          <div className="text-2xl font-bold font-mono mt-1 text-cyan-400">
            {summary?.avg_response_time_ms !== null && summary?.avg_response_time_ms !== undefined
              ? `${Math.round(summary.avg_response_time_ms)}ms`
              : '—'}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1 font-mono">Successful probes</div>
        </div>

        <div className="p-4 bg-zinc-900/60 border border-zinc-800/80 rounded-lg">
          <div className="text-xs text-zinc-500 uppercase tracking-wider font-mono">Total Checks</div>
          <div className="text-2xl font-bold font-mono mt-1 text-zinc-100">
            {summary?.total_checks ?? checks.length}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1 font-mono">All-time</div>
        </div>

        <div className="p-4 bg-zinc-900/60 border border-zinc-800/80 rounded-lg">
          <div className="text-xs text-zinc-500 uppercase tracking-wider font-mono">Successful</div>
          <div className="text-2xl font-bold font-mono mt-1 text-emerald-400">
            {summary?.successful_checks ?? checks.filter(c => c.success).length}
          </div>
          <div className="text-[11px] text-emerald-500/70 mt-1 font-mono">Healthy probes</div>
        </div>

        <div className="p-4 bg-zinc-900/60 border border-zinc-800/80 rounded-lg">
          <div className="text-xs text-zinc-500 uppercase tracking-wider font-mono">Failed</div>
          <div className="text-2xl font-bold font-mono mt-1 text-rose-400">
            {summary?.failed_checks ?? checks.filter(c => !c.success).length}
          </div>
          <div className="text-[11px] text-rose-500/70 mt-1 font-mono">Timeouts / Errors</div>
        </div>
      </div>

      {/* Response Time Chart */}
      <div className="p-6 bg-zinc-900/90 border border-zinc-800 rounded-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity size={16} className="text-cyan-400" />
            <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest font-mono">
              RESPONSE TIME HISTORY
            </h2>
          </div>
          <span className="text-xs text-zinc-500 font-mono">Recent 50 checks</span>
        </div>

        {/* Map checks to chart points (chronological order) */}
        <ResponseTimeChart
          points={[...checks].reverse().map(c => ({
            id: c.id,
            service_id: c.service_id,
            service_name: service.name,
            timestamp: c.checked_at,
            response_time_ms: c.response_time_ms,
            success: c.success,
            status_code: c.status_code,
          }))}
          height={200}
        />
      </div>

      {/* Incidents Section */}
      <div className="p-6 bg-zinc-900/90 border border-zinc-800 rounded-xl space-y-4">
        <div className="flex items-center gap-2">
          <ShieldAlert size={16} className="text-rose-400" />
          <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest font-mono">
            INCIDENTS FOR THIS SERVICE ({incidents.length})
          </h2>
        </div>

        {incidents.length > 0 ? (
          <div className="space-y-3">
            {incidents.map((inc) => {
              const isOpen = inc.status === 'OPEN';
              const start = new Date(inc.started_at);
              const end = inc.resolved_at ? new Date(inc.resolved_at) : null;
              const durationSec = end ? Math.round((end - start) / 1000) : null;

              return (
                <div
                  key={inc.id}
                  className={`p-4 rounded-lg border text-xs font-mono ${
                    isOpen
                      ? 'bg-rose-950/20 border-rose-800/40'
                      : 'bg-zinc-950/40 border-zinc-800/80'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        isOpen ? 'bg-rose-900/60 text-rose-300' : 'bg-zinc-800 text-zinc-400'
                      }`}>
                        {inc.status}
                      </span>
                      <span className="font-semibold text-zinc-200">Incident #{inc.id}</span>
                      <span className="text-zinc-500">•</span>
                      <span className="text-zinc-400">Failures: {inc.failure_count}</span>
                    </div>

                    <div className="text-zinc-500 text-[11px]">
                      {start.toLocaleString()}
                      {end && ` → ${end.toLocaleTimeString()} (${durationSec}s)`}
                    </div>
                  </div>

                  {inc.last_error_message && (
                    <div className="text-rose-400 mb-1">
                      <span className="text-zinc-500">Error:</span> {inc.last_error_message}
                    </div>
                  )}

                  {inc.recovery_message && (
                    <div className="text-emerald-400">
                      <span className="text-zinc-500">Recovery:</span> {inc.recovery_message}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-6 text-center text-xs font-mono text-zinc-500 border border-dashed border-zinc-800/80 rounded-lg">
            No incidents recorded for this service.
          </div>
        )}
      </div>

      {/* Recent Checks Table */}
      <div className="p-6 bg-zinc-900/90 border border-zinc-800 rounded-xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest font-mono">
            RECENT CHECK RESULTS
          </h2>
          <span className="text-xs text-zinc-500 font-mono">Last 50 results</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="text-[11px] text-zinc-500 uppercase border-b border-zinc-800 bg-zinc-950/40">
              <tr>
                <th className="py-2.5 px-3 font-medium">Outcome</th>
                <th className="py-2.5 px-3 font-medium">Timestamp</th>
                <th className="py-2.5 px-3 font-medium">Status Code</th>
                <th className="py-2.5 px-3 font-medium">Latency</th>
                <th className="py-2.5 px-3 font-medium">Error Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {checks.map((chk) => (
                <tr key={chk.id} className="hover:bg-zinc-800/30 transition-colors">
                  <td className="py-2 px-3">
                    {chk.success ? (
                      <span className="inline-flex items-center gap-1.5 text-emerald-400">
                        <CheckCircle2 size={13} /> Success
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-rose-400">
                        <XCircle size={13} /> Failure
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-zinc-400">
                    {new Date(chk.checked_at).toLocaleTimeString()}
                  </td>
                  <td className="py-2 px-3">
                    <span className={`px-1.5 py-0.5 rounded text-[11px] font-semibold ${
                      chk.status_code && chk.status_code >= 200 && chk.status_code < 300
                        ? 'bg-emerald-950/60 text-emerald-300'
                        : 'bg-rose-950/60 text-rose-300'
                    }`}>
                      {chk.status_code || '—'}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-zinc-300">
                    {chk.response_time_ms ? `${chk.response_time_ms.toFixed(1)}ms` : '—'}
                  </td>
                  <td className="py-2 px-3 text-zinc-400 max-w-md truncate">
                    {chk.error_message || chk.error_type || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
