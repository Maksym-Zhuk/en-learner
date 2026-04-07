import { api } from "./client";
import type { DashboardStats } from "@/types";

type DashboardStatsResponse = Omit<DashboardStats, "recent_words" | "recent_sets"> & {
  recent_words: Array<
    Omit<DashboardStats["recent_words"][number], "search_count"> & {
      search_count?: number;
    }
  >;
  recent_sets?: DashboardStats["recent_sets"];
};

export const dashboardApi = {
  stats: async (): Promise<DashboardStats> => {
    const stats = await api.get<DashboardStatsResponse>("/dashboard/stats");

    return {
      ...stats,
      recent_sets: stats.recent_sets ?? [],
      recent_words: stats.recent_words.map((word) => ({
        ...word,
        search_count: word.search_count ?? 1,
      })),
    };
  },
};
