import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { MapPin } from 'lucide-react';
import GrainOverlay from '../core/GrainOverlay';
import { CAMPUS_IMAGE } from '../../lib/campusVisuals';

gsap.registerPlugin(ScrollTrigger);

interface HeroImmersiveProps {
  eventCount: number;
  activeMode: 'events' | 'rooms' | null;
  nextEventTitle?: string;
  onEnterEvents: () => void;
  onEnterRooms: () => void;
}

export default function HeroImmersive({
  eventCount: _eventCount,
  activeMode: _activeMode,
  nextEventTitle: _nextEventTitle,
  onEnterEvents: _onEnterEvents,
  onEnterRooms: _onEnterRooms,
}: HeroImmersiveProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!rootRef.current) return;

    const ctx = gsap.context(() => {
      gsap.to('[data-parallax="orb"]', {
        yPercent: -16,
        ease: 'none',
        scrollTrigger: {
          trigger: rootRef.current,
          scrub: true,
          start: 'top top',
          end: 'bottom top',
        },
      });

      gsap.to('[data-parallax="copy"]', {
        yPercent: -8,
        ease: 'none',
        scrollTrigger: {
          trigger: rootRef.current,
          scrub: true,
          start: 'top top',
          end: 'bottom top',
        },
      });
    }, rootRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={rootRef} className="relative overflow-hidden rounded-[40px] border border-white/8 bg-white/[0.02] px-4 py-5 md:px-8 md:py-6">
      <GrainOverlay opacity={0.22} />
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 12% 18%, rgba(220,196,163,0.14), transparent 22%), radial-gradient(circle at 84% 16%, rgba(127,79,86,0.16), transparent 20%), radial-gradient(circle at 56% 88%, rgba(142,160,125,0.12), transparent 22%)',
        }}
      />

      <div className="relative grid items-center gap-6 lg:grid-cols-[1fr_0.92fr]">
        <div data-parallax="copy" className="relative z-10 max-w-3xl">
          <h1 className="max-w-4xl text-5xl font-bold leading-[0.9] text-white md:text-7xl">
            BITS Goa
          </h1>
        </div>

        <div data-parallax="orb" className="relative h-[320px] lg:h-[420px]">
          <div className="absolute inset-0 overflow-hidden rounded-[40px] border border-white/10 bg-white/[0.03] backdrop-blur-xl">
            <div
              className="absolute inset-0 scale-[1.03]"
              style={{
                backgroundImage: `linear-gradient(180deg, rgba(7,7,7,0.08), rgba(7,7,7,0.66)), linear-gradient(135deg, rgba(216,190,158,0.12), transparent 40%), url(${CAMPUS_IMAGE})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(180deg, transparent 24%, rgba(8,8,9,0.24) 48%, rgba(8,8,9,0.78) 100%)',
              }}
            />
          </div>

          <div className="absolute bottom-5 right-2 z-10 max-w-[240px] rounded-[26px] border border-white/12 bg-[#171314]/62 px-4 py-3 backdrop-blur-2xl">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-[#dcc4a3]/16 bg-[#dcc4a3]/10">
                <MapPin size={15} className="text-[#e6d3ba]" />
              </div>
              <div>
                <p className="text-white text-sm font-semibold">BITS Pilani, Goa Campus</p>
                <p className="text-white/45 text-xs mt-1">Campus events and spaces.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
