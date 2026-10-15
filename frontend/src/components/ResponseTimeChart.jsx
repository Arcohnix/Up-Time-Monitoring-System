import React, { useState } from 'react';

export default function ResponseTimeChart({ points = [] }) {
  const [hoveredPoint, setHoveredPoint] = useState(null);

  if (!points || points.length === 0) {
    return (
      <div style={{
        height: '180px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-dim)',
        fontSize: '0.875rem',
        border: '1px dashed var(--border)',
        borderRadius: '8px',
      }}>
        No latency data recorded yet. Automatic checks will plot here shortly.
      </div>
    );
  }

  // Filter valid latency points
  const validPoints = points.filter(p => typeof p.response_time_ms === 'number' && p.response_time_ms >= 0);
  if (validPoints.length === 0) {
    return (
      <div style={{
        height: '180px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-dim)',
      }}>
        Waiting for completed health probes...
      </div>
    );
  }

  const width = 800;
  const height = 180;
  const paddingX = 40;
  const paddingY = 25;

  const maxLatency = Math.max(...validPoints.map(p => p.response_time_ms), 50);
  const minLatency = 0;

  // Scale functions
  const getX = (index) => {
    if (validPoints.length === 1) return width / 2;
    return paddingX + (index / (validPoints.length - 1)) * (width - 2 * paddingX);
  };

  const getY = (val) => {
    const clamped = Math.max(minLatency, Math.min(val, maxLatency));
    return height - paddingY - ((clamped - minLatency) / (maxLatency - minLatency)) * (height - 2 * paddingY);
  };

  // Generate SVG path coordinates
  const coords = validPoints.map((p, idx) => ({
    x: getX(idx),
    y: getY(p.response_time_ms),
    raw: p,
  }));

  const linePath = coords.reduce((acc, curr, idx) => {
    return idx === 0 ? `M ${curr.x} ${curr.y}` : `${acc} L ${curr.x} ${curr.y}`;
  }, '');

  const areaPath = `${linePath} L ${coords[coords.length - 1].x} ${height - paddingY} L ${coords[0].x} ${height - paddingY} Z`;

  return (
    <div style={{ position: 'relative', width: '100%', overflow: 'hidden' }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
      >
        <defs>
          <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Horizontal grid lines */}
        {[0, 0.5, 1].map((pct, i) => {
          const y = height - paddingY - pct * (height - 2 * paddingY);
          const labelVal = Math.round(minLatency + pct * (maxLatency - minLatency));
          return (
            <g key={i}>
              <line
                x1={paddingX}
                y1={y}
                x2={width - paddingX}
                y2={y}
                stroke="var(--border)"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
              <text
                x={paddingX - 8}
                y={y + 4}
                fill="var(--text-dim)"
                fontSize="10"
                textAnchor="end"
                className="mono"
              >
                {labelVal}ms
              </text>
            </g>
          );
        })}

        {/* Area fill */}
        <path d={areaPath} fill="url(#latencyGradient)" />

        {/* Line stroke */}
        <path
          d={linePath}
          fill="none"
          stroke="#06b6d4"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Interactive points */}
        {coords.map((pt, idx) => {
          const isFailed = !pt.raw.success;
          const isHovered = hoveredPoint && hoveredPoint.raw.id === pt.raw.id;
          return (
            <circle
              key={idx}
              cx={pt.x}
              cy={pt.y}
              r={isHovered ? 6 : (isFailed ? 4.5 : 3)}
              fill={isFailed ? 'var(--red)' : '#06b6d4'}
              stroke="#0a0d14"
              strokeWidth="1.5"
              style={{ cursor: 'pointer', transition: 'r 0.15s ease' }}
              onMouseEnter={() => setHoveredPoint(pt)}
              onMouseLeave={() => setHoveredPoint(null)}
            />
          );
        })}
      </svg>

      {/* Tooltip */}
      {hoveredPoint && (
        <div style={{
          position: 'absolute',
          top: '10px',
          right: '20px',
          backgroundColor: '#161e2e',
          border: '1px solid var(--border-light)',
          borderRadius: '6px',
          padding: '6px 12px',
          fontSize: '0.75rem',
          pointerEvents: 'none',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          zIndex: 10,
        }}>
          <div style={{ color: 'var(--text-main)', fontWeight: 600 }}>
            {hoveredPoint.raw.service_name || `Service #${hoveredPoint.raw.service_id}`}
          </div>
          <div style={{ color: '#06b6d4', marginTop: '2px' }} className="mono">
            {hoveredPoint.raw.response_time_ms} ms {hoveredPoint.raw.status_code ? `(HTTP ${hoveredPoint.raw.status_code})` : ''}
          </div>
          <div style={{ color: 'var(--text-dim)', fontSize: '0.7rem' }}>
            {new Date(hoveredPoint.raw.timestamp).toLocaleTimeString()}
          </div>
        </div>
      )}
    </div>
  );
}
