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
import { useAppStore } from "@/store";
import { settingsApi } from "@/api/settings";

export default function App() {
  const darkMode = useAppStore((s) => s.darkMode);
  const setDarkMode = useAppStore((s) => s.setDarkMode);

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: settingsApi.get,
    staleTime: 5 * 60_000,
    retry: 1,
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  useEffect(() => {
    if (typeof settings?.dark_mode === "boolean" && settings.dark_mode !== darkMode) {
      setDarkMode(settings.dark_mode);
    }
  }, [settings?.dark_mode, darkMode, setDarkMode]);

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
        <Route path="settings" element={<Settings />} />
      </Route>
      {/* Review is full-screen, no sidebar */}
      <Route path="review" element={<Review />} />
      <Route path="public/tests/:token" element={<PublicTest />} />
    </Routes>
  );
}
