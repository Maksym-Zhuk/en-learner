import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import Dashboard from "@/pages/Dashboard";
import Search from "@/pages/Search";
import WordDetails from "@/pages/WordDetails";
import SavedWords from "@/pages/SavedWords";
import Sets from "@/pages/Sets";
import SetDetails from "@/pages/SetDetails";
import Review from "@/pages/Review";
import History from "@/pages/History";
import Settings from "@/pages/Settings";
import { useAppStore } from "@/store";
import { useEffect } from "react";

export default function App() {
  const darkMode = useAppStore((s) => s.darkMode);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

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
    </Routes>
  );
}
