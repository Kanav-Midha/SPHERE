import { motion } from 'framer-motion';
import { Building2, CalendarRange, ChevronRight } from 'lucide-react';
import GlassCard from '../ui/GlassCard';

type DiscoveryMode = 'events' | 'rooms' | null;

interface DiscoveryModeSelectorProps {
  mode: DiscoveryMode;
  onChange: (mode: Exclude<DiscoveryMode, null>) => void;
}

const modes = [
  {
    id: 'events' as const,
    title: 'Events',
    subtitle: 'Browse what is happening next, claim passes, and move into operator workflows when needed.',
    accent: '#c67f57',
    icon: CalendarRange,
  },
  {
    id: 'rooms' as const,
    title: 'Rooms',
    subtitle: 'Open the room browser for study spaces, availability, and booking requests.',
    accent: '#8ea07d',
    icon: Building2,
  },
];

export default function DiscoveryModeSelector({
  mode,
  onChange,
}: DiscoveryModeSelectorProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {modes.map((item, index) => {
        const Icon = item.icon;
        const isActive = mode === item.id;

        return (
          <motion.button
            key={item.id}
            type="button"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.08, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            whileTap={{ scale: 0.985 }}
            onClick={() => onChange(item.id)}
            className="text-left"
          >
            <GlassCard
              glow={isActive}
              glowColor={`${item.accent}30`}
              className="h-full relative overflow-hidden p-0"
              style={{
                border: isActive
                  ? `1px solid ${item.accent}55`
                  : '1px solid rgba(255,255,255,0.09)',
                background: isActive
                  ? `linear-gradient(135deg, ${item.accent}18, rgba(255,255,255,0.03) 44%, rgba(255,255,255,0.01))`
                  : 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))',
              }}
            >
                <div className="relative overflow-hidden rounded-[28px] p-7">
                  <div
                    className="absolute inset-0 opacity-80"
                    style={{
                    background: `radial-gradient(circle at top left, ${item.accent}30, transparent 30%), radial-gradient(circle at bottom right, ${item.accent}14, transparent 25%)`,
                  }}
                />
                <div className="relative flex items-start justify-between gap-4">
                  <div className="space-y-5">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-14 h-14 rounded-[20px] flex items-center justify-center"
                        style={{
                          background: `${item.accent}18`,
                          border: `1px solid ${item.accent}35`,
                          boxShadow: `0 12px 28px ${item.accent}18`,
                        }}
                      >
                        <Icon size={21} style={{ color: item.accent }} />
                      </div>
                      <span
                        className="text-[11px] font-bold uppercase tracking-[0.24em]"
                        style={{ color: isActive ? item.accent : 'rgba(255,255,255,0.35)' }}
                      >
                        {isActive ? 'Open Now' : 'Section'}
                      </span>
                    </div>
                    <div>
                      <p className="text-white text-2xl font-bold">
                        {item.title}
                      </p>
                      <p className="text-white/50 text-sm mt-3 max-w-xl leading-relaxed">{item.subtitle}</p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {(item.id === 'events'
                        ? ['Pass wallet', 'Operator scan', 'Admin control']
                        : ['Availability', 'Room browser', 'Approval flow']
                      ).map((feature) => (
                        <span
                          key={feature}
                          className="rounded-full px-3 py-1.5 text-[11px] font-semibold"
                          style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.62)' }}
                        >
                          {feature}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
                      style={{
                        background: isActive ? `${item.accent}22` : 'rgba(255,255,255,0.05)',
                        border: `1px solid ${isActive ? `${item.accent}30` : 'rgba(255,255,255,0.08)'}`,
                      }}
                    >
                      <ChevronRight
                        size={18}
                        style={{ color: isActive ? item.accent : 'rgba(255,255,255,0.45)' }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </GlassCard>
          </motion.button>
        );
      })}
    </div>
  );
}
