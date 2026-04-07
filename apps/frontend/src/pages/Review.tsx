import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { X, RotateCcw, AlertCircle } from "lucide-react";
import { reviewApi } from "@/api/review";
import { Button, FullPageSpinner, Spinner } from "@/components/ui";
import type { ReviewCard, ReviewSession } from "@/types";

type RatingKey = "again" | "hard" | "good" | "easy";

const RATING_COLORS: Record<RatingKey, string> = {
  again: "bg-red-500 hover:bg-red-600 text-white",
  hard: "bg-amber-500 hover:bg-amber-600 text-white",
  good: "bg-brand-600 hover:bg-brand-700 text-white",
  easy: "bg-green-500 hover:bg-green-600 text-white",
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

  // Session is fetched imperatively on mount — NOT cached in TanStack Query.
  // Starting a session is a side-effectful operation that creates a DB record;
  // caching it would serve stale "0 cards" results after new words are added.
  const [sessionData, setSessionData] = useState<ReviewSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [currentIdx, setCurrentIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [cardStartTime, setCardStartTime] = useState(Date.now());
  const [done, setDone] = useState(false);

  // Fetch a fresh session every time this component mounts.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFetchError(null);
    setSessionData(null);
    setCurrentIdx(0);
    setRevealed(false);
    setDone(false);

    reviewApi
      .startSession(setId, 20)
      .then((data) => {
        if (!cancelled) {
          setSessionData(data);
          setCardStartTime(Date.now());
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setFetchError(err.message ?? "Failed to load review session");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  // Re-run if the set filter changes (e.g. user navigates from one set review to another)
  }, [setId]);

  const submitMutation = useMutation({
    mutationFn: reviewApi.submit,
    onSuccess: () => {
      if (!sessionData) return;
      const next = currentIdx + 1;
      if (next >= sessionData.cards.length) {
        setDone(true);
      } else {
        setCurrentIdx(next);
        setRevealed(false);
        setCardStartTime(Date.now());
      }
    },
  });

  const handleRating = useCallback(
    (rating: RatingKey) => {
      if (!sessionData?.session_id || !sessionData.cards[currentIdx]) return;
      const card = sessionData.cards[currentIdx];
      submitMutation.mutate({
        session_id: sessionData.session_id,
        card_id: card.id,
        rating,
        time_spent_ms: Date.now() - cardStartTime,
      });
    },
    [sessionData, currentIdx, cardStartTime, submitMutation]
  );

  // Keyboard shortcuts: Space to reveal, 1-4 to rate
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (!revealed) setRevealed(true);
      }
      if (revealed && RATING_SHORTCUTS[e.key]) {
        handleRating(RATING_SHORTCUTS[e.key]);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [revealed, handleRating]);

  // ---- Render states ----

  if (loading) return <FullPageSpinner />;

  if (fetchError) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-gray-50 dark:bg-gray-950">
        <AlertCircle className="h-12 w-12 text-red-400" />
        <p className="text-lg font-medium">Failed to start review session</p>
        <p className="text-sm text-gray-500">{fetchError}</p>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => navigate("/dashboard")}>
            Dashboard
          </Button>
          <Button onClick={() => window.location.reload()}>Try again</Button>
        </div>
      </div>
    );
  }

  if (!sessionData || sessionData.cards.length === 0) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-gray-50 dark:bg-gray-950">
        <div className="text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold">All caught up!</h2>
          <p className="text-gray-500 mt-2">
            No cards are due for review right now.
          </p>
          <p className="text-sm text-gray-400 mt-1">
            Save words and they&apos;ll appear here automatically.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => navigate("/search")}>
            Search words
          </Button>
          <Button onClick={() => navigate("/dashboard")}>Dashboard</Button>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <SessionSummary
        reviewed={currentIdx + 1}
        onRestart={() => {
          // Refetch a new session by re-running the effect
          setSessionData(null);
          setLoading(true);
          reviewApi
            .startSession(setId, 20)
            .then((data) => {
              setSessionData(data);
              setCurrentIdx(0);
              setRevealed(false);
              setDone(false);
              setCardStartTime(Date.now());
            })
            .finally(() => setLoading(false));
        }}
        onClose={() => navigate("/dashboard")}
      />
    );
  }

  const card = sessionData.cards[currentIdx];
  const progress = (currentIdx / sessionData.cards.length) * 100;

  return (
    <div className="flex h-screen flex-col bg-gray-50 dark:bg-gray-950">
      {/* Top bar */}
      <div className="flex items-center gap-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-6 py-3">
        <button
          onClick={() => navigate(-1)}
          className="rounded-lg p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <X className="h-5 w-5 text-gray-500" />
        </button>

        <div className="flex-1 max-w-sm">
          <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-800">
            <div
              className="h-full rounded-full bg-brand-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <span className="text-sm text-gray-500 tabular-nums">
          {currentIdx + 1} / {sessionData.cards.length}
        </span>

        <div className="flex gap-2 text-xs text-gray-400">
          {sessionData.new_count > 0 && (
            <span className="rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5">
              {sessionData.new_count} new
            </span>
          )}
          {sessionData.review_count > 0 && (
            <span className="rounded-full bg-brand-100 dark:bg-brand-950/50 px-2 py-0.5 text-brand-600 dark:text-brand-400">
              {sessionData.review_count} review
            </span>
          )}
        </div>
      </div>

      {/* Card */}
      <div className="flex flex-1 flex-col items-center justify-center p-6">
        <div className="w-full max-w-lg">
          <CardFace card={card} revealed={revealed} />

          {!revealed ? (
            <div className="mt-8 text-center">
              <Button
                variant="secondary"
                size="lg"
                onClick={() => setRevealed(true)}
                className="mx-auto"
              >
                Show answer
                <kbd className="ml-2 rounded bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 text-xs font-mono text-gray-400">
                  Space
                </kbd>
              </Button>
            </div>
          ) : (
            <div className="mt-8">
              <p className="text-center text-xs text-gray-400 mb-3">
                How well did you know this?{" "}
                <span className="opacity-60">Press 1–4</span>
              </p>
              <div className="grid grid-cols-4 gap-3">
                {(["again", "hard", "good", "easy"] as RatingKey[]).map(
                  (r, i) => (
                    <button
                      key={r}
                      onClick={() => handleRating(r)}
                      disabled={submitMutation.isPending}
                      className={`flex flex-col items-center gap-1 rounded-xl py-3 px-2 text-sm font-medium transition-all active:scale-95 ${RATING_COLORS[r]} disabled:opacity-60`}
                    >
                      <span className="capitalize">{r}</span>
                      <kbd className="text-xs opacity-60">{i + 1}</kbd>
                    </button>
                  )
                )}
              </div>
            </div>
          )}

          {submitMutation.isPending && (
            <div className="mt-4 flex justify-center">
              <Spinner className="h-5 w-5" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Sub-components ------------------------------------------------------

function CardFace({ card, revealed }: { card: ReviewCard; revealed: boolean }) {
  const front = getCardFront(card);
  const back = getCardBack(card);

  return (
    <div className="card min-h-[280px] flex flex-col shadow-lg animate-fade-in">
      <div className="text-xs font-medium uppercase tracking-wider text-gray-400 mb-4">
        {getFaceLabel(card.face)}
      </div>

      {/* Front side */}
      <div className="flex-1 flex items-center justify-center text-center">
        <div>
          <div className="text-4xl font-bold leading-tight break-words">
            {front.main}
          </div>
          {front.sub && (
            <div className="font-mono text-sm text-gray-400 mt-2">
              {front.sub}
            </div>
          )}
        </div>
      </div>

      {/* Back side (revealed) */}
      {revealed && (
        <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-4 animate-slide-up">
          <div className="text-center">
            <div className="text-2xl font-semibold text-brand-700 dark:text-brand-300">
              {back.main}
            </div>
            {back.sub && (
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 italic">
                &ldquo;{back.sub}&rdquo;
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function getCardFront(card: ReviewCard): { main: string; sub?: string } {
  switch (card.face) {
    case "en_to_uk":
      return { main: card.word, sub: card.phonetic_text ?? undefined };
    case "uk_to_en":
      return { main: card.translation_uk ?? "?", sub: undefined };
    case "definition_to_word":
      return { main: card.primary_definition ?? "?", sub: undefined };
    case "example_to_word":
      return {
        main: (card.primary_example ?? "?").replace(
          new RegExp(`\\b${card.word}\\b`, "gi"),
          "_____"
        ),
      };
    default:
      return { main: card.word };
  }
}

function getCardBack(card: ReviewCard): { main: string; sub?: string } {
  switch (card.face) {
    case "en_to_uk":
      return { main: card.translation_uk ?? "—", sub: card.primary_example ?? undefined };
    case "uk_to_en":
      return { main: card.word, sub: card.primary_definition ?? undefined };
    case "definition_to_word":
      return { main: card.word, sub: card.primary_example ?? undefined };
    case "example_to_word":
      return { main: card.word, sub: card.primary_definition ?? undefined };
    default:
      return { main: card.word };
  }
}

function getFaceLabel(face: string): string {
  const labels: Record<string, string> = {
    en_to_uk: "English → Ukrainian",
    uk_to_en: "Ukrainian → English",
    definition_to_word: "Definition → Word",
    example_to_word: "Fill in the blank",
  };
  return labels[face] ?? face;
}

function SessionSummary({
  reviewed,
  onRestart,
  onClose,
}: {
  reviewed: number;
  onRestart: () => void;
  onClose: () => void;
}) {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-6 bg-gray-50 dark:bg-gray-950">
      <div className="text-center">
        <div className="text-6xl mb-4">✅</div>
        <h2 className="text-2xl font-bold">Session complete!</h2>
        <p className="text-gray-500 mt-2">
          You reviewed{" "}
          <span className="font-semibold text-brand-600">{reviewed}</span>{" "}
          {reviewed === 1 ? "card" : "cards"}
        </p>
      </div>
      <div className="flex gap-3">
        <Button variant="secondary" onClick={onClose}>
          Back to dashboard
        </Button>
        <Button onClick={onRestart}>
          <RotateCcw className="h-4 w-4" />
          Study more
        </Button>
      </div>
    </div>
  );
}
