export {};

declare global {
  interface EnLearnerNativeRuntimeInfo {
    version: string;
    platform: "windows" | "macos" | "linux";
    backendUrl: string;
    frontendUrl: string;
    storagePath: string;
    persistedBackendUrl: string | null;
    managesBackend: boolean;
    productionBuild: boolean;
    backendCheckable: boolean;
    backendReachable: boolean | null;
  }

  interface EnLearnerNativeSetWindowTitleResult {
    title: string;
  }

  interface Window {
    __EN_LEARNER_RUNTIME_CONFIG?: {
      apiBaseUrl?: string;
      publicAppUrl?: string;
    };
    __enLearner?: {
      version?: string;
      platform?: string;
      nativeBridge?: {
        available?: boolean;
      };
    };
    enLearnerNativeGetRuntimeInfo?: () => Promise<EnLearnerNativeRuntimeInfo>;
    enLearnerNativeSetWindowTitle?: (
      title: string
    ) => Promise<EnLearnerNativeSetWindowTitleResult>;
    enLearnerNativeSetBackendUrl?: (
      backendUrl: string
    ) => Promise<EnLearnerNativeRuntimeInfo>;
  }
}
