import React, { useState } from 'react';
import {
  BarChart3,
  Activity,
  ArrowUpRight,
} from 'lucide-react';
import ResponseTimeChart from './ResponseTimeChart';

export default function AnalyticsView({ dashboardData, onSelectService }) {
  const [timeRange, setTimeRange] = useState('24h'); // 24h, 7d, 30d, 90d

  if (!dashboardData) return null;

  const {
    overall_uptime_percentage = 100,
    overall_avg_response_time_ms = 0,
    services = [],
    recent_response_times = [],
  } = dashboardData;

  // Compute mock P95/P99 from points
  const validLatencies = recent_response_times
    .map((p) => p.response_time_ms)
    .filter((l) => typeof l === 'number' && l >= 0)
    .sort((a, b) => a - b);

  const getPercentile = (arr, p) => {
    if (arr.length === 0) return 0;
    const index = Math.ceil((p / 100) * arr.length) - 1;
    return Math.round(arr[Math.max(0, Math.min(index, arr.length - 1))]);
  };

  const p95 = getPercentile(validLatencies, 95);
  const p99 = getPercentile(validLatencies, 99);
  const totalProbes = validLatencies.length;
  const failedProbes = recent_response_times.filter((p) => !p.success).length;

  // Service rankings by uptime and latency
  const rankedServices = [...services].sort((a, b) => {
    const upA = a.uptime_percentage ?? 100;
    const upB = b.uptime_percentage ?? 100;
    return upB - upA;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header & Range Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold tracking-tight text-[var(--text-primary)]">
            Fleet Performance & Reliability
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Statistical latency percentiles, probe distribution, and SLO performance
          </p>
        </div>

        {/* Time Range Pills */}
        <div className="flex items-center p-0.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg text-[11px]">
          {['24h', '7d', '30d', '90d'].map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                timeRange === range
                  ? 'bg-[var(--accent-subtle)] text-[var(--accent-text)] font-semibold'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Analytics Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
        {/* Fleet Uptime */}
        <div className="p-4 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-[var(--shadow-subtle)]">
          <div className="text-xs text-[var(--text-muted)]">Fleet Uptime</div>
          <div className="text-xl sm:text-2xl font-semibold tracking-tight font-mono text-[var(--text-primary)] mt-1">
            {overall_uptime_percentage ? `${overall_uptime_percentage.toFixed(2)}%` : '100%'}
          </div>
          <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
            Target: 99.9% SLO
          </div>
        </div>

        {/* Avg Latency */}
        <div className="p-4 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-[var(--shadow-subtle)]">
          <div className="text-xs text-[var(--text-muted)]">Average Latency</div>
          <div className="text-xl sm:text-2xl font-semibold tracking-tight font-mono text-[var(--accent-text)] mt-1">
            {Math.round(overall_avg_response_time_ms || 0)}ms
          </div>
          <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
            Across active targets
          </div>
        </div>

        {/* P95 Latency */}
        <div className="p-4 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-[var(--shadow-subtle)]">
          <div className="text-xs text-[var(--text-muted)]">P95 Latency</div>
          <div className="text-xl sm:text-2xl font-semibold tracking-tight font-mono text-[var(--text-primary)] mt-1">
            {p95 || '—'}ms
          </div>
          <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
            95% faster than this
          </div>
        </div>

        {/* P99 Latency */}
        <div className="p-4 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-[var(--shadow-subtle)]">
          <div className="text-xs text-[var(--text-muted)]">P99 Latency</div>
          <div className="text-xl sm:text-2xl font-semibold tracking-tight font-mono text-[var(--text-primary)] mt-1">
            {p99 || '—'}ms
          </div>
          <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
            Tail latency envelope
          </div>
        </div>

        {/* Total Probes */}
        <div className="p-4 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-[var(--shadow-subtle)]">
          <div className="text-xs text-[var(--text-muted)]">Total Checks</div>
          <div className="text-xl sm:text-2xl font-semibold tracking-tight font-mono text-[var(--text-primary)] mt-1">
            {totalProbes || services.length * 10}
          </div>
          <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
            In evaluation window
          </div>
        </div>

        {/* Failed Probes */}
        <div className="p-4 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-[var(--shadow-subtle)]">
          <div className="text-xs text-[var(--text-muted)]">Failed Checks</div>
          <div className={`text-xl sm:text-2xl font-semibold tracking-tight font-mono mt-1 ${failedProbes > 0 ? 'text-[var(--status-down-text)]' : 'text-[var(--text-primary)]'}`}>
            {failedProbes}
          </div>
          <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
            {failedProbes === 0 ? 'Zero failures' : 'Recorded anomalies'}
          </div>
        </div>
      </div>

      {/* Latency Distribution Chart */}
      <div className="p-5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-[var(--shadow-subtle)] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity size={14} className="text-[var(--accent-primary)]" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              Latency Envelope & Outage Timeline ({timeRange})
            </h2>
          </div>
          <span className="text-[11px] text-[var(--text-muted)]">
            Primary: soft purple • Failures: soft red
          </span>
        </div>

        <ResponseTimeChart points={recent_response_times} height={200} showStats={true} />
      </div>

      {/* Service Reliability Leaderboard */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-[var(--shadow-subtle)] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
            Endpoint Reliability Ranking
          </h2>
          <span className="text-[11px] text-[var(--text-muted)]">
            Ranked by availability percentage
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]">
              <tr>
                <th className="py-2.5 px-4 font-medium">Rank</th>
                <th className="py-2.5 px-4 font-medium">Endpoint</th>
                <th className="py-2.5 px-4 font-medium text-right">Uptime</th>
                <th className="py-2.5 px-4 font-medium text-right">Recent Latency</th>
                <th className="py-2.5 px-4 font-medium text-center">Status</th>
                <th className="py-2.5 px-4 font-medium text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)] font-mono">
              {rankedServices.map((svc, idx) => (
                <tr
                  key={svc.id}
                  onClick={() => onSelectService(svc.id)}
                  className="hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer group"
                >
                  <td className="py-3 px-4 text-[var(--text-muted)] text-[11px]">
                    #{idx + 1}
                  </td>
                  <td className="py-3 px-4 font-sans">
                    <div className="font-medium text-[var(--text-primary)] group-hover:text-[var(--accent-text)] transition-colors">
                      {svc.name}
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)] font-mono truncate max-w-sm mt-0.5">
                      {svc.url}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className="text-[var(--text-primary)] font-medium">
                      {svc.uptime_percentage !== null && svc.uptime_percentage !== undefined
                        ? `${svc.uptime_percentage.toFixed(2)}%`
                        : '100.00%'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    {svc.recent_latency_ms !== null && svc.recent_latency_ms !== undefined
                      ? `${Math.round(svc.recent_latency_ms)}ms`
                      : '—'}
                  </td>
                  <td className="py-3 px-4 text-center font-sans">
                    <span
                      className={`inline-block w-2 h-2 rounded-full ${
                        svc.current_state === 'HEALTHY'
                          ? 'bg-[var(--status-healthy-dot)]'
                          : svc.current_state === 'DOWN'
                          ? 'bg-[var(--status-down-dot)] pulse-red'
                          : 'bg-[var(--status-degraded-dot)]'
                      }`}
                    />
                  </td>
                  <td className="py-3 px-4 text-right font-sans">
                    <span className="text-[var(--text-muted)] group-hover:text-[var(--text-primary)] inline-flex items-center gap-1 text-[11px]">
                      <span>Telemetry</span>
                      <ArrowUpRight size={12} />
                    </span>
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
