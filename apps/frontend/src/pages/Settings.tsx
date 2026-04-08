import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Database,
  Languages,
  MonitorSmartphone,
  RefreshCw,
  Settings as SettingsIcon,
  SlidersHorizontal,
  Volume2,
  Waypoints,
} from "lucide-react";
import toast from "react-hot-toast";
import { Badge, Button, EmptyState, Input, Skeleton } from "@/components/ui";
import { settingsApi } from "@/api/settings";
import { nativeDesktopApi, type NativeRuntimeInfo } from "@/native/desktop";
import { useAppStore } from "@/store";
import type { AppSettings } from "@/types";

export default function Settings() {
  const qc = useQueryClient();
  const darkMode = useAppStore((s) => s.darkMode);
  const setDarkMode = useAppStore((s) => s.setDarkMode);
  const nativeBridgeAvailable = nativeDesktopApi.isAvailable();
  const [desktopBackendUrl, setDesktopBackendUrl] = useState("");

  const {
    data: settings,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["settings"],
    queryFn: settingsApi.get,
  });

  const {
    data: nativeRuntime,
    isLoading: nativeRuntimeLoading,
    isError: nativeRuntimeError,
    error: nativeRuntimeQueryError,
    refetch: refetchNativeRuntime,
    isFetching: nativeRuntimeFetching,
  } = useQuery({
    queryKey: ["native-runtime"],
    queryFn: nativeDesktopApi.getRuntimeInfo,
    enabled: nativeBridgeAvailable,
    staleTime: 60_000,
    retry: 0,
  });

  useEffect(() => {
    if (typeof settings?.dark_mode === "boolean" && settings.dark_mode !== darkMode) {
      setDarkMode(settings.dark_mode);
    }
  }, [settings?.dark_mode, darkMode, setDarkMode]);

  useEffect(() => {
    setDesktopBackendUrl(nativeRuntime?.persistedBackendUrl ?? "");
  }, [nativeRuntime?.persistedBackendUrl]);

  const updateMutation = useMutation({
    mutationFn: settingsApi.update,
    onMutate: async (patch: Partial<AppSettings>) => {
      await qc.cancelQueries({ queryKey: ["settings"] });
      const previous = qc.getQueryData<AppSettings>(["settings"]);

      if (previous) {
        const optimistic = { ...previous, ...patch };
        qc.setQueryData(["settings"], optimistic);

        if (typeof patch.dark_mode === "boolean") {
          setDarkMode(patch.dark_mode);
        }
      }

      return { previous };
    },
    onError: (_error, _patch, context) => {
      if (context?.previous) {
        qc.setQueryData(["settings"], context.previous);
        setDarkMode(context.previous.dark_mode);
      }

      toast.error("Failed to save settings");
    },
    onSuccess: (data) => {
      qc.setQueryData(["settings"], data);
      setDarkMode(data.dark_mode);
    },
  });

  const update = (patch: Partial<AppSettings>) => {
    if (updateMutation.isPending) {
      return;
    }

    updateMutation.mutate(patch);
  };

  const nativeBackendMutation = useMutation({
    mutationFn: (backendUrl: string) => nativeDesktopApi.setBackendUrl(backendUrl.trim()),
    onSuccess: (runtime) => {
      qc.setQueryData(["native-runtime"], runtime);
      window.__EN_LEARNER_RUNTIME_CONFIG = {
        ...(window.__EN_LEARNER_RUNTIME_CONFIG ?? {}),
        apiBaseUrl: runtime.backendUrl,
      };
      qc.invalidateQueries();
      toast.success(
        runtime.persistedBackendUrl
          ? "Desktop backend URL saved to local SQLite storage"
          : "Desktop backend URL reset to the local default"
      );
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Failed to persist the desktop backend URL"));
    },
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 p-6">
        <Skeleton className="h-44 rounded-3xl" />
        <div className="grid gap-6 xl:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-72 rounded-3xl" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !settings) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <EmptyState
          icon={<SettingsIcon className="h-8 w-8" />}
          title="Settings are unavailable"
          description="The app could not load your preferences right now."
          action={
            <Button variant="secondary" onClick={() => refetch()}>
              Try again
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <section className="card">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-2xl">
            <div className="eyebrow">Preferences</div>
            <div className="mt-3 flex items-start gap-4">
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-3xl bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-300">
                <SettingsIcon className="h-7 w-7" />
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
                  Shape the app around your study routine
                </h1>
                <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-400">
                  Theme, review pacing, and playback preferences are stored
                  locally and applied across the app shell.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[320px]">
            <SummaryTile label="Theme" value={darkMode ? "Dark" : "Light"} />
            <SummaryTile
              label="Daily review cap"
              value={`${settings.daily_review_limit}`}
            />
            <SummaryTile
              label="New cards"
              value={`${settings.new_cards_per_day}`}
            />
            <SummaryTile
              label="Autoplay"
              value={settings.audio_autoplay ? "On" : "Off"}
            />
          </div>
        </div>

        <div className="panel-muted mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Preferences sync immediately
            </div>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Each control saves as soon as you change it. Interactions pause
              briefly while the current update is being written.
            </p>
          </div>
          <Badge variant={updateMutation.isPending ? "warning" : "success"}>
            {updateMutation.isPending ? "Saving changes" : "All changes saved"}
          </Badge>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.1fr,1.1fr,0.9fr]">
        <section className="card space-y-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-300">
              <SettingsIcon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Interface
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Quick appearance controls live in the top bar, while the rest stays here.
              </p>
            </div>
          </div>

          <ReadonlySetting
            icon={<SettingsIcon className="h-4 w-4" />}
            label="Theme switch"
            description="Use the small sun/moon toggle in the header to change the theme without opening settings."
            value={darkMode ? "Dark" : "Light"}
          />

          <ReadonlySetting
            icon={<Languages className="h-4 w-4" />}
            label="Interface language"
            description="Stored in settings, but the rest of the interface is still English-only."
            value={settings.ui_language.toUpperCase()}
          />
        </section>

        <section className="card space-y-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300">
              <SlidersHorizontal className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Review pacing
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Keep the queue manageable and control how aggressively new cards enter.
              </p>
            </div>
          </div>

          <NumberSetting
            label="Daily review limit"
            description="Maximum review cards the app should schedule in a day."
            value={settings.daily_review_limit}
            min={10}
            max={500}
            step={10}
            disabled={updateMutation.isPending}
            onChange={(value) => update({ daily_review_limit: value })}
          />

          <NumberSetting
            label="New cards per day"
            description="How many fresh words should be introduced into practice daily."
            value={settings.new_cards_per_day}
            min={1}
            max={100}
            step={5}
            disabled={updateMutation.isPending}
            onChange={(value) => update({ new_cards_per_day: value })}
          />
        </section>

        <section className="card space-y-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-300">
              <Volume2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Audio and reveal rules
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Decide what should happen automatically when a word opens.
              </p>
            </div>
          </div>

          <Toggle
            label="Auto-play pronunciation"
            description="Play available word audio right after a word loads."
            checked={settings.audio_autoplay}
            disabled={updateMutation.isPending}
            onChange={(value) => update({ audio_autoplay: value })}
          />

          <Toggle
            label="Show translation immediately"
            description="Reveal the Ukrainian translation without an extra click."
            checked={settings.show_translation_immediately}
            disabled={updateMutation.isPending}
            onChange={(value) => update({ show_translation_immediately: value })}
          />

          <ReadonlySetting
            icon={<SettingsIcon className="h-4 w-4" />}
            label="Storage"
            description="Preferences and learning data stay on this device."
            value="Local"
          />
        </section>
      </div>

      {nativeBridgeAvailable && (
        <section className="card space-y-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="eyebrow">Native Bridge</div>
              <h2 className="mt-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
                Frontend to C++ runtime
              </h2>
              <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-400">
                The desktop shell now exposes asynchronous native methods, so the
                frontend can call C++ directly instead of talking only to the backend.
              </p>
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => refetchNativeRuntime()}
              loading={nativeRuntimeFetching}
            >
              <RefreshCw className="h-4 w-4" />
              Refresh native status
            </Button>
          </div>

          {nativeRuntimeLoading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[1, 2, 3, 4].map((item) => (
                <Skeleton key={item} className="h-28 rounded-2xl" />
              ))}
            </div>
          ) : nativeRuntimeError || !nativeRuntime ? (
            <EmptyState
              icon={<Waypoints className="h-8 w-8" />}
              title="Native bridge is unavailable"
              description={getErrorMessage(
                nativeRuntimeQueryError,
                "The desktop shell did not respond to the frontend bridge request."
              )}
              action={
                <Button variant="secondary" onClick={() => refetchNativeRuntime()}>
                  Try again
                </Button>
              }
            />
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <ReadonlySetting
                  icon={<MonitorSmartphone className="h-4 w-4" />}
                  label="Runtime"
                  description="The current native shell that hosts this frontend."
                  value={`${formatPlatform(nativeRuntime.platform)} · v${nativeRuntime.version}`}
                />
                <ReadonlySetting
                  icon={<Waypoints className="h-4 w-4" />}
                  label="Bridge"
                  description="Native calls are promise-based and resolved by C++."
                  value="Connected"
                />
                <ReadonlySetting
                  icon={<SettingsIcon className="h-4 w-4" />}
                  label="Backend mode"
                  description={
                    nativeRuntime.managesBackend
                      ? "Desktop booted and manages the local backend process."
                      : "Desktop is attached to an already running backend URL."
                  }
                  value={nativeRuntime.managesBackend ? "Managed" : "External"}
                />
                <ReadonlySetting
                  icon={<Volume2 className="h-4 w-4" />}
                  label="Backend status"
                  description="Current reachability according to the desktop shell."
                  value={getBackendStatusLabel(nativeRuntime)}
                />
                <ReadonlySetting
                  icon={<Volume2 className="h-4 w-4" />}
                  label="Audio output"
                  description={
                    nativeRuntime.audioPlaybackAvailable
                      ? "Desktop runtime can play pronunciation audio."
                      : nativeRuntime.audioPlaybackIssue ??
                        "Desktop runtime cannot play pronunciation audio on this system."
                  }
                  value={nativeRuntime.audioPlaybackAvailable ? "Available" : "Unavailable"}
                />
              </div>

              <div className="panel-muted space-y-3">
                <div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Endpoint wiring
                  </div>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    These values come from the native C++ shell, not from the backend API.
                  </p>
                </div>

                <div className="grid gap-3 lg:grid-cols-2">
                  <EndpointTile label="Frontend URL" value={nativeRuntime.frontendUrl} />
                  <EndpointTile label="Backend URL" value={nativeRuntime.backendUrl} />
                </div>
              </div>

              <div className="panel-muted space-y-4">
                <div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Desktop backend override
                  </div>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    This value is stored by the C++ shell in a local SQLite file and
                    loaded again on the next desktop launch. Leave it blank to fall
                    back to the default local backend.
                  </p>
                </div>

                <Input
                  value={desktopBackendUrl}
                  onChange={(event) => setDesktopBackendUrl(event.target.value)}
                  placeholder="https://api.example.com"
                  leftIcon={<Waypoints className="h-4 w-4" />}
                  disabled={nativeBackendMutation.isPending}
                />

                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={() => nativeBackendMutation.mutate(desktopBackendUrl)}
                    loading={nativeBackendMutation.isPending}
                  >
                    Save backend URL
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={nativeBackendMutation.isPending || !desktopBackendUrl}
                    onClick={() => {
                      setDesktopBackendUrl("");
                      nativeBackendMutation.mutate("");
                    }}
                  >
                    Reset to local default
                  </Button>
                </div>

                <ReadonlySetting
                  icon={<Database className="h-4 w-4" />}
                  label="Native storage"
                  description="Desktop shell storage path managed by the C++ runtime."
                  value={nativeRuntime.storagePath}
                />
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}

function SummaryTile({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="metric-tile">
      <div className="text-xs font-medium uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500">
        {label}
      </div>
      <div className="mt-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
        {value}
      </div>
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="panel-muted flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {label}
        </div>
        <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {description}
        </div>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 flex-shrink-0 rounded-full transition-colors ${
          checked ? "bg-brand-600" : "bg-gray-300 dark:bg-gray-700"
        } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
      >
        <span
          className={`absolute top-1 left-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
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
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  value: number;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  const progress = ((value - min) / (max - min)) * 100;

  return (
    <div className="panel-muted space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {label}
          </div>
          <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {description}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <StepButton
            label={`Decrease ${label}`}
            disabled={disabled || value <= min}
            onClick={() => onChange(Math.max(min, value - step))}
          >
            −
          </StepButton>
          <div className="min-w-[68px] text-center">
            <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {value}
            </div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500">
              cards
            </div>
          </div>
          <StepButton
            label={`Increase ${label}`}
            disabled={disabled || value >= max}
            onClick={() => onChange(Math.min(max, value + step))}
          >
            +
          </StepButton>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
          <div
            className="h-full rounded-full bg-brand-500 transition-[width] duration-300"
            style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
          />
        </div>
        <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500">
          {min}-{max}
        </div>
      </div>
    </div>
  );
}

function StepButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-10 w-10 items-center justify-center rounded-2xl border border-gray-300 bg-white text-base font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
    >
      {children}
    </button>
  );
}

function ReadonlySetting({
  icon,
  label,
  description,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  value: string;
}) {
  return (
    <div className="panel-muted flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
          <span className="text-gray-400 dark:text-gray-500">{icon}</span>
          {label}
        </div>
        <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {description}
        </div>
      </div>

      <Badge variant="info">{value}</Badge>
    </div>
  );
}

function EndpointTile({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-800 dark:bg-gray-950/70">
      <div className="text-xs font-medium uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500">
        {label}
      </div>
      <div className="mt-2 break-all font-mono text-xs text-gray-700 dark:text-gray-300">
        {value}
      </div>
    </div>
  );
}

function formatPlatform(platform: NativeRuntimeInfo["platform"]) {
  switch (platform) {
    case "macos":
      return "macOS";
    case "windows":
      return "Windows";
    default:
      return "Linux";
  }
}

function getBackendStatusLabel(runtime: NativeRuntimeInfo) {
  if (!runtime.backendCheckable) {
    return "Remote";
  }

  if (runtime.backendReachable === null) {
    return "Unknown";
  }

  return runtime.backendReachable ? "Reachable" : "Offline";
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}
