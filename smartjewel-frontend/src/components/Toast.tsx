import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

// Lightweight toast system with smooth in/out transition and Tailwind styling
// Usage: const toast = useToast(); toast.success('Added to Bag');

type ToastType = 'success' | 'info' | 'error';

interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration: number; // ms
}

interface ToastApi {
  show: (title: string, opts?: { type?: ToastType; description?: string; duration?: number }) => void;
  success: (title: string, opts?: { description?: string; duration?: number }) => void;
  info: (title: string, opts?: { description?: string; duration?: number }) => void;
  error: (title: string, opts?: { description?: string; duration?: number }) => void;
}

const ToastContext = createContext<ToastApi | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<ToastMessage[]>([]);
  const timers = useRef<Map<string, number>>(new Map());

  const remove = useCallback((id: string) => {
    setItems(prev => prev.filter(t => t.id !== id));
    const t = timers.current.get(id);
    if (t) {
      window.clearTimeout(t);
      timers.current.delete(id);
    }
  }, []);

  const show: ToastApi['show'] = useCallback((title, opts) => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const msg: ToastMessage = {
      id,
      type: opts?.type || 'success',
      title,
      description: opts?.description,
      duration: Math.max(800, Math.min(8000, opts?.duration ?? 1800)),
    };
    setItems(prev => [...prev, msg]);
    const to = window.setTimeout(() => remove(id), msg.duration + 200); // allow out animation
    timers.current.set(id, to as unknown as number);
  }, [remove]);

  const api: ToastApi = useMemo(() => ({
    show,
    success: (title, opts) => show(title, { ...opts, type: 'success' }),
    info: (title, opts) => show(title, { ...opts, type: 'info' }),
    error: (title, opts) => show(title, { ...opts, type: 'error' }),
  }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* Viewport */}
      <div className="fixed top-16 right-4 z-[1000] flex flex-col gap-2 pointer-events-none">
        {items.map((t) => (
          <ToastItem key={t.id} item={t} onClose={() => remove(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

const ToastItem: React.FC<{ item: ToastMessage; onClose: () => void }> = ({ item, onClose }) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setMounted(true), 10);
    const end = window.setTimeout(() => setMounted(false), item.duration);
    return () => { window.clearTimeout(id); window.clearTimeout(end); };
  }, [item.duration]);

  const color = item.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
    : item.type === 'error' ? 'bg-red-50 text-red-800 border-red-200'
    : 'bg-blue-50 text-blue-800 border-blue-200';
  const icon = item.type === 'success' ? (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6 9 17l-5-5"/></svg>
  ) : item.type === 'error' ? (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/></svg>
  ) : (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
  );

  return (
    <div
      className={`pointer-events-auto min-w-[220px] max-w-[320px] border rounded-lg shadow-sm px-3 py-2 flex items-start gap-2 transition-all duration-200 ${color}`}
      style={{
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0px) scale(1)' : 'translateY(6px) scale(0.98)'
      }}
      role="status"
      aria-live="polite"
    >
      <div className="mt-[2px]">{icon}</div>
      <div className="flex-1">
        <div className="text-sm font-medium leading-snug">{item.title}</div>
        {item.description && <div className="text-xs opacity-80 leading-snug">{item.description}</div>}
      </div>
      <button className="ml-2 text-current/60 hover:text-current" aria-label="Close" onClick={onClose}>
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
      </button>
    </div>
  );
};