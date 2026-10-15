import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  RefreshCw,
  Plus,
  Play,
  ShieldAlert,
  Server,
  AlertTriangle,
} from 'lucide-react';
import {
  getDashboardOverview,
  triggerServiceCheck,
  triggerCheckAll,
  updateService,
  deleteService,
} from './api';
import OverviewView from './components/OverviewView';
import ServiceDetailView from './components/ServiceDetailView';
import IncidentsView from './components/IncidentsView';
import ServiceModal from './components/ServiceModal';

export default function App() {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [error, setError] = useState(null);
  const [lastSync, setLastSync] = useState(new Date());

  // Navigation states: 'OVERVIEW', 'INCIDENTS', 'SERVICE_DETAIL'
  const [activeTab, setActiveTab] = useState('OVERVIEW');
  const [selectedServiceId, setSelectedServiceId] = useState(null);

  // Probing states
  const [probingId, setProbingId] = useState(null);
  const [probingAll, setProbingAll] = useState(false);

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingService, setEditingService] = useState(null);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const data = await getDashboardOverview();
      setDashboardData(data);
      setError(null);
      setLastSync(new Date());
    } catch (err) {
      setError(err.message || 'Failed to connect to monitoring API');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Background polling loop
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      loadData(true);
    }, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, loadData]);

  // Single service probe
  const handleTriggerCheck = async (serviceId) => {
    setProbingId(serviceId);
    try {
      await triggerServiceCheck(serviceId);
      await loadData(true);
    } catch (err) {
      alert(`Probe failed: ${err.message}`);
    } finally {
      setProbingId(null);
    }
  };

  // Check all active services
  const handleTriggerCheckAll = async () => {
    setProbingAll(true);
    try {
      await triggerCheckAll();
      await loadData(true);
    } catch (err) {
      alert(`Check all failed: ${err.message}`);
    } finally {
      setProbingAll(false);
    }
  };

  // Enable/disable service
  const handleToggleActive = async (serviceId, nextActiveState) => {
    try {
      await updateService(serviceId, { is_active: nextActiveState });
      await loadData(true);
    } catch (err) {
      alert(`Failed to update state: ${err.message}`);
    }
  };

  // Delete service
  const handleDeleteService = async (serviceId, serviceName) => {
    if (!window.confirm(`Are you sure you want to delete "${serviceName}"?`)) return;
    try {
      await deleteService(serviceId);
      if (selectedServiceId === serviceId) {
        setSelectedServiceId(null);
        setActiveTab('OVERVIEW');
      }
      await loadData(true);
    } catch (err) {
      alert(`Failed to delete service: ${err.message}`);
    }
  };

  // Modal open helpers
  const handleOpenCreateModal = () => {
    setEditingService(null);
    setModalOpen(true);
  };

  const handleOpenEditModal = (service) => {
    setEditingService(service);
    setModalOpen(true);
  };

  // Select service to view detail
  const handleSelectService = (serviceId) => {
    setSelectedServiceId(serviceId);
    setActiveTab('SERVICE_DETAIL');
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* 1. Global Terminal Card Header (Matching SRE Aesthetic) */}
        <header className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden">
          <div className="flex flex-wrap items-center justify-between p-4 sm:p-6 border-b border-zinc-800 gap-4 bg-zinc-950/70">
            
            {/* Branding */}
            <div className="flex items-center gap-3">
              <Activity size={22} className="text-cyan-400" />
              <div>
                <h1 className="text-base font-bold tracking-widest text-zinc-100 font-mono">
                  UPTIME MONITOR
                </h1>
                <p className="text-[11px] text-zinc-500 font-mono">
                  Production Health & Reliability Fleet
                </p>
              </div>
            </div>

            {/* Status & Actions */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Live Status Pill */}
              <div
                className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-bold tracking-wider border ${
                  dashboardData?.system_status === 'SYSTEM ONLINE'
                    ? 'bg-emerald-950/50 text-emerald-400 border-emerald-800/50'
                    : 'bg-rose-950/60 text-rose-300 border-rose-800/60'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    dashboardData?.system_status === 'SYSTEM ONLINE'
                      ? 'bg-emerald-400 pulse-green'
                      : 'bg-rose-500 pulse-red'
                  }`}
                />
                <span>{dashboardData?.system_status || 'CONNECTING...'}</span>
              </div>

              {/* Refresh button */}
              <button
                onClick={() => loadData(false)}
                disabled={refreshing}
                title="Refresh dashboard data"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium rounded bg-zinc-800/80 hover:bg-zinc-800 text-zinc-300 border border-zinc-700/60 transition-colors"
              >
                <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
                <span>Refresh</span>
              </button>

              {/* Check All button */}
              <button
                onClick={handleTriggerCheckAll}
                disabled={probingAll}
                title="Trigger concurrent probe on all active endpoints"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-semibold rounded bg-zinc-800 hover:bg-zinc-700 text-cyan-400 border border-zinc-700 transition-colors disabled:opacity-50"
              >
                <Play size={12} fill="currentColor" className={probingAll ? 'animate-spin' : ''} />
                <span>{probingAll ? 'Probing...' : 'Check All'}</span>
              </button>

              {/* Add Service button */}
              <button
                onClick={handleOpenCreateModal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-semibold rounded bg-emerald-500 hover:bg-emerald-400 text-zinc-950 transition-colors cursor-pointer"
              >
                <Plus size={14} />
                <span>Add Service</span>
              </button>
            </div>
          </div>

          {/* Navigation Tabs Bar */}
          <div className="flex items-center justify-between px-6 py-2.5 bg-zinc-900 border-b border-zinc-800 text-xs font-mono">
            <nav className="flex items-center gap-2">
              <button
                onClick={() => {
                  setSelectedServiceId(null);
                  setActiveTab('OVERVIEW');
                }}
                className={`px-3 py-1.5 rounded transition-colors ${
                  activeTab === 'OVERVIEW'
                    ? 'bg-zinc-800 text-zinc-100 font-bold border border-zinc-700'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Overview
              </button>

              <button
                onClick={() => {
                  setSelectedServiceId(null);
                  setActiveTab('INCIDENTS');
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded transition-colors ${
                  activeTab === 'INCIDENTS'
                    ? 'bg-zinc-800 text-zinc-100 font-bold border border-zinc-700'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <ShieldAlert size={13} className={dashboardData?.active_incidents?.length > 0 ? 'text-rose-400' : ''} />
                <span>Incidents</span>
                {dashboardData?.active_incidents?.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-zinc-950 font-bold text-[10px]">
                    {dashboardData.active_incidents.length}
                  </span>
                )}
              </button>
            </nav>

            <div className="text-zinc-500 text-[11px] flex items-center gap-4">
              <span>Auto-refresh: {autoRefresh ? '5s' : 'Off'}</span>
              <span>Sync: {lastSync.toLocaleTimeString()}</span>
            </div>
          </div>
        </header>

        {/* Error Alert */}
        {error && (
          <div className="p-4 bg-rose-950/40 border border-rose-800 rounded-xl text-rose-300 text-xs font-mono flex items-center gap-2">
            <AlertTriangle size={16} className="text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 2. Main View Content */}
        {loading && !dashboardData ? (
          <div className="py-24 flex flex-col items-center justify-center text-zinc-500 font-mono text-xs">
            <Activity className="animate-spin text-cyan-400 mb-3" size={24} />
            Initializing monitoring dashboard...
          </div>
        ) : (
          <main>
            {activeTab === 'OVERVIEW' && (
              <OverviewView
                dashboardData={dashboardData}
                onSelectService={handleSelectService}
                onEditService={handleOpenEditModal}
                onDeleteService={handleDeleteService}
                onTriggerCheck={handleTriggerCheck}
                onToggleActive={handleToggleActive}
                onOpenCreateModal={handleOpenCreateModal}
                probingId={probingId}
              />
            )}

            {activeTab === 'INCIDENTS' && (
              <IncidentsView
                services={dashboardData?.services || []}
                onSelectService={handleSelectService}
              />
            )}

            {activeTab === 'SERVICE_DETAIL' && selectedServiceId && (
              <ServiceDetailView
                serviceId={selectedServiceId}
                onBack={() => setActiveTab('OVERVIEW')}
                onEdit={handleOpenEditModal}
                onDeleted={() => {
                  setSelectedServiceId(null);
                  setActiveTab('OVERVIEW');
                  loadData(true);
                }}
              />
            )}
          </main>
        )}

        {/* Footer */}
        <footer className="pt-6 pb-12 text-center text-xs text-zinc-600 font-mono">
          Uptime Monitoring System (UTMS) • Python asyncio prober • FastAPI • PostgreSQL
        </footer>

      </div>

      {/* Service Create / Edit Modal */}
      <ServiceModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        service={editingService}
        onSaved={() => loadData(false)}
      />
    </div>
  );
}
