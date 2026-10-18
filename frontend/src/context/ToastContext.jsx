import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

const ToastContext = createContext({
  showToast: () => {},
});

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random().toString(36).substring(2, 6);
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast Container */}
      <div
        aria-live="polite"
        className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm pointer-events-none"
      >
        {toasts.map((toast) => {
          const isSuccess = toast.type === 'success';
          const isError = toast.type === 'error';
          const isWarning = toast.type === 'warning';

          return (
            <div
              key={toast.id}
              className="pointer-events-auto flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg text-xs font-medium border shadow-lg transition-all duration-200 animate-in fade-in slide-in-from-bottom-2 bg-[var(--bg-surface)] text-[var(--text-primary)] border-[var(--border-subtle)]"
              style={{ minWidth: '220px' }}
            >
              <div className="flex items-center gap-2">
                {isSuccess && <CheckCircle2 size={14} className="text-[#10B981] shrink-0" />}
                {isError && <AlertTriangle size={14} className="text-[#E87986] shrink-0" />}
                {isWarning && <AlertTriangle size={14} className="text-[#F59E0B] shrink-0" />}
                {!isSuccess && !isError && !isWarning && (
                  <Info size={14} className="text-[var(--accent-primary)] shrink-0" />
                )}
                <span className="line-clamp-2 leading-relaxed">{toast.message}</span>
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                aria-label="Dismiss toast"
              >
                <X size={12} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
