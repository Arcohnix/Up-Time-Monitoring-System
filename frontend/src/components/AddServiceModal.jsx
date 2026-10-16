import React, { useState } from 'react';
import { X, Plus, AlertCircle } from 'lucide-react';
import { createService } from '../api';

export default function AddServiceModal({ isOpen, onClose, onServiceAdded }) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [method, setMethod] = useState('GET');
  const [interval, setIntervalVal] = useState(30);
  const [timeout, setTimeoutVal] = useState(10);
  const [expectedCode, setExpectedCode] = useState(200);
  const [failureThreshold, setFailureThreshold] = useState(3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await createService({
        name: name.trim(),
        url: url.trim(),
        http_method: method,
        check_interval_seconds: parseInt(interval, 10),
        timeout_seconds: parseInt(timeout, 10),
        expected_status_code: parseInt(expectedCode, 10),
        failure_threshold: parseInt(failureThreshold, 10),
        is_active: true,
      });

      // Reset form
      setName('');
      setUrl('');
      setMethod('GET');
      setIntervalVal(30);
      setTimeoutVal(10);
      setExpectedCode(200);
      setFailureThreshold(3);

      onServiceAdded();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create service');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/35 backdrop-blur-xs">
      <div className="w-full max-w-lg bg-white border border-[#E5E7EB] rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB] bg-[#F7F8FA]">
          <h2 className="text-sm font-semibold tracking-tight text-[#18181B] uppercase">
            + Register Service
          </h2>
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
            <div className="flex items-center gap-2 p-3 text-xs rounded-lg bg-[#FBEDEE] border border-[#C75C62]/30 text-[#A63F46]">
              <AlertCircle size={15} className="shrink-0 text-[#C75C62]" />
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
              placeholder="e.g. Payment Gateway"
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
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#71717A] uppercase tracking-wider mb-1.5">
                Expected Status
              </label>
              <input
                type="number"
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

          {/* Action buttons */}
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
              className="px-4 py-2 text-xs font-medium rounded-lg bg-[#5865D8] hover:bg-[#4754C4] text-white shadow-xs transition-colors disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
            >
              <Plus size={14} />
              {loading ? 'Registering...' : 'Add Service'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
