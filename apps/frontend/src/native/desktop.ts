import type { AuthSession, ConnectivityMode } from "@/types";

export type DesktopPlatform = "windows" | "macos" | "linux";

export interface NativeRuntimeInfo {
  version: string;
  platform: DesktopPlatform;
  backendUrl: string;
  frontendUrl: string;
  storagePath: string;
  connectivityMode: ConnectivityMode;
  authMode: "none" | "guest" | "remote";
  authSession: AuthSession | null;
  localProfileName: string;
  persistedBackendUrl: string | null;
  managesBackend: boolean;
  productionBuild: boolean;
  backendCheckable: boolean;
  backendReachable: boolean | null;
}

export interface NativeSetWindowTitleResult {
  title: string;
}

export interface NativeExternalUrlResult {
  ok: boolean;
}

function normalizeNativeError(
  error: unknown,
  fallback: string
): Error {
  if (error instanceof Error) {
    return error;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return new Error(error.message);
  }

  return new Error(fallback);
}

function mapRuntimeInfo(
  info: EnLearnerNativeRuntimeInfo
): NativeRuntimeInfo {
  let authSession: AuthSession | null = null;

  if (info.authSessionJson) {
    try {
      authSession = JSON.parse(info.authSessionJson) as AuthSession;
    } catch {
      authSession = null;
    }
  }

  return {
    version: info.version,
    platform: info.platform,
    backendUrl: info.backendUrl,
    frontendUrl: info.frontendUrl,
    storagePath: info.storagePath,
    connectivityMode: info.connectivityMode,
    authMode: info.authMode,
    authSession,
    localProfileName: info.localProfileName,
    persistedBackendUrl: info.persistedBackendUrl,
    managesBackend: info.managesBackend,
    productionBuild: info.productionBuild,
    backendCheckable: info.backendCheckable,
    backendReachable: info.backendReachable,
  };
}

export const nativeDesktopApi = {
  isAvailable() {
    return typeof window.enLearnerNativeGetRuntimeInfo === "function";
  },

  async getRuntimeInfo(): Promise<NativeRuntimeInfo> {
    if (typeof window.enLearnerNativeGetRuntimeInfo !== "function") {
      throw new Error("Native desktop bridge is unavailable");
    }

    try {
      return mapRuntimeInfo(await window.enLearnerNativeGetRuntimeInfo());
    } catch (error) {
      throw normalizeNativeError(error, "Failed to load native desktop runtime info");
    }
  },

  async setWindowTitle(
    title: string
  ): Promise<NativeSetWindowTitleResult | null> {
    if (typeof window.enLearnerNativeSetWindowTitle !== "function") {
      return null;
    }

    try {
      return await window.enLearnerNativeSetWindowTitle(title);
    } catch (error) {
      throw normalizeNativeError(error, "Failed to update native window title");
    }
  },

  async setBackendUrl(backendUrl: string): Promise<NativeRuntimeInfo> {
    if (typeof window.enLearnerNativeSetBackendUrl !== "function") {
      throw new Error("Native desktop bridge is unavailable");
    }

    try {
      return mapRuntimeInfo(await window.enLearnerNativeSetBackendUrl(backendUrl));
    } catch (error) {
      throw normalizeNativeError(error, "Failed to persist desktop backend URL");
    }
  },

  async setConnectivityMode(mode: ConnectivityMode): Promise<NativeRuntimeInfo> {
    if (typeof window.enLearnerNativeSetConnectivityMode !== "function") {
      throw new Error("Native desktop bridge is unavailable");
    }

    try {
      return mapRuntimeInfo(await window.enLearnerNativeSetConnectivityMode(mode));
    } catch (error) {
      throw normalizeNativeError(error, "Failed to persist desktop connectivity mode");
    }
  },

  async signInGuest(displayName = "Local user"): Promise<NativeRuntimeInfo> {
    if (typeof window.enLearnerNativeSignInGuest !== "function") {
      throw new Error("Native desktop bridge is unavailable");
    }

    try {
      return mapRuntimeInfo(await window.enLearnerNativeSignInGuest(displayName));
    } catch (error) {
      throw normalizeNativeError(error, "Failed to switch to guest mode");
    }
  },

  async setAuthSession(session: AuthSession): Promise<NativeRuntimeInfo> {
    if (typeof window.enLearnerNativeSetAuthSession !== "function") {
      throw new Error("Native desktop bridge is unavailable");
    }

    try {
      return mapRuntimeInfo(
        await window.enLearnerNativeSetAuthSession(JSON.stringify(session))
      );
    } catch (error) {
      throw normalizeNativeError(error, "Failed to persist desktop auth session");
    }
  },

  async clearAuthSession(): Promise<NativeRuntimeInfo> {
    if (typeof window.enLearnerNativeClearAuthSession !== "function") {
      throw new Error("Native desktop bridge is unavailable");
    }

    try {
      return mapRuntimeInfo(await window.enLearnerNativeClearAuthSession());
    } catch (error) {
      throw normalizeNativeError(error, "Failed to clear desktop auth session");
    }
  },

  async openExternalUrl(url: string): Promise<NativeExternalUrlResult | null> {
    if (typeof window.enLearnerNativeOpenExternalUrl !== "function") {
      return null;
    }

    try {
      return await window.enLearnerNativeOpenExternalUrl(url);
    } catch (error) {
      throw normalizeNativeError(error, "Failed to open the system browser");
    }
  },
};
