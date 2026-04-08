import { useQuery } from "@tanstack/react-query";
import { Brain } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { dashboardApi } from "@/api/dashboard";
import { DashboardOverview } from "@/components/dashboard/DashboardOverview";
import { Button, EmptyState } from "@/components/ui";

export default function Dashboard() {
  const navigate = useNavigate();
  const {
    data: stats,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: dashboardApi.stats,
    staleTime: 0,
    refetchInterval: 30_000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  if (isError) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <EmptyState
          icon={<Brain className="h-8 w-8" />}
          title="Dashboard is unavailable"
          description="The app could not load study stats right now."
          action={
            <Button variant="secondary" onClick={() => refetch()}>
              Try again
            </Button>
          }
        />
      </div>
    );
  }

  return <DashboardOverview stats={stats} isLoading={isLoading} onNavigate={navigate} />;
}
