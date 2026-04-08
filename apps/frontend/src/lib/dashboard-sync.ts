import type { QueryClient } from "@tanstack/react-query";

export function invalidateDashboardStats(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
}
