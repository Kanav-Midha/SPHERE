import { motion } from 'framer-motion';
import { LayoutDashboard, Users, LogOut, Hexagon } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';

interface NavBarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

export default function NavBar({ currentPage, onNavigate }: NavBarProps) {
  const { profile, signOut } = useAuthStore();

  const navItems = [
    { id: 'discovery', label: 'Discovery', icon: LayoutDashboard, roles: ['student', 'admin'] },
    { id: 'volunteer', label: 'Volunteer', icon: Users, roles: ['student', 'admin'] },
  ];

  const visibleItems = navItems.filter(
    (item) => profile && item.roles.includes(profile.role)
  );

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="fixed top-0 left-0 right-0 z-50 px-4 py-4 md:px-6"
    >
      <div
        className="mx-auto flex max-w-7xl items-center justify-between rounded-[26px] px-4 py-3 md:px-6"
        style={{
          background: 'linear-gradient(180deg, rgba(26,22,21,0.82), rgba(15,15,16,0.74))',
          backdropFilter: 'blur(22px)',
          border: '1px solid rgba(255,248,240,0.08)',
          boxShadow: 'var(--shadow-deep)',
        }}
      >
        <button
          onClick={() => onNavigate('discovery')}
          className="flex items-center gap-3 group"
        >
          <div
            className="flex h-10 w-10 items-center justify-center rounded-2xl"
            style={{ background: 'linear-gradient(135deg, #e4c7a0, #b46f51)', boxShadow: '0 14px 30px rgba(180,111,81,0.24)' }}
          >
            <Hexagon size={18} className="text-white" fill="white" />
          </div>
          <div className="text-left">
            <span
              className="block text-white font-bold text-lg tracking-tight"
              style={{ letterSpacing: '-0.04em' }}
            >
              SPHERE
            </span>
            <span className="hidden text-[11px] uppercase tracking-[0.22em] text-white/30 md:block">
              BITS Goa Campus Platform
            </span>
          </div>
        </button>

        <div className="hidden items-center gap-2 rounded-2xl border border-white/8 bg-white/5 p-1.5 md:flex">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <motion.button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                whileTap={{ scale: 0.96 }}
                className="relative flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition-colors duration-200"
                style={{
                  color: isActive ? '#fff6ee' : 'rgba(255,243,232,0.48)',
                  background: isActive ? 'linear-gradient(135deg, rgba(220,196,163,0.16), rgba(127,79,86,0.18))' : 'transparent',
                  border: isActive ? '1px solid rgba(220,196,163,0.18)' : '1px solid transparent',
                }}
              >
                <Icon size={15} />
                <span>{item.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute inset-0 rounded-2xl"
                    style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07)' }}
                  />
                )}
              </motion.button>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          {profile && (
            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <p className="text-white text-sm font-semibold leading-none">{profile.full_name || profile.email.split('@')[0]}</p>
                <p className="text-white/35 text-[11px] mt-1 capitalize tracking-[0.16em]">{profile.role}</p>
              </div>
              <div
                className="flex h-10 w-10 items-center justify-center rounded-2xl text-white font-bold text-sm"
                style={{ background: 'linear-gradient(135deg, rgba(228,199,160,0.26), rgba(127,79,86,0.88))', border: '1px solid rgba(255,255,255,0.12)' }}
              >
                {(profile.full_name || profile.email)[0].toUpperCase()}
              </div>
            </div>
          )}
          <motion.button
            onClick={signOut}
            whileTap={{ scale: 0.95 }}
            className="flex h-10 w-10 items-center justify-center rounded-2xl text-white/45 hover:text-white/85 transition-colors"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <LogOut size={14} />
          </motion.button>
        </div>
      </div>
    </motion.nav>
  );
}
