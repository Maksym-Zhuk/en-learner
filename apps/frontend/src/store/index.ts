import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthMode, AuthSession, ConnectivityMode } from "@/types";

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

  connectivityMode: ConnectivityMode;
  setConnectivityMode: (mode: ConnectivityMode) => void;

  authMode: AuthMode;
  authSession: AuthSession | null;
  localProfileName: string;
  setGuestMode: (profileName: string) => void;
  setRemoteSession: (session: AuthSession) => void;
  clearAuthSession: () => void;

  runtimeReady: boolean;
  setRuntimeReady: (ready: boolean) => void;
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

      connectivityMode: "auto",
      setConnectivityMode: (mode) => set({ connectivityMode: mode }),

      authMode: "none",
      authSession: null,
      localProfileName: "Local user",
      setGuestMode: (profileName) =>
        set({
          authMode: "guest",
          authSession: null,
          localProfileName: profileName.trim() || "Local user",
        }),
      setRemoteSession: (session) =>
        set({
          authMode: "remote",
          authSession: session,
          localProfileName: session.user.display_name,
        }),
      clearAuthSession: () =>
        set({
          authMode: "none",
          authSession: null,
        }),

      runtimeReady: false,
      setRuntimeReady: (ready) => set({ runtimeReady: ready }),
    }),
    {
      name: "en-learner-store",
      partialize: (s) => ({
        darkMode: s.darkMode,
        lastSearchQuery: s.lastSearchQuery,
        connectivityMode: s.connectivityMode,
        authMode: s.authMode,
        authSession: s.authSession,
        localProfileName: s.localProfileName,
      }),
    }
  )
);
