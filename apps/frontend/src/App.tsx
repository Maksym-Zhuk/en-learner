import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import Dashboard from "@/pages/Dashboard";
import Search from "@/pages/Search";
import WordDetails from "@/pages/WordDetails";
import SavedWords from "@/pages/SavedWords";
import Sets from "@/pages/Sets";
import SetDetails from "@/pages/SetDetails";
import Review from "@/pages/Review";
import PublicTest from "@/pages/PublicTest";
import History from "@/pages/History";
import Settings from "@/pages/Settings";
import Auth from "@/pages/Auth";
import { useAppStore } from "@/store";
import { settingsApi } from "@/api/settings";
import { nativeDesktopApi } from "@/native/desktop";
import { applyNativeRuntime, markRuntimeReady } from "@/lib/runtime-state";
import { FullPageSpinner } from "@/components/ui";

export default function App() {
  const darkMode = useAppStore((s) => s.darkMode);
  const setDarkMode = useAppStore((s) => s.setDarkMode);
  const runtimeReady = useAppStore((s) => s.runtimeReady);
  const nativeBridgeAvailable = nativeDesktopApi.isAvailable();

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: settingsApi.get,
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const {
    data: nativeRuntime,
    isError: nativeRuntimeError,
  } = useQuery({
    queryKey: ["native-runtime"],
    queryFn: nativeDesktopApi.getRuntimeInfo,
    enabled: nativeBridgeAvailable,
    staleTime: 60_000,
    retry: 0,
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  useEffect(() => {
    if (typeof settings?.dark_mode === "boolean" && settings.dark_mode !== darkMode) {
      setDarkMode(settings.dark_mode);
    }
  }, [settings?.dark_mode, darkMode, setDarkMode]);

  useEffect(() => {
    if (!nativeBridgeAvailable) {
      markRuntimeReady();
      return;
    }

    if (!nativeRuntime) {
      return;
    }

    window.__EN_LEARNER_RUNTIME_CONFIG = {
      ...(window.__EN_LEARNER_RUNTIME_CONFIG ?? {}),
      apiBaseUrl: nativeRuntime.backendUrl,
    };
    applyNativeRuntime(nativeRuntime);
  }, [nativeBridgeAvailable, nativeRuntime]);

  useEffect(() => {
    if (nativeRuntimeError) {
      markRuntimeReady();
    }
  }, [nativeRuntimeError]);

  if (nativeBridgeAvailable && !runtimeReady) {
    return <FullPageSpinner />;
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="search" element={<Search />} />
        <Route path="words/:id" element={<WordDetails />} />
        <Route path="saved" element={<SavedWords />} />
        <Route path="sets" element={<Sets />} />
        <Route path="sets/:id" element={<SetDetails />} />
        <Route path="history" element={<History />} />
        <Route path="auth" element={<Auth />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      {/* Review is full-screen, no sidebar */}
      <Route path="review" element={<Review />} />
      <Route path="public/tests/:token" element={<PublicTest />} />
    </Routes>
  );
}
