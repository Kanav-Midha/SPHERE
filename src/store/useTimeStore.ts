import { create } from 'zustand';

interface TimeState {
  serverTime: Date | null;
  offset: number;
  syncTime: () => Promise<void>;
  getCurrentUTC: () => Date;
}

export const useTimeStore = create<TimeState>((set, get) => ({
  serverTime: null,
  offset: 0,

  syncTime: async () => {
    try {
      const localBefore = Date.now();
      const res = await fetch('https://worldtimeapi.org/api/timezone/UTC');
      const localAfter = Date.now();
      if (res.ok) {
        const data = await res.json();
        const serverMs = new Date(data.utc_datetime).getTime();
        const roundTrip = (localAfter - localBefore) / 2;
        const offset = serverMs - (localBefore + roundTrip);
        set({ serverTime: new Date(serverMs), offset });
      }
    } catch {
      set({ offset: 0 });
    }
  },

  getCurrentUTC: () => {
    const { offset } = get();
    return new Date(Date.now() + offset);
  },
}));
