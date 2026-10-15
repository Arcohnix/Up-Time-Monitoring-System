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
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1rem',
    }}>
      <div style={{
        backgroundColor: '#101522',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        width: '100%',
        maxWidth: '520px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border)',
        }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)', letterSpacing: '0.05em' }} className="mono">
            + REGISTER SERVICE
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '4px',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {error && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '0.75rem',
              borderRadius: '6px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid var(--red)',
              color: 'var(--red)',
              fontSize: '0.85rem',
            }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Service Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Payment Gateway"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: '#171f33',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                padding: '0.6rem 0.8rem',
                color: 'var(--text-main)',
                fontSize: '0.9rem',
                outline: 'none',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Endpoint URL
            </label>
            <input
              type="url"
              required
              placeholder="https://api.example.com/health"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: '#171f33',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                padding: '0.6rem 0.8rem',
                color: 'var(--text-main)',
                fontSize: '0.9rem',
                outline: 'none',
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                HTTP Method
              </label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                style={{
                  width: '100%',
                  backgroundColor: '#171f33',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  padding: '0.6rem 0.8rem',
                  color: 'var(--text-main)',
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="HEAD">HEAD</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Expected Status
              </label>
              <input
                type="number"
                value={expectedCode}
                onChange={(e) => setExpectedCode(e.target.value)}
                style={{
                  width: '100%',
                  backgroundColor: '#171f33',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  padding: '0.6rem 0.8rem',
                  color: 'var(--text-main)',
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Interval (s)
              </label>
              <input
                type="number"
                min="5"
                max="86400"
                value={interval}
                onChange={(e) => setIntervalVal(e.target.value)}
                style={{
                  width: '100%',
                  backgroundColor: '#171f33',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  padding: '0.6rem 0.8rem',
                  color: 'var(--text-main)',
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Timeout (s)
              </label>
              <input
                type="number"
                min="1"
                max="60"
                value={timeout}
                onChange={(e) => setTimeoutVal(e.target.value)}
                style={{
                  width: '100%',
                  backgroundColor: '#171f33',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  padding: '0.6rem 0.8rem',
                  color: 'var(--text-main)',
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Threshold
              </label>
              <input
                type="number"
                min="1"
                max="20"
                value={failureThreshold}
                onChange={(e) => setFailureThreshold(e.target.value)}
                style={{
                  width: '100%',
                  backgroundColor: '#171f33',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  padding: '0.6rem 0.8rem',
                  color: 'var(--text-main)',
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                backgroundColor: 'transparent',
                border: '1px solid var(--border)',
                color: 'var(--text-muted)',
                padding: '0.5rem 1rem',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.85rem',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                backgroundColor: '#10b981',
                border: 'none',
                color: '#06261c',
                fontWeight: 600,
                padding: '0.5rem 1.25rem',
                borderRadius: '6px',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.85rem',
              }}
            >
              <Plus size={16} />
              {loading ? 'Registering...' : 'Add Service'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
