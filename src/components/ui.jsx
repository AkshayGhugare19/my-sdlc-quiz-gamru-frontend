import { AnimatePresence, motion } from 'framer-motion';
import { createContext, useCallback, useContext, useState } from 'react';
import Icon from './Icon.jsx';

// ── Spinner ──
export function Spinner({ className = 'w-5 h-5' }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" className="opacity-20" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

// ── Page header ──
export function PageHeader({ title, subtitle, icon, actions }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div className="flex items-center gap-3">
        {icon && (
          <div className="w-11 h-11 rounded-2xl glass grid place-items-center text-neon">
            <Icon name={icon} className="w-6 h-6" />
          </div>
        )}
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">{title}</h1>
          {subtitle && <p className="text-sm text-white/50 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

// ── Status / boolean pill ──
export function StatusPill({ value }) {
  const v = String(value ?? '').toUpperCase();
  const map = {
    ACTIVE: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
    PUBLISHED: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
    TRUE: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
    LIVE: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
    RUNNING: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
    DRAFT: 'bg-amber-500/15 text-amber-300 border-amber-500/25',
    SCHEDULED: 'bg-sky-500/15 text-sky-300 border-sky-500/25',
    PENDING: 'bg-amber-500/15 text-amber-300 border-amber-500/25',
    INACTIVE: 'bg-white/10 text-white/50 border-white/15',
    FALSE: 'bg-white/10 text-white/50 border-white/15',
    SUSPENDED: 'bg-red-500/15 text-red-300 border-red-500/25',
    ARCHIVED: 'bg-white/10 text-white/50 border-white/15',
    ENDED: 'bg-white/10 text-white/50 border-white/15',
  };
  const cls = map[v] || 'bg-white/10 text-white/60 border-white/15';
  const label = value === true ? 'Yes' : value === false ? 'No' : String(value ?? '—');
  return <span className={`chip border ${cls}`}>{label}</span>;
}

// ── Empty state ──
export function EmptyState({ icon = 'search', title = 'Nothing here yet', hint }) {
  return (
    <div className="text-center py-16 text-white/40">
      <div className="w-14 h-14 rounded-2xl glass grid place-items-center mx-auto mb-3 text-white/40">
        <Icon name={icon} className="w-7 h-7" />
      </div>
      <div className="font-semibold text-white/60">{title}</div>
      {hint && <div className="text-sm mt-1">{hint}</div>}
    </div>
  );
}

// ── Toast system ──
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((message, type = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
  }, []);

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-5 right-5 z-[100] space-y-2 w-80 max-w-[calc(100vw-2.5rem)]">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 40, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.95 }}
              className={`glass-strong rounded-xl px-4 py-3 flex items-start gap-3 border ${
                t.type === 'error' ? 'border-red-500/30' : 'border-neon/30'
              }`}
            >
              <div className={t.type === 'error' ? 'text-red-400' : 'text-neon'}>
                <Icon name={t.type === 'error' ? 'close' : 'check'} className="w-5 h-5" />
              </div>
              <div className="text-sm text-white/85 flex-1">{t.message}</div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

// ── Cell value formatter ──
export function formatCell(value) {
  if (value === null || value === undefined || value === '') return <span className="text-white/25">—</span>;
  if (typeof value === 'boolean') return <StatusPill value={value} />;
  if (typeof value === 'object') return <span className="text-white/40 text-xs">{JSON.stringify(value)}</span>;
  return String(value);
}
