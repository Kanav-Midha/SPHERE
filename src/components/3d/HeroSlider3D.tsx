import { useState } from 'react';
import { motion, useMotionValue } from 'framer-motion';
import { Calendar, MapPin, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Event } from '../../lib/supabase';

interface HeroSlider3DProps {
  events: Event[];
}

const CARD_IMAGES = [
  'https://images.pexels.com/photos/1190297/pexels-photo-1190297.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750',
  'https://images.pexels.com/photos/2747449/pexels-photo-2747449.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750',
  'https://images.pexels.com/photos/976866/pexels-photo-976866.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750',
  'https://images.pexels.com/photos/1105666/pexels-photo-1105666.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750',
  'https://images.pexels.com/photos/3184418/pexels-photo-3184418.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750',
];

export default function HeroSlider3D({ events }: HeroSlider3DProps) {
  const [active, setActive] = useState(0);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const dragX = useMotionValue(0);

  const items = events.length > 0 ? events : DEMO_EVENTS;
  const total = items.length;

  function goNext() {
    setActive((a) => (a + 1) % total);
  }

  function goPrev() {
    setActive((a) => (a - 1 + total) % total);
  }

  function handleDragEnd() {
    const val = dragX.get();
    if (val < -60) goNext();
    else if (val > 60) goPrev();
    dragX.set(0);
  }

  const getCardStyle = (index: number) => {
    const diff = ((index - active + total) % total + total) % total;
    const normalDiff = diff > total / 2 ? diff - total : diff;

    if (normalDiff === 0) {
      return { x: 0, z: 0, scale: 1, opacity: 1, blur: 0, zIndex: 10 };
    }

    if (normalDiff === 1 || normalDiff === -(total - 1)) {
      return { x: 320, z: -180, scale: 0.78, opacity: 0.5, blur: 6, zIndex: 5 };
    }

    if (normalDiff === -1 || normalDiff === total - 1) {
      return { x: -320, z: -180, scale: 0.78, opacity: 0.5, blur: 6, zIndex: 5 };
    }

    return { x: 0, z: -400, scale: 0.5, opacity: 0, blur: 12, zIndex: 0 };
  };

  return (
    <div className="relative w-full" style={{ height: 460 }}>
      <div
        className="absolute inset-x-12 top-6 bottom-8 rounded-[36px] opacity-90"
        style={{
          background:
            'radial-gradient(circle at top, rgba(103,232,249,0.15), transparent 34%), linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      />

      <div className="absolute inset-0 flex items-center justify-center" style={{ perspective: 1200 }}>
        {items.map((event, i) => {
          const style = getCardStyle(i);
          const fallbackImage = CARD_IMAGES[i % CARD_IMAGES.length];
          const imageKey = event.id || String(i);
          const img = event.image_url && !failedImages[imageKey] ? event.image_url : fallbackImage;

          return (
            <motion.div
              key={event.id || i}
              animate={{
                x: style.x,
                scale: style.scale,
                opacity: style.opacity,
                filter: `blur(${style.blur}px)`,
                zIndex: style.zIndex,
              }}
              transition={{ type: 'spring', stiffness: 280, damping: 32 }}
              style={{
                position: 'absolute',
                width: 360,
                transformStyle: 'preserve-3d',
                cursor: style.zIndex < 10 ? 'pointer' : 'grab',
              }}
              onClick={() => {
                if (style.x > 0) goNext();
                else if (style.x < 0) goPrev();
              }}
              drag={style.zIndex === 10 ? 'x' : false}
              dragConstraints={{ left: -200, right: 200 }}
              dragElastic={0.15}
              onDragEnd={handleDragEnd}
              onDrag={(_, info) => dragX.set(info.offset.x)}
            >
              <div
                className="overflow-hidden rounded-[30px]"
                style={{
                  background: 'linear-gradient(180deg, rgba(10,15,28,0.92), rgba(8,11,21,0.82))',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  boxShadow:
                    style.zIndex === 10
                      ? '0 46px 90px rgba(0,0,0,0.7), 0 0 70px rgba(103,232,249,0.12)'
                      : '0 20px 40px rgba(0,0,0,0.5)',
                }}
              >
                <div className="relative h-48 overflow-hidden">
                  <img
                    src={img}
                    alt={event.title}
                    className="h-full w-full object-cover"
                    draggable={false}
                    onError={() => {
                      setFailedImages((current) => {
                        if (current[imageKey]) return current;
                        return { ...current, [imageKey]: true };
                      });
                    }}
                  />
                  <div
                    className="absolute inset-0"
                    style={{
                      background: 'linear-gradient(to bottom, transparent 35%, rgba(6,10,20,0.95) 100%)',
                    }}
                  />
                  <div
                    className="absolute inset-0"
                    style={{
                      background: 'linear-gradient(135deg, rgba(103,232,249,0.18), transparent 35%)',
                    }}
                  />
                  <div className="absolute top-3 right-3 flex gap-2">
                    {(event.tags || []).slice(0, 2).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                        style={{
                          background: 'rgba(14,165,233,0.2)',
                          border: '1px solid rgba(14,165,233,0.4)',
                          color: '#7dd3fc',
                          backdropFilter: 'blur(12px)',
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="p-6">
                  <p className="mb-3 text-[11px] uppercase tracking-[0.24em] text-white/25">Curated Event Spotlight</p>
                  <h3
                    className="mb-1 text-lg font-bold leading-tight text-white"
                    style={{ letterSpacing: '-0.02em' }}
                  >
                    {event.title}
                  </h3>
                  <p className="mb-4 line-clamp-2 text-xs text-white/50">{event.description}</p>

                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-xs text-white/40">
                      <Calendar size={12} />
                      <span>
                        {new Date(event.event_date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-white/40">
                      <MapPin size={12} />
                      <span>{event.venue}</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-white/40">
                        <Users size={12} />
                        <span>{event.registered}/{event.capacity} registered</span>
                      </div>
                      <div
                        className="h-1.5 overflow-hidden rounded-full"
                        style={{ width: 80, background: 'rgba(255,255,255,0.08)' }}
                      >
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(100, (event.registered / event.capacity) * 100)}%`,
                            background: 'linear-gradient(90deg, #0ea5e9, #06b6d4)',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={goPrev}
        className="absolute left-4 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full transition-all duration-200 hover:scale-110 active:scale-95"
        style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))',
          border: '1px solid rgba(255,255,255,0.12)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <ChevronLeft size={18} className="text-white/70" />
      </button>

      <button
        type="button"
        onClick={goNext}
        className="absolute right-4 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full transition-all duration-200 hover:scale-110 active:scale-95"
        style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))',
          border: '1px solid rgba(255,255,255,0.12)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <ChevronRight size={18} className="text-white/70" />
      </button>

      <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 gap-2">
        {items.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setActive(i)}
            className="rounded-full transition-all duration-300"
            style={{
              width: i === active ? 24 : 6,
              height: 6,
              background: i === active ? '#0ea5e9' : 'rgba(255,255,255,0.2)',
            }}
          />
        ))}
      </div>
    </div>
  );
}

const DEMO_EVENTS: Event[] = [
  {
    id: '1',
    title: 'TechFest 2025',
    description: 'Annual technology festival featuring hackathons, workshops, and tech talks from industry leaders.',
    venue: 'Open Auditorium',
    event_date: new Date(Date.now() + 7 * 86400000).toISOString(),
    capacity: 500,
    registered: 312,
    image_url: CARD_IMAGES[0],
    tags: ['Tech', 'Hackathon'],
    organizer_id: '',
    created_at: '',
  },
  {
    id: '2',
    title: 'Cultural Night 2025',
    description: 'A spectacular evening of performances, art, and cultural exchange from students across all departments.',
    venue: 'Main Auditorium',
    event_date: new Date(Date.now() + 14 * 86400000).toISOString(),
    capacity: 300,
    registered: 289,
    image_url: CARD_IMAGES[1],
    tags: ['Culture', 'Music'],
    organizer_id: '',
    created_at: '',
  },
  {
    id: '3',
    title: 'Research Symposium',
    description: 'Presenting cutting-edge research from postgraduate students and faculty across disciplines.',
    venue: 'Seminar Hall 3',
    event_date: new Date(Date.now() + 21 * 86400000).toISOString(),
    capacity: 80,
    registered: 45,
    image_url: CARD_IMAGES[2],
    tags: ['Research', 'Academic'],
    organizer_id: '',
    created_at: '',
  },
  {
    id: '4',
    title: 'Startup Pitch Night',
    description: 'Students pitch their startup ideas to a panel of investors and mentors for funding and mentorship.',
    venue: 'Innovation Lab',
    event_date: new Date(Date.now() + 28 * 86400000).toISOString(),
    capacity: 100,
    registered: 67,
    image_url: CARD_IMAGES[3],
    tags: ['Startup', 'Business'],
    organizer_id: '',
    created_at: '',
  },
  {
    id: '5',
    title: 'Sports Carnival',
    description: 'Inter-department sports tournament spanning 5 days with over 12 sports categories.',
    venue: 'Sports Complex',
    event_date: new Date(Date.now() + 35 * 86400000).toISOString(),
    capacity: 200,
    registered: 180,
    image_url: CARD_IMAGES[4],
    tags: ['Sports', 'Tournament'],
    organizer_id: '',
    created_at: '',
  },
];
