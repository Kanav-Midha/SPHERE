import { useEffect, useMemo, useState } from 'react';
import { Calendar, KeyRound, LineChart, Pencil, Plus, RotateCcw, Trash2, Users } from 'lucide-react';
import type { EventAdminRecord } from '../../lib/supabase';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/useAuthStore';
import { useToastStore } from '../../store/useToastStore';
import GlassCard from '../ui/GlassCard';
import MagneticButton from '../ui/MagneticButton';

interface EventAdminPanelProps {
  onRefresh: () => Promise<void>;
}

interface AdminEventForm {
  title: string;
  description: string;
  venue: string;
  event_date: string;
  capacity: string;
  image_url: string;
  tags: string;
}

const EMPTY_FORM: AdminEventForm = {
  title: '',
  description: '',
  venue: '',
  event_date: '',
  capacity: '100',
  image_url: '',
  tags: '',
};

export default function EventAdminPanel({ onRefresh }: EventAdminPanelProps) {
  const { profile } = useAuthStore();
  const { addToast } = useToastStore();
  const [events, setEvents] = useState<EventAdminRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [form, setForm] = useState<AdminEventForm>(EMPTY_FORM);

  useEffect(() => {
    void fetchAdminData();
  }, [profile?.id]);

  async function fetchAdminData() {
    if (!profile) return;

    setLoading(true);

    const [{ data: eventRows, error: eventError }, { data: keysData }, { data: ticketsData }, { data: scansData }] = await Promise.all([
      supabase.from('events').select('*').eq('organizer_id', profile.id).order('event_date', { ascending: true }),
      supabase.from('event_operator_keys').select('event_id, operator_auth_key'),
      supabase.from('event_tickets').select('event_id, status'),
      supabase.from('scan_logs').select('event_id, status'),
    ]);

    if (eventError) {
      addToast({ type: 'error', title: 'Admin Events Failed', message: eventError.message });
      setLoading(false);
      return;
    }

    const keyMap = new Map((keysData || []).map((row: { event_id: string; operator_auth_key: string }) => [row.event_id, row.operator_auth_key]));
    const ticketStats = new Map<string, number>();
    const scannedStats = new Map<string, { valid: number; invalid: number; already_scanned: number }>();

    (ticketsData || []).forEach((row: { event_id: string }) => {
      ticketStats.set(row.event_id, (ticketStats.get(row.event_id) || 0) + 1);
    });

    (scansData || []).forEach((row: { event_id: string | null; status: 'valid' | 'invalid' | 'already_scanned' }) => {
      if (!row.event_id) return;
      const existing = scannedStats.get(row.event_id) || { valid: 0, invalid: 0, already_scanned: 0 };
      existing[row.status] += 1;
      scannedStats.set(row.event_id, existing);
    });

    const merged = ((eventRows || []) as EventAdminRecord[]).map((event) => {
      const metrics = scannedStats.get(event.id) || { valid: 0, invalid: 0, already_scanned: 0 };
      return {
        ...event,
        operator_auth_key: keyMap.get(event.id),
        tickets_claimed: ticketStats.get(event.id) || 0,
        tickets_scanned: metrics.valid,
        invalid_scans: metrics.invalid,
        already_scanned: metrics.already_scanned,
      };
    });

    setEvents(merged);
    setLoading(false);
  }

  const summary = useMemo(() => ({
    totalEvents: events.length,
    totalTickets: events.reduce((sum, event) => sum + (event.tickets_claimed || 0), 0),
    totalScanned: events.reduce((sum, event) => sum + (event.tickets_scanned || 0), 0),
  }), [events]);

  function startEdit(event: EventAdminRecord) {
    setEditingEventId(event.id);
    setForm({
      title: event.title,
      description: event.description,
      venue: event.venue,
      event_date: event.event_date.slice(0, 16),
      capacity: String(event.capacity),
      image_url: event.image_url,
      tags: (event.tags || []).join(', '),
    });
  }

  function resetForm() {
    setEditingEventId(null);
    setForm(EMPTY_FORM);
  }

  async function handleSubmit() {
    if (!form.title.trim() || !form.event_date) {
      addToast({ type: 'warning', title: 'Missing Event Details', message: 'Title and event date are required.' });
      return;
    }

    setSubmitting(true);
    const tags = form.tags.split(',').map((tag) => tag.trim()).filter(Boolean);

    if (editingEventId) {
      const { error } = await supabase
        .from('events')
        .update({
          title: form.title.trim(),
          description: form.description.trim(),
          venue: form.venue.trim(),
          event_date: new Date(form.event_date).toISOString(),
          capacity: Number(form.capacity) || 100,
          image_url: form.image_url.trim(),
          tags,
        })
        .eq('id', editingEventId);

      if (error) {
        addToast({ type: 'error', title: 'Event Update Failed', message: error.message });
      } else {
        addToast({ type: 'success', title: 'Event Updated', message: 'The admin dashboard has the latest event details.' });
        resetForm();
        await Promise.all([fetchAdminData(), onRefresh()]);
      }
    } else {
      const { data, error } = await supabase.rpc('create_event_with_operator_key', {
        title: form.title.trim(),
        description: form.description.trim(),
        venue: form.venue.trim(),
        event_date: new Date(form.event_date).toISOString(),
        capacity: Number(form.capacity) || 100,
        image_url: form.image_url.trim(),
        tags,
      });

      if (error) {
        addToast({ type: 'error', title: 'Event Creation Failed', message: error.message });
      } else {
        const created = (data || [])[0];
        addToast({
          type: 'success',
          title: 'Event Created',
          message: created?.operator_auth_key
            ? `Operator key generated: ${created.operator_auth_key}`
            : 'The event was created successfully.',
        });
        resetForm();
        await Promise.all([fetchAdminData(), onRefresh()]);
      }
    }

    setSubmitting(false);
  }

  async function handleDelete(eventId: string) {
    const targetEvent = events.find((event) => event.id === eventId);
    const confirmed = window.confirm(
      `Delete ${targetEvent?.title || 'this event'}? This will remove the event, operator key, and related ticket access.`
    );

    if (!confirmed) return;

    const { error } = await supabase.from('events').delete().eq('id', eventId);
    if (error) {
      addToast({ type: 'error', title: 'Delete Failed', message: error.message });
    } else {
      addToast({ type: 'success', title: 'Event Deleted', message: 'The event and its operator key have been removed.' });
      if (editingEventId === eventId) resetForm();
      await Promise.all([fetchAdminData(), onRefresh()]);
    }
  }

  async function handleRotateKey(eventId: string) {
    const { data, error } = await supabase.rpc('reset_event_operator_key', {
      target_event_id: eventId,
    });

    if (error) {
      addToast({ type: 'error', title: 'Key Reset Failed', message: error.message });
    } else {
      addToast({ type: 'success', title: 'Operator Key Rotated', message: `New gate key: ${data}` });
      await fetchAdminData();
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Live Events', value: summary.totalEvents, icon: Calendar, color: '#38bdf8' },
          { label: 'Tickets Claimed', value: summary.totalTickets, icon: Users, color: '#34d399' },
          { label: 'Tickets Scanned', value: summary.totalScanned, icon: LineChart, color: '#f59e0b' },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <GlassCard key={item.label}>
              <div className="flex items-center gap-3">
                <div
                  className="w-11 h-11 rounded-2xl flex items-center justify-center"
                  style={{ background: `${item.color}20`, border: `1px solid ${item.color}33` }}
                >
                  <Icon size={18} style={{ color: item.color }} />
                </div>
                <div>
                  <p className="text-white text-2xl font-bold">{item.value}</p>
                  <p className="text-white/35 text-sm">{item.label}</p>
                </div>
              </div>
            </GlassCard>
          );
        })}
      </div>

      <GlassCard>
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <p className="text-white text-lg font-semibold">{editingEventId ? 'Edit Event' : 'Create Event'}</p>
            <p className="text-white/40 text-sm mt-1">Every new event gets a fresh 12-character operator access key automatically.</p>
          </div>
          {editingEventId && (
            <MagneticButton variant="ghost" onClick={resetForm}>Cancel Edit</MagneticButton>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { key: 'title', label: 'Event Title', placeholder: 'Spring Tech Hackathon' },
            { key: 'venue', label: 'Venue', placeholder: 'Open Auditorium' },
            { key: 'event_date', label: 'Event Date', placeholder: '', type: 'datetime-local' },
            { key: 'capacity', label: 'Capacity', placeholder: '500', type: 'number' },
            { key: 'image_url', label: 'Image URL', placeholder: 'https://...' },
            { key: 'tags', label: 'Tags', placeholder: 'Hackathon, Tech, Night Event' },
          ].map((field) => (
            <div key={field.key}>
              <label className="block text-white/45 text-xs mb-1.5 font-medium">{field.label}</label>
              <input
                type={field.type || 'text'}
                value={form[field.key as keyof AdminEventForm]}
                onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value }))}
                placeholder={field.placeholder}
                className="w-full bg-transparent text-white text-sm placeholder-white/20 outline-none px-4 py-3 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
              />
            </div>
          ))}
        </div>

        <div className="mt-4">
          <label className="block text-white/45 text-xs mb-1.5 font-medium">Description</label>
          <textarea
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            rows={4}
            placeholder="Describe the event experience, audience, and what students should expect."
            className="w-full bg-transparent text-white text-sm placeholder-white/20 outline-none px-4 py-3 rounded-xl resize-none"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
          />
        </div>

        <div className="mt-4">
          <MagneticButton onClick={handleSubmit} disabled={submitting}>
            <span className="flex items-center gap-2">
              {editingEventId ? <Pencil size={15} /> : <Plus size={15} />}
              {submitting ? 'Saving...' : editingEventId ? 'Update Event' : 'Create Event'}
            </span>
          </MagneticButton>
        </div>
      </GlassCard>

      {loading ? (
        <GlassCard className="py-16 flex items-center justify-center">
          <div className="w-6 h-6 rounded-full border-2 border-sky-400 border-t-transparent animate-spin" />
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {events.map((event) => (
            <GlassCard key={event.id} className="h-full">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-white text-lg font-semibold">{event.title}</p>
                  <p className="text-white/35 text-sm mt-1">{event.venue}</p>
                </div>
                <span className="rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-white/45"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  Your event
                </span>
              </div>

              <p className="text-white/45 text-sm mt-3 line-clamp-3">{event.description}</p>

              <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
                <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <p className="text-white/30 text-xs uppercase tracking-[0.18em]">Operator Key</p>
                  <div className="flex items-center justify-between gap-2 mt-2">
                    <span className="text-sky-200 font-mono text-sm">{event.operator_auth_key || 'Pending migration'}</span>
                    <button
                      onClick={() => handleRotateKey(event.id)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-sky-300"
                      style={{ background: 'rgba(14,165,233,0.12)' }}
                    >
                      <RotateCcw size={14} />
                    </button>
                  </div>
                </div>

                <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <p className="text-white/30 text-xs uppercase tracking-[0.18em]">Attendance</p>
                  <p className="text-white font-semibold mt-2">{event.tickets_scanned || 0} scanned / {event.tickets_claimed || 0} claimed</p>
                  <p className="text-white/35 text-xs mt-1">
                    {event.invalid_scans || 0} invalid, {event.already_scanned || 0} repeats
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-4 text-sm text-white/45">
                <KeyRound size={14} className="text-amber-300" />
                <span>
                  Share the key only with gate volunteers assigned to this event.
                </span>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  onClick={() => startEdit(event)}
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-white transition-colors hover:text-white"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <Pencil size={14} />
                  Edit Event
                </button>
                <button
                  onClick={() => handleDelete(event.id)}
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-red-200 transition-colors hover:text-white"
                  style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.22)' }}
                >
                  <Trash2 size={14} />
                  Delete Event
                </button>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
