import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';
import Icon from './Icon.jsx';

export default function Modal({ open, onClose, title, subtitle, children, maxWidth = 'max-w-2xl' }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-night/70 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            className={`glass-strong relative w-full ${maxWidth} rounded-2xl shadow-neon max-h-[90vh] flex flex-col`}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          >
            <div className="flex items-start justify-between gap-4 p-5 border-b border-white/10">
              <div>
                <h3 className="text-lg font-bold text-white">{title}</h3>
                {subtitle && <p className="text-sm text-white/50 mt-0.5">{subtitle}</p>}
              </div>
              <button
                onClick={onClose}
                className="text-white/50 hover:text-white transition p-1 rounded-lg hover:bg-white/10"
                aria-label="Close"
              >
                <Icon name="close" className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
