import React, { useState, useEffect, useCallback } from 'react';
import {
  getDashboardOverview,
  triggerServiceCheck,
  triggerCheckAll,
  updateService,
  deleteService,
} from './api';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider, useToast } from './context/ToastContext';
import AppShell from './components/AppShell';
import CommandPalette from './components/CommandPalette';
import OverviewView from './components/OverviewView';
import MonitorsView from './components/MonitorsView';
import ServiceDetailView from './components/ServiceDetailView';
import IncidentsView from './components/IncidentsView';
import AnalyticsView from './components/AnalyticsView';
import SettingsView from './components/SettingsView';
import ServiceModal from './components/ServiceModal';

function MainApp() {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastSync, setLastSync] = useState(() => new Date());

  // Views: 'OVERVIEW', 'MONITORS', 'INCIDENTS', 'ANALYTICS', 'SETTINGS', 'SERVICE_DETAIL'
  const [activeTab, setActiveTab] = useState('OVERVIEW');
  const [selectedServiceId, setSelectedServiceId] = useState(null);

  // Probing states
  const [probingId, setProbingId] = useState(null);
  const [probingAll, setProbingAll] = useState(false);

  // Modal & Palette
  const [modalOpen, setModalOpen] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  const { showToast } = useToast();

  const loadData = useCallback(async () => {
    try {
      const data = await getDashboardOverview();
      setDashboardData(data);
      setError(null);
      setLastSync(new Date());
    } catch (err) {
      setError(err.message || 'Failed to connect to monitoring API');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Background polling loop (every 5 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      loadData(true);
    }, 5000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Global shortcut ⌘K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Single service probe
  const handleTriggerCheck = async (serviceId) => {
    setProbingId(serviceId);
    try {
      const res = await triggerServiceCheck(serviceId);
      await loadData(true);
      showToast(
        `Probed in ${res.response_time_ms ? Math.round(res.response_time_ms) : 0}ms (${res.success ? '200 OK' : 'Failed'})`,
        res.success ? 'success' : 'error'
      );
    } catch (err) {
      showToast(`Probe failed: ${err.message}`, 'error');
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
      showToast('Completed batch probe on all active targets', 'success');
    } catch (err) {
      showToast(`Batch probe failed: ${err.message}`, 'error');
    } finally {
      setProbingAll(false);
    }
  };

  // Toggle active
  const handleToggleActive = async (serviceId, nextActiveState) => {
    try {
      await updateService(serviceId, { is_active: nextActiveState });
      await loadData(true);
      showToast(`Monitor ${nextActiveState ? 'resumed' : 'paused'}`, 'info');
    } catch (err) {
      showToast(`Failed to update state: ${err.message}`, 'error');
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
      showToast(`Deleted monitor "${serviceName}"`, 'info');
    } catch (err) {
      showToast(`Failed to delete service: ${err.message}`, 'error');
    }
  };

  const handleOpenCreateModal = () => {
    setEditingService(null);
    setModalOpen(true);
  };

  const handleOpenEditModal = (service) => {
    setEditingService(service);
    setModalOpen(true);
  };

  const handleSelectService = (serviceId) => {
    setSelectedServiceId(serviceId);
    setActiveTab('SERVICE_DETAIL');
  };

  const handleNavigateTab = (tab) => {
    setSelectedServiceId(null);
    setActiveTab(tab);
  };

  const services = dashboardData?.services || [];
  const activeIncidents = dashboardData?.active_incidents || [];

  return (
    <AppShell
      activeTab={activeTab}
      onNavigateTab={handleNavigateTab}
      systemStatus={dashboardData?.system_status}
      activeIncidentCount={activeIncidents.length}
      probingAll={probingAll}
      onTriggerCheckAll={handleTriggerCheckAll}
      onOpenCreateModal={handleOpenCreateModal}
      onOpenCommandPalette={() => setCommandPaletteOpen(true)}
      lastSync={lastSync}
    >
      {/* Error Banner */}
      {error && (
        <div className="mb-4 p-3 bg-[var(--status-down-bg)] border border-[var(--status-down-border)] rounded-lg text-xs text-[var(--status-down-text)] flex items-center justify-between">
          <span>Failed to reach API gateway: {error}</span>
          <button
            onClick={() => loadData(false)}
            className="text-[11px] underline hover:no-underline cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && !dashboardData ? (
        <div className="py-24 space-y-4 animate-pulse">
          <div className="h-6 bg-[var(--border-subtle)] rounded w-48" />
          <div className="h-20 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl" />
          <div className="h-44 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl" />
          <div className="h-64 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl" />
        </div>
      ) : (
        <>
          {activeTab === 'OVERVIEW' && (
            <OverviewView
              dashboardData={dashboardData}
              onSelectService={handleSelectService}
              onTriggerCheck={handleTriggerCheck}
              onNavigateTab={handleNavigateTab}
              probingId={probingId}
            />
          )}

          {activeTab === 'MONITORS' && (
            <MonitorsView
              services={services}
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
              services={services}
              onSelectService={handleSelectService}
            />
          )}

          {activeTab === 'ANALYTICS' && (
            <AnalyticsView
              dashboardData={dashboardData}
              onSelectService={handleSelectService}
            />
          )}

          {activeTab === 'SETTINGS' && (
            <SettingsView />
          )}

          {activeTab === 'SERVICE_DETAIL' && selectedServiceId && (
            <ServiceDetailView
              serviceId={selectedServiceId}
              onBack={() => setActiveTab('MONITORS')}
              onEdit={handleOpenEditModal}
              onDeleted={() => {
                setSelectedServiceId(null);
                setActiveTab('MONITORS');
                loadData(true);
              }}
            />
          )}
        </>
      )}

      {/* Global Command Palette */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        services={services}
        onSelectService={handleSelectService}
        onOpenCreateModal={handleOpenCreateModal}
        onTriggerCheckAll={handleTriggerCheckAll}
        onNavigateTab={handleNavigateTab}
      />

      {/* Create / Edit Monitor Modal */}
      <ServiceModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        service={editingService}
        onSaved={() => loadData(true)}
      />
    </AppShell>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <MainApp />
      </ToastProvider>
    </ThemeProvider>
  );
}
