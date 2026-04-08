import type { DashboardStats } from "@/types";

export type DashboardTone = "brand" | "teal" | "amber" | "slate";

export interface DashboardHeroMetricModel {
  id: string;
  label: string;
  value: string;
  hint: string;
  tone: DashboardTone;
}

export interface DashboardStatCardModel {
  id: string;
  label: string;
  value: number;
  helper: string;
  tone: "brand" | "amber" | "orange" | "green";
  highlight?: boolean;
}

export interface DashboardStateMixItemModel {
  id: string;
  label: string;
  count: number;
  percentage: number;
  note: string;
  tone: DashboardTone;
}

export interface DashboardHardWordModel {
  id: string;
  wordId: string;
  word: string;
  rankLabel: string;
  lapseLabel: string;
  easeLabel: string;
}

export interface DashboardRecentWordModel {
  id: string;
  wordId: string;
  word: string;
  phoneticText: string | null;
  translation: string | null;
  searchCountLabel: string;
  recencyLabel: string;
}

export interface DashboardRecentSetModel {
  id: string;
  name: string;
  description: string | null;
  wordCount: number;
  wordCountLabel: string;
  freshnessLabel: string;
  intensityLabel: string;
}

export interface DashboardQuickActionModel {
  id: string;
  title: string;
  description: string;
  badge: string;
  ctaLabel: string;
  path: string;
  tone: DashboardTone;
}

export interface DashboardOverviewModel {
  todayLabel: string;
  headline: string;
  description: string;
  focusLabel: string;
  contextChips: string[];
  heroMetrics: DashboardHeroMetricModel[];
  statCards: DashboardStatCardModel[];
  stateMix: DashboardStateMixItemModel[];
  hardestWords: DashboardHardWordModel[];
  recentWords: DashboardRecentWordModel[];
  recentSets: DashboardRecentSetModel[];
  quickActions: DashboardQuickActionModel[];
  stateTotal: number;
}

export function buildDashboardOverviewModel(
  stats?: DashboardStats,
  now = new Date()
): DashboardOverviewModel {
  const todayLabel = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const wordsByState = stats?.words_by_state ?? {
    new: 0,
    learning: 0,
    review: 0,
    relearning: 0,
  };

  const stateTotal =
    wordsByState.new +
    wordsByState.learning +
    wordsByState.review +
    wordsByState.relearning;

  return {
    todayLabel,
    headline: getDashboardHeadline(stats),
    description: getDashboardDescription(stats, todayLabel),
    focusLabel: getFocusLabel(stats),
    contextChips: getContextChips(stats, stateTotal),
    heroMetrics: [
      {
        id: "queue",
        label: "Due Now",
        value: stats ? `${stats.words_due_today}` : "...",
        hint: stats
          ? stats.words_due_today > 0
            ? "Your queue is live."
            : "Nothing urgent at the moment."
          : "Refreshing queue activity.",
        tone: "brand",
      },
      {
        id: "reviewed",
        label: "Reviewed Today",
        value: stats ? `${stats.total_reviews_today}` : "...",
        hint: stats
          ? stats.total_reviews_today > 0
            ? "Momentum already recorded."
            : "No reps logged yet."
          : "Checking today's output.",
        tone: "teal",
      },
      {
        id: "streak",
        label: "Current Streak",
        value: stats ? `${stats.current_streak_days}` : "...",
        hint: stats
          ? `${pluralize(stats.current_streak_days, "day")} in a row.`
          : "Scanning your recent streak.",
        tone: "amber",
      },
      {
        id: "library",
        label: "Saved Words",
        value: stats ? `${stats.total_words_saved}` : "...",
        hint: stats
          ? stats.total_words_saved > 0
            ? "Available in your study library."
            : "Your library is still empty."
          : "Counting tracked vocabulary.",
        tone: "slate",
      },
    ],
    statCards: [
      {
        id: "saved",
        label: "Words saved",
        value: stats?.total_words_saved ?? 0,
        helper: "Vocabulary ready to organize and review.",
        tone: "brand",
      },
      {
        id: "due",
        label: "Due today",
        value: stats?.words_due_today ?? 0,
        helper: "Cards currently asking for attention.",
        tone: "amber",
        highlight: Boolean(stats && stats.words_due_today > 0),
      },
      {
        id: "streak-card",
        label: "Day streak",
        value: stats?.current_streak_days ?? 0,
        helper: "Consistency across recent study days.",
        tone: "orange",
      },
      {
        id: "reviewed-card",
        label: "Reviewed today",
        value: stats?.total_reviews_today ?? 0,
        helper: "Repetitions already closed out today.",
        tone: "green",
      },
    ],
    stateMix: [
      {
        id: "new",
        label: "New",
        count: wordsByState.new,
        percentage: getPercentage(wordsByState.new, stateTotal),
        note: "Fresh captures waiting for a first recall.",
        tone: "slate",
      },
      {
        id: "learning",
        label: "Learning",
        count: wordsByState.learning,
        percentage: getPercentage(wordsByState.learning, stateTotal),
        note: "Cards still building a stable memory trace.",
        tone: "amber",
      },
      {
        id: "review",
        label: "Review",
        count: wordsByState.review,
        percentage: getPercentage(wordsByState.review, stateTotal),
        note: "Longer-term cards rotating through spaced checks.",
        tone: "brand",
      },
      {
        id: "relearning",
        label: "Relearning",
        count: wordsByState.relearning,
        percentage: getPercentage(wordsByState.relearning, stateTotal),
        note: "Vocabulary you are actively rescuing after misses.",
        tone: "teal",
      },
    ],
    hardestWords: (stats?.hardest_words ?? []).map((word, index) => ({
      id: word.word_id,
      wordId: word.word_id,
      word: word.word,
      rankLabel: `#${index + 1} pressure point`,
      lapseLabel: `${word.lapses} ${pluralize(word.lapses, "lapse")}`,
      easeLabel: `Ease ${word.ease_factor.toFixed(2)}`,
    })),
    recentWords: (stats?.recent_words ?? []).map((word) => ({
      id: word.word_id,
      wordId: word.word_id,
      word: word.word,
      phoneticText: word.phonetic_text,
      translation: word.translation_uk,
      searchCountLabel: `${word.search_count} ${pluralize(word.search_count, "lookup")}`,
      recencyLabel: `Visited ${formatRelativeDate(word.last_searched_at)}`,
    })),
    recentSets: (stats?.recent_sets ?? []).map((set) => ({
      id: set.id,
      name: set.name,
      description: set.description,
      wordCount: set.word_count,
      wordCountLabel: `${set.word_count} ${pluralize(set.word_count, "word")}`,
      freshnessLabel: `Updated ${formatRelativeDate(set.updated_at)}`,
      intensityLabel: getSetIntensityLabel(set.word_count),
    })),
    quickActions: getQuickActions(stats),
    stateTotal,
  };
}

function getDashboardHeadline(stats?: DashboardStats) {
  if (!stats) {
    return "Composing today's learning brief";
  }

  if (stats.total_words_saved === 0) {
    return "Start building a vocabulary room worth returning to";
  }

  if (stats.words_due_today > 0) {
    return `Protect the streak while ${stats.words_due_today} ${pluralize(stats.words_due_today, "card")} wait in queue`;
  }

  if (stats.total_reviews_today > 0) {
    return "The queue is clear, and today already has real momentum";
  }

  return "Your desk is clear, so this is a good moment to capture new words";
}

function getDashboardDescription(stats: DashboardStats | undefined, todayLabel: string) {
  if (!stats) {
    return `${todayLabel}. Pulling your queue, streak, and recent vocabulary trails into one place.`;
  }

  if (stats.total_words_saved === 0) {
    return `${todayLabel}. Search a few useful words, save the ones worth keeping, and this board will turn into a daily study cockpit.`;
  }

  if (stats.words_due_today > 0) {
    return `${todayLabel}. You have ${stats.words_due_today} ${pluralize(stats.words_due_today, "card")} due right now, ${stats.total_reviews_today} ${pluralize(stats.total_reviews_today, "review")} already completed, and a ${stats.current_streak_days}-day streak worth defending.`;
  }

  if (stats.total_reviews_today > 0) {
    return `${todayLabel}. Today's queue is already handled, so the best next move is to expand the library or tighten a few study sets.`;
  }

  return `${todayLabel}. Everything urgent is quiet, which makes this a good window for search, curation, and set cleanup.`;
}

function getFocusLabel(stats?: DashboardStats) {
  if (!stats) {
    return "Refreshing Snapshot";
  }

  if (stats.total_words_saved === 0) {
    return "Build The Library";
  }

  if (stats.words_due_today > 0) {
    return "Queue Is Live";
  }

  if (stats.total_reviews_today > 0) {
    return "Momentum Held";
  }

  return "Clear Board";
}

function getContextChips(stats: DashboardStats | undefined, stateTotal: number) {
  if (!stats) {
    return ["Syncing your study signals", "Queue + streak + history", "Live data"];
  }

  const chips = [`${stats.total_words_saved} ${pluralize(stats.total_words_saved, "saved word")}`];

  if (stateTotal > 0) {
    chips.push(`${stateTotal} ${pluralize(stateTotal, "card")} in rotation`);
  }

  if (stats.recent_sets.length > 0) {
    chips.push(`${stats.recent_sets.length} ${pluralize(stats.recent_sets.length, "recent set")}`);
  } else {
    chips.push("No active sets yet");
  }

  return chips;
}

function getQuickActions(stats?: DashboardStats): DashboardQuickActionModel[] {
  return [
    {
      id: "review",
      title: stats?.words_due_today
        ? `Clear ${stats.words_due_today} due ${pluralize(stats.words_due_today, "card")}`
        : "Open a fresh review session",
      description: stats?.words_due_today
        ? "Jump straight into the queue and keep the active cards from slipping."
        : "Run the full-screen review flow and keep your recall rhythm warm.",
      badge: stats?.words_due_today ? `${stats.words_due_today} due` : "Queue clear",
      ctaLabel: "Study now",
      path: "/review",
      tone: "brand",
    },
    {
      id: "search",
      title: "Capture fresh vocabulary",
      description: "Look up a word, inspect the details, and save only the entries worth repeating.",
      badge: stats?.recent_words.length
        ? `${stats.recent_words.length} recent words`
        : "No recent lookups",
      ctaLabel: "Search words",
      path: "/search",
      tone: "teal",
    },
    {
      id: "sets",
      title: "Shape tighter study sets",
      description: "Split large collections into smaller themes that are easier to revisit with intent.",
      badge: stats?.recent_sets.length
        ? `${stats.recent_sets.length} recent sets`
        : "Create your first set",
      ctaLabel: "Open sets",
      path: "/sets",
      tone: "amber",
    },
    {
      id: "history",
      title: "Revisit the latest search trail",
      description: "Return to recently explored words without repeating the lookup from scratch.",
      badge: stats?.recent_words.length
        ? `${stats.recent_words.length} touchpoints`
        : "History is empty",
      ctaLabel: "View history",
      path: "/history",
      tone: "slate",
    },
  ];
}

function getSetIntensityLabel(wordCount: number) {
  if (wordCount === 0) {
    return "Empty shell";
  }

  if (wordCount < 5) {
    return "Starter pack";
  }

  if (wordCount < 12) {
    return "Focused set";
  }

  return "Deep set";
}

function getPercentage(count: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return (count / total) * 100;
}

function formatRelativeDate(isoString: string) {
  const date = new Date(isoString);
  const timestamp = date.getTime();

  if (Number.isNaN(timestamp)) {
    return "recently";
  }

  const diffMinutes = Math.floor((Date.now() - timestamp) / 60_000);

  if (diffMinutes < 1) {
    return "just now";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);

  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.floor(diffHours / 24);

  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return count === 1 ? singular : plural;
}
