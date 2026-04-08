import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Menu, Moon, Search, ShieldCheck, Sparkles, Sun, UserRound } from "lucide-react";
import toast from "react-hot-toast";
import Sidebar from "./Sidebar";
import { Button } from "@/components/ui";
import { settingsApi } from "@/api/settings";
import { nativeDesktopApi } from "@/native/desktop";
import { useAppStore } from "@/store";
import type { AppSettings } from "@/types";

function getPageMeta(pathname: string) {
  if (pathname.startsWith("/dashboard")) {
    return {
      title: "Dashboard",
      description: "Track your queue, streak, and recent vocabulary activity.",
    };
  }

  if (pathname.startsWith("/search")) {
    return {
      title: "Search",
      description: "Look up a word, inspect details, and save useful entries.",
    };
  }

  if (pathname.startsWith("/saved")) {
    return {
      title: "Saved Words",
      description: "Browse the words you decided to keep and revisit.",
    };
  }

  if (pathname.startsWith("/sets/")) {
    return {
      title: "Set Details",
      description: "Inspect one study set and review its words.",
    };
  }

  if (pathname.startsWith("/sets")) {
    return {
      title: "Study Sets",
      description: "Group vocabulary into focused collections for later review.",
    };
  }

  if (pathname.startsWith("/words/")) {
    return {
      title: "Word Details",
      description: "Check pronunciation, meanings, and learning actions.",
    };
  }

  if (pathname.startsWith("/history")) {
    return {
      title: "History",
      description: "Jump back into recent searches and revisit useful words.",
    };
  }

  if (pathname.startsWith("/auth")) {
    return {
      title: "Account",
      description: "Switch between local guest mode and remote sign-in providers.",
    };
  }

  if (pathname.startsWith("/settings")) {
    return {
      title: "Settings",
      description: "Tune theme, review pacing, and study preferences.",
    };
  }

  return {
    title: "en-learner",
    description: "Desktop vocabulary workspace.",
  };
}

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const darkMode = useAppStore((s) => s.darkMode);
  const setDarkMode = useAppStore((s) => s.setDarkMode);
  const authMode = useAppStore((s) => s.authMode);
  const authSession = useAppStore((s) => s.authSession);
  const localProfileName = useAppStore((s) => s.localProfileName);
  const pageMeta = getPageMeta(location.pathname);
  const showHeaderShortcuts = !location.pathname.startsWith("/dashboard");

  const authLabel = useMemo(() => {
    if (authMode === "remote" && authSession) {
      return authSession.user.display_name;
    }

    if (authMode === "guest") {
      return localProfileName;
    }

    return "Sign in";
  }, [authMode, authSession, localProfileName]);

  const themeMutation = useMutation({
    mutationFn: settingsApi.update,
    onMutate: async (patch: Partial<AppSettings>) => {
      await qc.cancelQueries({ queryKey: ["settings"] });
      const previous = qc.getQueryData<AppSettings>(["settings"]);

      if (previous) {
        qc.setQueryData<AppSettings>(["settings"], { ...previous, ...patch });
      }

      if (typeof patch.dark_mode === "boolean") {
        setDarkMode(patch.dark_mode);
      }

      return { previous };
    },
    onError: (_error, _patch, context) => {
      if (context?.previous) {
        qc.setQueryData(["settings"], context.previous);
        setDarkMode(context.previous.dark_mode);
      }

      toast.error("Failed to update theme");
    },
    onSuccess: (data) => {
      qc.setQueryData(["settings"], data);
      setDarkMode(data.dark_mode);
    },
  });

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const windowTitle = `${pageMeta.title} · en-learner`;
    document.title = windowTitle;
    void nativeDesktopApi.setWindowTitle(windowTitle).catch(() => {});
  }, [pageMeta.title]);

  const toggleTheme = () => {
    if (themeMutation.isPending) {
      return;
    }

    themeMutation.mutate({ dark_mode: !darkMode });
  };

  return (
    <div className="flex h-full overflow-hidden">
      {mobileNavOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-gray-950/40 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      <Sidebar mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-white/60 bg-[rgba(255,250,242,0.76)] backdrop-blur dark:border-white/10 dark:bg-[rgba(8,14,24,0.84)]">
          <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-label="Open navigation"
              onClick={() => setMobileNavOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>

            <div className="min-w-0 flex-1">
              <div className="eyebrow">Learning Workspace</div>
              <div className="mt-1 flex items-center gap-2">
                <p className="truncate font-display text-lg tracking-[-0.03em] text-gray-900 dark:text-gray-100">
                  {pageMeta.title}
                </p>
                <span className="hidden h-1 w-1 rounded-full bg-gray-300 dark:bg-gray-700 sm:block" />
                <p className="hidden truncate text-sm text-gray-500 dark:text-gray-400 sm:block">
                  {pageMeta.description}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
                onClick={toggleTheme}
                disabled={themeMutation.isPending}
              >
                {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>

              <Button
                variant={authMode === "none" ? "secondary" : "soft"}
                size="sm"
                onClick={() => navigate("/auth")}
                className="max-w-[180px]"
              >
                {authMode === "none" ? (
                  <ShieldCheck className="h-4 w-4" />
                ) : (
                  <UserRound className="h-4 w-4" />
                )}
                <span className="truncate">{authLabel}</span>
              </Button>

              {showHeaderShortcuts ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="hidden md:inline-flex"
                    onClick={() => navigate("/search")}
                  >
                    <Search className="h-4 w-4" />
                    Search
                  </Button>
                  <Button size="sm" onClick={() => navigate("/review")}>
                    <Sparkles className="h-4 w-4" />
                    Study now
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
