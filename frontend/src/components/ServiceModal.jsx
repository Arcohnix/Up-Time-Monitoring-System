import React, { useState, useEffect } from 'react';
import { X, Plus, Edit2, AlertCircle } from 'lucide-react';
import { createService, updateService } from '../api';
import { useToast } from '../context/ToastContext';

export default function ServiceModal({
  isOpen,
  onClose,
  onSaved,
  service = null, // If provided, Edit mode
}) {
  const isEditing = Boolean(service && service.id);
  const { showToast } = useToast();

  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [method, setMethod] = useState('GET');
  const [interval, setIntervalVal] = useState(30);
  const [timeout, setTimeoutVal] = useState(10);
  const [expectedCode, setExpectedCode] = useState(200);
  const [failureThreshold, setFailureThreshold] = useState(3);
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (service) {
      setName(service.name || '');
      setUrl(service.url || '');
      setMethod(service.http_method || 'GET');
      setIntervalVal(service.check_interval_seconds || 30);
      setTimeoutVal(service.timeout_seconds || 10);
      setExpectedCode(service.expected_status_code || 200);
      setFailureThreshold(service.failure_threshold || 3);
      setIsActive(service.is_active !== undefined ? service.is_active : true);
    } else {
      setName('');
      setUrl('');
      setMethod('GET');
      setIntervalVal(30);
      setTimeoutVal(10);
      setExpectedCode(200);
      setFailureThreshold(3);
      setIsActive(true);
    }
    setError(null);
  }, [service, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const intVal = parseInt(interval, 10);
    const timeVal = parseInt(timeout, 10);

    if (timeVal > intVal) {
      setError('Timeout cannot exceed check interval.');
      return;
    }

    setLoading(true);

    const payload = {
      name: name.trim(),
      url: url.trim(),
      http_method: method,
      check_interval_seconds: intVal,
      timeout_seconds: timeVal,
      expected_status_code: parseInt(expectedCode, 10),
      failure_threshold: parseInt(failureThreshold, 10),
      is_active: isActive,
    };

    try {
      if (isEditing) {
        await updateService(service.id, payload);
        showToast(`Updated monitor "${name}"`, 'success');
      } else {
        await createService(payload);
        showToast(`Created monitor "${name}"`, 'success');
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message || 'Operation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-98 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]">
          <div className="flex items-center gap-2">
            {isEditing ? (
              <Edit2 size={15} className="text-[var(--accent-primary)]" />
            ) : (
              <Plus size={15} className="text-[var(--accent-primary)]" />
            )}
            <h2 className="text-xs font-semibold tracking-tight text-[var(--text-primary)]">
              {isEditing ? `Edit Monitor #${service.id}` : 'Register New Monitor'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X size={15} />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-[var(--status-down-bg)] border border-[var(--status-down-border)] rounded-lg text-xs text-[var(--status-down-text)] flex items-center gap-2">
              <AlertCircle size={14} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Name & Method */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-3 space-y-1">
              <label className="text-[11px] font-medium text-[var(--text-muted)]">
                Service Name
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Production API Gateway"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] rounded-md text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-[var(--text-muted)]">
                Method
              </label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] rounded-md text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
              >
                <option value="GET">GET</option>
                <option value="HEAD">HEAD</option>
                <option value="POST">POST</option>
              </select>
            </div>
          </div>

          {/* Endpoint URL */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-[var(--text-muted)]">
              Endpoint URL
            </label>
            <input
              type="url"
              required
              placeholder="https://api.example.com/health"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full px-3 py-1.5 text-xs font-mono bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] rounded-md text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)]"
            />
          </div>

          {/* Numbers Grid: Interval, Timeout, Status Code, Threshold */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-[var(--text-muted)]">
                Interval (s)
              </label>
              <input
                type="number"
                min="5"
                max="86400"
                value={interval}
                onChange={(e) => setIntervalVal(e.target.value)}
                className="w-full px-3 py-1.5 font-mono bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] rounded-md text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-[var(--text-muted)]">
                Timeout (s)
              </label>
              <input
                type="number"
                min="1"
                max="60"
                value={timeout}
                onChange={(e) => setTimeoutVal(e.target.value)}
                className="w-full px-3 py-1.5 font-mono bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] rounded-md text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-[var(--text-muted)]">
                Expected Code
              </label>
              <input
                type="number"
                min="100"
                max="599"
                value={expectedCode}
                onChange={(e) => setExpectedCode(e.target.value)}
                className="w-full px-3 py-1.5 font-mono bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] rounded-md text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-[var(--text-muted)]">
                Threshold
              </label>
              <input
                type="number"
                min="1"
                max="20"
                value={failureThreshold}
                onChange={(e) => setFailureThreshold(e.target.value)}
                className="w-full px-3 py-1.5 font-mono bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] rounded-md text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
              />
            </div>
          </div>

          {/* Active Toggle */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="isActiveToggle"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded border-[var(--border-subtle)] text-[var(--accent-primary)] focus:ring-[var(--accent-primary)] cursor-pointer"
            />
            <label htmlFor="isActiveToggle" className="text-xs text-[var(--text-secondary)] cursor-pointer">
              Enable continuous background health checks immediately
            </label>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border-subtle)]">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)] rounded-md transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-3.5 py-1.5 text-xs font-medium rounded-md bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Monitor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
