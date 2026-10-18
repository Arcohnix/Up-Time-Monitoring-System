import React from 'react';

export default function StatusIndicator({
  state,
  isActive = true,
  size = 'sm',
  showText = true,
  pulse = true,
  className = '',
}) {
  if (!isActive) {
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs text-[var(--status-paused-text)] ${className}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-paused-dot)] shrink-0" />
        {showText && <span>Paused</span>}
      </span>
    );
  }

  const s = (state || '').toUpperCase();

  if (s === 'HEALTHY' || s === 'OPERATIONAL') {
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs font-medium text-[var(--status-healthy-text)] ${className}`}>
        <span
          className={`w-1.5 h-1.5 rounded-full bg-[var(--status-healthy-dot)] shrink-0 ${
            pulse ? 'pulse-green' : ''
          }`}
        />
        {showText && <span>Operational</span>}
      </span>
    );
  }

  if (s === 'FAILING' || s === 'DEGRADED') {
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs font-medium text-[var(--status-degraded-text)] ${className}`}>
        <span
          className={`w-1.5 h-1.5 rounded-full bg-[var(--status-degraded-dot)] shrink-0 ${
            pulse ? 'pulse-amber' : ''
          }`}
        />
        {showText && <span>Degraded</span>}
      </span>
    );
  }

  if (s === 'DOWN') {
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs font-medium text-[var(--status-down-text)] ${className}`}>
        <span
          className={`w-1.5 h-1.5 rounded-full bg-[var(--status-down-dot)] shrink-0 ${
            pulse ? 'pulse-red' : ''
          }`}
        />
        {showText && <span>Down</span>}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] ${className}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)] shrink-0" />
      {showText && <span>{state || 'Unknown'}</span>}
    </span>
  );
}
