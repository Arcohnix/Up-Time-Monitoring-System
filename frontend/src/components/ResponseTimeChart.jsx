import React, { useState } from 'react';

export default function ResponseTimeChart({ points = [], height = 180, showStats = true }) {
  const [hovered, setHovered] = useState(null);

  if (!points || points.length === 0) {
    return (
      <div
        style={{ height }}
        className="w-full flex items-center justify-center border border-dashed border-zinc-800 rounded-lg text-zinc-500 text-xs font-mono"
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
        className="w-full flex items-center justify-center border border-dashed border-zinc-800 rounded-lg text-zinc-500 text-xs font-mono"
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

  return (
    <div className="relative w-full">
      {/* Top summary stats */}
      {showStats && (
        <div className="flex items-center justify-end gap-3 mb-2 text-xs font-mono text-zinc-400">
          <span>Min: <span className="text-zinc-200">{Math.round(minVal)}ms</span></span>
          <span className="text-zinc-700">•</span>
          <span>Avg: <span className="text-cyan-400">{avgVal}ms</span></span>
          <span className="text-zinc-700">•</span>
          <span>Max: <span className="text-zinc-200">{Math.round(maxVal)}ms</span></span>
        </div>
      )}

      {/* SVG Canvas */}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto block select-none"
      >
        <defs>
          <linearGradient id="rtGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
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
                stroke="#27272a"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
              <text
                x={paddingX - 8}
                y={y + 3}
                fill="#71717a"
                fontSize="10"
                textAnchor="end"
                className="font-mono"
              >
                {label}ms
              </text>
            </g>
          );
        })}

        {/* Area */}
        <path d={areaD} fill="url(#rtGradient)" />

        {/* Line */}
        <path
          d={lineD}
          fill="none"
          stroke="#06b6d4"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Interactive points */}
        {coords.map((c, i) => {
          const isFailed = !c.raw.success;
          const isHovered = hovered && hovered.raw.id === c.raw.id;
          return (
            <circle
              key={i}
              cx={c.x}
              cy={c.y}
              r={isHovered ? 5.5 : (isFailed ? 4 : 2.5)}
              fill={isFailed ? '#f43f5e' : '#06b6d4'}
              stroke="#09090b"
              strokeWidth="1.5"
              className="cursor-pointer transition-all duration-150"
              onMouseEnter={() => setHovered(c)}
              onMouseLeave={() => setHovered(null)}
            />
          );
        })}
      </svg>

      {/* Floating Tooltip */}
      {hovered && (
        <div
          className="absolute z-20 top-2 right-4 bg-zinc-900 border border-zinc-700/80 rounded-md px-3 py-2 text-xs shadow-xl pointer-events-none font-mono"
        >
          <div className="text-zinc-200 font-semibold mb-0.5">
            {hovered.raw.service_name || `Service #${hovered.raw.service_id}`}
          </div>
          <div className="flex items-center gap-1.5 text-cyan-400">
            <span>{hovered.raw.response_time_ms}ms</span>
            {hovered.raw.status_code && (
              <span className="text-zinc-400">(HTTP {hovered.raw.status_code})</span>
            )}
          </div>
          <div className="text-zinc-500 text-[11px] mt-0.5">
            {new Date(hovered.raw.timestamp || hovered.raw.checked_at).toLocaleTimeString()}
          </div>
        </div>
      )}
    </div>
  );
}
