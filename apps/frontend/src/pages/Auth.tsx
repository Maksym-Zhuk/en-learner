import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ExternalLink,
  KeyRound,
  LogOut,
  PencilLine,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import toast from "react-hot-toast";
import { authApi } from "@/api/auth";
import { Badge, Button, EmptyState, Input, Skeleton } from "@/components/ui";
import { cn } from "@/components/ui/utils";
import { applyNativeRuntime } from "@/lib/runtime-state";
import { nativeDesktopApi, type NativeRuntimeInfo } from "@/native/desktop";
import { useAppStore } from "@/store";
import type { AuthProvider, AuthSession } from "@/types";

type AuthPanel = "local" | "remote";
type EmailAuthMode = "login" | "register";

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export default function Auth() {
  const qc = useQueryClient();
  const nativeBridgeAvailable = nativeDesktopApi.isAvailable();
  const authMode = useAppStore((s) => s.authMode);
  const authSession = useAppStore((s) => s.authSession);
  const localProfileName = useAppStore((s) => s.localProfileName);
  const setGuestMode = useAppStore((s) => s.setGuestMode);
  const setRemoteSession = useAppStore((s) => s.setRemoteSession);
  const clearAuthSession = useAppStore((s) => s.clearAuthSession);

  const [activePanel, setActivePanel] = useState<AuthPanel>(
    authMode === "remote" ? "remote" : "local"
  );
  const [showLocalNameEditor, setShowLocalNameEditor] = useState(authMode === "none");
  const [showRemoteEmailForm, setShowRemoteEmailForm] = useState(false);
  const [emailAuthMode, setEmailAuthMode] = useState<EmailAuthMode>("login");
  const [guestName, setGuestName] = useState(localProfileName);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [registerName, setRegisterName] = useState(localProfileName);
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");

  useEffect(() => {
    if (authMode === "remote") {
      setActivePanel("remote");
      setShowRemoteEmailForm(false);
    }

    if (authMode === "guest") {
      setActivePanel("local");
    }
  }, [authMode]);

  useEffect(() => {
    setGuestName(localProfileName);
    setRegisterName(localProfileName);
  }, [localProfileName]);

  const { data: providers, isLoading: providersLoading, isError: providersError } = useQuery({
    queryKey: ["auth-providers"],
    queryFn: authApi.listProviders,
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const oauthProviders = useMemo(
    () =>
      (providers ?? []).filter(
        (provider) => provider.kind === "oauth" && provider.available
      ),
    [providers]
  );

  const canSubmitLogin =
    loginEmail.trim().includes("@") && loginPassword.trim().length >= 8;
  const canSubmitRegister =
    registerName.trim().length > 0 &&
    registerEmail.trim().includes("@") &&
    registerPassword.trim().length >= 8;

  const applyRuntime = (runtime: NativeRuntimeInfo) => {
    qc.setQueryData(["native-runtime"], runtime);
    window.__EN_LEARNER_RUNTIME_CONFIG = {
      ...(window.__EN_LEARNER_RUNTIME_CONFIG ?? {}),
      apiBaseUrl: runtime.backendUrl,
    };
    applyNativeRuntime(runtime);
  };

  const persistRemoteSession = async (session: AuthSession) => {
    if (nativeBridgeAvailable) {
      const runtime = await nativeDesktopApi.setAuthSession(session);
      applyRuntime(runtime);
      return;
    }

    setRemoteSession(session);
  };

  const clearPersistedAuth = async () => {
    if (nativeBridgeAvailable) {
      const runtime = await nativeDesktopApi.clearAuthSession();
      applyRuntime(runtime);
      return;
    }

    clearAuthSession();
  };

  const guestMutation = useMutation({
    mutationFn: async (profileName: string) => {
      if (nativeBridgeAvailable) {
        return nativeDesktopApi.signInGuest(profileName.trim() || "Local user");
      }

      setGuestMode(profileName.trim() || "Local user");
      return null;
    },
    onSuccess: (runtime) => {
      if (runtime) {
        applyRuntime(runtime);
      }
      if (!nativeBridgeAvailable) {
        setGuestMode(guestName.trim() || "Local user");
      }
      setShowLocalNameEditor(false);
      setActivePanel("local");
      toast.success("Local profile is ready");
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Failed to switch to local mode"));
    },
  });

  const loginMutation = useMutation({
    mutationFn: async () => {
      const session = await authApi.login({
        email: loginEmail.trim(),
        password: loginPassword,
      });
      await persistRemoteSession(session);
      return session;
    },
    onSuccess: (session) => {
      setLoginEmail("");
      setLoginPassword("");
      setShowRemoteEmailForm(false);
      setActivePanel("remote");
      toast.success(`Signed in as ${session.user.display_name}`);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Failed to sign in"));
    },
  });

  const registerMutation = useMutation({
    mutationFn: async () => {
      const session = await authApi.register({
        display_name: registerName.trim(),
        email: registerEmail.trim(),
        password: registerPassword,
      });
      await persistRemoteSession(session);
      return session;
    },
    onSuccess: (session) => {
      setRegisterEmail("");
      setRegisterPassword("");
      setShowRemoteEmailForm(false);
      setActivePanel("remote");
      toast.success(`Created account for ${session.user.display_name}`);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Failed to create the remote account"));
    },
  });

  const oauthMutation = useMutation({
    mutationFn: async (provider: AuthProvider) => {
      const start = await authApi.startOAuth(provider.id);

      if (nativeBridgeAvailable) {
        await nativeDesktopApi.openExternalUrl(start.authorization_url);
      } else {
        const popup = window.open(
          start.authorization_url,
          `en-learner-auth-${provider.id}`,
          "popup=yes,width=520,height=760"
        );

        if (!popup) {
          throw new Error("The browser blocked the auth popup");
        }
      }

      for (let attempt = 0; attempt < 90; attempt += 1) {
        const status = await authApi.getOAuthStatus(start.state);

        if (status.status === "complete" && status.session) {
          await persistRemoteSession(status.session);
          return status.session;
        }

        if (status.status === "failed") {
          throw new Error(status.error ?? `${provider.label} sign-in failed`);
        }

        await wait(1000);
      }

      throw new Error("Timed out waiting for the external sign-in to finish");
    },
    onSuccess: (session) => {
      setShowRemoteEmailForm(false);
      setActivePanel("remote");
      toast.success(`Connected ${session.user.provider} account`);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Remote sign-in failed"));
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      if (authMode === "remote" && authSession) {
        try {
          await authApi.logout();
        } catch {
          // local session cleanup still needs to happen
        }
      }

      await clearPersistedAuth();
    },
    onSuccess: () => {
      setShowRemoteEmailForm(false);
      setActivePanel("remote");
      toast.success("Signed out");
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Failed to sign out"));
    },
  });

  const openEmailForm = (mode: EmailAuthMode) => {
    setEmailAuthMode(mode);
    setShowRemoteEmailForm(true);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <section className="card">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="eyebrow">Account</div>
            <div className="mt-3 flex items-start gap-4">
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-3xl bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-300">
                <ShieldCheck className="h-7 w-7" />
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
                  Choose how you want to use en-learner
                </h1>
                <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-400">
                  Keep the app local for personal study, or connect a remote account
                  when you need shared links and online features.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={authMode === "remote" ? "success" : authMode === "guest" ? "info" : "default"}>
              {authMode === "remote" ? "Remote account active" : authMode === "guest" ? "Local profile active" : "No account selected"}
            </Badge>
            <Badge variant="default">
              {nativeBridgeAvailable ? "Desktop bridge" : "Browser mode"}
            </Badge>
          </div>
        </div>
      </section>

      <div className="grid gap-3 lg:grid-cols-2">
        <ChoiceCard
          title="Use on this device"
          description="Best when the app is only for you on this laptop. No remote account required."
          meta={authMode === "guest" ? localProfileName : "Local profile"}
          selected={activePanel === "local"}
          onClick={() => setActivePanel("local")}
          icon={<UserRound className="h-5 w-5" />}
        />
        <ChoiceCard
          title="Connect account"
          description="Use this for shared test links, internet-backed features, and syncing identity."
          meta={authMode === "remote" && authSession ? authSession.user.display_name : "Remote access"}
          selected={activePanel === "remote"}
          onClick={() => setActivePanel("remote")}
          icon={<KeyRound className="h-5 w-5" />}
        />
      </div>

      {activePanel === "local" ? (
        <section className="card space-y-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300">
              <UserRound className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Use en-learner locally
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Start studying on this device with a lightweight local profile.
              </p>
            </div>
          </div>

          <div className="panel-muted flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Current local profile
              </div>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {authMode === "guest"
                  ? `${localProfileName} is currently active on this device.`
                  : "No local profile is active yet."}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() => guestMutation.mutate(guestName)}
                loading={guestMutation.isPending}
              >
                {authMode === "guest" ? "Keep using locally" : "Use locally"}
              </Button>
              {(authMode === "guest" || authMode === "remote") && (
                <Button
                  variant="secondary"
                  onClick={() => logoutMutation.mutate()}
                  loading={logoutMutation.isPending}
                >
                  <LogOut className="h-4 w-4" />
                  Clear current access
                </Button>
              )}
            </div>
          </div>

          {showLocalNameEditor ? (
            <div className="rounded-3xl border border-gray-200 p-5 dark:border-gray-800">
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Local profile name
              </div>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Only shown on this device. You can skip this and keep the default name.
              </p>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <Input
                  value={guestName}
                  onChange={(event) => setGuestName(event.target.value)}
                  placeholder="Local user"
                />
                <Button
                  onClick={() => guestMutation.mutate(guestName)}
                  loading={guestMutation.isPending}
                >
                  Save local name
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setGuestName(localProfileName);
                    setShowLocalNameEditor(false);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="ghost"
              className="w-fit"
              onClick={() => setShowLocalNameEditor(true)}
            >
              <PencilLine className="h-4 w-4" />
              Rename local profile
            </Button>
          )}
        </section>
      ) : (
        <section className="card space-y-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Connect a remote account
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Use a provider or email sign-in only when you need online features.
              </p>
            </div>
          </div>

          {authMode === "remote" && authSession && !showRemoteEmailForm ? (
            <div className="space-y-4">
              <div className="rounded-3xl border border-emerald-200 bg-emerald-50/80 p-5 dark:border-emerald-900/70 dark:bg-emerald-950/20">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                      Signed in as {authSession.user.display_name}
                    </div>
                    <p className="mt-1 text-sm text-emerald-700/90 dark:text-emerald-200/90">
                      Provider: {authSession.user.provider}
                      {authSession.user.email ? ` · ${authSession.user.email}` : ""}
                    </p>
                  </div>
                  <Badge variant="success">Connected</Badge>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button variant="secondary" onClick={() => setShowRemoteEmailForm(true)}>
                  Use another account
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => logoutMutation.mutate()}
                  loading={logoutMutation.isPending}
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Continue with a provider
                  </div>
                  <Badge variant="info">
                    {nativeBridgeAvailable ? "Opens your browser" : "Uses a popup window"}
                  </Badge>
                </div>

                {providersLoading ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Skeleton className="h-12 rounded-2xl" />
                    <Skeleton className="h-12 rounded-2xl" />
                    <Skeleton className="h-12 rounded-2xl" />
                    <Skeleton className="h-12 rounded-2xl" />
                  </div>
                ) : providersError ? (
                  <EmptyState
                    title="Providers are unavailable"
                    description="The backend could not publish the configured sign-in providers."
                  />
                ) : oauthProviders.length === 0 ? (
                  <EmptyState
                    title="No providers are configured yet"
                    description="Set PUBLIC_BACKEND_URL and provider credentials on the Rust server to enable Google, GitHub, Microsoft, or Discord sign-in."
                  />
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {oauthProviders.map((provider) => (
                      <Button
                        key={provider.id}
                        variant="secondary"
                        className="justify-between"
                        loading={
                          oauthMutation.isPending &&
                          oauthMutation.variables?.id === provider.id
                        }
                        onClick={() => oauthMutation.mutate(provider)}
                      >
                        <span>{provider.label}</span>
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    ))}
                  </div>
                )}
              </div>

              {!showRemoteEmailForm ? (
                <div className="rounded-3xl border border-dashed border-gray-200 p-5 dark:border-gray-800">
                  <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Or use email
                  </div>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Pick one action and we will show only that form.
                  </p>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <Button variant="secondary" onClick={() => openEmailForm("login")}>
                      Sign in with email
                    </Button>
                    <Button onClick={() => openEmailForm("register")}>
                      Create account
                    </Button>
                  </div>
                </div>
              ) : emailAuthMode === "login" ? (
                <form
                  className="rounded-3xl border border-gray-200 p-5 dark:border-gray-800"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (canSubmitLogin) {
                      loginMutation.mutate();
                    }
                  }}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-base font-semibold text-gray-900 dark:text-gray-100">
                          Sign in with email
                        </div>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                          Use an existing remote account.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setShowRemoteEmailForm(false)}
                      >
                        Back
                      </Button>
                    </div>
                    <Input
                      type="email"
                      value={loginEmail}
                      onChange={(event) => setLoginEmail(event.target.value)}
                      placeholder="name@example.com"
                    />
                    <Input
                      type="password"
                      value={loginPassword}
                      onChange={(event) => setLoginPassword(event.target.value)}
                      placeholder="Password"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Passwords must be at least 8 characters long.
                    </p>
                    <Button
                      type="submit"
                      className="w-full sm:w-auto"
                      loading={loginMutation.isPending}
                      disabled={!canSubmitLogin}
                    >
                      Sign in
                    </Button>
                  </div>
                </form>
              ) : (
                <form
                  className="rounded-3xl border border-gray-200 p-5 dark:border-gray-800"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (canSubmitRegister) {
                      registerMutation.mutate();
                    }
                  }}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-base font-semibold text-gray-900 dark:text-gray-100">
                          Create a remote account
                        </div>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                          Create a new user with email and password.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setShowRemoteEmailForm(false)}
                      >
                        Back
                      </Button>
                    </div>
                    <Input
                      value={registerName}
                      onChange={(event) => setRegisterName(event.target.value)}
                      placeholder="Display name"
                    />
                    <Input
                      type="email"
                      value={registerEmail}
                      onChange={(event) => setRegisterEmail(event.target.value)}
                      placeholder="name@example.com"
                    />
                    <Input
                      type="password"
                      value={registerPassword}
                      onChange={(event) => setRegisterPassword(event.target.value)}
                      placeholder="Password"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Use a name, a valid email, and a password with at least 8 characters.
                    </p>
                    <Button
                      type="submit"
                      className="w-full sm:w-auto"
                      loading={registerMutation.isPending}
                      disabled={!canSubmitRegister}
                    >
                      Create account
                    </Button>
                  </div>
                </form>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}

function ChoiceCard({
  title,
  description,
  meta,
  selected,
  onClick,
  icon,
}: {
  title: string;
  description: string;
  meta: string;
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-3xl border p-5 text-left transition-colors",
        selected
          ? "border-brand-300 bg-brand-50 dark:border-brand-800 dark:bg-brand-950/40"
          : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-800 dark:bg-gray-950 dark:hover:border-gray-700"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-gray-700 shadow-sm dark:bg-gray-900 dark:text-gray-200">
          {icon}
        </div>
        {selected ? <Badge variant="pos">Selected</Badge> : null}
      </div>

      <div className="mt-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
        {title}
      </div>
      <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
        {description}
      </p>
      <div className="mt-4 text-xs font-medium uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
        {meta}
      </div>
    </button>
  );
}
