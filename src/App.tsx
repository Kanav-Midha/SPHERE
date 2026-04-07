import { useEffect, useState } from 'react';
import { allowedGoogleDomain, isValidDomain, supabase } from './lib/supabase';
import { useAuthStore } from './store/useAuthStore';
import { useOperatorSessionStore } from './store/useOperatorSessionStore';
import { useToastStore } from './store/useToastStore';
import { useTimeStore } from './store/useTimeStore';
import AmbientBackground from './components/3d/AmbientBackground';
import NavBar from './components/ui/NavBar';
import ToastContainer from './components/ui/Toast';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Scanner from './pages/Scanner';
import VolunteerPage from './pages/VolunteerPage';
import { motion, AnimatePresence } from 'framer-motion';
import { Hexagon } from 'lucide-react';

function getPageFromPath(pathname: string) {
  if (pathname.startsWith('/scanner')) return 'scanner';
  if (pathname.startsWith('/volunteer')) return 'volunteer';
  return 'discovery';
}

function getPathFromPage(page: string) {
  switch (page) {
    case 'scanner':
      return '/scanner';
    case 'volunteer':
      return '/volunteer';
    default:
      return '/';
  }
}

function LoadingScreen() {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: '#050505' }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center gap-4"
      >
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
        className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{
          background: 'linear-gradient(135deg, #e4c7a0, #b46f51)',
          boxShadow: '0 20px 40px rgba(180,111,81,0.28)',
        }}
      >
        <Hexagon size={28} className="text-white" fill="white" />
      </motion.div>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: 120 }}
          transition={{ duration: 1.2, ease: 'easeInOut' }}
          className="h-0.5 rounded-full"
          style={{ background: 'linear-gradient(90deg, #e4c7a0, #b46f51)' }}
        />
      </motion.div>
    </div>
  );
}

export default function App() {
  const { profile, loading, initialized, setLoading, fetchProfile } = useAuthStore();
  const { session: operatorSession } = useOperatorSessionStore();
  const { addToast } = useToastStore();
  const { syncTime } = useTimeStore();
  const [currentPage, setCurrentPage] = useState(() => getPageFromPath(window.location.pathname));

  const navigateTo = (page: string, options?: { replace?: boolean }) => {
    const nextPath = getPathFromPage(page);
    if (window.location.pathname !== nextPath) {
      if (options?.replace) {
        window.history.replaceState({ page }, '', nextPath);
      } else {
        window.history.pushState({ page }, '', nextPath);
      }
    }
    setCurrentPage(page);
  };

  useEffect(() => {
    syncTime();

    const handleAuthorizedSession = async (email: string | undefined, userId: string) => {
      if (!email || !isValidDomain(email)) {
        await supabase.auth.signOut();
        setLoading(false);
        useAuthStore.setState({ profile: null, initialized: true });
        addToast({
          type: 'error',
          title: 'BITS Goa Account Required',
          message: `Please sign in with your @${allowedGoogleDomain} Google account.`,
        });
        return;
      }

      await fetchProfile(userId);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        if (session?.user) {
          await handleAuthorizedSession(session.user.email, session.user.id);
        } else {
          setLoading(false);
          useAuthStore.setState({ profile: null, initialized: true });
        }
      })();
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        handleAuthorizedSession(session.user.email, session.user.id);
      } else {
        setLoading(false);
        useAuthStore.setState({ initialized: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [addToast, fetchProfile, setLoading, syncTime]);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPage(getPageFromPath(window.location.pathname));
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const pageVariants = {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 },
  };

  const renderPage = () => {
    if (currentPage === 'scanner') {
      return <Scanner onExit={() => navigateTo('discovery')} />;
    }
    if (!profile) return <Login />;
    switch (currentPage) {
      case 'discovery': return <Dashboard onOpenScanner={() => navigateTo('scanner')} />;
      case 'volunteer': return <VolunteerPage />;
      default: return <Dashboard onOpenScanner={() => navigateTo('scanner')} />;
    }
  };

  if (!initialized || loading) return <LoadingScreen />;

  return (
    <div className="relative min-h-screen" style={{ background: '#050505' }}>
      <AmbientBackground />

      {profile && currentPage !== 'scanner' && (
        <NavBar currentPage={currentPage} onNavigate={navigateTo} />
      )}

      <div className="relative z-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPage === 'scanner' ? `scanner-${operatorSession?.eventId || 'locked'}` : profile ? currentPage : 'login'}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            {renderPage()}
          </motion.div>
        </AnimatePresence>
      </div>

      <ToastContainer />
    </div>
  );
}
