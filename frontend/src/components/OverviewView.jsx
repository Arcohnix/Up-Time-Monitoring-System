import React from 'react';
import {
  Activity,
  Play,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import StatusIndicator from './StatusIndicator';
import ResponseTimeChart from './ResponseTimeChart';

export default function OverviewView({
  dashboardData,
  onSelectService,
  onTriggerCheck,
  onNavigateTab,
  probingId = null,
}) {
  if (!dashboardData) return null;

  const {
    overall_uptime_percentage = 100,
    overall_avg_response_time_ms = 0,
    total_services = 0,
    healthy_services = 0,
    down_services = 0,
    services = [],
    recent_response_times = [],
    active_incidents = [],
  } = dashboardData;

  const degradedServices = services.filter(
    (s) => s.is_active && (s.current_state === 'FAILING' || s.current_state === 'DEGRADED')
  ).length;

  const hasOutage = down_services > 0 || active_incidents.length > 0;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* =====================================================================
          1. HEADER GREETING & OPERATIONAL STATEMENT
          Do NOT make this huge. Subtle, calm, technical confidence.
          ===================================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1">
        <div>
          <div className="text-xs text-[var(--text-muted)] font-medium">
            {getGreeting()}
          </div>
          <h1 className="text-lg font-semibold tracking-tight text-[var(--text-primary)] mt-0.5">
            {hasOutage
              ? `${down_services} monitor${down_services === 1 ? '' : 's'} experiencing outage`
              : 'Everything is operating normally'}
          </h1>
        </div>
        <div className="text-xs text-[var(--text-muted)] flex items-center gap-2">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              hasOutage ? 'bg-[var(--status-down-dot)] pulse-red' : 'bg-[var(--status-healthy-dot)] pulse-green'
            }`}
          />
          <span>Continuous fleet probing active</span>
        </div>
      </div>

      {/* =====================================================================
          2. HEALTH SUMMARY (HORIZONTAL METRIC STRIP)
          Instead of 6–10 generic cards, a clean horizontal summary
          Minimal separators. No excessive cards.
          ===================================================================== */}
      <div className="p-4 sm:p-5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-[var(--shadow-subtle)]">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 divide-y sm:divide-y-0 sm:divide-x divide-[var(--border-subtle)]">
          {/* Total Monitors */}
          <div className="pt-2 sm:pt-0 sm:px-3 first:pl-0">
            <div className="text-xl sm:text-2xl font-semibold tracking-tight font-mono text-[var(--text-primary)]">
              {total_services}
            </div>
            <div className="text-xs text-[var(--text-muted)] mt-0.5">
              Monitors
            </div>
          </div>

          {/* Healthy */}
          <div className="pt-2 sm:pt-0 sm:px-3">
            <div className="text-xl sm:text-2xl font-semibold tracking-tight font-mono text-[var(--status-healthy-text)]">
              {healthy_services}
            </div>
            <div className="text-xs text-[var(--text-muted)] mt-0.5">
              Healthy
            </div>
          </div>

          {/* Degraded */}
          <div className="pt-2 sm:pt-0 sm:px-3">
            <div className="text-xl sm:text-2xl font-semibold tracking-tight font-mono text-[var(--status-degraded-text)]">
              {degradedServices}
            </div>
            <div className="text-xs text-[var(--text-muted)] mt-0.5">
              Degraded
            </div>
          </div>

          {/* Down */}
          <div className="pt-2 sm:pt-0 sm:px-3">
            <div className={`text-xl sm:text-2xl font-semibold tracking-tight font-mono ${down_services > 0 ? 'text-[var(--status-down-text)]' : 'text-[var(--text-primary)]'}`}>
              {down_services}
            </div>
            <div className="text-xs text-[var(--text-muted)] mt-0.5">
              Down
            </div>
          </div>

          {/* Overall Uptime */}
          <div className="pt-2 sm:pt-0 sm:px-3">
            <div className="text-xl sm:text-2xl font-semibold tracking-tight font-mono text-[var(--text-primary)]">
              {overall_uptime_percentage ? `${overall_uptime_percentage.toFixed(2)}%` : '100.00%'}
            </div>
            <div className="text-xs text-[var(--text-muted)] mt-0.5 flex items-center justify-between">
              <span>Fleet Uptime</span>
              {overall_avg_response_time_ms ? (
                <span className="font-mono text-[11px] text-[var(--accent-text)]">
                  {Math.round(overall_avg_response_time_ms)}ms avg
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================================
          3. ACTIVE INCIDENTS ALERT STRIP (IF ANY)
          ===================================================================== */}
      {active_incidents.length > 0 && (
        <div className="p-4 bg-[var(--status-down-bg)] border border-[var(--status-down-border)] rounded-xl text-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-[var(--status-down-text)] font-semibold">
              <ShieldAlert size={15} />
              <span>{active_incidents.length} ACTIVE INCIDENT{active_incidents.length === 1 ? '' : 'S'}</span>
            </div>
            <button
              onClick={() => onNavigateTab('INCIDENTS')}
              className="text-[11px] text-[var(--status-down-text)] hover:underline flex items-center gap-1 cursor-pointer font-medium"
            >
              <span>View all incidents</span>
              <ArrowRight size={11} />
            </button>
          </div>
          <div className="divide-y divide-[var(--status-down-border)]">
            {active_incidents.map((inc) => (
              <div
                key={inc.id}
                onClick={() => onSelectService(inc.service_id)}
                className="py-1.5 flex items-center justify-between cursor-pointer hover:opacity-80 transition-opacity"
              >
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-down-dot)] pulse-red shrink-0" />
                  <span className="font-medium text-[var(--text-primary)]">
                    Service #{inc.service_id}:
                  </span>
                  <span className="text-[var(--text-secondary)] truncate max-w-md">
                    {inc.last_error_message || 'Probe check failed'}
                  </span>
                </div>
                <span className="text-[11px] text-[var(--text-muted)] font-mono shrink-0">
                  {new Date(inc.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =====================================================================
          4. FLEET LATENCY TREND
          Minimalist chart with soft purple curve and hover precision tooltip
          ===================================================================== */}
      <div className="p-5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-[var(--shadow-subtle)] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity size={14} className="text-[var(--accent-primary)]" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              Fleet Latency
            </h2>
          </div>
          <span className="text-[11px] text-[var(--text-muted)]">
            Recent probe response times
          </span>
        </div>

        <ResponseTimeChart points={recent_response_times} height={150} showStats={true} />
      </div>

      {/* =====================================================================
          5. PRIMARY MONITORS LIST
          Clear scanning, compact typography, aligned data, subtle separators
          ===================================================================== */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-[var(--shadow-subtle)] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              Active Monitors ({services.length})
            </h2>
          </div>
          <button
            onClick={() => onNavigateTab('MONITORS')}
            className="text-xs text-[var(--accent-text)] hover:text-[var(--accent-hover)] font-medium flex items-center gap-1 cursor-pointer transition-colors"
          >
            <span>View all monitors</span>
            <ArrowRight size={12} />
          </button>
        </div>

        {services.length === 0 ? (
          <div className="py-12 text-center text-xs text-[var(--text-muted)]">
            No monitors configured yet. Add your first endpoint to start tracking.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]">
                <tr>
                  <th className="py-2 px-4 font-medium">Service</th>
                  <th className="py-2 px-4 font-medium">Status</th>
                  <th className="py-2 px-4 font-medium text-right">Latency</th>
                  <th className="py-2 px-4 font-medium text-right">Uptime</th>
                  <th className="py-2 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {services.slice(0, 6).map((svc) => (
                  <tr
                    key={svc.id}
                    onClick={() => onSelectService(svc.id)}
                    className="hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer group"
                  >
                    <td className="py-3 px-4">
                      <div className="font-medium text-[var(--text-primary)] group-hover:text-[var(--accent-text)] transition-colors">
                        {svc.name}
                      </div>
                      <div className="text-[11px] text-[var(--text-muted)] font-mono truncate max-w-xs mt-0.5">
                        {svc.url}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <StatusIndicator state={svc.current_state} isActive={svc.is_active} />
                    </td>
                    <td className="py-3 px-4 text-right font-mono">
                      {svc.recent_latency_ms !== null && svc.recent_latency_ms !== undefined ? (
                        <span className="text-[var(--text-primary)] font-medium">
                          {Math.round(svc.recent_latency_ms)}ms
                        </span>
                      ) : (
                        <span className="text-[var(--text-muted)]">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-[var(--text-secondary)]">
                      {svc.uptime_percentage !== null && svc.uptime_percentage !== undefined
                        ? `${svc.uptime_percentage.toFixed(1)}%`
                        : '100%'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onTriggerCheck(svc.id);
                        }}
                        disabled={probingId === svc.id}
                        title="Probe service now"
                        className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)] transition-colors cursor-pointer"
                      >
                        <Play
                          size={12}
                          fill="currentColor"
                          className={probingId === svc.id ? 'animate-spin text-[var(--accent-primary)]' : ''}
                        />
                      </button>
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
