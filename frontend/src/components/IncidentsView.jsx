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

      {/* Top Incident Summary Cards (Neutral) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 bg-white border border-[#E5E7EB] rounded-xl shadow-xs">
          <div className="text-xs font-medium text-[#71717A] flex items-center justify-between">
            <span>Active Incidents</span>
            {activeCount > 0 && <span className="w-2 h-2 rounded-full bg-[#C75C62] pulse-red" />}
          </div>
          <div className="text-3xl font-semibold text-[#18181B] tracking-tight mt-1">
            {activeCount}
          </div>
          <div className="text-[11px] text-[#A1A1AA] mt-1">
            {activeCount > 0 ? 'Outages currently ongoing' : 'All systems operating normally'}
          </div>
        </div>

        <div className="p-5 bg-white border border-[#E5E7EB] rounded-xl shadow-xs">
          <div className="text-xs font-medium text-[#71717A]">
            Resolved Incidents
          </div>
          <div className="text-3xl font-semibold text-[#18181B] tracking-tight mt-1">
            {resolvedCount}
          </div>
          <div className="text-[11px] text-[#A1A1AA] mt-1">
            Past outages automatically cleared
          </div>
        </div>

        <div className="p-5 bg-white border border-[#E5E7EB] rounded-xl shadow-xs">
          <div className="text-xs font-medium text-[#71717A]">
            Total Incidents
          </div>
          <div className="text-3xl font-semibold text-[#18181B] tracking-tight mt-1">
            {incidents.length}
          </div>
          <div className="text-[11px] text-[#A1A1AA] mt-1">
            Recorded history across all services
          </div>
        </div>
      </div>

      {/* Main Incidents Table Card */}
      <div className="p-6 bg-white border border-[#E5E7EB] rounded-xl shadow-xs space-y-4">
        
        {/* Controls / Filter Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-[#E5E7EB]">
          <div className="flex items-center gap-2">
            <ShieldAlert size={16} className="text-[#71717A]" />
            <h2 className="text-xs font-semibold text-[#18181B] uppercase tracking-wider">
              INCIDENTS LOG
            </h2>
          </div>

          <div className="flex items-center p-0.5 bg-[#F3F4F6] border border-[#E5E7EB] rounded-lg text-xs">
            <button
              onClick={() => setFilter('ALL')}
              className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                filter === 'ALL' ? 'bg-white text-[#18181B] font-semibold shadow-xs' : 'text-[#71717A] hover:text-[#18181B]'
              }`}
            >
              All ({incidents.length})
            </button>
            <button
              onClick={() => setFilter('OPEN')}
              className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                filter === 'OPEN' ? 'bg-white text-[#A63F46] font-semibold shadow-xs' : 'text-[#71717A] hover:text-[#18181B]'
              }`}
            >
              Active ({activeCount})
            </button>
            <button
              onClick={() => setFilter('RESOLVED')}
              className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                filter === 'RESOLVED' ? 'bg-white text-[#347A55] font-semibold shadow-xs' : 'text-[#71717A] hover:text-[#18181B]'
              }`}
            >
              Resolved ({resolvedCount})
            </button>
          </div>
        </div>

        {/* Incidents Table */}
        {filteredIncidents.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[11px] text-[#71717A] uppercase tracking-wider border-b border-[#E5E7EB] bg-[#F7F8FA]">
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
              <tbody className="divide-y divide-[#E5E7EB]">
                {filteredIncidents.map((inc) => {
                  const isOpen = inc.status === 'OPEN';
                  const srv = serviceMap[inc.service_id];

                  return (
                    <tr
                      key={inc.id}
                      className="hover:bg-[#F7F8FA] transition-colors cursor-pointer"
                      onClick={() => onSelectService && onSelectService(inc.service_id)}
                    >
                      {/* Status */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium border ${
                            isOpen
                              ? 'bg-[#FBEDEE] text-[#A63F46] border-[#C75C62]/20'
                              : 'bg-[#ECF7F0] text-[#347A55] border-[#4D9F72]/20'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isOpen ? 'bg-[#C75C62] pulse-red' : 'bg-[#4D9F72]'}`} />
                          {inc.status}
                        </span>
                      </td>

                      {/* Service */}
                      <td className="py-3 px-3">
                        <div className="font-medium text-[#18181B] hover:text-[#5865D8] flex items-center gap-1 transition-colors">
                          <span>{srv ? srv.name : `Service #${inc.service_id}`}</span>
                          <ExternalLink size={10} className="text-[#A1A1AA]" />
                        </div>
                        {srv && (
                          <div className="text-[11px] text-[#71717A] font-mono truncate max-w-xs">{srv.url}</div>
                        )}
                      </td>

                      {/* Start Time */}
                      <td className="py-3 px-3 text-[#71717A] whitespace-nowrap">
                        {new Date(inc.started_at).toLocaleString()}
                      </td>

                      {/* Recovery Time */}
                      <td className="py-3 px-3 text-[#71717A] whitespace-nowrap">
                        {inc.resolved_at ? (
                          new Date(inc.resolved_at).toLocaleString()
                        ) : (
                          <span className="text-[#A63F46] font-medium">— (Ongoing)</span>
                        )}
                      </td>

                      {/* Duration */}
                      <td className="py-3 px-3 text-[#18181B] font-medium whitespace-nowrap">
                        {formatDuration(inc.started_at, inc.resolved_at)}
                      </td>

                      {/* Failures */}
                      <td className="py-3 px-3 text-[#71717A] whitespace-nowrap">
                        <span className="px-1.5 py-0.5 rounded-md bg-[#F3F4F6] text-[#71717A] text-[11px] font-medium">
                          {inc.failure_count}
                        </span>
                      </td>

                      {/* Cause & Recovery Message */}
                      <td className="py-3 px-3 max-w-xs truncate">
                        {isOpen ? (
                          <span className="text-[#A63F46]">
                            {inc.last_error_message || inc.last_error_type || 'Unreachable'}
                          </span>
                        ) : (
                          <span className="text-[#347A55]">
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
          <div className="py-12 text-center text-xs text-[#71717A] border border-dashed border-[#E5E7EB] rounded-xl">
            No incidents found matching the filter "{filter}".
          </div>
        )}

      </div>

    </div>
  );
}
