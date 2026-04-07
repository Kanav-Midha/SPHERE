import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import GlassCard from '../components/ui/GlassCard';
import DiscoveryModeSelector from '../components/modules/DiscoveryModeSelector';
import RoomBookingDiscovery from '../components/modules/RoomBookingDiscovery';
import type { Event } from '../lib/supabase';
import EventBookingDiscovery from '../components/modules/EventBookingDiscovery';
import HeroImmersive from '../components/hero/HeroImmersive';

interface DashboardProps {
  onOpenScanner: () => void;
}

export default function Dashboard({ onOpenScanner }: DashboardProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [discoveryMode, setDiscoveryMode] = useState<'events' | 'rooms' | null>(() => {
    if (typeof window === 'undefined') return null;
    const stored = window.sessionStorage.getItem('sphere-discovery-mode');
    return stored === 'events' || stored === 'rooms' ? stored : null;
  });

  useEffect(() => {
    void fetchData();

    const channel = supabase
      .channel('sphere-events-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'events' },
        () => {
          void fetchData();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (discoveryMode) {
      window.sessionStorage.setItem('sphere-discovery-mode', discoveryMode);
    } else {
      window.sessionStorage.removeItem('sphere-discovery-mode');
    }
  }, [discoveryMode]);

  async function fetchData() {
    const [{ data: evData }] = await Promise.all([
      supabase.from('events').select('*').order('event_date', { ascending: true }),
    ]);
    setEvents((evData as Event[]) || []);
    setLoadingEvents(false);
  }

  const nextEvent = events[0];

  return (
    <div className="min-h-screen pt-28 pb-14">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mb-6"
        >
          <HeroImmersive
            eventCount={events.length}
            activeMode={discoveryMode}
            nextEventTitle={nextEvent?.title}
            onEnterEvents={() => setDiscoveryMode('events')}
            onEnterRooms={() => setDiscoveryMode('rooms')}
          />
        </motion.div>

        <div className="mb-8">
          <DiscoveryModeSelector mode={discoveryMode} onChange={setDiscoveryMode} />
        </div>

        {discoveryMode === 'events' && (
          <EventBookingDiscovery
            events={events}
            loading={loadingEvents}
            onRefresh={fetchData}
            onOpenScanner={onOpenScanner}
          />
        )}

        {discoveryMode === 'rooms' && (
          <div className="mt-2">
            <RoomBookingDiscovery />
          </div>
        )}

        {discoveryMode === null && (
          <GlassCard className="mt-2 text-center py-14" glow glowColor="rgba(198,127,87,0.2)">
            <div className="max-w-2xl mx-auto">
              <p className="text-white text-2xl font-bold" style={{ letterSpacing: '-0.03em' }}>
                Start with one section
              </p>
              <p className="text-white/45 text-sm mt-3">
                Open Events to browse and claim passes, or Rooms to move into the room booking flow.
              </p>
            </div>
          </GlassCard>
        )}
      </div>
    </div>
  );
}
