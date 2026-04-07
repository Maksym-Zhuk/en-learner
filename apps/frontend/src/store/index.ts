import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AppStore {
  darkMode: boolean;
  toggleDarkMode: () => void;
  setDarkMode: (v: boolean) => void;

  // Active review session
  activeSessionId: string | null;
  setActiveSessionId: (id: string | null) => void;

  // Quick search query (persisted across navigation)
  lastSearchQuery: string;
  setLastSearchQuery: (q: string) => void;
}

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      darkMode: false,
      toggleDarkMode: () => set((s) => ({ darkMode: !s.darkMode })),
      setDarkMode: (v) => set({ darkMode: v }),

      activeSessionId: null,
      setActiveSessionId: (id) => set({ activeSessionId: id }),

      lastSearchQuery: "",
      setLastSearchQuery: (q) => set({ lastSearchQuery: q }),
    }),
    {
      name: "en-learner-store",
      partialize: (s) => ({ darkMode: s.darkMode, lastSearchQuery: s.lastSearchQuery }),
    }
  )
);
