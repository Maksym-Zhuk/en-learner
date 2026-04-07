import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings as SettingsIcon } from "lucide-react";
import toast from "react-hot-toast";
import { Skeleton } from "@/components/ui";
import { settingsApi } from "@/api/settings";
import { useAppStore } from "@/store";
import type { AppSettings } from "@/types";

export default function Settings() {
  const qc = useQueryClient();
  const { darkMode, setDarkMode } = useAppStore();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: settingsApi.get,
  });

  const updateMutation = useMutation({
    mutationFn: settingsApi.update,
    onSuccess: (data) => {
      qc.setQueryData(["settings"], data);
      toast.success("Settings saved");
      // Sync dark mode from backend setting too
      setDarkMode(data.dark_mode);
    },
    onError: () => toast.error("Failed to save settings"),
  });

  const update = (patch: Partial<AppSettings>) => {
    if (!settings) return;
    updateMutation.mutate({ ...settings, ...patch });
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6 max-w-2xl">
        <Skeleton className="h-8 w-32" />
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-14 rounded-xl" />
        ))}
      </div>
    );
  }

  if (!settings) return null;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-8">
      <div className="flex items-center gap-3">
        <SettingsIcon className="h-6 w-6 text-gray-500" />
        <h1 className="text-2xl font-bold">Settings</h1>
      </div>

      {/* Appearance */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          Appearance
        </h2>
        <div className="card space-y-4">
          <Toggle
            label="Dark mode"
            description="Switch between light and dark themes"
            checked={darkMode}
            onChange={(v) => {
              setDarkMode(v);
              update({ dark_mode: v });
            }}
          />
        </div>
      </section>

      {/* Review */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          Review settings
        </h2>
        <div className="card space-y-4">
          <NumberSetting
            label="Daily review limit"
            description="Maximum cards to review per day"
            value={settings.daily_review_limit}
            min={10}
            max={500}
            step={10}
            onChange={(v) => update({ daily_review_limit: v })}
          />
          <div className="border-t border-gray-200 dark:border-gray-800" />
          <NumberSetting
            label="New cards per day"
            description="How many new words to introduce daily"
            value={settings.new_cards_per_day}
            min={1}
            max={100}
            step={5}
            onChange={(v) => update({ new_cards_per_day: v })}
          />
        </div>
      </section>

      {/* Audio */}
      <section className="space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          Audio & display
        </h2>
        <div className="card space-y-4">
          <Toggle
            label="Auto-play pronunciation"
            description="Automatically play audio when a word loads"
            checked={settings.audio_autoplay}
            onChange={(v) => update({ audio_autoplay: v })}
          />
          <div className="border-t border-gray-200 dark:border-gray-800" />
          <Toggle
            label="Show translation immediately"
            description="Show Ukrainian translation without extra click"
            checked={settings.show_translation_immediately}
            onChange={(v) => update({ show_translation_immediately: v })}
          />
        </div>
      </section>

      <p className="text-xs text-gray-400 text-center pt-4">
        en-learner v1.0.0 — all data stored locally
      </p>
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-gray-500 dark:text-gray-400">{description}</div>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition-colors ${
          checked ? "bg-brand-600" : "bg-gray-300 dark:bg-gray-700"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

function NumberSetting({
  label,
  description,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  description: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-gray-500 dark:text-gray-400">{description}</div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(Math.max(min, value - step))}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-sm font-bold transition-colors"
        >
          −
        </button>
        <span className="w-12 text-center text-sm font-medium">{value}</span>
        <button
          onClick={() => onChange(Math.min(max, value + step))}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-sm font-bold transition-colors"
        >
          +
        </button>
      </div>
    </div>
  );
}
