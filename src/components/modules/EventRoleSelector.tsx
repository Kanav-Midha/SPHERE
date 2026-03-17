import { motion } from 'framer-motion';
import { Crown, GraduationCap, ScanLine } from 'lucide-react';
import GlassCard from '../ui/GlassCard';

export type EventWorkspaceMode = 'customer' | 'admin' | 'operator';

interface EventRoleSelectorProps {
  mode: EventWorkspaceMode;
  onChange: (mode: EventWorkspaceMode) => void;
  canAccessAdmin: boolean;
}

const options = [
  {
    id: 'customer' as const,
    title: 'Customer',
    subtitle: 'Browse events, claim tickets, and keep your wallet ready for the gate.',
    icon: GraduationCap,
    accent: '#38bdf8',
  },
  {
    id: 'admin' as const,
    title: 'Admin',
    subtitle: 'Create events, generate operator keys, and watch live scan analytics.',
    icon: Crown,
    accent: '#f59e0b',
  },
  {
    id: 'operator' as const,
    title: 'Operator',
    subtitle: 'Enter the 12-character event key and launch the scanner with zero distractions.',
    icon: ScanLine,
    accent: '#34d399',
  },
];

export default function EventRoleSelector({ mode, onChange, canAccessAdmin }: EventRoleSelectorProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {options.map((option, index) => {
        const Icon = option.icon;
        const isActive = mode === option.id;
        const isDisabled = option.id === 'admin' && !canAccessAdmin;

        return (
          <motion.button
            key={option.id}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, duration: 0.45 }}
            onClick={() => !isDisabled && onChange(option.id)}
            className="text-left"
            disabled={isDisabled}
          >
            <GlassCard
              className={`h-full transition-opacity duration-200 ${isDisabled ? 'opacity-50' : ''}`}
              glow={isActive}
              glowColor={`${option.accent}33`}
              style={{
                border: isActive ? `1px solid ${option.accent}55` : '1px solid rgba(255,255,255,0.08)',
                background: isActive ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.04)',
              }}
            >
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: `${option.accent}20`, border: `1px solid ${option.accent}35` }}
              >
                <Icon size={20} style={{ color: option.accent }} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-white text-lg font-semibold">{option.title}</p>
                {isActive && (
                  <span className="text-[10px] uppercase tracking-[0.2em]" style={{ color: option.accent }}>
                    Active
                  </span>
                )}
              </div>
              <p className="text-white/45 text-sm mt-2 leading-relaxed">
                {isDisabled ? 'Only event heads using BITS admin access can open this workspace.' : option.subtitle}
              </p>
            </GlassCard>
          </motion.button>
        );
      })}
    </div>
  );
}
