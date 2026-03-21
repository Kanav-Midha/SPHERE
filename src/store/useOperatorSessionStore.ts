import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { OperatorSession } from '../lib/supabase';

interface OperatorSessionState {
  session: OperatorSession | null;
  setSession: (session: OperatorSession) => void;
  clearSession: () => void;
}

export const useOperatorSessionStore = create<OperatorSessionState>()(
  persist(
    (set) => ({
      session: null,
      setSession: (session) => set({ session }),
      clearSession: () => set({ session: null }),
    }),
    {
      name: 'sphere-operator-session',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);
