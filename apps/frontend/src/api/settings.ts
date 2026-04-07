import { api } from "./client";
import type { AppSettings } from "@/types";

export const settingsApi = {
  get: () => api.get<AppSettings>("/settings"),
  update: (data: Partial<AppSettings>) => api.put<AppSettings>("/settings", data),
};
