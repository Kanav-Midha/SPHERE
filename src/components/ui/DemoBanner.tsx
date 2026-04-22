import { Eye } from 'lucide-react';

/**
 * Shown while the public demo account is signed in. Browsing, room
 * availability and ticket claiming all work; anything that would change data
 * other visitors see is refused by the database.
 */
export default function DemoBanner() {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-center gap-3 px-4 py-2 text-center backdrop-blur-xl"
      style={{
        background: 'linear-gradient(90deg, rgba(40,30,24,0.92), rgba(48,30,22,0.92))',
        borderTop: '1px solid rgba(255,255,255,0.10)',
      }}
    >
      <Eye size={14} className="shrink-0 text-white/60" />
      <p className="text-xs leading-relaxed text-white/70">
        <span className="font-semibold text-white/90">Read-only demo.</span>{' '}
        Browse events, rooms and live availability, and claim a ticket to see the QR flow.
        Writes are refused by row level security policies in Postgres.
      </p>
    </div>
  );
}
