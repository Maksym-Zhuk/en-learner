export type DesktopPlatform = "windows" | "macos" | "linux";

export interface NativeRuntimeInfo {
  version: string;
  platform: DesktopPlatform;
  backendUrl: string;
  frontendUrl: string;
  storagePath: string;
  persistedBackendUrl: string | null;
  managesBackend: boolean;
  productionBuild: boolean;
  backendCheckable: boolean;
  backendReachable: boolean | null;
}

export interface NativeSetWindowTitleResult {
  title: string;
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

export const nativeDesktopApi = {
  isAvailable() {
    return typeof window.enLearnerNativeGetRuntimeInfo === "function";
  },

  async getRuntimeInfo(): Promise<NativeRuntimeInfo> {
    if (typeof window.enLearnerNativeGetRuntimeInfo !== "function") {
      throw new Error("Native desktop bridge is unavailable");
    }

    try {
      return await window.enLearnerNativeGetRuntimeInfo();
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
      return await window.enLearnerNativeSetBackendUrl(backendUrl);
    } catch (error) {
      throw normalizeNativeError(error, "Failed to persist desktop backend URL");
    }
  },
};
