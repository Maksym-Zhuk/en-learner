import type { NativeRuntimeInfo } from "@/native/desktop";
import { useAppStore } from "@/store";

export function applyNativeRuntime(runtime: NativeRuntimeInfo) {
  useAppStore.setState((state) => ({
    ...state,
    connectivityMode: runtime.connectivityMode,
    audioPlaybackAvailable: runtime.audioPlaybackAvailable,
    audioPlaybackIssue: runtime.audioPlaybackIssue,
    authMode: runtime.authMode,
    authSession: runtime.authMode === "remote" ? runtime.authSession : null,
    localProfileName: runtime.localProfileName,
    runtimeReady: true,
  }));
}

export function markRuntimeReady() {
  useAppStore.setState({ runtimeReady: true });
}
