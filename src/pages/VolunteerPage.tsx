import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, ChevronDown, Plus, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { useTimeStore } from '../store/useTimeStore';
import GlassCard from '../components/ui/GlassCard';
import VolunteerForm from '../components/modules/VolunteerForm';
import AdminKanban from '../components/modules/AdminKanban';
import MagneticButton from '../components/ui/MagneticButton';
import VolunteerGallerySection from '../components/modules/VolunteerGallerySection';
import type { VolunteerEvent } from '../lib/supabase';

export default function VolunteerPage() {
  const { profile } = useAuthStore();
  const { getCurrentUTC, syncTime } = useTimeStore();
  const [volunteerEvents, setVolunteerEvents] = useState<VolunteerEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<VolunteerEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [applied, setApplied] = useState<Set<string>>(new Set());

  useEffect(() => {
    syncTime();
    fetchVolunteerEvents();
  }, []);

  async function fetchVolunteerEvents() {
    setLoading(true);
    const { data } = await supabase
      .from('volunteer_events')
      .select('*, events(title)')
      .order('application_close', { ascending: true });

    const events = (data || []) as (VolunteerEvent & { events: { title: string } | null })[];
    setVolunteerEvents(events);
    if (events.length > 0) setSelectedEvent(events[0]);

    if (profile) {
      const { data: apps } = await supabase
        .from('volunteer_applications')
        .select('volunteer_event_id')
        .eq('user_id', profile.id);
      setApplied(new Set((apps || []).map((a: { volunteer_event_id: string }) => a.volunteer_event_id)));
    }
    setLoading(false);
  }

  async function seedDemoVolunteerEvent() {
    const { data: eventData } = await supabase.from('events').select('id').limit(1).maybeSingle();
    if (!eventData) return;
    const now = new Date();
    const open = new Date(now.getTime() - 5 * 86400000);
    const close = new Date(now.getTime() + 10 * 86400000);
    await supabase.from('volunteer_events').insert({
      event_id: eventData.id,
      title: 'TechFest 2025 Volunteer Program',
      description: 'Join us as a volunteer at TechFest 2025! Help with event coordination, registration, and tech support.',
      application_open: open.toISOString(),
      application_close: close.toISOString(),
      spots: 20,
    });
    fetchVolunteerEvents();
  }

  const isAdmin = profile?.role === 'admin';
  const now = getCurrentUTC();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={24} className="text-sky-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-12 px-6">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mb-8"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1
                className="text-white text-3xl font-bold"
                style={{ letterSpacing: '-0.03em' }}
              >
                Volunteer Hub
              </h1>
              <p className="text-white/35 text-sm mt-1">Apply to volunteer at campus events</p>
            </div>
            {isAdmin && (
              <MagneticButton
                variant="ghost"
                size="sm"
                onClick={seedDemoVolunteerEvent}
              >
                <span className="flex items-center gap-1.5">
                  <Plus size={13} />
                  Seed Demo Event
                </span>
              </MagneticButton>
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
        >
          <VolunteerGallerySection />
        </motion.div>

        {volunteerEvents.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-24 gap-4"
          >
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <Users size={32} className="text-white/20" />
            </div>
            <p className="text-white/30 text-sm">No volunteer programs open right now</p>
            {isAdmin && (
              <MagneticButton size="sm" onClick={seedDemoVolunteerEvent}>
                Create Demo Program
              </MagneticButton>
            )}
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="space-y-3">
              <h2 className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-3">Programs</h2>
              {volunteerEvents.map((ve) => {
                const isClosed = new Date(ve.application_close).getTime() < now.getTime();
                const isSelected = selectedEvent?.id === ve.id;
                const hasApplied = applied.has(ve.id);
                return (
                  <motion.button
                    key={ve.id}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => { setSelectedEvent(ve); setShowForm(false); }}
                    className="w-full text-left p-4 rounded-xl transition-all"
                    style={{
                      background: isSelected ? 'rgba(14,165,233,0.1)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${isSelected ? 'rgba(14,165,233,0.25)' : 'rgba(255,255,255,0.07)'}`,
                    }}
                  >
                    <p className="text-white text-sm font-semibold leading-tight">{ve.title}</p>
                    <p className="text-white/35 text-xs mt-1 line-clamp-2">{ve.description}</p>
                    <div className="flex items-center gap-2 mt-2.5">
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{
                          background: isClosed ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
                          color: isClosed ? '#f87171' : '#34d399',
                          border: `1px solid ${isClosed ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'}`,
                        }}
                      >
                        {isClosed ? 'Closed' : 'Open'}
                      </span>
                      <span className="text-white/25 text-[10px]">{ve.spots} spots</span>
                      {hasApplied && (
                        <span className="text-sky-400 text-[10px] font-medium ml-auto">Applied</span>
                      )}
                    </div>
                  </motion.button>
                );
              })}
            </div>

            <div className="lg:col-span-2">
              <AnimatePresence mode="wait">
                {selectedEvent && (
                  <motion.div
                    key={selectedEvent.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-4"
                  >
                    <GlassCard>
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h2
                            className="text-white font-bold text-xl"
                            style={{ letterSpacing: '-0.02em' }}
                          >
                            {selectedEvent.title}
                          </h2>
                          <p className="text-white/40 text-sm mt-1">{selectedEvent.description}</p>
                        </div>
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ml-4"
                          style={{ background: 'rgba(14,165,233,0.12)', border: '1px solid rgba(14,165,233,0.2)' }}
                        >
                          <Users size={18} className="text-sky-400" />
                        </div>
                      </div>

                      {!isAdmin && (
                        <>
                          {!applied.has(selectedEvent.id) ? (
                            <>
                              <motion.button
                                whileTap={{ scale: 0.98 }}
                                onClick={() => setShowForm(!showForm)}
                                className="w-full flex items-center justify-between py-3 px-4 rounded-xl mb-4 text-sm font-medium text-white/70"
                                style={{
                                  background: 'rgba(255,255,255,0.03)',
                                  border: '1px solid rgba(255,255,255,0.08)',
                                }}
                              >
                                <span>Apply to Volunteer</span>
                                <motion.div animate={{ rotate: showForm ? 180 : 0 }}>
                                  <ChevronDown size={15} />
                                </motion.div>
                              </motion.button>

                              <AnimatePresence>
                                {showForm && (
                                  <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    style={{ overflow: 'hidden' }}
                                  >
                                    <VolunteerForm
                                      volunteerEvent={selectedEvent}
                                      onSuccess={() => {
                                        setApplied((prev) => new Set([...prev, selectedEvent.id]));
                                        setShowForm(false);
                                      }}
                                    />
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </>
                          ) : (
                            <div
                              className="flex items-center gap-3 py-3 px-4 rounded-xl"
                              style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)' }}
                            >
                              <div className="w-2 h-2 rounded-full bg-emerald-400" />
                              <p className="text-emerald-300 text-sm font-medium">Application submitted — under review</p>
                            </div>
                          )}
                        </>
                      )}
                    </GlassCard>

                    {isAdmin && (
                      <GlassCard>
                        <div className="flex items-center gap-2 mb-5">
                          <h3
                            className="text-white font-bold text-base"
                            style={{ letterSpacing: '-0.02em' }}
                          >
                            Review Board
                          </h3>
                          <span
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-sky-400"
                            style={{ background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.2)' }}
                          >
                            Admin
                          </span>
                        </div>
                        <AdminKanban
                          volunteerEventId={selectedEvent.id}
                          isOpen={new Date(selectedEvent.application_close).getTime() <= now.getTime()}
                        />
                      </GlassCard>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
