import React from 'react';
import StatusIndicator from './StatusIndicator';

export default function StatusBadge({ state, isActive = true, className = '' }) {
  return <StatusIndicator state={state} isActive={isActive} className={className} />;
}
