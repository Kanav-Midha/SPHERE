import { useState } from 'react';
import { ArrowRight, Hexagon } from 'lucide-react';
import { allowedGoogleDomain, supabase } from '../lib/supabase';
import { useToastStore } from '../store/useToastStore';
import GrainOverlay from '../components/core/GrainOverlay';
import { CAMPUS_IMAGE } from '../lib/campusVisuals';

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.2-.9 2.2-1.8 2.9l3 2.3c1.8-1.7 2.8-4.1 2.8-6.9 0-.7-.1-1.4-.2-2H12Z" />
      <path fill="#34A853" d="M12 21.5c2.6 0 4.7-.8 6.3-2.2l-3-2.3c-.8.5-1.9.9-3.3.9-2.5 0-4.7-1.7-5.5-4l-3.1 2.4c1.6 3.1 4.8 5.2 8.6 5.2Z" />
      <path fill="#4A90E2" d="M6.5 13.9c-.2-.5-.3-1.2-.3-1.9s.1-1.3.3-1.9l-3.1-2.4A9.5 9.5 0 0 0 2.4 12c0 1.5.4 2.9 1 4.2l3.1-2.3Z" />
      <path fill="#FBBC05" d="M12 6.1c1.4 0 2.6.5 3.6 1.4l2.7-2.7C16.7 3.3 14.6 2.5 12 2.5c-3.8 0-7 2.1-8.6 5.2l3.1 2.4c.8-2.4 3-4 5.5-4Z" />
    </svg>
  );
}

export default function Login() {
  const { addToast } = useToastStore();
  const [loading, setLoading] = useState(false);

  async function handleGoogleSignIn() {
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          scopes: 'email profile',
          queryParams: {
            hd: allowedGoogleDomain,
            prompt: 'select_account',
          },
        },
      });

      if (error) {
        addToast({ type: 'error', title: 'Google Sign-In Failed', message: error.message });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-10 md:px-8">
      <GrainOverlay opacity={0.18} />
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 12% 20%, rgba(220,196,163,0.14), transparent 20%), radial-gradient(circle at 86% 16%, rgba(127,79,86,0.12), transparent 22%), radial-gradient(circle at 56% 84%, rgba(142,160,125,0.1), transparent 24%)',
        }}
      />

      <div className="relative z-10 mx-auto grid min-h-[88vh] max-w-7xl items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="max-w-3xl">
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-[22px]"
                style={{ background: 'linear-gradient(135deg, #e4c7a0, #b46f51)', boxShadow: '0 24px 60px rgba(180,111,81,0.24)' }}
              >
                <Hexagon size={24} className="text-white" fill="white" />
              </div>
              <div>
                <p className="text-white text-2xl font-bold">SPHERE</p>
                <p className="text-white/35 text-sm">Campus events and spaces, made for BITS Goa</p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative">
          <div className="rounded-[40px] border border-white/8 bg-white/[0.03] p-5 shadow-[0_30px_80px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
            <div className="overflow-hidden rounded-[34px] border border-white/8">
              <div
                className="relative min-h-[320px] md:min-h-[380px]"
                style={{
                  backgroundImage: `linear-gradient(180deg, rgba(12,12,13,0.1), rgba(12,12,13,0.68)), linear-gradient(135deg, rgba(220,196,163,0.08), transparent 42%), url(${CAMPUS_IMAGE})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              >
                <div className="absolute inset-x-6 top-6 flex items-start justify-between gap-4">
                  <div className="rounded-full border border-white/12 bg-[#171314]/55 px-4 py-2 backdrop-blur-xl">
                    <p className="text-[10px] uppercase tracking-[0.26em] text-white/48">BITS Goa</p>
                  </div>
                  <div className="rounded-full border border-white/12 bg-[#171314]/55 px-4 py-2 backdrop-blur-xl">
                    <p className="text-[10px] uppercase tracking-[0.26em] text-white/48">Student access</p>
                  </div>
                </div>

                <div className="absolute inset-x-6 bottom-6">
                  <div className="max-w-[320px] rounded-[28px] border border-white/12 bg-[#171314]/64 px-5 py-4 shadow-[0_20px_50px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
                    <p className="text-white text-lg font-semibold">BITS Pilani, Goa Campus</p>
                    <p className="mt-2 text-sm leading-6 text-white/56">
                      One place for events, rooms, and campus workflows.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-[30px] border border-white/10 bg-[#121111]/68 p-6 backdrop-blur-2xl">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <p className="text-white text-2xl font-semibold">Continue with BITS Google</p>
                  <p className="text-white/45 text-sm mt-2 leading-relaxed">
                    Access is reserved for students and staff using <span style={{ color: '#dcc4a3' }} className="font-medium">@{allowedGoogleDomain}</span>.
                  </p>
                </div>
                <div className="hidden rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 md:block">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-white/34">Sign-in</p>
                  <p className="mt-1 text-sm text-white/64">Google OAuth</p>
                </div>
              </div>

              <button
                type="button"
                disabled={loading}
                onClick={handleGoogleSignIn}
                className="flex min-h-[68px] w-full items-center justify-center rounded-[22px] px-6 py-5 text-lg font-semibold text-[#1a1715] transition-colors disabled:cursor-not-allowed disabled:opacity-70"
                style={{
                  background: 'linear-gradient(135deg, #e6cfaa, #d49c73)',
                  boxShadow: '0 18px 45px rgba(198,127,87,0.24)',
                }}
              >
                <span className="flex items-center gap-3">
                  <GoogleMark />
                  {loading ? 'Redirecting to Google...' : 'Continue With Google'}
                  {!loading && <ArrowRight size={16} />}
                </span>
              </button>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-white/32">Access</p>
                  <p className="mt-2 text-sm text-white/62">Only the BITS Goa domain can enter this platform.</p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-white/32">Support</p>
                  <p className="mt-2 text-sm text-white/62">If login fails, verify Google auth is enabled in Supabase.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
