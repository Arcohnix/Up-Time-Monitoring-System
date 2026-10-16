import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  RefreshCw,
  Plus,
  Play,
  ShieldAlert,
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
  const autoRefresh = true;
  const [error, setError] = useState(null);
  const [lastSync, setLastSync] = useState(() => new Date());

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

  const isSystemOnline = dashboardData?.system_status === 'SYSTEM ONLINE';

  return (
    <div className="min-h-screen bg-[#F7F8FA] text-[#18181B] p-4 sm:p-6 lg:p-8 antialiased">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* 1. Refined Navigation & Header Card */}
        <header className="bg-white border border-[#E5E7EB] rounded-xl shadow-xs overflow-hidden">
          <div className="flex flex-wrap items-center justify-between p-4 sm:p-6 border-b border-[#E5E7EB] gap-4 bg-white">
            
            {/* Branding */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#EEF0FF] flex items-center justify-center text-[#5865D8]">
                <Activity size={18} />
              </div>
              <div>
                <h1 className="text-base font-semibold tracking-tight text-[#18181B]">
                  Uptime Monitoring System
                </h1>
                <p className="text-xs text-[#71717A]">
                  Production Health & Reliability Fleet
                </p>
              </div>
            </div>

            {/* Status & Actions */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Live Status Pill (Soft Status Colors) */}
              <div
                className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border ${
                  isSystemOnline
                    ? 'bg-[#ECF7F0] text-[#347A55] border-[#4D9F72]/20'
                    : 'bg-[#FBEDEE] text-[#A63F46] border-[#C75C62]/20'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isSystemOnline
                      ? 'bg-[#4D9F72] pulse-green'
                      : 'bg-[#C75C62] pulse-red'
                  }`}
                />
                <span>{dashboardData?.system_status || 'CONNECTING...'}</span>
              </div>

              {/* Refresh button */}
              <button
                onClick={() => loadData(false)}
                disabled={refreshing}
                title="Refresh dashboard data"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white hover:bg-[#F3F4F6] text-[#71717A] hover:text-[#18181B] border border-[#E5E7EB] transition-colors cursor-pointer"
              >
                <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
                <span>Refresh</span>
              </button>

              {/* Check All button */}
              <button
                onClick={handleTriggerCheckAll}
                disabled={probingAll}
                title="Trigger concurrent probe on all active endpoints"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white hover:bg-[#F3F4F6] text-[#71717A] hover:text-[#18181B] border border-[#E5E7EB] transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Play size={11} fill="currentColor" className={probingAll ? 'animate-spin' : ''} />
                <span>{probingAll ? 'Probing...' : 'Check All'}</span>
              </button>

              {/* Add Service button (5% Accent Color) */}
              <button
                onClick={handleOpenCreateModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-lg bg-[#5865D8] hover:bg-[#4754C4] text-white shadow-xs transition-colors cursor-pointer"
              >
                <Plus size={14} />
                <span>Add Service</span>
              </button>
            </div>
          </div>

          {/* Navigation Tabs Bar */}
          <div className="flex items-center justify-between px-6 py-2.5 bg-white text-xs">
            <nav className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  setSelectedServiceId(null);
                  setActiveTab('OVERVIEW');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  activeTab === 'OVERVIEW'
                    ? 'bg-[#EEF0FF] text-[#5865D8]'
                    : 'text-[#71717A] hover:text-[#18181B] hover:bg-[#F3F4F6]'
                }`}
              >
                Overview
              </button>

              <button
                onClick={() => {
                  setSelectedServiceId(null);
                  setActiveTab('INCIDENTS');
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  activeTab === 'INCIDENTS'
                    ? 'bg-[#EEF0FF] text-[#5865D8]'
                    : 'text-[#71717A] hover:text-[#18181B] hover:bg-[#F3F4F6]'
                }`}
              >
                <ShieldAlert size={14} className={dashboardData?.active_incidents?.length > 0 ? 'text-[#C75C62]' : ''} />
                <span>Incidents</span>
                {dashboardData?.active_incidents?.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-[#FBEDEE] text-[#A63F46] font-semibold text-[10px]">
                    {dashboardData.active_incidents.length}
                  </span>
                )}
              </button>
            </nav>

            <div className="text-[#71717A] text-[11px] flex items-center gap-4">
              <span>Auto-refresh: {autoRefresh ? '5s' : 'Off'}</span>
              <span>Sync: {lastSync.toLocaleTimeString()}</span>
            </div>
          </div>
        </header>

        {/* Error Alert */}
        {error && (
          <div className="p-4 bg-[#FBEDEE] border border-[#C75C62]/30 rounded-xl text-[#A63F46] text-xs flex items-center gap-2">
            <AlertTriangle size={16} className="text-[#C75C62] shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 2. Main View Content */}
        {loading && !dashboardData ? (
          <div className="py-24 flex flex-col items-center justify-center text-[#71717A] text-xs">
            <Activity className="animate-spin text-[#5865D8] mb-3" size={24} />
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
        <footer className="pt-6 pb-12 text-center text-xs text-[#A1A1AA]">
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
