import { AnimatePresence, motion } from 'framer-motion';
import { X, CheckCircle2, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { useToastStore } from '../../store/useToastStore';

const icons = {
  success: <CheckCircle2 size={18} className="text-emerald-400" />,
  error: <AlertCircle size={18} className="text-red-400" />,
  warning: <AlertTriangle size={18} className="text-amber-400" />,
  info: <Info size={18} className="text-sky-400" />,
};

const borderColors = {
  success: 'rgba(52,211,153,0.25)',
  error: 'rgba(239,68,68,0.25)',
  warning: 'rgba(251,191,36,0.25)',
  info: 'rgba(14,165,233,0.25)',
};

export default function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  return (
    <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-3 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 60, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 60, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl min-w-[280px] max-w-[360px]"
            style={{
              background: 'rgba(10,10,10,0.92)',
              backdropFilter: 'blur(20px)',
              border: `1px solid ${borderColors[toast.type]}`,
              boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            }}
          >
            <div className="mt-0.5 shrink-0">{icons[toast.type]}</div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-semibold leading-tight">{toast.title}</p>
              {toast.message && (
                <p className="text-white/50 text-xs mt-0.5 leading-snug">{toast.message}</p>
              )}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="shrink-0 text-white/30 hover:text-white/70 transition-colors mt-0.5"
            >
              <X size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
