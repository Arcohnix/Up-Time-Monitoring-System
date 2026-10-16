import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  Play,
  Edit2,
  Trash2,
  Power,
  ExternalLink,
  CheckCircle2,
  XCircle,
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
      <div className="py-20 flex flex-col items-center justify-center text-[#71717A] text-xs">
        <Activity className="animate-spin text-[#5865D8] mb-3" size={24} />
        Loading service details...
      </div>
    );
  }

  if (error && !service) {
    return (
      <div className="py-12 px-6">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs text-[#71717A] hover:text-[#18181B] mb-4 font-medium transition-colors"
        >
          <ArrowLeft size={14} /> Back to Services
        </button>
        <div className="p-4 bg-[#FBEDEE] border border-[#C75C62]/30 rounded-xl text-[#A63F46] text-xs">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between pb-4 border-b border-[#E5E7EB]">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-medium text-[#71717A] hover:text-[#18181B] transition-colors cursor-pointer"
        >
          <ArrowLeft size={14} />
          <span>SERVICES OVERVIEW</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handleManualCheck}
            disabled={probing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white hover:bg-[#F3F4F6] text-[#18181B] border border-[#E5E7EB] transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Play size={11} fill="currentColor" className={probing ? 'animate-spin' : ''} />
            <span>{probing ? 'Probing...' : 'Check Now'}</span>
          </button>

          <button
            onClick={handleToggleActive}
            title={service.is_active ? 'Pause monitoring' : 'Resume monitoring'}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white hover:bg-[#F3F4F6] text-[#71717A] hover:text-[#18181B] border border-[#E5E7EB] transition-colors cursor-pointer"
          >
            <Power size={12} className={service.is_active ? 'text-[#71717A]' : 'text-[#4D9F72]'} />
            <span>{service.is_active ? 'Pause' : 'Resume'}</span>
          </button>

          <button
            onClick={() => onEdit(service)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white hover:bg-[#F3F4F6] text-[#71717A] hover:text-[#18181B] border border-[#E5E7EB] transition-colors cursor-pointer"
          >
            <Edit2 size={12} />
            <span>Edit</span>
          </button>

          <button
            onClick={handleDelete}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white hover:bg-[#FBEDEE] text-[#71717A] hover:text-[#A63F46] border border-[#E5E7EB] hover:border-[#C75C62]/30 transition-colors cursor-pointer"
          >
            <Trash2 size={12} />
            <span>Delete</span>
          </button>
        </div>
      </div>

      {/* Service Header Card */}
      <div className="p-6 bg-white border border-[#E5E7EB] rounded-xl shadow-xs space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold tracking-tight text-[#18181B]">
                {service.name}
              </h1>
              <StatusBadge state={service.current_state} isActive={service.is_active} />
            </div>

            <div className="flex items-center gap-2 mt-1.5 text-xs text-[#71717A]">
              <span className="px-1.5 py-0.5 rounded-md bg-[#F3F4F6] text-[#71717A] font-medium text-[10px]">
                {service.http_method}
              </span>
              <a
                href={service.url}
                target="_blank"
                rel="noreferrer"
                className="hover:text-[#5865D8] hover:underline flex items-center gap-1 font-mono text-xs"
              >
                <span>{service.url}</span>
                <ExternalLink size={11} />
              </a>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs text-[#71717A]">
            <div>
              <span>Interval:</span> <span className="text-[#18181B] font-medium">{service.check_interval_seconds}s</span>
            </div>
            <div>
              <span>Timeout:</span> <span className="text-[#18181B] font-medium">{service.timeout_seconds}s</span>
            </div>
            <div>
              <span>Threshold:</span> <span className="text-[#18181B] font-medium">{service.consecutive_failures}/{service.failure_threshold}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Metric Cards (Neutral) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-4 bg-white border border-[#E5E7EB] rounded-xl shadow-xs">
          <div className="text-xs font-medium text-[#71717A]">Uptime</div>
          <div className="text-2xl font-semibold text-[#18181B] tracking-tight mt-1">
            {summary ? `${summary.uptime_percentage.toFixed(2)}%` : '—'}
          </div>
          <div className="text-[11px] text-[#A1A1AA] mt-1">Historical ratio</div>
        </div>

        <div className="p-4 bg-white border border-[#E5E7EB] rounded-xl shadow-xs">
          <div className="text-xs font-medium text-[#71717A]">Avg Latency</div>
          <div className="text-2xl font-semibold text-[#18181B] tracking-tight mt-1">
            {summary?.avg_response_time_ms !== null && summary?.avg_response_time_ms !== undefined
              ? `${Math.round(summary.avg_response_time_ms)}ms`
              : '—'}
          </div>
          <div className="text-[11px] text-[#A1A1AA] mt-1">Successful probes</div>
        </div>

        <div className="p-4 bg-white border border-[#E5E7EB] rounded-xl shadow-xs">
          <div className="text-xs font-medium text-[#71717A]">Total Checks</div>
          <div className="text-2xl font-semibold text-[#18181B] tracking-tight mt-1">
            {summary?.total_checks ?? checks.length}
          </div>
          <div className="text-[11px] text-[#A1A1AA] mt-1">All-time</div>
        </div>

        <div className="p-4 bg-white border border-[#E5E7EB] rounded-xl shadow-xs">
          <div className="text-xs font-medium text-[#71717A]">Successful</div>
          <div className="text-2xl font-semibold text-[#18181B] tracking-tight mt-1">
            {summary?.successful_checks ?? checks.filter(c => c.success).length}
          </div>
          <div className="text-[11px] text-[#A1A1AA] mt-1">Healthy probes</div>
        </div>

        <div className="p-4 bg-white border border-[#E5E7EB] rounded-xl shadow-xs">
          <div className="text-xs font-medium text-[#71717A]">Failed</div>
          <div className="text-2xl font-semibold text-[#18181B] tracking-tight mt-1">
            {summary?.failed_checks ?? checks.filter(c => !c.success).length}
          </div>
          <div className="text-[11px] text-[#A1A1AA] mt-1">Timeouts / Errors</div>
        </div>
      </div>

      {/* Response Time Chart */}
      <div className="p-6 bg-white border border-[#E5E7EB] rounded-xl shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity size={16} className="text-[#5865D8]" />
            <h2 className="text-xs font-semibold text-[#71717A] uppercase tracking-wider">
              RESPONSE TIME HISTORY
            </h2>
          </div>
          <span className="text-xs text-[#A1A1AA]">Recent 50 checks</span>
        </div>

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
      <div className="p-6 bg-white border border-[#E5E7EB] rounded-xl shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <ShieldAlert size={16} className="text-[#71717A]" />
          <h2 className="text-xs font-semibold text-[#18181B] uppercase tracking-wider">
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
                  className={`p-4 rounded-xl border text-xs transition-colors ${
                    isOpen
                      ? 'bg-[#FBEDEE] border-[#C75C62]/20'
                      : 'bg-[#F7F8FA] border-[#E5E7EB]'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium border ${
                        isOpen
                          ? 'bg-[#FBEDEE] text-[#A63F46] border-[#C75C62]/30'
                          : 'bg-[#ECF7F0] text-[#347A55] border-[#4D9F72]/30'
                      }`}>
                        {inc.status}
                      </span>
                      <span className="font-medium text-[#18181B]">Incident #{inc.id}</span>
                      <span className="text-[#A1A1AA]">•</span>
                      <span className="text-[#71717A]">Failures: {inc.failure_count}</span>
                    </div>

                    <div className="text-[#71717A] text-[11px]">
                      {start.toLocaleString()}
                      {end && ` → ${end.toLocaleTimeString()} (${durationSec}s)`}
                    </div>
                  </div>

                  {inc.last_error_message && (
                    <div className="text-[#A63F46] mb-1">
                      <span className="text-[#71717A]">Error:</span> {inc.last_error_message}
                    </div>
                  )}

                  {inc.recovery_message && (
                    <div className="text-[#347A55]">
                      <span className="text-[#71717A]">Recovery:</span> {inc.recovery_message}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-6 text-center text-xs text-[#71717A] border border-dashed border-[#E5E7EB] rounded-xl">
            No incidents recorded for this service.
          </div>
        )}
      </div>

      {/* Recent Checks Table */}
      <div className="p-6 bg-white border border-[#E5E7EB] rounded-xl shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-[#71717A] uppercase tracking-wider">
            RECENT CHECK RESULTS
          </h2>
          <span className="text-xs text-[#A1A1AA]">Last 50 results</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[11px] text-[#71717A] uppercase tracking-wider border-b border-[#E5E7EB] bg-[#F7F8FA]">
              <tr>
                <th className="py-2.5 px-3 font-medium">Outcome</th>
                <th className="py-2.5 px-3 font-medium">Timestamp</th>
                <th className="py-2.5 px-3 font-medium">Status Code</th>
                <th className="py-2.5 px-3 font-medium">Latency</th>
                <th className="py-2.5 px-3 font-medium">Error Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB]">
              {checks.map((chk) => (
                <tr key={chk.id} className="hover:bg-[#F7F8FA] transition-colors">
                  <td className="py-2.5 px-3">
                    {chk.success ? (
                      <span className="inline-flex items-center gap-1.5 text-[#347A55] font-medium">
                        <CheckCircle2 size={13} className="text-[#4D9F72]" /> Success
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-[#A63F46] font-medium">
                        <XCircle size={13} className="text-[#C75C62]" /> Failure
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-[#71717A]">
                    {new Date(chk.checked_at).toLocaleTimeString()}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className={`px-1.5 py-0.5 rounded-md text-[11px] font-medium ${
                      chk.status_code && chk.status_code >= 200 && chk.status_code < 300
                        ? 'bg-[#ECF7F0] text-[#347A55]'
                        : 'bg-[#FBEDEE] text-[#A63F46]'
                    }`}>
                      {chk.status_code || '—'}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-[#18181B] font-medium">
                    {chk.response_time_ms ? `${chk.response_time_ms.toFixed(1)}ms` : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-[#71717A] max-w-md truncate">
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
