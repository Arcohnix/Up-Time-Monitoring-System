import React, { useState } from 'react';

export default function ResponseTimeChart({ points = [], height = 180, showStats = true }) {
  const [hovered, setHovered] = useState(null);

  if (!points || points.length === 0) {
    return (
      <div
        style={{ height }}
        className="w-full flex items-center justify-center border border-dashed border-[var(--border-subtle)] rounded-lg text-[var(--text-muted)] text-xs"
      >
        No latency data recorded in this time window
      </div>
    );
  }

  // Filter valid points
  const valid = points.filter((p) => {
    const lat = p.response_time_ms;
    return typeof lat === 'number' && lat >= 0;
  });

  if (valid.length === 0) {
    return (
      <div
        style={{ height }}
        className="w-full flex items-center justify-center border border-dashed border-[var(--border-subtle)] rounded-lg text-[var(--text-muted)] text-xs"
      >
        Waiting for completed health probes...
      </div>
    );
  }

  const latencies = valid.map((p) => p.response_time_ms);
  const minVal = Math.min(...latencies);
  const maxVal = Math.max(...latencies, 20);
  const avgVal = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);

  const width = 800;
  const paddingX = 40;
  const paddingY = 24;

  const getX = (idx) => {
    if (valid.length === 1) return width / 2;
    return paddingX + (idx / (valid.length - 1)) * (width - 2 * paddingX);
  };

  const getY = (val) => {
    const clamped = Math.max(0, Math.min(val, maxVal));
    return height - paddingY - (clamped / maxVal) * (height - 2 * paddingY);
  };

  const coords = valid.map((p, idx) => ({
    x: getX(idx),
    y: getY(p.response_time_ms),
    raw: p,
  }));

  const lineD = coords.reduce(
    (acc, c, idx) => (idx === 0 ? `M ${c.x} ${c.y}` : `${acc} L ${c.x} ${c.y}`),
    ''
  );

  const areaD = `${lineD} L ${coords[coords.length - 1].x} ${height - paddingY} L ${coords[0].x} ${height - paddingY} Z`;

  const formatDate = (dateStr) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="relative w-full">
      {/* Top summary stats */}
      {showStats && (
        <div className="flex items-center justify-end gap-3 mb-2 text-xs text-[var(--text-muted)] font-mono">
          <span>Min: <span className="text-[var(--text-primary)] font-medium">{Math.round(minVal)}ms</span></span>
          <span className="text-[var(--border-subtle)]">•</span>
          <span>Avg: <span className="text-[var(--accent-text)] font-medium">{avgVal}ms</span></span>
          <span className="text-[var(--border-subtle)]">•</span>
          <span>Max: <span className="text-[var(--text-primary)] font-medium">{Math.round(maxVal)}ms</span></span>
        </div>
      )}

      {/* SVG Canvas */}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto block select-none overflow-visible"
      >
        <defs>
          <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity="0.12" />
            <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity="0.00" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {[0, 0.5, 1].map((pct, i) => {
          const y = height - paddingY - pct * (height - 2 * paddingY);
          const label = Math.round(pct * maxVal);
          return (
            <g key={i}>
              <line
                x1={paddingX}
                y1={y}
                x2={width - paddingX}
                y2={y}
                stroke="var(--border-subtle)"
                strokeDasharray="3 3"
                strokeWidth="1"
              />
              <text
                x={paddingX - 8}
                y={y + 3.5}
                fill="var(--text-muted)"
                fontSize="10"
                textAnchor="end"
                fontFamily="ui-monospace, monospace"
              >
                {label}ms
              </text>
            </g>
          );
        })}

        {/* Subtle Area Fill */}
        <path d={areaD} fill="url(#latencyGradient)" />

        {/* Primary Data Line (Soft Purple Accent) */}
        <path
          d={lineD}
          fill="none"
          stroke="var(--accent-primary)"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {coords.map((c, i) => {
          const isFailed = !c.raw.success;
          const isHovered = hovered && (hovered.raw.id ? hovered.raw.id === c.raw.id : hovered.x === c.x);
          return (
            <circle
              key={i}
              cx={c.x}
              cy={c.y}
              r={isHovered ? 5 : (isFailed ? 3.5 : 2.5)}
              fill={isFailed ? 'var(--status-down-dot)' : 'var(--accent-primary)'}
              stroke="var(--bg-surface)"
              strokeWidth="1.5"
              className="cursor-pointer transition-all duration-150"
              onMouseEnter={() => setHovered(c)}
              onMouseLeave={() => setHovered(null)}
            />
          );
        })}
      </svg>

      {/* Floating Precision Tooltip */}
      {hovered && (
        <div
          className="absolute z-20 top-2 right-2 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-xs shadow-lg pointer-events-none animate-in fade-in duration-100"
          style={{ minWidth: '170px' }}
        >
          <div className="text-[11px] text-[var(--text-muted)] font-mono mb-1">
            {formatDate(hovered.raw.timestamp || hovered.raw.checked_at)}
          </div>
          <div className="flex items-center justify-between text-[var(--text-primary)] font-medium">
            <span>Response time:</span>
            <span className="font-mono text-[var(--accent-text)]">{hovered.raw.response_time_ms}ms</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)] mt-0.5">
            <span>Status:</span>
            <span className="font-mono">
              {hovered.raw.status_code ? `HTTP ${hovered.raw.status_code}` : (hovered.raw.success ? '200 OK' : 'Failed')}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
