import type { ReactNode } from "react";
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
  Sparkles,
  TrendingDown,
} from "lucide-react";
import { Badge, Button, EmptyState, Skeleton, cn } from "@/components/ui";
import type { DashboardStats } from "@/types";
import {
  buildDashboardOverviewModel,
  type DashboardHardWordModel,
  type DashboardHeroMetricModel,
  type DashboardQuickActionModel,
  type DashboardRecentSetModel,
  type DashboardRecentWordModel,
  type DashboardStateMixItemModel,
  type DashboardStatCardModel,
  type DashboardTone,
} from "./dashboard-overview-model";

interface DashboardOverviewProps {
  stats?: DashboardStats;
  isLoading: boolean;
  onNavigate: (path: string) => void;
}

export function DashboardOverview({
  stats,
  isLoading,
  onNavigate,
}: DashboardOverviewProps) {
  const model = buildDashboardOverviewModel(stats);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 xl:space-y-8">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-[radial-gradient(circle_at_top_left,rgba(79,84,229,0.18),transparent_32%),radial-gradient(circle_at_80%_18%,rgba(13,148,136,0.16),transparent_28%),linear-gradient(135deg,rgba(255,251,245,0.95),rgba(246,247,251,0.88))] p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.22),transparent_30%),radial-gradient(circle_at_80%_18%,rgba(20,184,166,0.18),transparent_24%),linear-gradient(135deg,rgba(8,13,22,0.96),rgba(12,20,32,0.9))] sm:p-8">
        <div className="absolute inset-y-0 right-0 hidden w-1/3 bg-[linear-gradient(135deg,transparent,rgba(255,255,255,0.4))] xl:block dark:bg-[linear-gradient(135deg,transparent,rgba(255,255,255,0.05))]" />
        <div className="absolute -left-16 top-16 h-40 w-40 rounded-full bg-brand-300/20 blur-3xl dark:bg-brand-400/20" />
        <div className="absolute bottom-0 right-12 h-36 w-36 rounded-full bg-teal-300/20 blur-3xl dark:bg-teal-400/20" />

        <div className="relative grid gap-8 xl:grid-cols-[minmax(0,1.45fr)_360px] xl:items-start">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-900/10 bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-600 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
              <Sparkles className="h-3.5 w-3.5" />
              {model.focusLabel}
            </div>

            <h1 className="mt-5 max-w-3xl font-display text-4xl leading-[0.96] tracking-[-0.04em] text-slate-950 dark:text-slate-50 sm:text-5xl xl:text-6xl">
              {model.headline}
            </h1>

            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300 sm:text-lg">
              {model.description}
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button size="lg" onClick={() => onNavigate("/review")}>
                <Play className="h-4 w-4" />
                Study now
                {stats && stats.words_due_today > 0 && (
                  <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">
                    {stats.words_due_today}
                  </span>
                )}
              </Button>
              <Button variant="secondary" size="lg" onClick={() => onNavigate("/search")}>
                <Search className="h-4 w-4" />
                Search words
              </Button>
              <Button variant="ghost" size="lg" onClick={() => onNavigate("/sets")}>
                <Layers className="h-4 w-4" />
                Open sets
              </Button>
            </div>

            <div className="mt-8 flex flex-wrap gap-2.5">
              <StatusChip label={model.todayLabel} tone="slate" />
              {model.contextChips.map((chip) => (
                <StatusChip key={chip} label={chip} tone="brand" />
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            {model.heroMetrics.map((metric) => (
              <HeroMetricCard key={metric.id} metric={metric} />
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {isLoading
          ? [1, 2, 3, 4].map((item) => (
              <Skeleton key={item} className="h-36 rounded-[1.75rem]" />
            ))
          : model.statCards.map((card) => <SummaryStatCard key={card.id} card={card} />)}
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <article className="card overflow-hidden">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="eyebrow">Study Mix</div>
              <h2 className="mt-2 font-display text-3xl tracking-[-0.03em] text-slate-950 dark:text-slate-50">
                Cards in rotation
              </h2>
            </div>
            <Badge variant="info">
              {model.stateTotal > 0
                ? `${model.stateTotal} ${model.stateTotal === 1 ? "card" : "cards"}`
                : "No active cards"}
            </Badge>
          </div>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-400">
            Keep the mix balanced. Too many fresh cards creates noise; too many relearning cards
            means older material is leaking out of memory.
          </p>

          {isLoading ? (
            <div className="mt-6 space-y-3">
              {[1, 2, 3, 4].map((item) => (
                <Skeleton key={item} className="h-28 rounded-[1.5rem]" />
              ))}
            </div>
          ) : model.stateTotal > 0 ? (
            <div className="mt-6 space-y-3">
              {model.stateMix.map((item) => (
                <StateMixRow key={item.id} item={item} />
              ))}
            </div>
          ) : (
            <EmptyState
              className="mt-6 py-12"
              icon={<BookOpen className="h-8 w-8" />}
              title="No active cards yet"
              description="Save a few words first, then the dashboard will start showing a real learning mix."
              action={
                <Button onClick={() => onNavigate("/search")}>
                  <Search className="h-4 w-4" />
                  Find words
                </Button>
              }
            />
          )}
        </article>

        <article className="card overflow-hidden">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="eyebrow">Recent Sets</div>
              <h2 className="mt-2 font-display text-3xl tracking-[-0.03em] text-slate-950 dark:text-slate-50">
                Collections worth tuning
              </h2>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onNavigate("/sets")}>
              View all
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>

          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-400">
            Recently touched sets belong here so the next organizational move is always close at
            hand.
          </p>

          {isLoading ? (
            <div className="mt-6 space-y-3">
              {[1, 2, 3].map((item) => (
                <Skeleton key={item} className="h-40 rounded-[1.5rem]" />
              ))}
            </div>
          ) : model.recentSets.length > 0 ? (
            <div className="mt-6 space-y-3">
              {model.recentSets.slice(0, 3).map((set) => (
                <RecentSetCard key={set.id} set={set} onNavigate={onNavigate} />
              ))}
            </div>
          ) : (
            <EmptyState
              className="mt-6 py-12"
              icon={<Layers className="h-8 w-8" />}
              title="No study sets yet"
              description="Create smaller themed collections to make review sessions feel sharper and easier to revisit."
              action={
                <Button onClick={() => onNavigate("/sets")}>
                  <Layers className="h-4 w-4" />
                  Create a set
                </Button>
              }
            />
          )}
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
        <article className="card overflow-hidden">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="eyebrow">Recent Activity</div>
              <h2 className="mt-2 font-display text-3xl tracking-[-0.03em] text-slate-950 dark:text-slate-50">
                Search trail
              </h2>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onNavigate("/history")}>
              View history
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-400">
            Recently searched words stay visible so you can reopen context instead of repeating the
            lookup.
          </p>

          {isLoading ? (
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {[1, 2, 3, 4].map((item) => (
                <Skeleton key={item} className="h-36 rounded-[1.5rem]" />
              ))}
            </div>
          ) : model.recentWords.length > 0 ? (
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {model.recentWords.slice(0, 4).map((word) => (
                <RecentWordCard key={word.id} word={word} onNavigate={onNavigate} />
              ))}
            </div>
          ) : (
            <EmptyState
              className="mt-6 py-12"
              icon={<Search className="h-8 w-8" />}
              title="No recent searches"
              description="Look up a word and it will appear here for a faster return path."
              action={
                <Button onClick={() => onNavigate("/search")}>
                  <Search className="h-4 w-4" />
                  Start searching
                </Button>
              }
            />
          )}
        </article>

        <div className="space-y-6">
          <article className="card overflow-hidden">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="eyebrow">Watchlist</div>
                <h2 className="mt-2 font-display text-3xl tracking-[-0.03em] text-slate-950 dark:text-slate-50">
                  Pressure points
                </h2>
              </div>
              <TrendingDown className="h-5 w-5 text-slate-400 dark:text-slate-500" />
            </div>

            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">
              These words are accumulating lapses faster than the rest of the library.
            </p>

            {isLoading ? (
              <div className="mt-6 space-y-3">
                {[1, 2, 3].map((item) => (
                  <Skeleton key={item} className="h-24 rounded-[1.5rem]" />
                ))}
              </div>
            ) : model.hardestWords.length > 0 ? (
              <div className="mt-6 space-y-3">
                {model.hardestWords.slice(0, 3).map((word) => (
                  <HardWordCard key={word.id} word={word} onNavigate={onNavigate} />
                ))}
              </div>
            ) : (
              <EmptyState
                className="mt-6 py-10"
                icon={<TrendingDown className="h-8 w-8" />}
                title="No struggling words"
                description="There are no lapse-heavy cards right now. Keep the rhythm steady."
              />
            )}
          </article>

          <article className="card overflow-hidden">
            <div>
              <div className="eyebrow">Quick Actions</div>
              <h2 className="mt-2 font-display text-3xl tracking-[-0.03em] text-slate-950 dark:text-slate-50">
                Pick the next move
              </h2>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              {model.quickActions.map((action) => (
                <QuickActionCard
                  key={action.id}
                  action={action}
                  onClick={() => onNavigate(action.path)}
                />
              ))}
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}

function HeroMetricCard({ metric }: { metric: DashboardHeroMetricModel }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[1.75rem] border p-5 shadow-sm backdrop-blur-sm",
        heroMetricToneClasses[metric.tone]
      )}
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.28em] opacity-70">
        {metric.label}
      </div>
      <div className="mt-3 font-display text-4xl leading-none tracking-[-0.04em] text-current">
        {metric.value}
      </div>
      <p className="mt-3 text-sm leading-6 opacity-75">{metric.hint}</p>
    </div>
  );
}

function SummaryStatCard({ card }: { card: DashboardStatCardModel }) {
  const iconMap: Record<DashboardStatCardModel["id"], ReactNode> = {
    saved: <BookOpen className="h-5 w-5" />,
    due: <Calendar className="h-5 w-5" />,
    "streak-card": <Flame className="h-5 w-5" />,
    "reviewed-card": <Brain className="h-5 w-5" />,
  };

  return (
    <div
      className={cn(
        "card relative overflow-hidden",
        card.highlight && "ring-1 ring-amber-400/60"
      )}
    >
      <div className={cn("absolute inset-x-0 top-0 h-1", summaryAccentClasses[card.tone])} />

      <div
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-2xl",
          summaryIconClasses[card.tone]
        )}
      >
        {iconMap[card.id]}
      </div>

      <div className="mt-5 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
        {card.label}
      </div>
      <div className="mt-2 font-display text-4xl leading-none tracking-[-0.04em] text-slate-950 dark:text-slate-50">
        {card.value}
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">{card.helper}</p>
    </div>
  );
}

function StateMixRow({ item }: { item: DashboardStateMixItemModel }) {
  return (
    <div className="rounded-[1.5rem] border border-slate-900/10 bg-white/65 p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {item.label}
          </div>
          <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">{item.note}</p>
        </div>
        <Badge className={cn("shrink-0", stateBadgeClasses[item.tone])}>{item.count}</Badge>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-800/80">
          <div
            className={cn("h-full rounded-full transition-[width] duration-500", stateBarClasses[item.tone])}
            style={{ width: `${item.count > 0 ? Math.max(6, item.percentage) : 0}%` }}
          />
        </div>
        <div className="w-12 text-right text-sm font-semibold text-slate-700 dark:text-slate-300">
          {Math.round(item.percentage)}%
        </div>
      </div>
    </div>
  );
}

function RecentSetCard({
  set,
  onNavigate,
}: {
  set: DashboardRecentSetModel;
  onNavigate: (path: string) => void;
}) {
  return (
    <div className="rounded-[1.6rem] border border-slate-900/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.82),rgba(243,247,255,0.82))] p-5 shadow-sm dark:border-white/10 dark:bg-[linear-gradient(135deg,rgba(255,255,255,0.05),rgba(99,102,241,0.08))]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="eyebrow">{set.intensityLabel}</div>
          <h3 className="mt-2 truncate font-display text-2xl tracking-[-0.03em] text-slate-950 dark:text-slate-50">
            {set.name}
          </h3>
        </div>
        <Badge variant={set.wordCount > 0 ? "info" : "default"}>{set.wordCountLabel}</Badge>
      </div>

      <p className="mt-3 line-clamp-2 min-h-[3rem] text-sm leading-6 text-slate-600 dark:text-slate-400">
        {set.description ?? "Add a short note so the purpose of this set stays obvious later on."}
      </p>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400 dark:text-slate-500">
          {set.freshnessLabel}
        </span>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={() => onNavigate(`/sets/${set.id}`)}>
            Open
          </Button>
          {set.wordCount > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onNavigate(`/review?set_id=${set.id}`)}
            >
              <Play className="h-4 w-4" />
              Study
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function RecentWordCard({
  word,
  onNavigate,
}: {
  word: DashboardRecentWordModel;
  onNavigate: (path: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onNavigate(`/words/${word.wordId}`)}
      className="group rounded-[1.6rem] border border-slate-900/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.82),rgba(241,248,255,0.86))] p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md dark:border-white/10 dark:bg-[linear-gradient(135deg,rgba(255,255,255,0.05),rgba(15,23,42,0.35))] dark:hover:border-brand-700/50"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-display text-2xl tracking-[-0.03em] text-slate-950 dark:text-slate-50">
            {word.word}
          </div>
          {word.phoneticText && (
            <div className="mt-1 font-mono text-xs text-slate-400 dark:text-slate-500">
              {word.phoneticText}
            </div>
          )}
        </div>
        <Badge variant="default">{word.searchCountLabel}</Badge>
      </div>

      <div className="mt-4 min-h-[1.75rem] text-sm font-medium text-brand-700 dark:text-brand-300">
        {word.translation ?? "Translation not available"}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 text-xs uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
        <span>{word.recencyLabel}</span>
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </div>
    </button>
  );
}

function HardWordCard({
  word,
  onNavigate,
}: {
  word: DashboardHardWordModel;
  onNavigate: (path: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onNavigate(`/words/${word.wordId}`)}
      className="w-full rounded-[1.5rem] border border-red-200/70 bg-[linear-gradient(135deg,rgba(255,249,249,0.95),rgba(255,244,244,0.82))] p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-red-900/40 dark:bg-[linear-gradient(135deg,rgba(127,29,29,0.14),rgba(15,23,42,0.5))]"
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-red-500/80 dark:text-red-300/80">
        {word.rankLabel}
      </div>
      <div className="mt-2 font-display text-2xl tracking-[-0.03em] text-slate-950 dark:text-slate-50">
        {word.word}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-red-600 dark:text-red-300">{word.lapseLabel}</div>
        <div className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
          {word.easeLabel}
        </div>
      </div>
    </button>
  );
}

function QuickActionCard({
  action,
  onClick,
}: {
  action: DashboardQuickActionModel;
  onClick: () => void;
}) {
  const iconMap: Record<DashboardQuickActionModel["id"], ReactNode> = {
    review: <Play className="h-4 w-4" />,
    search: <Search className="h-4 w-4" />,
    sets: <Layers className="h-4 w-4" />,
    history: <History className="h-4 w-4" />,
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group rounded-[1.6rem] border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md",
        quickActionClasses[action.tone]
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-2xl",
            quickActionIconClasses[action.tone]
          )}
        >
          {iconMap[action.id]}
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-[0.24em] opacity-70">
          {action.badge}
        </span>
      </div>

      <h3 className="mt-4 text-lg font-semibold text-current">{action.title}</h3>
      <p className="mt-2 text-sm leading-6 opacity-80">{action.description}</p>

      <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold">
        {action.ctaLabel}
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </div>
    </button>
  );
}

function StatusChip({
  label,
  tone,
}: {
  label: string;
  tone: DashboardTone;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em]",
        statusChipClasses[tone]
      )}
    >
      {label}
    </span>
  );
}

const heroMetricToneClasses: Record<DashboardTone, string> = {
  brand:
    "border-brand-200/70 bg-brand-50/75 text-brand-950 dark:border-brand-800/40 dark:bg-brand-950/35 dark:text-brand-100",
  teal:
    "border-teal-200/70 bg-teal-50/75 text-teal-950 dark:border-teal-800/40 dark:bg-teal-950/30 dark:text-teal-100",
  amber:
    "border-amber-200/70 bg-amber-50/80 text-amber-950 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-100",
  slate:
    "border-slate-200/80 bg-white/75 text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-slate-100",
};

const summaryAccentClasses: Record<DashboardStatCardModel["tone"], string> = {
  brand: "bg-brand-500",
  amber: "bg-amber-500",
  orange: "bg-orange-500",
  green: "bg-emerald-500",
};

const summaryIconClasses: Record<DashboardStatCardModel["tone"], string> = {
  brand: "bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300",
  amber: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  orange: "bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300",
  green: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
};

const stateBadgeClasses: Record<DashboardTone, string> = {
  brand: "bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-300",
  teal: "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  slate: "bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300",
};

const stateBarClasses: Record<DashboardTone, string> = {
  brand: "bg-brand-500",
  teal: "bg-teal-500",
  amber: "bg-amber-500",
  slate: "bg-slate-500",
};

const quickActionClasses: Record<DashboardTone, string> = {
  brand:
    "border-brand-200/70 bg-brand-50/70 text-brand-950 dark:border-brand-900/40 dark:bg-brand-950/30 dark:text-brand-100",
  teal:
    "border-teal-200/70 bg-teal-50/70 text-teal-950 dark:border-teal-900/40 dark:bg-teal-950/30 dark:text-teal-100",
  amber:
    "border-amber-200/70 bg-amber-50/80 text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100",
  slate:
    "border-slate-200/80 bg-slate-100/85 text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-slate-100",
};

const quickActionIconClasses: Record<DashboardTone, string> = {
  brand: "bg-white/70 text-brand-700 dark:bg-white/10 dark:text-brand-200",
  teal: "bg-white/70 text-teal-700 dark:bg-white/10 dark:text-teal-200",
  amber: "bg-white/70 text-amber-700 dark:bg-white/10 dark:text-amber-200",
  slate: "bg-white/80 text-slate-700 dark:bg-white/10 dark:text-slate-200",
};

const statusChipClasses: Record<DashboardTone, string> = {
  brand: "bg-white/70 text-brand-700 dark:bg-white/10 dark:text-brand-200",
  teal: "bg-white/70 text-teal-700 dark:bg-white/10 dark:text-teal-200",
  amber: "bg-white/70 text-amber-700 dark:bg-white/10 dark:text-amber-200",
  slate: "bg-slate-900/5 text-slate-700 dark:bg-white/5 dark:text-slate-300",
};
