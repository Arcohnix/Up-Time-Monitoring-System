import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  Play,
  Edit2,
  Trash2,
  Power,
  ExternalLink,
  ShieldAlert,
  Activity,
  CheckCircle2,
  XCircle,
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
import StatusIndicator from './StatusIndicator';
import ResponseTimeChart from './ResponseTimeChart';
import { useToast } from '../context/ToastContext';

export default function ServiceDetailView({ serviceId, onBack, onEdit, onDeleted }) {
  const [service, setService] = useState(null);
  const [summary, setSummary] = useState(null);
  const [checks, setChecks] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [probing, setProbing] = useState(false);
  const [error, setError] = useState(null);
  const { showToast } = useToast();

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
      const result = await triggerServiceCheck(serviceId);
      await loadServiceData();
      showToast(`Probed ${result.success ? 'successfully' : 'with failure'} in ${result.response_time_ms ? Math.round(result.response_time_ms) : 0}ms`, result.success ? 'success' : 'error');
    } catch (err) {
      showToast(`Probe failed: ${err.message}`, 'error');
    } finally {
      setProbing(false);
    }
  };

  const handleToggleActive = async () => {
    if (!service) return;
    try {
      const updated = await updateService(service.id, { is_active: !service.is_active });
      setService(updated);
      showToast(`Monitor ${updated.is_active ? 'resumed' : 'paused'}`, 'info');
    } catch (err) {
      showToast(`Failed to toggle monitor: ${err.message}`, 'error');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete "${service?.name}"?`)) return;
    try {
      await deleteService(serviceId);
      showToast('Monitor removed', 'info');
      onDeleted();
    } catch (err) {
      showToast(`Failed to delete service: ${err.message}`, 'error');
    }
  };

  if (loading && !service) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-[var(--text-muted)] text-xs animate-in fade-in">
        <Activity className="animate-spin text-[var(--accent-primary)] mb-2" size={20} />
        <span>Loading observability telemetry...</span>
      </div>
    );
  }

  if (error && !service) {
    return (
      <div className="p-6 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl space-y-3">
        <div className="text-xs text-[var(--status-down-text)] font-medium">Error loading monitor: {error}</div>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs text-[var(--accent-text)] hover:underline"
        >
          <ArrowLeft size={13} />
          <span>Back to fleet</span>
        </button>
      </div>
    );
  }

  const latestCheck = checks[0];
  const chartPoints = [...checks].reverse();

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Back button & Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors mb-2 cursor-pointer font-medium"
          >
            <ArrowLeft size={13} />
            <span>All monitors</span>
          </button>

          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">
              {service?.name}
            </h1>
            <StatusIndicator state={service?.current_state} isActive={service?.is_active} />
          </div>

          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] font-mono mt-1">
            <span className="truncate max-w-md">{service?.url}</span>
            <a
              href={service?.url}
              target="_blank"
              rel="noreferrer"
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              <ExternalLink size={12} />
            </a>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Probe Now */}
          <button
            onClick={handleManualCheck}
            disabled={probing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Play size={11} fill="currentColor" className={probing ? 'animate-spin text-[var(--accent-primary)]' : ''} />
            <span>{probing ? 'Probing...' : 'Probe Now'}</span>
          </button>

          {/* Pause / Resume */}
          <button
            onClick={handleToggleActive}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] transition-colors cursor-pointer"
          >
            <Power size={12} className={service?.is_active ? 'text-[var(--status-healthy-dot)]' : 'text-[var(--text-muted)]'} />
            <span>{service?.is_active ? 'Pause' : 'Resume'}</span>
          </button>

          {/* Edit */}
          <button
            onClick={() => onEdit(service)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] transition-colors cursor-pointer"
          >
            <Edit2 size={12} />
            <span>Edit</span>
          </button>

          {/* Delete */}
          <button
            onClick={handleDelete}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-[var(--bg-surface)] hover:bg-[var(--status-down-bg)] text-[var(--status-down-text)] border border-[var(--border-subtle)] hover:border-[var(--status-down-border)] transition-colors cursor-pointer"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Observability Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Current Response Time */}
        <div className="p-4 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-[var(--shadow-subtle)]">
          <div className="text-xs text-[var(--text-muted)]">Current Response Time</div>
          <div className="text-2xl font-semibold tracking-tight font-mono text-[var(--text-primary)] mt-1">
            {latestCheck?.response_time_ms !== null && latestCheck?.response_time_ms !== undefined
              ? `${Math.round(latestCheck.response_time_ms)}ms`
              : '—'}
          </div>
          <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
            {latestCheck ? `HTTP ${latestCheck.status_code || 'Err'}` : 'No checks recorded'}
          </div>
        </div>

        {/* 30-Day Uptime */}
        <div className="p-4 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-[var(--shadow-subtle)]">
          <div className="text-xs text-[var(--text-muted)]">Uptime (30d window)</div>
          <div className="text-2xl font-semibold tracking-tight font-mono text-[var(--text-primary)] mt-1">
            {summary?.uptime_percentage !== null && summary?.uptime_percentage !== undefined
              ? `${summary.uptime_percentage.toFixed(2)}%`
              : '100.00%'}
          </div>
          <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
            {summary ? `${summary.total_checks} total checks` : 'Evaluating...'}
          </div>
        </div>

        {/* Average Latency */}
        <div className="p-4 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-[var(--shadow-subtle)]">
          <div className="text-xs text-[var(--text-muted)]">Average Latency</div>
          <div className="text-2xl font-semibold tracking-tight font-mono text-[var(--accent-text)] mt-1">
            {summary?.avg_response_time_ms !== null && summary?.avg_response_time_ms !== undefined
              ? `${Math.round(summary.avg_response_time_ms)}ms`
              : '—'}
          </div>
          <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
            P95: {summary?.p95_latency_ms ? `${Math.round(summary.p95_latency_ms)}ms` : '—'}
          </div>
        </div>

        {/* Configuration Profile */}
        <div className="p-4 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-[var(--shadow-subtle)]">
          <div className="text-xs text-[var(--text-muted)]">Check Interval & Threshold</div>
          <div className="text-lg font-semibold tracking-tight font-mono text-[var(--text-primary)] mt-1">
            {service?.check_interval_seconds || 30}s / {service?.failure_threshold || 3}x
          </div>
          <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
            Timeout: {service?.timeout_seconds || 10}s
          </div>
        </div>
      </div>

      {/* Response Time Chart */}
      <div className="p-5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-[var(--shadow-subtle)] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity size={14} className="text-[var(--accent-primary)]" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              Latency History (Last 50 checks)
            </h2>
          </div>
          <span className="text-[11px] text-[var(--text-muted)]">
            Hover to view probe timestamp and status
          </span>
        </div>

        <ResponseTimeChart points={chartPoints} height={180} showStats={true} />
      </div>

      {/* Recent Incidents for this monitor */}
      {incidents.length > 0 && (
        <div className="p-5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-[var(--shadow-subtle)] space-y-3">
          <div className="flex items-center gap-2">
            <ShieldAlert size={14} className="text-[var(--status-down-dot)]" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              Incident History ({incidents.length})
            </h2>
          </div>

          <div className="divide-y divide-[var(--border-subtle)]">
            {incidents.map((inc) => {
              const isOpen = inc.status === 'OPEN';
              return (
                <div key={inc.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isOpen ? 'bg-[var(--status-down-dot)] pulse-red' : 'bg-[var(--text-muted)]'
                      }`}
                    />
                    <span className="font-medium text-[var(--text-primary)]">
                      Incident #{inc.id}
                    </span>
                    <span className="text-[var(--text-secondary)]">
                      {inc.last_error_message || 'Probe timeout'}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 font-mono text-[11px] text-[var(--text-muted)]">
                    <span className={isOpen ? 'text-[var(--status-down-text)] font-semibold' : ''}>
                      {isOpen ? 'ACTIVE OUTAGE' : 'RESOLVED'}
                    </span>
                    <span>{new Date(inc.started_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Probe Logs Table */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-[var(--shadow-subtle)] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
            Probe Telemetry Stream
          </h2>
          <span className="text-[11px] text-[var(--text-muted)] font-mono">
            Showing latest {checks.length} checks
          </span>
        </div>

        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-left text-xs">
            <thead className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] sticky top-0">
              <tr>
                <th className="py-2 px-4 font-medium">Outcome</th>
                <th className="py-2 px-4 font-medium">Status Code</th>
                <th className="py-2 px-4 font-medium text-right">Response Time</th>
                <th className="py-2 px-4 font-medium">Timestamp</th>
                <th className="py-2 px-4 font-medium">Diagnostic Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)] font-mono">
              {checks.map((chk) => (
                <tr key={chk.id} className="hover:bg-[var(--bg-surface-hover)] transition-colors">
                  <td className="py-2.5 px-4 font-sans">
                    {chk.success ? (
                      <span className="inline-flex items-center gap-1.5 text-[var(--status-healthy-text)] font-medium text-xs">
                        <CheckCircle2 size={13} className="text-[var(--status-healthy-dot)]" />
                        <span>Pass</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-[var(--status-down-text)] font-medium text-xs">
                        <XCircle size={13} className="text-[var(--status-down-dot)]" />
                        <span>Fail</span>
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-4">
                    {chk.status_code ? (
                      <span className="px-1.5 py-0.5 rounded text-[11px] bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
                        {chk.status_code}
                      </span>
                    ) : (
                      <span className="text-[var(--text-muted)]">—</span>
                    )}
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    {chk.response_time_ms ? `${Math.round(chk.response_time_ms)}ms` : '—'}
                  </td>
                  <td className="py-2.5 px-4 text-[11px] text-[var(--text-muted)]">
                    {new Date(chk.checked_at || chk.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </td>
                  <td className="py-2.5 px-4 text-[11px] text-[var(--text-secondary)] font-sans truncate max-w-xs">
                    {chk.error_message || 'OK'}
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
