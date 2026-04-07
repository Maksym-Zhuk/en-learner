import { startTransition, useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  BookOpenCheck,
  CheckCircle2,
  Clock3,
  Keyboard,
  LayoutDashboard,
  RefreshCw,
  RotateCcw,
  Search,
} from "lucide-react";
import toast from "react-hot-toast";
import { reviewApi } from "@/api/review";
import { Button, FullPageSpinner, Spinner } from "@/components/ui";
import type {
  ReviewCard,
  ReviewRating,
  ReviewSession,
  SessionSummary,
} from "@/types";

type RatingKey = ReviewRating;

interface CardSideContent {
  main: string;
  sub?: string;
  note?: string;
  details?: Array<{ label: string; value: string }>;
}

const SESSION_LIMIT = 20;

const RATING_META: Record<
  RatingKey,
  { label: string; hint: string; shortcut: string; className: string }
> = {
  again: {
    label: "Again",
    hint: "Repeat soon",
    shortcut: "1",
    className: "bg-red-500 text-white hover:bg-red-600",
  },
  hard: {
    label: "Hard",
    hint: "Still shaky",
    shortcut: "2",
    className: "bg-amber-500 text-white hover:bg-amber-600",
  },
  good: {
    label: "Good",
    hint: "Remembered it",
    shortcut: "3",
    className: "bg-brand-600 text-white hover:bg-brand-700",
  },
  easy: {
    label: "Easy",
    hint: "Too obvious",
    shortcut: "4",
    className: "bg-green-500 text-white hover:bg-green-600",
  },
};

const RATING_SHORTCUTS: Record<string, RatingKey> = {
  "1": "again",
  "2": "hard",
  "3": "good",
  "4": "easy",
};

export default function Review() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setId = searchParams.get("set_id") ?? undefined;
  const returnPath = setId ? `/sets/${setId}` : "/dashboard";
  const returnLabel = setId ? "Back to set" : "Back to dashboard";
  const sessionLabel = setId ? "Set review" : "Daily review";

  const [sessionData, setSessionData] = useState<ReviewSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [cardStartTime, setCardStartTime] = useState(Date.now());
  const [done, setDone] = useState(false);
  const [sessionReloadKey, setSessionReloadKey] = useState(0);

  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summaryReloadKey, setSummaryReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setFetchError(null);
    setSessionData(null);
    setCurrentIdx(0);
    setRevealed(false);
    setDone(false);
    setSummary(null);
    setSummaryError(null);
    setSummaryLoading(false);
    setSummaryReloadKey(0);

    reviewApi
      .startSession(setId, SESSION_LIMIT)
      .then((data) => {
        if (cancelled) return;
        setSessionData(data);
        setCardStartTime(Date.now());
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setFetchError(getErrorMessage(error, "Failed to load review session"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [setId, sessionReloadKey]);

  useEffect(() => {
    if (!done || !sessionData?.session_id) return;

    let cancelled = false;
    setSummaryLoading(true);
    setSummaryError(null);

    reviewApi
      .summary(sessionData.session_id)
      .then((data) => {
        if (!cancelled) setSummary(data);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setSummaryError(getErrorMessage(error, "Failed to load session stats."));
        }
      })
      .finally(() => {
        if (!cancelled) setSummaryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [done, sessionData?.session_id, summaryReloadKey]);

  const restartSession = () => {
    startTransition(() => {
      setSessionReloadKey((value) => value + 1);
    });
  };

  const submitMutation = useMutation({
    mutationFn: reviewApi.submit,
    onSuccess: () => {
      if (!sessionData) return;

      const nextIndex = currentIdx + 1;
      const isLastCard = nextIndex >= sessionData.cards.length;

      if (isLastCard) {
        setDone(true);
        return;
      }

      startTransition(() => {
        setCurrentIdx(nextIndex);
      });
      setRevealed(false);
      setCardStartTime(Date.now());
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Failed to save your rating"));
    },
  });

  const handleRating = useCallback(
    (rating: RatingKey) => {
      if (!sessionData?.session_id || submitMutation.isPending) return;

      const card = sessionData.cards[currentIdx];
      if (!card) return;

      submitMutation.mutate({
        session_id: sessionData.session_id,
        card_id: card.id,
        rating,
        time_spent_ms: Math.max(100, Date.now() - cardStartTime),
      });
    },
    [sessionData, currentIdx, cardStartTime, submitMutation]
  );

  useEffect(() => {
    if (!sessionData?.cards[currentIdx] || loading || done) return;

    const handler = (event: KeyboardEvent) => {
      if (submitMutation.isPending) return;

      if ((event.key === " " || event.key === "Enter") && !revealed) {
        event.preventDefault();
        setRevealed(true);
        return;
      }

      const shortcut = RATING_SHORTCUTS[event.key];
      if (revealed && shortcut) {
        event.preventDefault();
        handleRating(shortcut);
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [currentIdx, done, handleRating, loading, revealed, sessionData, submitMutation.isPending]);

  if (loading) return <FullPageSpinner />;

  if (fetchError) {
    return (
      <CenteredState
        icon={<AlertCircle className="h-10 w-10 text-red-400" />}
        title="Failed to start review session"
        description={fetchError}
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate(returnPath)}>
              <ArrowLeft className="h-4 w-4" />
              {returnLabel}
            </Button>
            <Button onClick={restartSession}>
              <RefreshCw className="h-4 w-4" />
              Try again
            </Button>
          </>
        }
      />
    );
  }

  if (!sessionData || sessionData.cards.length === 0) {
    return (
      <CenteredState
        icon={<BookOpenCheck className="h-10 w-10 text-brand-500" />}
        title={setId ? "This set has nothing due right now" : "You are caught up for now"}
        description={
          setId
            ? "Add more words or come back later when cards from this set are due again."
            : "No cards are due right now. Save more words and they will show up here automatically."
        }
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate("/search")}>
              <Search className="h-4 w-4" />
              Search words
            </Button>
            <Button onClick={() => navigate(returnPath)}>
              {setId ? <ArrowLeft className="h-4 w-4" /> : <LayoutDashboard className="h-4 w-4" />}
              {setId ? "Back to set" : "Dashboard"}
            </Button>
          </>
        }
      />
    );
  }

  if (done) {
    return (
      <ReviewSummaryScreen
        reviewed={summary?.total_reviewed ?? currentIdx + 1}
        summary={summary}
        summaryLoading={summaryLoading}
        summaryError={summaryError}
        sessionLabel={sessionLabel}
        closeLabel={returnLabel}
        onClose={() => navigate(returnPath)}
        onRestart={restartSession}
        onRetrySummary={() => setSummaryReloadKey((value) => value + 1)}
      />
    );
  }

  const card = sessionData.cards[currentIdx];
  const completedCount = currentIdx;
  const totalCards = sessionData.cards.length;
  const progress = (completedCount / totalCards) * 100;
  const remainingCount = totalCards - currentIdx - 1;

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-gray-950">
      <div className="border-b border-gray-200 bg-white px-4 py-4 dark:border-gray-800 dark:bg-gray-900 sm:px-6">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(returnPath)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>

            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {sessionLabel}
              </div>
              <div className="text-xs text-gray-500">
                Card {currentIdx + 1} of {totalCards} · {remainingCount} left after this one
              </div>
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              {sessionData.new_count > 0 && (
                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                  {sessionData.new_count} new
                </span>
              )}
              {sessionData.review_count > 0 && (
                <span className="rounded-full bg-brand-50 px-2.5 py-1 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300">
                  {sessionData.review_count} review
                </span>
              )}
              {sessionData.relearning_count > 0 && (
                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                  {sessionData.relearning_count} relearning
                </span>
              )}
            </div>
          </div>

          <div>
            <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-800">
              <div
                className="h-full rounded-full bg-brand-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
              <span>{completedCount} reviewed</span>
              <span>{totalCards} total</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-6 sm:px-6">
        <div className="w-full max-w-4xl">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-500">
            <div className="flex flex-wrap gap-2">
              <InfoPill label={getFaceLabel(card.face)} />
              <InfoPill label={getStateLabel(card.state)} />
            </div>
            <div className="flex items-center gap-2">
              <Clock3 className="h-4 w-4" />
              <span>{getCardContext(card)}</span>
            </div>
          </div>

          <CardFace card={card} revealed={revealed} />

          {!revealed ? (
            <div className="mt-8 text-center">
              <Button size="lg" onClick={() => setRevealed(true)} className="mx-auto">
                Show answer
              </Button>
              <p className="mt-3 text-sm text-gray-500">
                Press <kbd className="rounded bg-gray-200 px-1.5 py-0.5 font-mono text-xs dark:bg-gray-800">Space</kbd>{" "}
                or{" "}
                <kbd className="rounded bg-gray-200 px-1.5 py-0.5 font-mono text-xs dark:bg-gray-800">Enter</kbd>
              </p>
            </div>
          ) : (
            <div className="mt-8">
              <div className="mb-4 flex items-center justify-center gap-2 text-sm text-gray-500">
                <Keyboard className="h-4 w-4" />
                <span>Rate this card with buttons or press 1 to 4.</span>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {(Object.keys(RATING_META) as RatingKey[]).map((rating) => {
                  const meta = RATING_META[rating];

                  return (
                    <button
                      key={rating}
                      type="button"
                      onClick={() => handleRating(rating)}
                      disabled={submitMutation.isPending}
                      className={`rounded-2xl px-4 py-4 text-left transition-transform active:scale-[0.98] disabled:opacity-60 ${meta.className}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-base font-semibold">{meta.label}</span>
                        <kbd className="rounded bg-black/10 px-1.5 py-0.5 text-xs font-mono text-white/80">
                          {meta.shortcut}
                        </kbd>
                      </div>
                      <p className="mt-2 text-sm text-white/85">{meta.hint}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <HintCard
              title="Reveal"
              value="Space / Enter"
              icon={<Keyboard className="h-4 w-4" />}
            />
            <HintCard
              title="Rate"
              value="1, 2, 3, 4"
              icon={<Keyboard className="h-4 w-4" />}
            />
            <HintCard
              title="Remaining"
              value={`${remainingCount} ${remainingCount === 1 ? "card" : "cards"}`}
              icon={<Clock3 className="h-4 w-4" />}
            />
          </div>

          {submitMutation.isPending && (
            <div className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-500">
              <Spinner className="h-4 w-4" />
              Saving your rating...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CardFace({ card, revealed }: { card: ReviewCard; revealed: boolean }) {
  const front = getCardFront(card);
  const back = getCardBack(card);

  return (
    <div className="card min-h-[360px] rounded-[28px] border border-gray-200 bg-white/95 p-6 shadow-xl dark:border-gray-800 dark:bg-gray-900">
      <div className="text-xs font-medium uppercase tracking-[0.18em] text-gray-400">
        Prompt
      </div>

      <div className="flex min-h-[200px] flex-1 items-center justify-center py-8 text-center">
        <div className="space-y-3">
          <div className="text-3xl font-bold leading-tight break-words text-gray-950 dark:text-gray-50 sm:text-4xl">
            {front.main}
          </div>
          {front.sub && (
            <div className="font-mono text-sm text-gray-400">
              {front.sub}
            </div>
          )}
          {front.note && (
            <p className="mx-auto max-w-2xl text-sm text-gray-500 dark:text-gray-400">
              {front.note}
            </p>
          )}
        </div>
      </div>

      {revealed && (
        <div className="space-y-4 border-t border-gray-200 pt-5 dark:border-gray-700">
          <div className="text-center">
            <div className="text-xs font-medium uppercase tracking-[0.18em] text-gray-400">
              Answer
            </div>
            <div className="mt-2 text-2xl font-semibold text-brand-700 dark:text-brand-300 sm:text-3xl">
              {back.main}
            </div>
            {back.sub && (
              <p className="mt-2 text-sm font-medium text-gray-500 dark:text-gray-400">
                {back.sub}
              </p>
            )}
          </div>

          {back.details && back.details.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {back.details.map((detail) => (
                <div
                  key={detail.label}
                  className="rounded-2xl bg-gray-50 p-3 text-left dark:bg-gray-800/70"
                >
                  <div className="text-xs font-medium uppercase tracking-wide text-gray-400">
                    {detail.label}
                  </div>
                  <div className="mt-1 text-sm text-gray-700 dark:text-gray-200">
                    {detail.value}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ReviewSummaryScreen({
  reviewed,
  summary,
  summaryLoading,
  summaryError,
  sessionLabel,
  closeLabel,
  onRestart,
  onRetrySummary,
  onClose,
}: {
  reviewed: number;
  summary: SessionSummary | null;
  summaryLoading: boolean;
  summaryError: string | null;
  sessionLabel: string;
  closeLabel: string;
  onRestart: () => void;
  onRetrySummary: () => void;
  onClose: () => void;
}) {
  return (
    <CenteredState
      icon={<CheckCircle2 className="h-12 w-12 text-green-500" />}
      title="Session complete"
      description={
        summary
          ? `You reviewed ${summary.total_reviewed} ${summary.total_reviewed === 1 ? "card" : "cards"} in ${formatDuration(summary.duration_ms)}.`
          : `You finished this ${sessionLabel.toLowerCase()} after ${reviewed} ${reviewed === 1 ? "card" : "cards"}.`
      }
      body={
        summaryLoading ? (
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
            <Spinner className="h-4 w-4" />
            Loading session stats...
          </div>
        ) : summary ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <SummaryStat label="Again" value={summary.again_count} tone="bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300" />
            <SummaryStat label="Hard" value={summary.hard_count} tone="bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300" />
            <SummaryStat label="Good" value={summary.good_count} tone="bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300" />
            <SummaryStat label="Easy" value={summary.easy_count} tone="bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-300" />
          </div>
        ) : summaryError ? (
          <div className="space-y-3 text-center">
            <p className="text-sm text-gray-500">{summaryError}</p>
            <Button variant="secondary" onClick={onRetrySummary}>
              <RefreshCw className="h-4 w-4" />
              Retry stats
            </Button>
          </div>
        ) : null
      }
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            <ArrowLeft className="h-4 w-4" />
            {closeLabel}
          </Button>
          <Button onClick={onRestart}>
            <RotateCcw className="h-4 w-4" />
            Study more
          </Button>
        </>
      }
    />
  );
}

function CenteredState({
  icon,
  title,
  description,
  body,
  actions,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  body?: React.ReactNode;
  actions: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-8 dark:bg-gray-950">
      <div className="w-full max-w-xl rounded-3xl border border-gray-200 bg-white p-6 text-center shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 dark:bg-gray-800">
          {icon}
        </div>
        <h2 className="text-2xl font-bold text-gray-950 dark:text-gray-50">{title}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-gray-500 dark:text-gray-400">
          {description}
        </p>
        {body && <div className="mt-6">{body}</div>}
        <div className="mt-6 flex flex-wrap justify-center gap-3">{actions}</div>
      </div>
    </div>
  );
}

function HintCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center gap-2 text-gray-400">
        {icon}
        <span>{title}</span>
      </div>
      <div className="mt-1 font-medium text-gray-700 dark:text-gray-200">{value}</div>
    </div>
  );
}

function InfoPill({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-600 shadow-sm dark:bg-gray-900 dark:text-gray-300">
      {label}
    </span>
  );
}

function SummaryStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className={`rounded-2xl px-4 py-3 text-left ${tone}`}>
      <div className="text-xs font-medium uppercase tracking-wide opacity-80">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function getCardFront(card: ReviewCard): CardSideContent {
  switch (card.face) {
    case "en_to_uk":
      return {
        main: card.word,
        sub: card.phonetic_text ?? undefined,
        note: card.primary_definition ?? undefined,
      };
    case "uk_to_en":
      return {
        main: card.translation_uk ?? "?",
        note: card.primary_definition ?? "Recall the English word.",
      };
    case "definition_to_word":
      return {
        main: card.primary_definition ?? "?",
        note: "Recall the English word from this definition.",
      };
    case "example_to_word":
      return {
        main: maskWordInExample(card.primary_example ?? "?", card.word),
        note: "Fill the blank with the missing word.",
      };
    default:
      return { main: card.word };
  }
}

function getCardBack(card: ReviewCard): CardSideContent {
  switch (card.face) {
    case "en_to_uk":
      return {
        main: card.translation_uk ?? "No translation yet",
        sub: card.word,
        details: compactDetails([
          { label: "Definition", value: card.primary_definition },
          { label: "Example", value: card.primary_example },
        ]),
      };
    case "uk_to_en":
      return {
        main: card.word,
        sub: card.phonetic_text ?? undefined,
        details: compactDetails([
          { label: "Translation", value: card.translation_uk },
          { label: "Definition", value: card.primary_definition },
          { label: "Example", value: card.primary_example },
        ]),
      };
    case "definition_to_word":
      return {
        main: card.word,
        sub: card.translation_uk ?? undefined,
        details: compactDetails([{ label: "Example", value: card.primary_example }]),
      };
    case "example_to_word":
      return {
        main: card.word,
        sub: card.translation_uk ?? undefined,
        details: compactDetails([
          { label: "Definition", value: card.primary_definition },
          { label: "Full example", value: card.primary_example },
        ]),
      };
    default:
      return { main: card.word };
  }
}

function compactDetails(
  details: Array<{ label: string; value: string | null | undefined }>
): Array<{ label: string; value: string }> {
  return details
    .filter((detail): detail is { label: string; value: string } => Boolean(detail.value))
    .map((detail) => ({ label: detail.label, value: detail.value }));
}

function getFaceLabel(face: string): string {
  const labels: Record<string, string> = {
    en_to_uk: "English to Ukrainian",
    uk_to_en: "Ukrainian to English",
    definition_to_word: "Definition to word",
    example_to_word: "Fill in the blank",
  };

  return labels[face] ?? face;
}

function getStateLabel(state: string): string {
  const labels: Record<string, string> = {
    new: "New card",
    learning: "Learning",
    review: "Review",
    relearning: "Relearning",
  };

  return labels[state] ?? state;
}

function getCardContext(card: ReviewCard): string {
  if (card.state === "new") return "First time in review";
  if (card.lapses > 0) {
    return `${card.lapses} ${card.lapses === 1 ? "lapse" : "lapses"} so far`;
  }
  if (card.reps > 0) {
    return `${card.reps} ${card.reps === 1 ? "review" : "reviews"} completed`;
  }
  return "In progress";
}

function formatDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) return `${seconds}s`;
  if (seconds === 0) return `${minutes}m`;
  return `${minutes}m ${seconds}s`;
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function maskWordInExample(example: string, word: string): string {
  const escapedWord = escapeRegExp(word.trim());
  if (!escapedWord) return example;

  const withBoundary = new RegExp(`\\b${escapedWord}\\b`, "gi");
  const masked = example.replace(withBoundary, "_____");

  if (masked !== example) return masked;
  return example.replace(new RegExp(escapedWord, "gi"), "_____");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
