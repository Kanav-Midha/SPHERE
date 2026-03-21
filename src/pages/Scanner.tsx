import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Shield, Activity, LogOut, CalendarClock, MapPin } from 'lucide-react';
import ScannerInterface from '../components/modules/ScannerInterface';
import OperatorAccessPanel from '../components/modules/OperatorAccessPanel';
import { useOperatorSessionStore } from '../store/useOperatorSessionStore';
import MagneticButton from '../components/ui/MagneticButton';

interface ScannerProps {
  onExit: () => void;
}

interface OperatorMetrics {
  total_scans: number;
  valid_scans: number;
  invalid_scans: number;
  already_scanned_scans: number;
}

export default function Scanner({ onExit }: ScannerProps) {
  const { session, clearSession } = useOperatorSessionStore();
  const [metrics, setMetrics] = useState<OperatorMetrics>({
    total_scans: 0,
    valid_scans: 0,
    invalid_scans: 0,
    already_scanned_scans: 0,
  });

  useEffect(() => {
    if (session) {
      void refreshMetrics();
    }
  }, [session?.eventId, session?.operatorKey]);

  async function refreshMetrics() {
    if (!session) return;
    const response = await fetch(`/api/operator/metrics?operatorKey=${encodeURIComponent(session.operatorKey)}`);
    const payload = await response.json().catch(() => null);

    if (!response.ok || !payload) {
      if (payload?.error && /operator key/i.test(payload.error)) {
        clearSession();
      }
      return;
    }

    setMetrics({
      total_scans: Number(payload.total_scans || 0),
      valid_scans: Number(payload.valid_scans || 0),
      invalid_scans: Number(payload.invalid_scans || 0),
      already_scanned_scans: Number(payload.already_scanned_scans || 0),
    });
  }

  if (!session) {
    return (
      <div className="min-h-screen pt-24 pb-10 px-4">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-white/30 text-sm font-medium mb-1">Direct Scanner Portal</p>
              <h1 className="text-white text-3xl font-bold" style={{ letterSpacing: '-0.03em' }}>
                Unlock the event scanner
              </h1>
            </div>
            <MagneticButton variant="ghost" onClick={onExit}>
              <span className="flex items-center gap-2">
                <ArrowLeft size={15} />
                Back
              </span>
            </MagneticButton>
          </div>
          <OperatorAccessPanel />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-16 flex flex-col">
      <div className="absolute top-20 left-0 right-0 z-10 px-4 pointer-events-none">
        <div className="max-w-sm mx-auto">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center justify-between px-4 py-2.5 rounded-xl mb-3"
            style={{
              background: 'rgba(5,5,5,0.75)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div className="flex items-center gap-2">
              <Shield size={13} className="text-sky-400" />
              <div>
                <span className="block text-white/60 text-xs font-medium">Operator Mode</span>
                <span className="block text-white/30 text-[10px]">{session.eventTitle}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 pointer-events-auto">
              <button
                onClick={onExit}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white/55 hover:text-white"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <ArrowLeft size={14} />
              </button>
              <button
                onClick={() => {
                  clearSession();
                  onExit();
                }}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white/55 hover:text-white"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <LogOut size={14} />
              </button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.08 }}
            className="flex items-center justify-between px-4 py-2.5 rounded-xl"
            style={{
              background: 'rgba(5,5,5,0.75)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div className="flex items-center gap-2">
              <CalendarClock size={13} className="text-sky-400" />
              <span className="text-white/50 text-xs">{new Date(session.eventDate).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin size={13} className="text-sky-400" />
              <span className="text-white/50 text-xs">{session.venue}</span>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="flex-1 relative">
        <ScannerInterface onScanComplete={refreshMetrics} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="absolute bottom-6 left-0 right-0 z-20 px-4 pointer-events-none"
      >
        <div className="max-w-sm mx-auto">
          <div
            className="flex items-center justify-around px-4 py-3 rounded-xl"
            style={{
              background: 'rgba(5,5,5,0.8)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(255,255,255,0.07)',
            }}
          >
            {[
              { label: 'Scanned Today', value: metrics.total_scans, color: 'text-sky-400' },
              { label: 'Valid', value: metrics.valid_scans, color: 'text-emerald-400' },
              { label: 'Invalid', value: metrics.invalid_scans + metrics.already_scanned_scans, color: 'text-red-400' },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <p className={`text-base font-bold ${s.color}`} style={{ letterSpacing: '-0.02em' }}>{s.value}</p>
                <p className="text-white/30 text-[9px] mt-0.5">{s.label}</p>
              </div>
            ))}
            <div
              className="w-px h-8 self-center"
              style={{ background: 'rgba(255,255,255,0.08)' }}
            />
            <div className="flex items-center gap-1.5">
              <Activity size={11} className="text-sky-400 animate-pulse" />
              <span className="text-white/40 text-[9px]">Live</span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
