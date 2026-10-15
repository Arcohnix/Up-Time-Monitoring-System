import React, { useState, useEffect } from 'react';
import { X, Plus, Edit2, AlertCircle } from 'lucide-react';
import { createService, updateService } from '../api';

export default function ServiceModal({
  isOpen,
  onClose,
  onSaved,
  service = null, // If provided, we are in Edit mode
}) {
  const isEditing = Boolean(service && service.id);

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
    setLoading(true);

    const payload = {
      name: name.trim(),
      url: url.trim(),
      http_method: method,
      check_interval_seconds: parseInt(interval, 10),
      timeout_seconds: parseInt(timeout, 10),
      expected_status_code: parseInt(expectedCode, 10),
      failure_threshold: parseInt(failureThreshold, 10),
      is_active: isActive,
    };

    try {
      if (isEditing) {
        await updateService(service.id, payload);
      } else {
        await createService(payload);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/60">
          <div className="flex items-center gap-2">
            {isEditing ? <Edit2 size={16} className="text-zinc-400" /> : <Plus size={16} className="text-emerald-400" />}
            <h2 className="text-sm font-semibold tracking-wide text-zinc-100 uppercase font-mono">
              {isEditing ? `Edit Service #${service.id}` : 'Register Monitored Service'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-start gap-2 p-3 text-xs rounded bg-rose-950/40 border border-rose-800/60 text-rose-300">
              <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5 font-mono">
              Service Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Primary API Gateway"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-zinc-950 border border-zinc-800 rounded-md text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5 font-mono">
              Endpoint URL
            </label>
            <input
              type="url"
              required
              placeholder="https://api.example.com/health"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-zinc-950 border border-zinc-800 rounded-md text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 font-mono transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5 font-mono">
                HTTP Method
              </label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-zinc-950 border border-zinc-800 rounded-md text-zinc-100 focus:outline-none focus:border-zinc-600 font-mono transition-colors"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="HEAD">HEAD</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5 font-mono">
                Expected Status
              </label>
              <input
                type="number"
                min="100"
                max="599"
                value={expectedCode}
                onChange={(e) => setExpectedCode(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-zinc-950 border border-zinc-800 rounded-md text-zinc-100 font-mono focus:outline-none focus:border-zinc-600 transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5 font-mono">
                Interval (s)
              </label>
              <input
                type="number"
                min="5"
                max="86400"
                value={interval}
                onChange={(e) => setIntervalVal(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-zinc-950 border border-zinc-800 rounded-md text-zinc-100 font-mono focus:outline-none focus:border-zinc-600 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5 font-mono">
                Timeout (s)
              </label>
              <input
                type="number"
                min="1"
                max="60"
                value={timeout}
                onChange={(e) => setTimeoutVal(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-zinc-950 border border-zinc-800 rounded-md text-zinc-100 font-mono focus:outline-none focus:border-zinc-600 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5 font-mono">
                Threshold
              </label>
              <input
                type="number"
                min="1"
                max="20"
                value={failureThreshold}
                onChange={(e) => setFailureThreshold(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-zinc-950 border border-zinc-800 rounded-md text-zinc-100 font-mono focus:outline-none focus:border-zinc-600 transition-colors"
              />
            </div>
          </div>

          {/* Active status toggle */}
          <div className="pt-2 flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-300">Active Monitoring</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-200 after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-200 bg-transparent hover:bg-zinc-800/80 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold rounded-md bg-emerald-500 hover:bg-emerald-400 text-zinc-950 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 font-mono"
            >
              {loading ? 'Saving...' : isEditing ? 'Update Service' : 'Create Service'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
