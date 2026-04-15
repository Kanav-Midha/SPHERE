import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { MapPin, Users, ChevronLeft, ChevronRight, CheckCircle } from 'lucide-react';
import type { Room } from '../../lib/supabase';
import MagneticButton from '../ui/MagneticButton';

interface RoomFallbackCarouselProps {
  rooms: Room[];
  date: string;
  timeSlot: string;
  onBook: (room: Room) => void;
}

export default function RoomFallbackCarousel({
  rooms, date: _date, timeSlot: _timeSlot, onBook,
}: RoomFallbackCarouselProps) {
  const [idx, setIdx] = useState(0);
  const [booked, setBooked] = useState<string | null>(null);

  if (!rooms.length) return null;

  const room = rooms[idx];

  async function handleBook() {
    setBooked(room.id);
    onBook(room);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl overflow-hidden mt-3"
      style={{
        background: 'rgba(14,165,233,0.06)',
        border: '1px solid rgba(14,165,233,0.2)',
      }}
    >
      <div
        className="px-4 py-2.5 flex items-center gap-2"
        style={{ borderBottom: '1px solid rgba(14,165,233,0.12)' }}
      >
        <div className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
        <span className="text-sky-400 text-xs font-semibold">Room unavailable — alternatives found</span>
      </div>

      <div className="p-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={room.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <p className="text-white font-semibold text-sm">{room.name}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <MapPin size={11} className="text-white/40" />
                  <span className="text-white/40 text-xs">{room.location}</span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Users size={11} className="text-white/40" />
                  <span className="text-white/40 text-xs">Capacity: {room.capacity}</span>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {(room.amenities || []).slice(0, 3).map((a) => (
                    <span
                      key={a}
                      className="text-[10px] px-2 py-0.5 rounded-full text-white/50"
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
                    >
                      {a}
                    </span>
                  ))}
                </div>
              </div>

              {booked === room.id ? (
                <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-semibold">
                  <CheckCircle size={14} />
                  <span>Booked</span>
                </div>
              ) : (
                <MagneticButton size="sm" onClick={handleBook}>
                  Book
                </MagneticButton>
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <button
            onClick={() => setIdx((i) => (i - 1 + rooms.length) % rooms.length)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white transition-colors"
            style={{ background: 'rgba(255,255,255,0.05)' }}
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-white/30 text-xs">{idx + 1} / {rooms.length} options</span>
          <button
            onClick={() => setIdx((i) => (i + 1) % rooms.length)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white transition-colors"
            style={{ background: 'rgba(255,255,255,0.05)' }}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
