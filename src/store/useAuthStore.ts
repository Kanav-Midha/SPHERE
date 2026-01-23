import { create } from 'zustand';
import { getRoleFromEmail, supabase, Profile } from '../lib/supabase';

interface AuthState {
  profile: Profile | null;
  loading: boolean;
  initialized: boolean;
  setProfile: (profile: Profile | null) => void;
  setLoading: (loading: boolean) => void;
  signOut: () => Promise<void>;
  fetchProfile: (userId: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  profile: null,
  loading: true,
  initialized: false,

  setProfile: (profile) => set({ profile }),
  setLoading: (loading) => set({ loading }),

  fetchProfile: async (userId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    const email = user?.email || '';
    const fullName = user?.user_metadata?.full_name || user?.user_metadata?.name || email.split('@')[0] || 'User';
    const fallbackProfile = user ? {
      id: userId,
      email,
      full_name: fullName,
      role: getRoleFromEmail(email),
      avatar_url: '',
      created_at: new Date().toISOString(),
    } : null;

    let { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Failed to fetch profile', error);
    }

    if (!data && user) {
      const { data: inserted, error: upsertError } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          email,
          full_name: fullName,
          role: getRoleFromEmail(email),
        })
        .select()
        .maybeSingle();

      if (upsertError) {
        console.error('Failed to create profile', upsertError);
      }

      data = inserted;
    }

    set({ profile: data || fallbackProfile, loading: false, initialized: true });
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ profile: null, initialized: true });
  },
}));
