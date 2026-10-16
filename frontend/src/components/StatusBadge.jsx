import React from 'react';

export default function StatusBadge({ state, isActive = true }) {
  if (!isActive) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium bg-[#F3F4F6] text-[#71717A]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#A1A1AA]" />
        Disabled
      </span>
    );
  }

  const s = (state || '').toUpperCase();

  if (s === 'HEALTHY') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium bg-[#ECF7F0] text-[#347A55]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#4D9F72] pulse-green" />
        Healthy
      </span>
    );
  }

  if (s === 'FAILING' || s === 'DEGRADED') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium bg-[#FBF5E8] text-[#946F22]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#C99535] pulse-amber" />
        Degraded
      </span>
    );
  }

  if (s === 'DOWN') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium bg-[#FBEDEE] text-[#A63F46]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#C75C62] pulse-red" />
        Down
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium bg-[#F3F4F6] text-[#71717A]">
      <span className="w-1.5 h-1.5 rounded-full bg-[#A1A1AA]" />
      {state || 'Unknown'}
    </span>
  );
}
