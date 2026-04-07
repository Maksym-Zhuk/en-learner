import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  BookOpen,
  Brain,
  Flame,
  Calendar,
  TrendingDown,
  ArrowRight,
  Play,
} from "lucide-react";
import { Button, Skeleton } from "@/components/ui";
import { dashboardApi } from "@/api/dashboard";

export default function Dashboard() {
  const navigate = useNavigate();
  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: dashboardApi.stats,
    refetchInterval: 30_000,
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => navigate("/review")}
          className="gap-2"
        >
          <Play className="h-4 w-4" />
          Study now
          {stats && stats.words_due_today > 0 && (
            <span className="ml-1 rounded-full bg-white/20 px-1.5 text-xs">
              {stats.words_due_today}
            </span>
          )}
        </Button>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={<BookOpen className="h-5 w-5" />}
          label="Words saved"
          value={stats?.total_words_saved}
          loading={isLoading}
          color="brand"
        />
        <StatCard
          icon={<Calendar className="h-5 w-5" />}
          label="Due today"
          value={stats?.words_due_today}
          loading={isLoading}
          color="amber"
          highlight={stats && stats.words_due_today > 0}
        />
        <StatCard
          icon={<Flame className="h-5 w-5" />}
          label="Day streak"
          value={stats?.current_streak_days}
          loading={isLoading}
          color="orange"
        />
        <StatCard
          icon={<Brain className="h-5 w-5" />}
          label="Reviewed today"
          value={stats?.total_reviews_today}
          loading={isLoading}
          color="green"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Words by state */}
        <div className="card space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
            Learning progress
          </h2>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : stats ? (
            <div className="space-y-2.5">
              <ProgressRow label="New" count={stats.words_by_state.new} color="bg-gray-400" />
              <ProgressRow label="Learning" count={stats.words_by_state.learning} color="bg-amber-400" />
              <ProgressRow label="Review" count={stats.words_by_state.review} color="bg-brand-500" />
              <ProgressRow label="Mastered" count={stats.words_by_state.relearning} color="bg-green-500" />
            </div>
          ) : null}
        </div>

        {/* Hardest words */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
              Needs attention
            </h2>
            <TrendingDown className="h-4 w-4 text-gray-400" />
          </div>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : stats && stats.hardest_words.length > 0 ? (
            <div className="space-y-2">
              {stats.hardest_words.map((w) => (
                <button
                  key={w.word_id}
                  onClick={() => navigate(`/words/${w.word_id}`)}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <span className="font-medium text-sm">{w.word}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-red-500">{w.lapses} lapses</span>
                    <span className="text-xs text-gray-400">
                      ease {w.ease_factor.toFixed(1)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">
              No struggling words — great job!
            </p>
          )}
        </div>
      </div>

      {/* Recent words */}
      {(isLoading || (stats && stats.recent_words.length > 0)) && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
              Recently searched
            </h2>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => navigate("/history")}
            >
              View all <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
          {isLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {stats!.recent_words.map((w) => (
                <button
                  key={w.word_id}
                  onClick={() => navigate(`/words/${w.word_id}`)}
                  className="flex flex-col rounded-lg border border-gray-200 dark:border-gray-800 p-3 text-left hover:border-brand-300 dark:hover:border-brand-700 hover:shadow-sm transition-all"
                >
                  <span className="font-semibold text-sm">{w.word}</span>
                  {w.phonetic_text && (
                    <span className="text-xs font-mono text-gray-400 mt-0.5">{w.phonetic_text}</span>
                  )}
                  {w.translation_uk && (
                    <span className="text-xs text-brand-600 dark:text-brand-400 mt-1 truncate">
                      {w.translation_uk}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  loading,
  color,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value?: number;
  loading: boolean;
  color: string;
  highlight?: boolean;
}) {
  const colorMap: Record<string, string> = {
    brand: "bg-brand-50 text-brand-600 dark:bg-brand-950/30 dark:text-brand-400",
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400",
    orange: "bg-orange-50 text-orange-600 dark:bg-orange-950/30 dark:text-orange-400",
    green: "bg-green-50 text-green-600 dark:bg-green-950/30 dark:text-green-400",
  };

  return (
    <div
      className={`card flex items-center gap-4 ${
        highlight ? "ring-2 ring-amber-400/50" : ""
      }`}
    >
      <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${colorMap[color]}`}>
        {icon}
      </div>
      <div>
        <div className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</div>
        {loading ? (
          <Skeleton className="mt-1 h-7 w-16" />
        ) : (
          <div className="text-2xl font-bold">{value ?? 0}</div>
        )}
      </div>
    </div>
  );
}

function ProgressRow({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 text-sm text-gray-600 dark:text-gray-400">{label}</span>
      <div className="flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800 h-2">
        <div
          className={`h-full rounded-full ${color} transition-all duration-500`}
          style={{ width: `${Math.min(100, count * 2)}%`, minWidth: count > 0 ? "8px" : "0" }}
        />
      </div>
      <span className="w-8 text-right text-sm font-medium">{count}</span>
    </div>
  );
}
