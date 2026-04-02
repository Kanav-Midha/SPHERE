import { useEffect, useState } from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import type { Event } from '../../lib/supabase';
import { useAuthStore } from '../../store/useAuthStore';
import { useOperatorSessionStore } from '../../store/useOperatorSessionStore';
import EventAdminPanel from './EventAdminPanel';
import EventCustomerView from './EventCustomerView';
import EventRoleSelector, { type EventWorkspaceMode } from './EventRoleSelector';
import GlassCard from '../ui/GlassCard';
import MagneticButton from '../ui/MagneticButton';
import OperatorAccessPanel from './OperatorAccessPanel';

interface EventBookingDiscoveryProps {
  events: Event[];
  loading: boolean;
  onRefresh: () => Promise<void>;
  onOpenScanner: () => void;
}

export default function EventBookingDiscovery({
  events,
  loading,
  onRefresh,
  onOpenScanner,
}: EventBookingDiscoveryProps) {
  const { profile } = useAuthStore();
  const { session } = useOperatorSessionStore();
  const [mode, setMode] = useState<EventWorkspaceMode>(() => {
    if (typeof window === 'undefined') return 'customer';
    const stored = window.sessionStorage.getItem('sphere-event-workspace-mode');
    return stored === 'admin' || stored === 'operator' || stored === 'customer' ? stored : 'customer';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.sessionStorage.setItem('sphere-event-workspace-mode', mode);
  }, [mode]);

  return (
    <div className="space-y-6">
      <GlassCard className="overflow-hidden" glow glowColor="rgba(56,189,248,0.18)">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <p className="text-white/30 text-sm font-medium mb-1">Event Booking Workspace</p>
            <h2 className="text-white text-3xl font-bold" style={{ letterSpacing: '-0.03em' }}>
              Choose your role before you continue
            </h2>
            <p className="text-white/45 text-sm mt-3 max-w-3xl">
              Customers discover and claim tickets, admins create events and generate operator keys, and gate operators unlock a scanner that is hard-bound to one event.
            </p>
          </div>

          {session && (
            <div
              className="rounded-2xl px-4 py-3"
              style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.16)' }}
            >
              <div className="flex items-center gap-2">
                <ShieldCheck size={15} className="text-emerald-300" />
                <p className="text-white text-sm font-semibold">Operator session active</p>
              </div>
              <p className="text-white/45 text-sm mt-1">{session.eventTitle}</p>
            </div>
          )}
        </div>
      </GlassCard>

      <EventRoleSelector mode={mode} onChange={setMode} canAccessAdmin={Boolean(profile)} />

      {mode === 'customer' && (
        <EventCustomerView events={events} loading={loading} onRefresh={onRefresh} />
      )}

      {mode === 'admin' && (
        profile ? (
          <EventAdminPanel onRefresh={onRefresh} />
        ) : (
          <GlassCard className="text-center py-14">
            <p className="text-white text-2xl font-semibold">Sign in required</p>
            <p className="text-white/45 text-sm mt-3">The event-head workspace opens once you sign in with your BITS account.</p>
          </GlassCard>
        )
      )}

      {mode === 'operator' && (
        <div className="space-y-5">
          <OperatorAccessPanel
            onAuthorized={() => {
              onOpenScanner();
            }}
          />

          <GlassCard>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <p className="text-white text-lg font-semibold">Open the full scanner portal</p>
                <p className="text-white/45 text-sm mt-1">
                  Use the dedicated scanner route for the phone-first gate view and full-screen scan feedback.
                </p>
              </div>
              <MagneticButton onClick={onOpenScanner} variant="ghost">
                <span className="flex items-center gap-2">
                  Open Scanner Portal
                  <ArrowRight size={15} />
                </span>
              </MagneticButton>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
