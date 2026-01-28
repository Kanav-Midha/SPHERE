import { useRef, ReactNode } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';

interface MagneticButtonProps {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  variant?: 'primary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export default function MagneticButton({
  children,
  onClick,
  className = '',
  disabled = false,
  type = 'button',
  variant = 'primary',
  size = 'md',
}: MagneticButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 200, damping: 18 });
  const springY = useSpring(y, { stiffness: 200, damping: 18 });

  function handleMouseMove(e: React.MouseEvent) {
    if (!ref.current || disabled) return;
    const rect = ref.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    x.set((e.clientX - cx) * 0.22);
    y.set((e.clientY - cy) * 0.22);
  }

  function handleMouseLeave() {
    x.set(0);
    y.set(0);
  }

  const variantStyles: Record<string, React.CSSProperties> = {
    primary: {
      background: 'linear-gradient(135deg, #e6d3ba 0%, #c9895e 52%, #8e5b4a 100%)',
      color: '#171313',
      border: '1px solid rgba(255,248,240,0.24)',
      boxShadow: '0 18px 48px rgba(201,137,94,0.22), inset 0 1px 0 rgba(255,255,255,0.28)',
    },
    ghost: {
      background: 'linear-gradient(180deg, rgba(255,248,240,0.07), rgba(255,248,240,0.04))',
      color: 'rgba(245,239,230,0.92)',
      border: '1px solid rgba(255,248,240,0.12)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
    },
    danger: {
      background: 'linear-gradient(135deg, #fb7185 0%, #ef4444 45%, #dc2626 100%)',
      color: '#ffffff',
      border: '1px solid rgba(255,255,255,0.14)',
      boxShadow: '0 18px 44px rgba(239,68,68,0.24), inset 0 1px 0 rgba(255,255,255,0.2)',
    },
  };

  const sizeStyles: Record<string, string> = {
    sm: 'px-4 py-2.5 text-sm',
    md: 'px-6 py-3.5 text-sm',
    lg: 'px-8 py-4.5 text-base',
  };

  return (
    <motion.button
      ref={ref}
      type={type}
      onClick={onClick}
      disabled={disabled}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ x: springX, y: springY, ...variantStyles[variant] }}
      whileTap={{ scale: 0.95 }}
      whileHover={{ scale: 1.03 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={`relative overflow-hidden font-semibold rounded-2xl tracking-tight cursor-pointer select-none
        transition-opacity duration-200 ${disabled ? 'opacity-40 cursor-not-allowed' : ''}
        ${sizeStyles[size]} ${className}`}
    >
      <span
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background: 'linear-gradient(120deg, rgba(255,255,255,0.18), transparent 32%, transparent 68%, rgba(255,255,255,0.06))',
        }}
      />
      <span className="relative z-[1]">{children}</span>
    </motion.button>
  );
}
