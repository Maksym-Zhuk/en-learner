import { NavLink, useNavigate } from "react-router-dom";
import {
  BookOpen,
  Brain,
  History,
  Layers,
  LayoutDashboard,
  Search,
  Settings,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "@/components/ui/utils";
import { useAppStore } from "@/store";

const navSections = [
  {
    title: "Learn",
    items: [
      {
        to: "/dashboard",
        icon: LayoutDashboard,
        label: "Dashboard",
        description: "Queue, streak, and study rhythm.",
      },
      {
        to: "/search",
        icon: Search,
        label: "Search",
        description: "Find new words and inspect details.",
      },
    ],
  },
  {
    title: "Library",
    items: [
      {
        to: "/saved",
        icon: BookOpen,
        label: "Saved Words",
        description: "Vocabulary you decided to keep.",
      },
      {
        to: "/sets",
        icon: Layers,
        label: "Study Sets",
        description: "Collections for focused practice.",
      },
    ],
  },
  {
    title: "Support",
    items: [
      {
        to: "/history",
        icon: History,
        label: "History",
        description: "Recent searches and quick return paths.",
      },
    ],
  },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({
  mobileOpen = false,
  onClose,
}: SidebarProps) {
  const navigate = useNavigate();
  const lastSearchQuery = useAppStore((s) => s.lastSearchQuery);

  const openSearch = () => {
    onClose?.();

    if (lastSearchQuery) {
      navigate(`/search?q=${encodeURIComponent(lastSearchQuery)}`);
      return;
    }

    navigate("/search");
  };

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 flex w-80 max-w-[88vw] flex-col overflow-y-auto border-r border-white/50 bg-white/95 backdrop-blur transition-transform dark:border-white/10 dark:bg-gray-950/95 lg:static lg:w-72 lg:max-w-none lg:translate-x-0",
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      )}
    >
      <div className="border-b border-gray-200/80 p-4 dark:border-gray-800/80">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-sm">
              <Brain className="h-5 w-5" />
            </div>
            <div>
              <div className="text-base font-semibold tracking-tight">en-learner</div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Personal vocabulary workspace
              </p>
            </div>
          </div>

          <button
            type="button"
            aria-label="Close navigation"
            className="rounded-xl p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100 lg:hidden"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="panel-muted mt-5 space-y-4">
          <div>
            <div className="eyebrow">Focus Shortcut</div>
            <h2 className="mt-2 text-base font-semibold text-gray-900 dark:text-gray-100">
              Jump back into review
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Open the study queue or continue from your latest search without
              browsing through the app.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                onClose?.();
                navigate("/review");
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-700"
            >
              <Sparkles className="h-4 w-4" />
              Study now
            </button>

            <button
              type="button"
              onClick={openSearch}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <Search className="h-4 w-4" />
              {lastSearchQuery ? `Resume "${truncateLabel(lastSearchQuery)}"` : "Find words"}
            </button>
          </div>
        </div>
      </div>

      <nav className="space-y-6 px-3 py-4">
        {navSections.map((section) => (
          <div key={section.title} className="space-y-2">
            <div className="px-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-400 dark:text-gray-500">
              {section.title}
            </div>

            <div className="space-y-1.5">
              {section.items.map(({ to, icon: Icon, label, description }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={onClose}
                  className={({ isActive }) =>
                    cn(
                      "group flex items-center gap-3 rounded-2xl px-3 py-3 transition-colors",
                      isActive
                        ? "bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-200"
                        : "text-gray-700 hover:bg-gray-100/80 dark:text-gray-300 dark:hover:bg-gray-900"
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <div
                        className={cn(
                          "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl border transition-colors",
                          isActive
                            ? "border-transparent bg-brand-600 text-white"
                            : "border-gray-200 bg-white text-gray-500 group-hover:border-gray-300 group-hover:text-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:group-hover:border-gray-700 dark:group-hover:text-gray-100"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>

                      <div className="min-w-0">
                        <div className="text-sm font-semibold">{label}</div>
                        <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                          {description}
                        </div>
                      </div>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="mt-auto border-t border-gray-200/80 p-3 dark:border-gray-800/80">
        <NavLink
          to="/settings"
          onClick={onClose}
          className={({ isActive }) =>
            cn(
              "mb-1.5 flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition-colors",
              isActive
                ? "bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-200"
                : "text-gray-700 hover:bg-gray-100/80 dark:text-gray-300 dark:hover:bg-gray-900"
            )
          }
        >
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl border border-gray-200 bg-white text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
            <Settings className="h-4 w-4" />
          </div>
          <div>
            <div className="font-semibold">Settings</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Theme, review flow, and defaults.
            </div>
          </div>
        </NavLink>
      </div>
    </aside>
  );
}

function truncateLabel(value: string) {
  if (value.length <= 18) {
    return value;
  }

  return `${value.slice(0, 15)}...`;
}
