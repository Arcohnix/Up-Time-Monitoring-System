import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  Mail,
  RotateCcw,
} from 'lucide-react';
import { getIncidents } from '../api';

export default function IncidentsView({ services = [], onSelectService }) {
  const [incidents, setIncidents] = useState([]);
  const [filter, setFilter] = useState('ALL'); // ALL, OPEN, RESOLVED
  const [selectedIncident, setSelectedIncident] = useState(null);

  const serviceMap = React.useMemo(() => {
    const map = {};
    services.forEach((s) => {
      map[s.id] = s;
    });
    return map;
  }, [services]);

  const loadIncidents = async () => {
    try {
      const data = await getIncidents({ limit: 100 });
      setIncidents(data || []);
    } catch {
      // Silently handled for background sync
    }
  };

  useEffect(() => {
    loadIncidents();
    const interval = setInterval(loadIncidents, 6000);
    return () => clearInterval(interval);
  }, []);

  const filteredIncidents = incidents.filter((inc) => {
    if (filter === 'OPEN') return inc.status === 'OPEN';
    if (filter === 'RESOLVED') return inc.status === 'RESOLVED';
    return true;
  });

  const activeIncidents = incidents.filter((i) => i.status === 'OPEN');
  const resolvedIncidents = incidents.filter((i) => i.status === 'RESOLVED');

  const formatDuration = (startStr, endStr) => {
    const start = new Date(startStr);
    const end = endStr ? new Date(endStr) : new Date();
    const totalSec = Math.max(0, Math.round((end - start) / 1000));

    if (!endStr) {
      const mins = Math.floor(totalSec / 60);
      const secs = totalSec % 60;
      return `${mins}m ${secs}s`;
    }

    if (totalSec < 60) return `${totalSec}s`;
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    if (mins < 60) return `${mins}m ${secs}s`;
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hours}h ${remMins}m`;
  };

  const getTimelineSteps = (inc) => {
    const service = serviceMap[inc.service_id];
    const steps = [];

    const startTime = new Date(inc.started_at);

    // Initial check failures leading up to threshold
    const failureCount = inc.failure_count || 3;
    steps.push({
      time: startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      title: 'Health check probe failed',
      desc: inc.last_error_message || 'Connection refused or HTTP timeout',
      type: 'failure',
      icon: AlertTriangle,
    });

    // Threshold reached & incident created
    steps.push({
      time: startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      title: `Incident #${inc.id} created`,
      desc: `Reached consecutive failure threshold (${failureCount}x failures) on ${service?.name || 'service'}. Target marked DOWN.`,
      type: 'incident',
      icon: ShieldAlert,
    });

    // Notification alert dispatched
    steps.push({
      time: startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      title: 'Alert notification dispatched',
      desc: 'Email alert sent to configured recipients (arcohnix8@gmail.com).',
      type: 'notification',
      icon: Mail,
    });

    // Recovery
    if (inc.status === 'RESOLVED' && inc.resolved_at) {
      const resolvedTime = new Date(inc.resolved_at);
      steps.push({
        time: resolvedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        title: 'Service recovered',
        desc: inc.recovery_message || 'HTTP 200 OK received. Target returned to healthy state.',
        type: 'recovery',
        icon: RotateCcw,
      });

      steps.push({
        time: resolvedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        title: `Incident #${inc.id} resolved`,
        desc: 'Resolution alert dispatched. Total duration: ' + formatDuration(inc.started_at, inc.resolved_at),
        type: 'resolved',
        icon: CheckCircle2,
      });
    }

    return steps;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold tracking-tight text-[var(--text-primary)]">
            Incident Management
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Fleet outage tracking, threshold triggers, and automated alert logs
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center p-0.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg text-[11px]">
          <button
            onClick={() => setFilter('ALL')}
            className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
              filter === 'ALL'
                ? 'bg-[var(--bg-surface-subtle)] text-[var(--text-primary)] font-medium'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            All ({incidents.length})
          </button>
          <button
            onClick={() => setFilter('OPEN')}
            className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
              filter === 'OPEN'
                ? 'bg-[var(--status-down-bg)] text-[var(--status-down-text)] font-semibold'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            Active ({activeIncidents.length})
          </button>
          <button
            onClick={() => setFilter('RESOLVED')}
            className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
              filter === 'RESOLVED'
                ? 'bg-[var(--bg-surface-subtle)] text-[var(--text-primary)] font-medium'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            Resolved ({resolvedIncidents.length})
          </button>
        </div>
      </div>

      {/* Main Content Layout: List + Timeline Detail Drawer/Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Incident List Column */}
        <div className={selectedIncident ? 'lg:col-span-7 space-y-3' : 'lg:col-span-12 space-y-3'}>
          {filteredIncidents.length === 0 ? (
            <div className="p-12 text-center bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl text-xs text-[var(--text-muted)]">
              No incidents found in this category. All systems operating normally.
            </div>
          ) : (
            filteredIncidents.map((inc) => {
              const svc = serviceMap[inc.service_id];
              const isOpen = inc.status === 'OPEN';
              const isSelected = selectedIncident?.id === inc.id;

              return (
                <div
                  key={inc.id}
                  onClick={() => setSelectedIncident(inc)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-[var(--accent-primary)] bg-[var(--bg-surface-hover)] shadow-sm'
                      : isOpen
                      ? 'border-[var(--status-down-border)] bg-[var(--status-down-bg)] hover:border-[var(--status-down-dot)]'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            isOpen ? 'bg-[var(--status-down-dot)] pulse-red' : 'bg-[var(--text-muted)]'
                          }`}
                        />
                        <span className="font-semibold text-xs text-[var(--text-primary)]">
                          {svc?.name || `Service #${inc.service_id}`}
                        </span>
                        <span
                          className={`text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.2 rounded border ${
                            isOpen
                              ? 'text-[var(--status-down-text)] border-[var(--status-down-border)] bg-[var(--status-down-bg)] font-semibold'
                              : 'text-[var(--text-muted)] border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]'
                          }`}
                        >
                          {isOpen ? 'Down' : 'Resolved'}
                        </span>
                      </div>

                      <div className="text-xs text-[var(--text-secondary)] truncate">
                        {inc.last_error_message || 'Probe timeout or connection failure'}
                      </div>

                      <div className="text-[11px] text-[var(--text-muted)] font-mono flex items-center gap-3 pt-0.5">
                        <span>Started: {new Date(inc.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        <span>•</span>
                        <span>
                          Duration: {formatDuration(inc.started_at, inc.resolved_at)}
                        </span>
                        {inc.failure_count && (
                          <>
                            <span>•</span>
                            <span>{inc.failure_count} consecutive failures</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectService(inc.service_id);
                        }}
                        className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded hover:bg-[var(--bg-surface-subtle)] transition-colors"
                        title="View Monitor"
                      >
                        <ExternalLink size={12} />
                      </button>
                      <ChevronRight size={14} className="text-[var(--text-muted)]" />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Incident Detail Timeline Column */}
        {selectedIncident && (
          <div className="lg:col-span-5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl p-5 shadow-[var(--shadow-subtle)] space-y-4 animate-in fade-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
              <div>
                <div className="text-xs font-semibold text-[var(--text-primary)]">
                  Incident #{selectedIncident.id} Timeline
                </div>
                <div className="text-[11px] text-[var(--text-muted)] font-mono mt-0.5">
                  {serviceMap[selectedIncident.service_id]?.name || `Service #${selectedIncident.service_id}`}
                </div>
              </div>
              <button
                onClick={() => setSelectedIncident(null)}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded hover:bg-[var(--bg-surface-subtle)] cursor-pointer"
              >
                Close
              </button>
            </div>

            {/* Timeline Steps */}
            <div className="space-y-4 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-px before:bg-[var(--border-subtle)]">
              {getTimelineSteps(selectedIncident).map((step, idx) => {
                const Icon = step.icon;
                const isFail = step.type === 'failure' || step.type === 'incident';
                const isRecovery = step.type === 'recovery' || step.type === 'resolved';

                return (
                  <div key={idx} className="relative flex items-start gap-3 pl-1">
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 z-10 ${
                        isFail
                          ? 'bg-[var(--status-down-bg)] text-[var(--status-down-text)] border border-[var(--status-down-border)]'
                          : isRecovery
                          ? 'bg-[var(--status-healthy-bg)] text-[var(--status-healthy-text)] border border-[var(--status-healthy-border)]'
                          : 'bg-[var(--bg-surface-subtle)] text-[var(--accent-text)] border border-[var(--border-subtle)]'
                      }`}
                    >
                      <Icon size={11} />
                    </div>

                    <div className="min-w-0 space-y-0.5 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[var(--text-primary)]">
                          {step.title}
                        </span>
                        <span className="text-[10px] text-[var(--text-muted)] font-mono">
                          {step.time}
                        </span>
                      </div>
                      <div className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                        {step.desc}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs">
              <span className="text-[var(--text-muted)] font-mono text-[11px]">
                Status: {selectedIncident.status}
              </span>
              <button
                onClick={() => onSelectService(selectedIncident.service_id)}
                className="text-[var(--accent-text)] hover:underline font-medium flex items-center gap-1 cursor-pointer"
              >
                <span>View Monitor Telemetry</span>
                <ArrowRight size={11} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
