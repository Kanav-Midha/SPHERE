import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Clock, Send, Plus, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/useAuthStore';
import { useTimeStore } from '../../store/useTimeStore';
import { useToastStore } from '../../store/useToastStore';
import MagneticButton from '../ui/MagneticButton';
import type { VolunteerEvent } from '../../lib/supabase';

interface VolunteerFormProps {
  volunteerEvent: VolunteerEvent;
  onSuccess: () => void;
}

export default function VolunteerForm({ volunteerEvent, onSuccess }: VolunteerFormProps) {
  const { profile } = useAuthStore();
  const { getCurrentUTC } = useTimeStore();
  const { addToast } = useToastStore();
  const [locked, setLocked] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [skillInput, setSkillInput] = useState('');
  const [form, setForm] = useState({
    full_name: profile?.full_name || '',
    email: profile?.email || '',
    motivation: '',
    experience: '',
    skills: [] as string[],
  });

  useEffect(() => {
    const tick = () => {
      const now = getCurrentUTC();
      const close = new Date(volunteerEvent.application_close);
      const diff = close.getTime() - now.getTime();
      if (diff <= 0) {
        setLocked(true);
        setTimeLeft('Closed');
      } else {
        setLocked(false);
        const d = Math.floor(diff / 86400000);
        const h = Math.floor((diff % 86400000) / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        setTimeLeft(d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m ${s}s`);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [volunteerEvent.application_close, getCurrentUTC]);

  function addSkill() {
    if (skillInput.trim() && !form.skills.includes(skillInput.trim())) {
      setForm((f) => ({ ...f, skills: [...f.skills, skillInput.trim()] }));
      setSkillInput('');
    }
  }

  function removeSkill(skill: string) {
    setForm((f) => ({ ...f, skills: f.skills.filter((s) => s !== skill) }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (locked || submitting || !profile) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('volunteer_applications').insert({
        volunteer_event_id: volunteerEvent.id,
        user_id: profile.id,
        full_name: form.full_name,
        email: form.email,
        motivation: form.motivation,
        skills: form.skills,
        experience: form.experience,
      });
      if (error) {
        if (error.code === '23505') {
          addToast({ type: 'warning', title: 'Already Applied', message: 'You have already submitted an application.' });
        } else {
          addToast({ type: 'error', title: 'Error', message: error.message });
        }
      } else {
        addToast({ type: 'success', title: 'Application Submitted!', message: 'We will review your application soon.' });
        onSuccess();
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative">
      <AnimatePresence>
        {locked && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 px-4 py-3 rounded-xl flex items-center gap-3"
            style={{
              background: 'rgba(255,255,255,0.04)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.15)',
            }}
          >
            <Lock size={16} className="text-white/50 shrink-0" />
            <div>
              <p className="text-white/80 font-semibold text-sm">Registration Closed</p>
              <p className="text-white/35 text-xs">The application window has passed.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!locked && (
        <div
          className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg"
          style={{ background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.15)' }}
        >
          <Clock size={13} className="text-sky-400" />
          <span className="text-sky-400 text-xs font-medium">Closes in: </span>
          <span className="text-sky-300 text-xs font-mono font-bold">{timeLeft}</span>
        </div>
      )}

      <motion.form
        onSubmit={handleSubmit}
        animate={{ opacity: locked ? 0.5 : 1 }}
        transition={{ duration: 0.4 }}
        className="space-y-4"
      >
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-white/50 text-xs mb-1.5 font-medium">Full Name</label>
            <input
              value={form.full_name}
              onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
              disabled={locked}
              required
              className="w-full bg-transparent text-white text-sm placeholder-white/20 outline-none px-3 py-2.5 rounded-xl transition-opacity"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                opacity: locked ? 0.5 : 1,
              }}
              placeholder="Your full name"
            />
          </div>
          <div>
            <label className="block text-white/50 text-xs mb-1.5 font-medium">Email</label>
            <input
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              disabled={locked}
              type="email"
              required
              className="w-full bg-transparent text-white text-sm placeholder-white/20 outline-none px-3 py-2.5 rounded-xl"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                opacity: locked ? 0.5 : 1,
              }}
              placeholder="your@university.edu"
            />
          </div>
        </div>

        <div>
          <label className="block text-white/50 text-xs mb-1.5 font-medium">Why do you want to volunteer?</label>
          <textarea
            value={form.motivation}
            onChange={(e) => setForm((f) => ({ ...f, motivation: e.target.value }))}
            disabled={locked}
            required
            rows={3}
            className="w-full bg-transparent text-white text-sm placeholder-white/20 outline-none px-3 py-2.5 rounded-xl resize-none"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
              opacity: locked ? 0.5 : 1,
            }}
            placeholder="Share your motivation..."
          />
        </div>

        <div>
          <label className="block text-white/50 text-xs mb-1.5 font-medium">Relevant Experience</label>
          <textarea
            value={form.experience}
            onChange={(e) => setForm((f) => ({ ...f, experience: e.target.value }))}
            disabled={locked}
            rows={2}
            className="w-full bg-transparent text-white text-sm placeholder-white/20 outline-none px-3 py-2.5 rounded-xl resize-none"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
              opacity: locked ? 0.5 : 1,
            }}
            placeholder="Any previous volunteering or event experience..."
          />
        </div>

        <div>
          <label className="block text-white/50 text-xs mb-1.5 font-medium">Skills</label>
          <div className="flex gap-2">
            <input
              value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill())}
              disabled={locked}
              className="flex-1 bg-transparent text-white text-sm placeholder-white/20 outline-none px-3 py-2.5 rounded-xl"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                opacity: locked ? 0.5 : 1,
              }}
              placeholder="Type a skill and press Enter"
            />
            <motion.button
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={addSkill}
              disabled={locked}
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              <Plus size={15} className="text-white/60" />
            </motion.button>
          </div>
          {form.skills.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {form.skills.map((s) => (
                <span
                  key={s}
                  className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full text-sky-300"
                  style={{ background: 'rgba(14,165,233,0.12)', border: '1px solid rgba(14,165,233,0.2)' }}
                >
                  {s}
                  <button type="button" onClick={() => removeSkill(s)}>
                    <X size={10} className="text-sky-400/60 hover:text-sky-300" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <MagneticButton
          type="submit"
          disabled={locked || submitting}
          size="lg"
          className="w-full justify-center"
        >
          <span className="flex items-center gap-2">
            {submitting ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}><Send size={15} /></motion.div> : <Send size={15} />}
            {submitting ? 'Submitting...' : 'Submit Application'}
          </span>
        </MagneticButton>
      </motion.form>
    </div>
  );
}
