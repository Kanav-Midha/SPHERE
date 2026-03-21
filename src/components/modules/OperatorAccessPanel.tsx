import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { DoorOpen, ShieldCheck, ScanLine, RefreshCcw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToastStore } from '../../store/useToastStore';
import { useOperatorSessionStore } from '../../store/useOperatorSessionStore';
import GlassCard from '../ui/GlassCard';
import MagneticButton from '../ui/MagneticButton';

interface OperatorAccessPanelProps {
  onAuthorized?: () => void;
  compact?: boolean;
}

function normalizeKey(value: string) {
  const clean = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  return clean.replace(/(.{4})/g, '$1-').replace(/-$/, '');
}

export default function OperatorAccessPanel({ onAuthorized, compact = false }: OperatorAccessPanelProps) {
  const { addToast } = useToastStore();
  const { session, setSession, clearSession } = useOperatorSessionStore();
  const [eventKey, setEventKey] = useState(session?.operatorKey || '');
  const [loading, setLoading] = useState(false);

  const hasCompleteKey = useMemo(() => eventKey.replace(/-/g, '').length === 12, [eventKey]);

  async function handleAuthorize() {
    if (!hasCompleteKey) {
      addToast({
        type: 'warning',
        title: 'Incomplete Event Key',
        message: 'Enter the full 12-character gate operator key first.',
      });
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.rpc('verify_event_operator_key', {
      input_key: eventKey,
    });

    setLoading(false);

    const eventData = (data || [])[0];
    if (error || !eventData) {
      addToast({
        type: 'error',
        title: 'Access Denied',
        message: error?.message || 'That event key could not be verified.',
      });
      return;
    }

    setSession({
      eventId: eventData.event_id,
      eventTitle: eventData.title,
      venue: eventData.venue || 'Campus venue',
      eventDate: eventData.event_date,
      operatorKey: eventKey,
    });

    addToast({
      type: 'success',
      title: 'Scanner Unlocked',
      message: `${eventData.title} is ready for gate validation.`,
    });

    onAuthorized?.();
  }

  const activeDate = session?.eventDate
    ? new Date(session.eventDate).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : null;

  return (
    <GlassCard glow glowColor="rgba(14,165,233,0.2)" className={compact ? '' : 'max-w-3xl mx-auto'}>
      <div className={`grid gap-6 ${compact ? 'md:grid-cols-1' : 'md:grid-cols-[1.1fr_0.9fr]'}`}>
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(14,165,233,0.12)', border: '1px solid rgba(14,165,233,0.24)' }}
            >
              <DoorOpen size={22} className="text-sky-300" />
            </div>
            <div>
              <p className="text-white text-xl font-semibold" style={{ letterSpacing: '-0.02em' }}>
                Gate Operator Access
              </p>
              <p className="text-white/40 text-sm">
                Enter the event key shared by the admin to unlock the scanner for one event only.
              </p>
            </div>
          </div>

          <div
            className="rounded-2xl p-4"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <label className="block text-white/45 text-xs mb-2 font-medium">12-character Event Key</label>
            <input
              value={eventKey}
              onChange={(event) => setEventKey(normalizeKey(event.target.value))}
              placeholder="A4X9-88B2-Q1L0"
              className="w-full bg-transparent text-white text-lg tracking-[0.28em] placeholder-white/15 outline-none px-4 py-4 rounded-xl font-mono"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}
            />
            <div className="flex flex-wrap items-center gap-3 mt-4">
              <MagneticButton onClick={handleAuthorize} disabled={loading || !hasCompleteKey} size="lg">
                {loading ? 'Verifying Key...' : 'Unlock Scanner'}
              </MagneticButton>
              {session && (
                <MagneticButton
                  variant="ghost"
                  onClick={() => {
                    clearSession();
                    setEventKey('');
                    addToast({ type: 'info', title: 'Operator Session Cleared', message: 'The scanner has been locked again.' });
                  }}
                >
                  <span className="flex items-center gap-2">
                    <RefreshCcw size={15} />
                    Clear Session
                  </span>
                </MagneticButton>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl p-4"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck size={15} className="text-emerald-300" />
              <p className="text-white text-sm font-semibold">Restricted Sandbox</p>
            </div>
            <p className="text-white/45 text-sm leading-relaxed">
              Operator access only allows scan validation for the linked event. No event edits, analytics deep-dive, or cross-event browsing.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl p-4"
            style={{ background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.16)' }}
          >
            <div className="flex items-center gap-2 mb-2">
              <ScanLine size={15} className="text-sky-300" />
              <p className="text-white text-sm font-semibold">Active Event</p>
            </div>

            {session ? (
              <div className="space-y-2 text-sm">
                <p className="text-white font-medium">{session.eventTitle}</p>
                <p className="text-white/45">{session.venue}</p>
                {activeDate && <p className="text-white/35 text-xs">{activeDate}</p>}
              </div>
            ) : (
              <p className="text-white/45 text-sm">
                No gate session is active yet. Once the key is verified, the scanner locks onto that event automatically.
              </p>
            )}
          </motion.div>
        </div>
      </div>
    </GlassCard>
  );
}
