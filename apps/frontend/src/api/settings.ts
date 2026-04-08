import { api } from "./client";
import { desktopLocalCore } from "@/lib/local-core";
import type { AppSettings } from "@/types";

export const settingsApi = {
  get: () =>
    desktopLocalCore.isAvailable()
      ? desktopLocalCore.getSettings()
      : api.get<AppSettings>("/settings"),
  update: (data: Partial<AppSettings>) =>
    desktopLocalCore.isAvailable()
      ? desktopLocalCore.updateSettings(data)
      : api.put<AppSettings>("/settings", data),
};
