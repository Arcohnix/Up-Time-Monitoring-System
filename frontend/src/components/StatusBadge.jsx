import React from 'react';

export default function StatusBadge({ state, isActive = true, size = 'sm' }) {
  if (!isActive) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-zinc-800/80 text-zinc-400 border border-zinc-700/50">
        <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
        Disabled
      </span>
    );
  }

  const s = (state || '').toUpperCase();

  if (s === 'HEALTHY') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-emerald-950/40 text-emerald-400 border border-emerald-800/40">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-green" />
        Healthy
      </span>
    );
  }

  if (s === 'FAILING' || s === 'DEGRADED') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-amber-950/40 text-amber-400 border border-amber-800/40">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 pulse-amber" />
        Degraded
      </span>
    );
  }

  if (s === 'DOWN') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold bg-rose-950/50 text-rose-300 border border-rose-800/50">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 pulse-red" />
        Down
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-zinc-800 text-zinc-400 border border-zinc-700">
      <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
      {state || 'Unknown'}
    </span>
  );
}
