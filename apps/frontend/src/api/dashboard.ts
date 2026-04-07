import { api } from "./client";
import type { DashboardStats } from "@/types";

export const dashboardApi = {
  stats: () => api.get<DashboardStats>("/dashboard/stats"),
};
