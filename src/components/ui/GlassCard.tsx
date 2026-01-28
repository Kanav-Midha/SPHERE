import { motion, HTMLMotionProps } from 'framer-motion';
import { ReactNode } from 'react';

interface GlassCardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children: ReactNode;
  glow?: boolean;
  glowColor?: string;
  padding?: string;
}

export default function GlassCard({
  children,
  glow = false,
  glowColor = 'rgba(198,127,87,0.14)',
  padding = 'p-6',
  className = '',
  ...rest
}: GlassCardProps) {
  return (
    <motion.div
      className={`glass premium-surface rounded-[28px] ${padding} ${className}`}
      style={{
        boxShadow: glow
          ? `var(--shadow-deep), 0 0 0 1px rgba(255,255,255,0.03), 0 0 42px ${glowColor}`
          : 'var(--shadow-deep), inset 0 1px 0 rgba(255,255,255,0.04)',
        ...rest.style,
      }}
      {...rest}
    >
      <div className="relative z-[1]">{children}</div>
    </motion.div>
  );
}
