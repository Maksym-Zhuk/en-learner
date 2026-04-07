import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  Brain,
  Calendar,
  Flame,
  History,
  Layers,
  Play,
  Search,
  TrendingDown,
} from "lucide-react";
import { Badge, Button, EmptyState, Skeleton, cn } from "@/components/ui";
import { dashboardApi } from "@/api/dashboard";
import type { DashboardStats } from "@/types";

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
    refetchInterval: 30_000,
  });

  const todayLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
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

  const stateTotal = stats
    ? stats.words_by_state.new +
      stats.words_by_state.learning +
      stats.words_by_state.review +
      stats.words_by_state.relearning
    : 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <section className="card">
        <div className="grid gap-6 xl:grid-cols-[1.25fr,0.85fr]">
          <div className="max-w-2xl">
            <div className="eyebrow">Today</div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-100 sm:text-4xl">
              {getDashboardHeadline(stats)}
            </h1>
            <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-gray-400">
              {isLoading
                ? "Loading your latest study overview."
                : getDashboardDescription(stats, todayLabel)}
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button onClick={() => navigate("/review")}>
                <Play className="h-4 w-4" />
                Study now
                {stats && stats.words_due_today > 0 && (
                  <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">
                    {stats.words_due_today}
                  </span>
                )}
              </Button>
              <Button variant="secondary" onClick={() => navigate("/search")}>
                <Search className="h-4 w-4" />
                Search words
              </Button>
            </div>
          </div>

          <div className="panel-muted grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <PulseMetric
              label="Queue"
              value={isLoading ? "..." : `${stats?.words_due_today ?? 0}`}
              hint={
                isLoading
                  ? "Refreshing"
                  : stats?.words_due_today
                    ? "Ready now"
                    : "Clear for now"
              }
            />
            <PulseMetric
              label="Streak"
              value={isLoading ? "..." : `${stats?.current_streak_days ?? 0}`}
              hint="Consecutive active days"
            />
            <PulseMetric
              label="Saved words"
              value={isLoading ? "..." : `${stats?.total_words_saved ?? 0}`}
              hint="Available in your library"
            />
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<BookOpen className="h-5 w-5" />}
          label="Words saved"
          value={stats?.total_words_saved}
          helper="Vocabulary available for review"
          loading={isLoading}
          color="brand"
        />
        <StatCard
          icon={<Calendar className="h-5 w-5" />}
          label="Due today"
          value={stats?.words_due_today}
          helper="Cards ready in the queue"
          loading={isLoading}
          color="amber"
          highlight={Boolean(stats && stats.words_due_today > 0)}
        />
        <StatCard
          icon={<Flame className="h-5 w-5" />}
          label="Day streak"
          value={stats?.current_streak_days}
          helper="Momentum across recent days"
          loading={isLoading}
          color="orange"
        />
        <StatCard
          icon={<Brain className="h-5 w-5" />}
          label="Reviewed today"
          value={stats?.total_reviews_today}
          helper="Cards already completed today"
          loading={isLoading}
          color="green"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
        <section className="card space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="eyebrow">Learning Progress</div>
              <h2 className="mt-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
                Active card mix
              </h2>
            </div>
            {!isLoading && stats && (
              <Badge variant="info">
                {stateTotal > 0 ? `${stateTotal} tracked cards` : "No active cards"}
              </Badge>
            )}
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((item) => (
                <Skeleton key={item} className="h-12 rounded-2xl" />
              ))}
            </div>
          ) : stats && stateTotal > 0 ? (
            <div className="space-y-3">
              <ProgressRow
                label="New"
                count={stats.words_by_state.new}
                percentage={getPercentage(stats.words_by_state.new, stateTotal)}
                color="bg-gray-400"
              />
              <ProgressRow
                label="Learning"
                count={stats.words_by_state.learning}
                percentage={getPercentage(stats.words_by_state.learning, stateTotal)}
                color="bg-amber-400"
              />
              <ProgressRow
                label="Review"
                count={stats.words_by_state.review}
                percentage={getPercentage(stats.words_by_state.review, stateTotal)}
                color="bg-brand-500"
              />
              <ProgressRow
                label="Relearning"
                count={stats.words_by_state.relearning}
                percentage={getPercentage(stats.words_by_state.relearning, stateTotal)}
                color="bg-green-500"
              />
            </div>
          ) : (
            <EmptyState
              icon={<BookOpen className="h-8 w-8" />}
              title="No active cards yet"
              description="Save a few words first and the dashboard will start showing your learning mix."
              className="py-10"
              action={
                <Button onClick={() => navigate("/search")}>
                  <Search className="h-4 w-4" />
                  Find words
                </Button>
              }
            />
          )}
        </section>

        <section className="card space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="eyebrow">Watchlist</div>
              <h2 className="mt-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
                Needs attention
              </h2>
            </div>
            <TrendingDown className="h-5 w-5 text-gray-400 dark:text-gray-500" />
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((item) => (
                <Skeleton key={item} className="h-20 rounded-2xl" />
              ))}
            </div>
          ) : stats && stats.hardest_words.length > 0 ? (
            <div className="space-y-3">
              {stats.hardest_words.map((word, index) => (
                <button
                  key={word.word_id}
                  type="button"
                  onClick={() => navigate(`/words/${word.word_id}`)}
                  className="panel-muted flex w-full items-center justify-between gap-4 text-left transition-colors hover:bg-white dark:hover:bg-gray-900"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500">
                      #{index + 1} attention item
                    </div>
                    <div className="mt-1 truncate text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {word.word}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-sm font-semibold text-red-500">
                      {word.lapses} lapse{word.lapses === 1 ? "" : "s"}
                    </div>
                    <div className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                      Ease {word.ease_factor.toFixed(2)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<TrendingDown className="h-8 w-8" />}
              title="No struggling words"
              description="There are no lapse-heavy cards right now. Keep the rhythm going."
              className="py-10"
            />
          )}
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
        <section className="card space-y-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="eyebrow">Recent Activity</div>
              <h2 className="mt-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
                Recently searched words
              </h2>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/history")}
            >
              View history
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>

          {isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {[1, 2, 3, 4].map((item) => (
                <Skeleton key={item} className="h-28 rounded-2xl" />
              ))}
            </div>
          ) : stats && stats.recent_words.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {stats.recent_words.map((word) => (
                <button
                  key={word.word_id}
                  type="button"
                  onClick={() => navigate(`/words/${word.word_id}`)}
                  className="panel-muted flex flex-col items-start gap-2 text-left transition-colors hover:bg-white dark:hover:bg-gray-900"
                >
                  <div className="flex w-full items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-base font-semibold text-gray-900 dark:text-gray-100">
                        {word.word}
                      </div>
                      {word.phonetic_text && (
                        <div className="mt-1 font-mono text-xs text-gray-400 dark:text-gray-500">
                          {word.phonetic_text}
                        </div>
                      )}
                    </div>

                    <Badge variant="default">{word.search_count}x</Badge>
                  </div>

                  {word.translation_uk && (
                    <div className="text-sm font-medium text-brand-600 dark:text-brand-400">
                      {word.translation_uk}
                    </div>
                  )}

                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Last searched {formatRelativeDate(word.last_searched_at)}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Search className="h-8 w-8" />}
              title="No recent searches"
              description="Look up a word and the dashboard will surface it here for a quick return."
              className="py-10"
              action={
                <Button onClick={() => navigate("/search")}>
                  <Search className="h-4 w-4" />
                  Start searching
                </Button>
              }
            />
          )}
        </section>

        <section className="card space-y-4">
          <div>
            <div className="eyebrow">Quick Actions</div>
            <h2 className="mt-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
              Pick the next move
            </h2>
          </div>

          <QuickActionCard
            icon={<Play className="h-4 w-4" />}
            title="Run today’s review"
            description="Open the full-screen review flow and clear your current queue."
            onClick={() => navigate("/review")}
            tone="brand"
          />
          <QuickActionCard
            icon={<Layers className="h-4 w-4" />}
            title="Organize study sets"
            description="Group useful words into smaller themed collections."
            onClick={() => navigate("/sets")}
            tone="amber"
          />
          <QuickActionCard
            icon={<History className="h-4 w-4" />}
            title="Inspect search history"
            description="Jump back into earlier queries without repeating the lookup."
            onClick={() => navigate("/history")}
            tone="gray"
          />
        </section>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  helper,
  loading,
  color,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value?: number;
  helper: string;
  loading: boolean;
  color: "brand" | "amber" | "orange" | "green";
  highlight?: boolean;
}) {
  const colorMap = {
    brand: "bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-300",
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300",
    orange: "bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-300",
    green: "bg-green-50 text-green-600 dark:bg-green-950/40 dark:text-green-300",
  };

  return (
    <div
      className={cn(
        "card flex items-start gap-4",
        highlight && "ring-2 ring-amber-400/50"
      )}
    >
      <div
        className={cn(
          "flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl",
          colorMap[color]
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-xs font-medium uppercase tracking-[0.18em] text-gray-400 dark:text-gray-500">
          {label}
        </div>
        {loading ? (
          <Skeleton className="mt-2 h-8 w-20 rounded-xl" />
        ) : (
          <div className="mt-2 text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
            {value ?? 0}
          </div>
        )}
        <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">{helper}</div>
      </div>
    </div>
  );
}

function PulseMetric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl bg-white/80 px-4 py-3 shadow-sm dark:bg-gray-950/70">
      <div className="text-xs font-medium uppercase tracking-[0.2em] text-gray-400 dark:text-gray-500">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">
        {value}
      </div>
      <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">{hint}</div>
    </div>
  );
}

function ProgressRow({
  label,
  count,
  percentage,
  color,
}: {
  label: string;
  count: number;
  percentage: number;
  color: string;
}) {
  return (
    <div className="panel-muted space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {label}
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {count} card{count === 1 ? "" : "s"}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
          <div
            className={cn("h-full rounded-full transition-[width] duration-500", color)}
            style={{ width: `${count > 0 ? Math.max(6, percentage) : 0}%` }}
          />
        </div>
        <div className="w-12 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">
          {Math.round(percentage)}%
        </div>
      </div>
    </div>
  );
}

function QuickActionCard({
  icon,
  title,
  description,
  onClick,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  tone: "brand" | "amber" | "gray";
}) {
  const toneClasses = {
    brand:
      "bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-brand-950/40 dark:text-brand-200 dark:hover:bg-brand-950/60",
    amber:
      "bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-950/60",
    gray:
      "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-2xl px-4 py-4 text-left transition-colors",
        toneClasses[tone]
      )}
    >
      <div className="flex items-center gap-2 text-sm font-semibold">
        {icon}
        {title}
      </div>
      <div className="mt-2 text-sm leading-6 text-current/80">{description}</div>
    </button>
  );
}

function getDashboardHeadline(stats?: DashboardStats) {
  if (!stats) {
    return "Building your study snapshot";
  }

  if (stats.words_due_today > 0) {
    return `${stats.words_due_today} card${stats.words_due_today === 1 ? "" : "s"} are ready for review`;
  }

  if (stats.total_reviews_today > 0) {
    return "Today’s review queue is currently clear";
  }

  if (stats.total_words_saved > 0) {
    return "Keep your learning rhythm moving";
  }

  return "Start building your vocabulary library";
}

function getDashboardDescription(stats: DashboardStats | undefined, todayLabel: string) {
  if (!stats) {
    return `${todayLabel}. Checking your latest streak, queue, and recent activity.`;
  }

  if (stats.total_words_saved === 0) {
    return `${todayLabel}. Search for a few words, save the useful ones, and the dashboard will turn into a live study overview.`;
  }

  if (stats.words_due_today > 0) {
    return `${todayLabel}. Your queue is active, with ${stats.words_due_today} card${stats.words_due_today === 1 ? "" : "s"} ready now and a ${stats.current_streak_days}-day streak to protect.`;
  }

  if (stats.total_reviews_today > 0) {
    return `${todayLabel}. You already cleared today’s queue with ${stats.total_reviews_today} completed review${stats.total_reviews_today === 1 ? "" : "s"}.`;
  }

  return `${todayLabel}. Everything is caught up for now, so this is a good moment to search and save new vocabulary.`;
}

function getPercentage(count: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return (count / total) * 100;
}

function formatRelativeDate(isoString: string) {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) {
    return "just now";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
