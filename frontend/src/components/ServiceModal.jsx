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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/35 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-white border border-[#E5E7EB] rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB] bg-[#F7F8FA]">
          <div className="flex items-center gap-2">
            {isEditing ? <Edit2 size={16} className="text-[#5865D8]" /> : <Plus size={16} className="text-[#5865D8]" />}
            <h2 className="text-sm font-semibold tracking-tight text-[#18181B]">
              {isEditing ? `Edit Service #${service.id}` : 'Register Monitored Service'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-[#71717A] hover:text-[#18181B] hover:bg-[#F3F4F6] transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-start gap-2 p-3 text-xs rounded-lg bg-[#FBEDEE] border border-[#C75C62]/30 text-[#A63F46]">
              <AlertCircle size={15} className="shrink-0 mt-0.5 text-[#C75C62]" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-[#71717A] uppercase tracking-wider mb-1.5">
              Service Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Primary API Gateway"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-[#E5E7EB] rounded-lg text-[#18181B] placeholder-[#A1A1AA] focus:outline-none focus:border-[#5865D8] focus:ring-1 focus:ring-[#5865D8] transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#71717A] uppercase tracking-wider mb-1.5">
              Endpoint URL
            </label>
            <input
              type="url"
              required
              placeholder="https://api.example.com/health"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-[#E5E7EB] rounded-lg text-[#18181B] placeholder-[#A1A1AA] focus:outline-none focus:border-[#5865D8] focus:ring-1 focus:ring-[#5865D8] font-mono transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#71717A] uppercase tracking-wider mb-1.5">
                HTTP Method
              </label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-[#E5E7EB] rounded-lg text-[#18181B] focus:outline-none focus:border-[#5865D8] focus:ring-1 focus:ring-[#5865D8] transition-colors"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="HEAD">HEAD</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#71717A] uppercase tracking-wider mb-1.5">
                Expected Status
              </label>
              <input
                type="number"
                min="100"
                max="599"
                value={expectedCode}
                onChange={(e) => setExpectedCode(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-[#E5E7EB] rounded-lg text-[#18181B] focus:outline-none focus:border-[#5865D8] focus:ring-1 focus:ring-[#5865D8] transition-colors font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#71717A] uppercase tracking-wider mb-1.5">
                Interval (s)
              </label>
              <input
                type="number"
                min="5"
                max="86400"
                value={interval}
                onChange={(e) => setIntervalVal(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-[#E5E7EB] rounded-lg text-[#18181B] focus:outline-none focus:border-[#5865D8] focus:ring-1 focus:ring-[#5865D8] transition-colors font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#71717A] uppercase tracking-wider mb-1.5">
                Timeout (s)
              </label>
              <input
                type="number"
                min="1"
                max="60"
                value={timeout}
                onChange={(e) => setTimeoutVal(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-[#E5E7EB] rounded-lg text-[#18181B] focus:outline-none focus:border-[#5865D8] focus:ring-1 focus:ring-[#5865D8] transition-colors font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#71717A] uppercase tracking-wider mb-1.5">
                Threshold
              </label>
              <input
                type="number"
                min="1"
                max="20"
                value={failureThreshold}
                onChange={(e) => setFailureThreshold(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-[#E5E7EB] rounded-lg text-[#18181B] focus:outline-none focus:border-[#5865D8] focus:ring-1 focus:ring-[#5865D8] transition-colors font-mono"
              />
            </div>
          </div>

          {/* Active status toggle */}
          <div className="pt-2 flex items-center justify-between">
            <span className="text-xs font-medium text-[#18181B]">Active Monitoring</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-[#E5E7EB] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[#D1D5DB] after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#5865D8]"></div>
            </label>
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[#E5E7EB]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-[#71717A] hover:text-[#18181B] bg-transparent hover:bg-[#F3F4F6] rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-xs font-medium rounded-lg bg-[#5865D8] hover:bg-[#4754C4] text-white shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
            >
              {loading ? 'Saving...' : isEditing ? 'Update Service' : 'Create Service'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
