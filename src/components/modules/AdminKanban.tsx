import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, Clock, Mail } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToastStore } from '../../store/useToastStore';
import type { VolunteerApplication } from '../../lib/supabase';

interface AdminKanbanProps {
  volunteerEventId: string;
  isOpen: boolean;
}

type KanbanColumn = 'pending' | 'approved' | 'rejected';

const columns: { id: KanbanColumn; label: string; color: string; icon: React.ReactNode }[] = [
  { id: 'pending', label: 'Pending Review', color: 'rgba(251,191,36,0.15)', icon: <Clock size={14} className="text-amber-400" /> },
  { id: 'approved', label: 'Approved', color: 'rgba(52,211,153,0.1)', icon: <CheckCircle2 size={14} className="text-emerald-400" /> },
  { id: 'rejected', label: 'Rejected', color: 'rgba(239,68,68,0.1)', icon: <XCircle size={14} className="text-red-400" /> },
];

export default function AdminKanban({ volunteerEventId, isOpen }: AdminKanbanProps) {
  const { addToast } = useToastStore();
  const [applications, setApplications] = useState<VolunteerApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    fetchApplications();
  }, [volunteerEventId, isOpen]);

  async function fetchApplications() {
    setLoading(true);
    const { data } = await supabase
      .from('volunteer_applications')
      .select('*')
      .eq('volunteer_event_id', volunteerEventId)
      .order('applied_at', { ascending: false });
    setApplications((data as VolunteerApplication[]) || []);
    setLoading(false);
  }

  async function updateStatus(id: string, status: KanbanColumn) {
    setUpdating(id);
    const { error } = await supabase
      .from('volunteer_applications')
      .update({ status, reviewed_at: new Date().toISOString() })
      .eq('id', id);
    if (!error) {
      setApplications((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status } : a))
      );
      addToast({ type: 'success', title: `Application ${status}`, message: 'Status updated successfully' });
    }
    setUpdating(null);
  }

  if (!isOpen) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <Clock size={28} className="text-white/20" />
        </div>
        <p className="text-white/25 text-sm">Review board unlocks when applications close</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 rounded-full border-2 border-sky-400 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-4">
      {columns.map((col) => {
        const colApps = applications.filter((a) => a.status === col.id);
        return (
          <div key={col.id}>
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-xl mb-3"
              style={{ background: col.color, border: '1px solid rgba(255,255,255,0.06)' }}
            >
              {col.icon}
              <span className="text-white/70 text-xs font-semibold">{col.label}</span>
              <span
                className="ml-auto text-xs font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}
              >
                {colApps.length}
              </span>
            </div>

            <div className="space-y-2">
              {colApps.map((app) => (
                <motion.div
                  key={app.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 rounded-xl"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.07)',
                  }}
                >
                  <div className="flex items-start gap-2 mb-2">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0"
                      style={{ background: 'rgba(14,165,233,0.2)' }}
                    >
                      {app.full_name[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-white text-xs font-semibold truncate">{app.full_name}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Mail size={9} className="text-white/30" />
                        <p className="text-white/30 text-[10px] truncate">{app.email}</p>
                      </div>
                    </div>
                  </div>

                  {app.motivation && (
                    <p className="text-white/40 text-[10px] leading-relaxed mb-2 line-clamp-2">
                      {app.motivation}
                    </p>
                  )}

                  {app.skills && app.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {app.skills.slice(0, 3).map((s) => (
                        <span
                          key={s}
                          className="text-[9px] px-1.5 py-0.5 rounded-full text-sky-400/60"
                          style={{ background: 'rgba(14,165,233,0.08)' }}
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  )}

                  {col.id === 'pending' && (
                    <div className="flex gap-1.5">
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => updateStatus(app.id, 'approved')}
                        disabled={updating === app.id}
                        className="flex-1 py-1.5 rounded-lg text-[10px] font-semibold text-emerald-400 transition-opacity"
                        style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.15)' }}
                      >
                        Approve
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => updateStatus(app.id, 'rejected')}
                        disabled={updating === app.id}
                        className="flex-1 py-1.5 rounded-lg text-[10px] font-semibold text-red-400 transition-opacity"
                        style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.12)' }}
                      >
                        Reject
                      </motion.button>
                    </div>
                  )}
                  {col.id !== 'pending' && (
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => updateStatus(app.id, 'pending')}
                      className="w-full py-1.5 rounded-lg text-[10px] font-semibold text-white/30 transition-opacity"
                      style={{ background: 'rgba(255,255,255,0.04)' }}
                    >
                      Move to Pending
                    </motion.button>
                  )}
                </motion.div>
              ))}

              {colApps.length === 0 && (
                <div
                  className="text-center py-6 rounded-xl"
                  style={{ border: '1px dashed rgba(255,255,255,0.06)' }}
                >
                  <p className="text-white/15 text-xs">No applications</p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
