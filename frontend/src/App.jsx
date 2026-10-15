import React, { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  Plus,
  Play,
  Trash2,
  ExternalLink,
  AlertTriangle,
  CheckCircle,
  Activity,
  Server,
  Clock,
  ShieldAlert,
} from 'lucide-react';
import {
  fetchDashboard,
  triggerServiceCheck,
  triggerCheckAll,
  deleteService,
} from './api';
import ResponseTimeChart from './components/ResponseTimeChart';
import AddServiceModal from './components/AddServiceModal';

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [checkingServiceId, setCheckingServiceId] = useState(null);
  const [checkingAll, setCheckingAll] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const result = await fetchDashboard();
      setData(result);
      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message || 'Failed to connect to backend server');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Polling loop
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      loadData(true);
    }, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, loadData]);

  // Trigger manual single check
  const handleCheckService = async (serviceId, e) => {
    e.stopPropagation();
    setCheckingServiceId(serviceId);
    try {
      await triggerServiceCheck(serviceId);
      await loadData(true);
    } catch (err) {
      alert(`Check failed: ${err.message}`);
    } finally {
      setCheckingServiceId(null);
    }
  };

  // Trigger check all
  const handleCheckAll = async () => {
    setCheckingAll(true);
    try {
      await triggerCheckAll();
      await loadData(true);
    } catch (err) {
      alert(`Check all failed: ${err.message}`);
    } finally {
      setCheckingAll(false);
    }
  };

  // Delete service
  const handleDeleteService = async (serviceId, serviceName, e) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete "${serviceName}"?`)) return;
    try {
      await deleteService(serviceId);
      await loadData(true);
    } catch (err) {
      alert(`Failed to delete: ${err.message}`);
    }
  };

  // Status dot & badge helper
  const getStatusBadge = (state, isActive) => {
    if (!isActive) {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
          <span className="dot-gray" />
          <span>Disabled</span>
        </span>
      );
    }
    switch (state) {
      case 'HEALTHY':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--green)', fontSize: '0.85rem' }}>
            <span className="dot-green" />
            <span>Healthy</span>
          </span>
        );
      case 'FAILING':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--yellow)', fontSize: '0.85rem' }}>
            <span className="dot-yellow" />
            <span>Degraded</span>
          </span>
        );
      case 'DOWN':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--red)', fontSize: '0.85rem', fontWeight: 600 }}>
            <span className="dot-red" />
            <span>Down</span>
          </span>
        );
      default:
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-dim)', fontSize: '0.85rem' }}>
            <span className="dot-gray" />
            <span>Unknown</span>
          </span>
        );
    }
  };

  return (
    <div style={{ minHeight: '100vh', padding: '2rem 1rem' }}>
      <div style={{ maxWidth: '960px', margin: '0 auto' }}>

        {/* Global Terminal Card Container */}
        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
          overflow: 'hidden',
        }}>

          {/* 1. Header (Matching ASCII Top Banner) */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1.25rem 2rem',
            borderBottom: '1px solid var(--border)',
            backgroundColor: '#0c101a',
            flexWrap: 'wrap',
            gap: '1rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Activity size={22} style={{ color: '#06b6d4' }} />
              <h1 style={{
                fontSize: '1.15rem',
                fontWeight: 700,
                letterSpacing: '0.12em',
                color: 'var(--text-main)',
                margin: 0,
              }} className="mono">
                UPTIME MONITOR
              </h1>
            </div>

            {/* System Online Badge & Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              {/* Online indicator */}
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '4px 12px',
                borderRadius: '9999px',
                backgroundColor: data?.system_status === 'SYSTEM ONLINE' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                border: `1px solid ${data?.system_status === 'SYSTEM ONLINE' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                fontSize: '0.75rem',
                fontWeight: 600,
                letterSpacing: '0.08em',
              }} className="mono">
                <span className={data?.system_status === 'SYSTEM ONLINE' ? 'dot-green' : 'dot-red'} />
                <span style={{ color: data?.system_status === 'SYSTEM ONLINE' ? 'var(--green)' : 'var(--red)' }}>
                  {data?.system_status || 'CONNECTING...'}
                </span>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={() => loadData(false)}
                  disabled={refreshing}
                  title="Refresh status"
                  style={{
                    backgroundColor: 'var(--bg-subtle)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-muted)',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.75rem',
                  }}
                  className="mono"
                >
                  <RefreshCw size={13} className={refreshing ? 'spin' : ''} />
                  <span>Refresh</span>
                </button>

                <button
                  onClick={handleCheckAll}
                  disabled={checkingAll}
                  title="Probe all active endpoints now"
                  style={{
                    backgroundColor: 'var(--bg-subtle)',
                    border: '1px solid var(--border)',
                    color: '#06b6d4',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                  }}
                  className="mono"
                >
                  <Play size={12} fill="#06b6d4" />
                  <span>{checkingAll ? 'Checking...' : 'Check All'}</span>
                </button>

                <button
                  onClick={() => setIsModalOpen(true)}
                  style={{
                    backgroundColor: 'var(--green)',
                    border: 'none',
                    color: '#06261c',
                    padding: '6px 14px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                  }}
                  className="mono"
                >
                  <Plus size={14} />
                  <span>+ Service</span>
                </button>
              </div>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div style={{
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              borderBottom: '1px solid var(--red)',
              color: 'var(--red)',
              padding: '0.75rem 2rem',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Active Incidents Alert Banner */}
          {data?.active_incidents && data.active_incidents.length > 0 && (
            <div style={{
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              borderBottom: '1px solid rgba(239, 68, 68, 0.3)',
              padding: '1rem 2rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--red)', fontWeight: 600, marginBottom: '6px' }}>
                <ShieldAlert size={18} />
                <span className="mono" style={{ letterSpacing: '0.05em' }}>
                  ACTIVE OUTAGE ({data.active_incidents.length} INCIDENT{data.active_incidents.length > 1 ? 'S' : ''})
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {data.active_incidents.map((inc) => (
                  <div key={inc.id} style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>Incident #{inc.id}</span>: Service #{inc.service_id} is down —{' '}
                    <span style={{ color: 'var(--red)' }}>{inc.last_error_message || 'Unreachable'}</span>{' '}
                    (Consecutive failures: {inc.failure_count})
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2. Top Metrics Section (Matching ASCII Metrics Grid) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            padding: '2rem',
            borderBottom: '1px solid var(--border)',
            gap: '2rem',
            backgroundColor: '#0e121d',
          }}>
            {/* Uptime */}
            <div>
              <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', lineHeight: 1.1 }} className="mono">
                {data ? `${data.overall_uptime_percentage.toFixed(2)}%` : '—'}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '6px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Uptime
              </div>
            </div>

            {/* Avg Latency */}
            <div>
              <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--cyan)', letterSpacing: '-0.02em', lineHeight: 1.1 }} className="mono">
                {data?.overall_avg_response_time_ms !== null && data?.overall_avg_response_time_ms !== undefined
                  ? `${Math.round(data.overall_avg_response_time_ms)}ms`
                  : '—'}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '6px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Avg latency
              </div>
            </div>

            {/* Services Count */}
            <div>
              <div style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', lineHeight: 1.1 }} className="mono">
                {data ? data.total_services : '—'}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '6px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Services
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '6px', fontSize: '0.75rem' }} className="mono">
                <span style={{ color: 'var(--green)' }}>● {data?.healthy_services || 0} Healthy</span>
                {data?.degraded_services > 0 && <span style={{ color: 'var(--yellow)' }}>● {data.degraded_services} Degraded</span>}
                {data?.down_services > 0 && <span style={{ color: 'var(--red)' }}>● {data.down_services} Down</span>}
              </div>
            </div>
          </div>

          {/* 3. Services Section (Matching ASCII Services List) */}
          <div style={{ padding: '2rem', borderBottom: '1px solid var(--border)' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1.25rem',
            }}>
              <h2 style={{
                fontSize: '0.85rem',
                fontWeight: 700,
                color: 'var(--text-muted)',
                letterSpacing: '0.12em',
                margin: 0,
              }} className="mono">
                SERVICES
              </h2>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }} className="mono">
                Auto-refresh: {autoRefresh ? 'ON (5s)' : 'PAUSED'}
              </span>
            </div>

            {/* Services List Table */}
            {data?.services && data.services.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {data.services.map((svc) => (
                  <div
                    key={svc.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(220px, 2fr) minmax(80px, 1fr) minmax(90px, 1fr) minmax(110px, 1fr) 90px',
                      alignItems: 'center',
                      padding: '0.85rem 1.25rem',
                      backgroundColor: 'var(--bg-subtle)',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      transition: 'background-color 0.15s ease, border-color 0.15s ease',
                      gap: '1rem',
                    }}
                  >
                    {/* Name & URL */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                        {svc.current_state === 'HEALTHY' && <span className="dot-green" />}
                        {svc.current_state === 'FAILING' && <span className="dot-yellow" />}
                        {svc.current_state === 'DOWN' && <span className="dot-red" />}
                        {!svc.is_active && <span className="dot-gray" />}

                        <span style={{ fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                          {svc.name}
                        </span>
                      </div>
                    </div>

                    {/* Uptime % */}
                    <div style={{ textAlign: 'right', color: 'var(--text-main)', fontWeight: 600 }} className="mono">
                      {svc.uptime_percentage.toFixed(2)}%
                    </div>

                    {/* Avg Latency */}
                    <div style={{ textAlign: 'right', color: 'var(--text-muted)' }} className="mono">
                      {svc.avg_response_time_ms !== null && svc.avg_response_time_ms !== undefined
                        ? `${Math.round(svc.avg_response_time_ms)}ms`
                        : '—'}
                    </div>

                    {/* State Badge */}
                    <div style={{ textAlign: 'center' }}>
                      {getStatusBadge(svc.current_state, svc.is_active)}
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                      <button
                        onClick={(e) => handleCheckService(svc.id, e)}
                        disabled={checkingServiceId === svc.id}
                        title="Run health check now"
                        style={{
                          backgroundColor: 'transparent',
                          border: '1px solid var(--border)',
                          color: '#06b6d4',
                          padding: '4px 6px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                        }}
                      >
                        <Play size={12} fill="#06b6d4" className={checkingServiceId === svc.id ? 'spin' : ''} />
                      </button>

                      <button
                        onClick={(e) => handleDeleteService(svc.id, svc.name, e)}
                        title="Delete service"
                        style={{
                          backgroundColor: 'transparent',
                          border: 'none',
                          color: 'var(--text-dim)',
                          padding: '4px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{
                padding: '2.5rem',
                textAlign: 'center',
                color: 'var(--text-muted)',
                backgroundColor: 'var(--bg-subtle)',
                borderRadius: '8px',
                border: '1px dashed var(--border)',
              }}>
                <Server size={32} style={{ color: 'var(--text-dim)', marginBottom: '8px' }} />
                <div style={{ fontWeight: 600 }}>No services registered yet</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                  Click "+ Service" above to start monitoring an API or website.
                </div>
              </div>
            )}
          </div>

          {/* 4. Response Time Graph (Matching ASCII Latency Graph) */}
          <div style={{ padding: '2rem' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1rem',
            }}>
              <h2 style={{
                fontSize: '0.85rem',
                fontWeight: 700,
                color: 'var(--text-muted)',
                letterSpacing: '0.12em',
                margin: 0,
              }} className="mono">
                RESPONSE TIME
              </h2>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }} className="mono">
                Last 40 probes
              </span>
            </div>

            {/* SVG Interactive Chart */}
            <ResponseTimeChart points={data?.recent_response_times || []} />
          </div>

        </div>

        {/* Footer info */}
        <div style={{
          marginTop: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          color: 'var(--text-dim)',
          fontSize: '0.75rem',
          padding: '0 0.5rem',
        }} className="mono">
          <div>UTMS v0.1.0 • Engine: Asyncio + PostgreSQL</div>
          <div>Last sync: {lastUpdated.toLocaleTimeString()}</div>
        </div>

      </div>

      {/* Add Service Modal */}
      <AddServiceModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onServiceAdded={() => loadData(false)}
      />
    </div>
  );
}
