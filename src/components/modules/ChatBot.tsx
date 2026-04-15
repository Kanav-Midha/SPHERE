import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Send, Bot, User, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/useAuthStore';
import { useToastStore } from '../../store/useToastStore';
import RoomFallbackCarousel from './RoomFallbackCarousel';
import type { Room } from '../../lib/supabase';

interface BookingIntent {
  room_name?: string;
  date?: string;
  time_slot?: string;
  missing: string[];
}

interface Message {
  id: string;
  role: 'user' | 'bot';
  content: string;
  fallbackRooms?: Room[];
  fallbackDate?: string;
  fallbackSlot?: string;
  timestamp: Date;
}

function parseIntent(input: string): BookingIntent {
  const lower = input.toLowerCase();
  const result: BookingIntent = { missing: [] };

  const roomMatch = lower.match(/lt[-\s]?(\d)|seminar hall (\d)|boardroom|innovation lab|auditorium/i);
  if (roomMatch) {
    if (lower.includes('lt')) result.room_name = `LT-${roomMatch[1] || '1'}`;
    else if (lower.includes('seminar')) result.room_name = `Seminar Hall ${roomMatch[2] || '3'}`;
    else if (lower.includes('boardroom')) result.room_name = 'Boardroom A';
    else if (lower.includes('innovation')) result.room_name = 'Innovation Lab';
    else if (lower.includes('auditorium')) result.room_name = 'Open Auditorium';
  }

  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const today = new Date();
  if (lower.includes('tomorrow') || lower.includes('tmrw') || lower.includes('2moro')) {
    result.date = tomorrow.toISOString().split('T')[0];
  } else if (lower.includes('today')) {
    result.date = today.toISOString().split('T')[0];
  } else {
    const dateMatch = lower.match(/(\d{1,2})[\/\-](\d{1,2})/);
    if (dateMatch) {
      const m = parseInt(dateMatch[1]) - 1;
      const d = parseInt(dateMatch[2]);
      const dt = new Date(); dt.setMonth(m); dt.setDate(d);
      result.date = dt.toISOString().split('T')[0];
    }
    const namedMonth = lower.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})/i);
    if (namedMonth) {
      const months: Record<string, number> = { jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11 };
      const mo = months[namedMonth[1].toLowerCase().slice(0,3)];
      const dt = new Date(); dt.setMonth(mo); dt.setDate(parseInt(namedMonth[2]));
      result.date = dt.toISOString().split('T')[0];
    }
  }

  const timeMatch = lower.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (timeMatch) {
    let hour = parseInt(timeMatch[1]);
    const min = timeMatch[2] || '00';
    const meridiem = timeMatch[3];
    if (meridiem === 'pm' && hour < 12) hour += 12;
    if (meridiem === 'am' && hour === 12) hour = 0;
    if (hour >= 6 && hour <= 22) {
      const end = (hour + 1) % 24;
      result.time_slot = `${String(hour).padStart(2,'0')}:${min}-${String(end).padStart(2,'0')}:${min}`;
    }
  }

  if (!result.room_name) result.missing.push('room');
  if (!result.date) result.missing.push('date');
  if (!result.time_slot) result.missing.push('time');

  return result;
}

function getMissingQuestion(missing: string[]): string {
  if (missing.includes('room')) return "Which room would you like? Available rooms: LT-1, LT-2, Seminar Hall 3, Innovation Lab, Boardroom A, Open Auditorium.";
  if (missing.includes('date')) return "What date did you have in mind? (e.g., 'tomorrow', 'May 20')";
  if (missing.includes('time')) return "What time would you like to book? (e.g., '3pm', '10:00am')";
  return "Could you provide more details?";
}

export default function ChatBot() {
  const { profile } = useAuthStore();
  const { addToast } = useToastStore();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'bot',
      content: "Hello! I'm your room booking assistant. Try something like: \"Book LT-1 for tomorrow at 3pm\" or \"Reserve Innovation Lab on Friday at 5pm\".",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingIntent, setPendingIntent] = useState<Partial<BookingIntent> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function addMessage(msg: Omit<Message, 'id' | 'timestamp'>) {
    setMessages((prev) => [...prev, { ...msg, id: Math.random().toString(36).slice(2), timestamp: new Date() }]);
  }

  async function attemptBooking(intent: BookingIntent) {
    if (!profile) return;
    setLoading(true);
    try {
      const { data: roomData } = await supabase
        .from('rooms')
        .select('*')
        .ilike('name', `%${intent.room_name}%`)
        .maybeSingle();

      if (!roomData) {
        addMessage({ role: 'bot', content: `Sorry, I couldn't find a room matching "${intent.room_name}". Please check the room name.` });
        setLoading(false);
        return;
      }

      const { error } = await supabase.from('bookings').insert({
        room_id: roomData.id,
        user_id: profile.id,
        date: intent.date,
        time_slot: intent.time_slot,
        purpose: 'Booked via chatbot',
        status: 'pending',
      });

      if (error) {
        if (error.code === '23505') {
          const { data: alternateRooms } = await supabase
            .from('rooms')
            .select('*')
            .neq('id', roomData.id)
            .limit(3);

          const availableRooms: Room[] = [];
          for (const r of (alternateRooms || [])) {
            const { data: conflict } = await supabase
              .from('bookings')
              .select('id')
              .eq('room_id', r.id)
              .eq('date', intent.date!)
              .eq('time_slot', intent.time_slot!)
              .maybeSingle();
            if (!conflict) availableRooms.push(r as Room);
          }

          addMessage({
            role: 'bot',
            content: `${intent.room_name} is already booked for ${intent.date} at ${intent.time_slot}. Here are some available alternatives:`,
            fallbackRooms: availableRooms,
            fallbackDate: intent.date,
            fallbackSlot: intent.time_slot,
          });
        } else {
          addMessage({ role: 'bot', content: `Booking failed: ${error.message}` });
        }
      } else {
        addMessage({
          role: 'bot',
          content: `Done! I've submitted **${roomData.name}** for **${intent.date}** at **${intent.time_slot}**. You'll find the request in your bookings.`,
        });
        addToast({ type: 'success', title: 'Request Submitted', message: `${roomData.name} on ${intent.date}` });
        setPendingIntent(null);
      }
    } catch {
      addMessage({ role: 'bot', content: 'Something went wrong. Please try again.' });
    }
    setLoading(false);
  }

  async function handleFallbackBook(room: Room) {
    if (!pendingIntent?.date || !pendingIntent?.time_slot || !profile) return;
    const { error } = await supabase.from('bookings').insert({
      room_id: room.id,
      user_id: profile.id,
      date: pendingIntent.date,
      time_slot: pendingIntent.time_slot,
      purpose: 'Booked via chatbot fallback',
      status: 'pending',
    });
    if (!error) {
      addMessage({ role: 'bot', content: `Submitted **${room.name}** on **${pendingIntent.date}** at **${pendingIntent.time_slot}** for approval.` });
      addToast({ type: 'success', title: 'Request Submitted', message: `${room.name} secured` });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const userText = input.trim();
    setInput('');
    addMessage({ role: 'user', content: userText });

    setLoading(true);
    await new Promise((r) => setTimeout(r, 600));

    const intent = parseIntent(userText);
    const merged: BookingIntent = {
      ...pendingIntent as BookingIntent,
      ...Object.fromEntries(Object.entries(intent).filter(([, v]) => v !== undefined && v !== '')),
      missing: intent.missing,
    } as BookingIntent;

    if (pendingIntent) {
      if (pendingIntent.room_name && !merged.room_name) merged.room_name = pendingIntent.room_name as string;
      if (pendingIntent.date && !merged.date) merged.date = pendingIntent.date as string;
      if (pendingIntent.time_slot && !merged.time_slot) merged.time_slot = pendingIntent.time_slot as string;
      const stillMissing: string[] = [];
      if (!merged.room_name) stillMissing.push('room');
      if (!merged.date) stillMissing.push('date');
      if (!merged.time_slot) stillMissing.push('time');
      merged.missing = stillMissing;
    }

    if (merged.missing.length > 0) {
      setPendingIntent(merged);
      addMessage({ role: 'bot', content: getMissingQuestion(merged.missing) });
      setLoading(false);
      return;
    }

    setPendingIntent(merged);
    await attemptBooking(merged);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide" style={{ minHeight: 0 }}>
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div
              className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center"
              style={{
                background: msg.role === 'bot' ? 'rgba(14,165,233,0.2)' : 'rgba(255,255,255,0.08)',
                border: `1px solid ${msg.role === 'bot' ? 'rgba(14,165,233,0.3)' : 'rgba(255,255,255,0.1)'}`,
              }}
            >
              {msg.role === 'bot' ? <Bot size={13} className="text-sky-400" /> : <User size={13} className="text-white/60" />}
            </div>
            <div className={`flex flex-col gap-1 max-w-[85%] ${msg.role === 'user' ? 'items-end' : ''}`}>
              <div
                className="px-3.5 py-2.5 rounded-xl text-sm leading-relaxed"
                style={{
                  background: msg.role === 'user' ? 'rgba(14,165,233,0.18)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${msg.role === 'user' ? 'rgba(14,165,233,0.25)' : 'rgba(255,255,255,0.07)'}`,
                  color: 'rgba(255,255,255,0.85)',
                }}
                dangerouslySetInnerHTML={{
                  __html: msg.content.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>'),
                }}
              />
              {msg.fallbackRooms && msg.fallbackRooms.length > 0 && (
                <RoomFallbackCarousel
                  rooms={msg.fallbackRooms}
                  date={msg.fallbackDate || ''}
                  timeSlot={msg.fallbackSlot || ''}
                  onBook={handleFallbackBook}
                />
              )}
            </div>
          </motion.div>
        ))}
        {loading && (
          <div className="flex gap-3">
            <div
              className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center"
              style={{ background: 'rgba(14,165,233,0.2)', border: '1px solid rgba(14,165,233,0.3)' }}
            >
              <Bot size={13} className="text-sky-400" />
            </div>
            <div
              className="px-3.5 py-2.5 rounded-xl flex items-center gap-2"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <Loader2 size={13} className="text-sky-400 animate-spin" />
              <span className="text-white/40 text-sm">Processing...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex gap-2 p-4"
        style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Book LT-1 for tomorrow at 5pm..."
          className="flex-1 bg-transparent text-white text-sm placeholder-white/25 outline-none px-3 py-2.5 rounded-xl"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
          disabled={loading}
        />
        <motion.button
          type="submit"
          disabled={loading || !input.trim()}
          whileTap={{ scale: 0.92 }}
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-opacity"
          style={{
            background: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
            opacity: loading || !input.trim() ? 0.4 : 1,
          }}
        >
          <Send size={15} className="text-white" />
        </motion.button>
      </form>
    </div>
  );
}
