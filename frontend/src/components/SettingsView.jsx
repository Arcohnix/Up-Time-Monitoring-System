import React from 'react';
import {
  Mail,
  ShieldCheck,
  Cpu,
  ExternalLink,
  Laptop,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function SettingsView() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-6 max-w-4xl animate-in fade-in duration-150">
      {/* Header */}
      <div>
        <h1 className="text-base font-semibold tracking-tight text-[var(--text-primary)]">
          System & Fleet Settings
        </h1>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">
          Configuration profiles for notifications, monitoring scheduler, watchdog, and observability
        </p>
      </div>

      {/* 1. Notification Providers Profile */}
      <div className="p-5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-[var(--shadow-subtle)] space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2">
            <Mail size={15} className="text-[var(--accent-primary)]" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              Notification Channels
            </h2>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs text-[var(--status-healthy-text)] font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-healthy-dot)] pulse-green" />
            Configured
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          {/* Email Channel */}
          <div className="p-3.5 bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[var(--text-primary)]">Email Alerts (SMTP)</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-[var(--status-healthy-bg)] text-[var(--status-healthy-text)]">
                Active
              </span>
            </div>
            <div className="space-y-1 font-mono text-[11px] text-[var(--text-secondary)]">
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Recipient:</span>
                <span className="text-[var(--text-primary)]">arcohnix8@gmail.com</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">SMTP Host:</span>
                <span>smtp.gmail.com:587</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Encryption:</span>
                <span>STARTTLS</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Deduplication:</span>
                <span>1 per incident cycle</span>
              </div>
            </div>
          </div>

          {/* Webhook Channel */}
          <div className="p-3.5 bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[var(--text-primary)]">Webhook Dispatch</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-[var(--bg-surface)] text-[var(--text-muted)]">
                Optional
              </span>
            </div>
            <div className="space-y-1 font-mono text-[11px] text-[var(--text-secondary)]">
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Endpoint:</span>
                <span className="truncate max-w-[160px]">ALERT_WEBHOOK_URL</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Timeout:</span>
                <span>10.0s</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Payload:</span>
                <span>JSON (Incident Schema)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Fault Isolation:</span>
                <span>Independent worker</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. External Watchdog & Self-Health Profile */}
      <div className="p-5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-[var(--shadow-subtle)] space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2">
            <ShieldCheck size={15} className="text-[var(--status-healthy-dot)]" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              External Watchdog & Self-Health
            </h2>
          </div>
          <span className="text-[11px] text-[var(--text-muted)] font-mono">
            Phase 12 Service Guard
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
          <div className="p-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)]">
            <div className="text-[10px] text-[var(--text-muted)] uppercase">Heartbeat Endpoint</div>
            <div className="font-semibold text-[var(--text-primary)] mt-1">/health/heartbeat</div>
            <div className="text-[10px] text-[var(--text-muted)] mt-0.5">Worker liveness verification</div>
          </div>
          <div className="p-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)]">
            <div className="text-[10px] text-[var(--text-muted)] uppercase">Probe Interval</div>
            <div className="font-semibold text-[var(--text-primary)] mt-1">5.0 seconds</div>
            <div className="text-[10px] text-[var(--text-muted)] mt-0.5">Independent watchdog container</div>
          </div>
          <div className="p-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)]">
            <div className="text-[10px] text-[var(--text-muted)] uppercase">Heartbeat Stale Limit</div>
            <div className="font-semibold text-[var(--text-primary)] mt-1">30.0 seconds</div>
            <div className="text-[10px] text-[var(--text-muted)] mt-0.5">Failure alert threshold: 2x</div>
          </div>
        </div>
      </div>

      {/* 3. Monitoring Engine & Observability Stack */}
      <div className="p-5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-[var(--shadow-subtle)] space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2">
            <Cpu size={15} className="text-[var(--accent-primary)]" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              Observability & Scheduler Engine
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="space-y-2">
            <div className="font-semibold text-[var(--text-primary)]">Prometheus Metrics</div>
            <div className="text-[11px] text-[var(--text-muted)] leading-relaxed">
              Exposes application, scheduler, and probe telemetry at the standardized scrape endpoint.
            </div>
            <div className="font-mono text-[11px] text-[var(--text-secondary)] flex items-center gap-2">
              <span className="text-[var(--text-muted)]">Endpoint:</span>
              <a
                href="http://localhost:8000/metrics"
                target="_blank"
                rel="noreferrer"
                className="text-[var(--accent-text)] hover:underline inline-flex items-center gap-1"
              >
                <span>/metrics</span>
                <ExternalLink size={10} />
              </a>
              <span className="text-[var(--text-muted)]">• Port 9090</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="font-semibold text-[var(--text-primary)]">Grafana Dashboards</div>
            <div className="text-[11px] text-[var(--text-muted)] leading-relaxed">
              Pre-provisioned observability dashboards for uptime SLA, latency percentiles, and error tracking.
            </div>
            <div className="font-mono text-[11px] text-[var(--text-secondary)] flex items-center gap-2">
              <span className="text-[var(--text-muted)]">Portal:</span>
              <a
                href="http://localhost:3001"
                target="_blank"
                rel="noreferrer"
                className="text-[var(--accent-text)] hover:underline inline-flex items-center gap-1"
              >
                <span>http://localhost:3001</span>
                <ExternalLink size={10} />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Display & Theme Preferences */}
      <div className="p-5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-[var(--shadow-subtle)] space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2">
            <Laptop size={15} className="text-[var(--text-secondary)]" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              Appearance & Interface Theme
            </h2>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-[var(--text-primary)]">Color Palette Mode</div>
            <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
              Select between Dark, Light, or automatic System preference.
            </div>
          </div>

          <div className="flex items-center p-0.5 bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] rounded-lg text-xs">
            {['system', 'light', 'dark'].map((m) => (
              <button
                key={m}
                onClick={() => setTheme(m)}
                className={`px-3 py-1 rounded-md capitalize transition-colors cursor-pointer ${
                  theme === m
                    ? 'bg-[var(--bg-surface)] text-[var(--accent-text)] font-semibold shadow-xs'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
