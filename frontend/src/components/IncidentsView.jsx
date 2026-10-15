import React, { useState, useEffect } from 'react';
import { ShieldAlert, ExternalLink } from 'lucide-react';
import { getIncidents } from '../api';

export default function IncidentsView({ services = [], onSelectService }) {
  const [incidents, setIncidents] = useState([]);
  const [filter, setFilter] = useState('ALL'); // ALL, OPEN, RESOLVED

  // Map serviceId to service object
  const serviceMap = React.useMemo(() => {
    const map = {};
    services.forEach((s) => {
      map[s.id] = s;
    });
    return map;
  }, [services]);

  const loadIncidents = async () => {
    try {
      const data = await getIncidents({ limit: 100 });
      setIncidents(data || []);
    } catch {
      // Handled silently for periodic polling
    }
  };

  useEffect(() => {
    loadIncidents();
    const interval = setInterval(loadIncidents, 6000);
    return () => clearInterval(interval);
  }, []);

  const filteredIncidents = incidents.filter((inc) => {
    if (filter === 'OPEN') return inc.status === 'OPEN';
    if (filter === 'RESOLVED') return inc.status === 'RESOLVED';
    return true;
  });

  const activeCount = incidents.filter((i) => i.status === 'OPEN').length;
  const resolvedCount = incidents.filter((i) => i.status === 'RESOLVED').length;

  const formatDuration = (startStr, endStr) => {
    const start = new Date(startStr);
    const end = endStr ? new Date(endStr) : new Date();
    const totalSec = Math.max(0, Math.round((end - start) / 1000));

    if (!endStr) {
      const mins = Math.floor(totalSec / 60);
      const secs = totalSec % 60;
      return `Ongoing (${mins}m ${secs}s)`;
    }

    if (totalSec < 60) return `${totalSec}s`;
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    if (mins < 60) return `${mins}m ${secs}s`;
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hours}h ${remMins}m`;
  };

  return (
    <div className="space-y-6">

      {/* Top Incident Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 bg-zinc-900/90 border border-zinc-800 rounded-xl">
          <div className="text-xs text-zinc-500 uppercase tracking-wider font-mono">
            Active Incidents
          </div>
          <div className={`text-3xl font-extrabold font-mono mt-1 ${activeCount > 0 ? 'text-rose-400' : 'text-zinc-100'}`}>
            {activeCount}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1 font-mono">
            {activeCount > 0 ? 'Critical outages currently ongoing' : 'All systems operating normally'}
          </div>
        </div>

        <div className="p-5 bg-zinc-900/90 border border-zinc-800 rounded-xl">
          <div className="text-xs text-zinc-500 uppercase tracking-wider font-mono">
            Resolved Incidents
          </div>
          <div className="text-3xl font-extrabold font-mono mt-1 text-emerald-400">
            {resolvedCount}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1 font-mono">
            Past outages automatically cleared
          </div>
        </div>

        <div className="p-5 bg-zinc-900/90 border border-zinc-800 rounded-xl">
          <div className="text-xs text-zinc-500 uppercase tracking-wider font-mono">
            Total Incidents
          </div>
          <div className="text-3xl font-extrabold font-mono mt-1 text-zinc-100">
            {incidents.length}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1 font-mono">
            Recorded history across all services
          </div>
        </div>
      </div>

      {/* Main Incidents Table Card */}
      <div className="p-6 bg-zinc-900/90 border border-zinc-800 rounded-xl space-y-4">
        
        {/* Controls / Filter Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <ShieldAlert size={16} className="text-rose-400" />
            <h2 className="text-xs font-bold text-zinc-300 uppercase tracking-widest font-mono">
              INCIDENTS LOG
            </h2>
          </div>

          <div className="flex items-center p-1 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-mono">
            <button
              onClick={() => setFilter('ALL')}
              className={`px-3 py-1 rounded-md transition-colors ${
                filter === 'ALL' ? 'bg-zinc-800 text-zinc-100 font-semibold' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              All ({incidents.length})
            </button>
            <button
              onClick={() => setFilter('OPEN')}
              className={`px-3 py-1 rounded-md transition-colors ${
                filter === 'OPEN' ? 'bg-rose-950 text-rose-300 font-semibold' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Active ({activeCount})
            </button>
            <button
              onClick={() => setFilter('RESOLVED')}
              className={`px-3 py-1 rounded-md transition-colors ${
                filter === 'RESOLVED' ? 'bg-emerald-950 text-emerald-300 font-semibold' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Resolved ({resolvedCount})
            </button>
          </div>
        </div>

        {/* Incidents Table */}
        {filteredIncidents.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="text-[11px] text-zinc-500 uppercase border-b border-zinc-800 bg-zinc-950/40">
                <tr>
                  <th className="py-2.5 px-3 font-medium">Status</th>
                  <th className="py-2.5 px-3 font-medium">Service</th>
                  <th className="py-2.5 px-3 font-medium">Start Time</th>
                  <th className="py-2.5 px-3 font-medium">Recovery Time</th>
                  <th className="py-2.5 px-3 font-medium">Duration</th>
                  <th className="py-2.5 px-3 font-medium">Failures</th>
                  <th className="py-2.5 px-3 font-medium">Root Cause / Recovery</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {filteredIncidents.map((inc) => {
                  const isOpen = inc.status === 'OPEN';
                  const srv = serviceMap[inc.service_id];

                  return (
                    <tr
                      key={inc.id}
                      className="hover:bg-zinc-800/40 transition-colors cursor-pointer"
                      onClick={() => onSelectService && onSelectService(inc.service_id)}
                    >
                      {/* Status */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold ${
                            isOpen
                              ? 'bg-rose-950/80 text-rose-300 border border-rose-800/60'
                              : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isOpen ? 'bg-rose-400 pulse-red' : 'bg-emerald-400'}`} />
                          {inc.status}
                        </span>
                      </td>

                      {/* Service */}
                      <td className="py-3 px-3">
                        <div className="font-semibold text-zinc-200 hover:text-cyan-400 flex items-center gap-1">
                          <span>{srv ? srv.name : `Service #${inc.service_id}`}</span>
                          <ExternalLink size={10} className="text-zinc-500" />
                        </div>
                        {srv && (
                          <div className="text-[11px] text-zinc-500 truncate max-w-xs">{srv.url}</div>
                        )}
                      </td>

                      {/* Start Time */}
                      <td className="py-3 px-3 text-zinc-300 whitespace-nowrap">
                        {new Date(inc.started_at).toLocaleString()}
                      </td>

                      {/* Recovery Time */}
                      <td className="py-3 px-3 text-zinc-400 whitespace-nowrap">
                        {inc.resolved_at ? (
                          new Date(inc.resolved_at).toLocaleString()
                        ) : (
                          <span className="text-rose-400 font-semibold">— (Ongoing)</span>
                        )}
                      </td>

                      {/* Duration */}
                      <td className="py-3 px-3 text-zinc-300 whitespace-nowrap">
                        {formatDuration(inc.started_at, inc.resolved_at)}
                      </td>

                      {/* Failures */}
                      <td className="py-3 px-3 text-zinc-300 whitespace-nowrap">
                        <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 text-[11px]">
                          {inc.failure_count}
                        </span>
                      </td>

                      {/* Cause & Recovery Message */}
                      <td className="py-3 px-3 max-w-xs truncate">
                        {isOpen ? (
                          <span className="text-rose-400">
                            {inc.last_error_message || inc.last_error_type || 'Unreachable'}
                          </span>
                        ) : (
                          <span className="text-emerald-400">
                            {inc.recovery_message || 'Recovered'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 text-center text-xs font-mono text-zinc-500 border border-dashed border-zinc-800 rounded-lg">
            No incidents found matching the filter "{filter}".
          </div>
        )}

      </div>

    </div>
  );
}
