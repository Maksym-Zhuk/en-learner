import type { CardState, ReviewRating } from "@/types";

export interface ScheduleResult {
  new_state: CardState;
  interval_days: number;
  ease_factor: number;
  due_at: string;
  lapses: number;
}

const INITIAL_EASE = 2.5;
const MIN_EASE = 1.3;
const EASY_BONUS = 1.3;
const HARD_PENALTY = 0.15;
const AGAIN_PENALTY = 0.2;
const LEARNING_GRAD_INTERVAL = 1;
const RELEARNING_INTERVAL = 1;

export function scheduleReview(
  currentState: CardState,
  intervalDays: number,
  easeFactor: number,
  reps: number,
  lapses: number,
  rating: ReviewRating
): ScheduleResult {
  switch (`${currentState}:${rating}`) {
    case "new:again":
      return learningStep(1, INITIAL_EASE, lapses);
    case "new:hard":
      return learningStep(5, INITIAL_EASE, lapses);
    case "new:good":
      return learningStep(10, INITIAL_EASE, lapses);
    case "new:easy":
      return reviewStep(4, clampEase(INITIAL_EASE + 0.15), lapses);

    case "learning:again":
      return learningStep(1, easeFactor, lapses);
    case "learning:hard":
      return learningStep(10, clampEase(easeFactor - HARD_PENALTY), lapses);
    case "learning:good":
      if (reps >= 1) {
        return reviewStep(LEARNING_GRAD_INTERVAL, easeFactor, lapses);
      }
      return learningStep(10, easeFactor, lapses);
    case "learning:easy":
      return reviewStep(
        Math.max(1, LEARNING_GRAD_INTERVAL * EASY_BONUS),
        clampEase(easeFactor + 0.15),
        lapses
      );

    case "review:again":
      return {
        new_state: "relearning",
        interval_days: minutesToDays(10),
        ease_factor: clampEase(easeFactor - AGAIN_PENALTY),
        due_at: fromNowMinutes(10),
        lapses: lapses + 1,
      };
    case "review:hard":
      return reviewStep(Math.max(1, intervalDays * 1.2), clampEase(easeFactor - HARD_PENALTY), lapses);
    case "review:good":
      return reviewStep(Math.max(1, intervalDays * easeFactor), easeFactor, lapses);
    case "review:easy":
      return reviewStep(
        Math.max(1, intervalDays * easeFactor * EASY_BONUS),
        clampEase(easeFactor + 0.15),
        lapses
      );

    case "relearning:again":
      return relearningStep(5, easeFactor, lapses);
    case "relearning:hard":
      return relearningStep(10, clampEase(easeFactor - HARD_PENALTY), lapses);
    case "relearning:good":
      return reviewStep(RELEARNING_INTERVAL, easeFactor, lapses);
    case "relearning:easy":
      return reviewStep(
        Math.max(1, RELEARNING_INTERVAL * EASY_BONUS),
        clampEase(easeFactor + 0.15),
        lapses
      );

    default:
      return reviewStep(Math.max(1, intervalDays), clampEase(easeFactor), lapses);
  }
}

function learningStep(
  minutes: number,
  easeFactor: number,
  lapses: number
): ScheduleResult {
  return {
    new_state: "learning",
    interval_days: minutesToDays(minutes),
    ease_factor: easeFactor,
    due_at: fromNowMinutes(minutes),
    lapses,
  };
}

function relearningStep(
  minutes: number,
  easeFactor: number,
  lapses: number
): ScheduleResult {
  return {
    new_state: "relearning",
    interval_days: minutesToDays(minutes),
    ease_factor: easeFactor,
    due_at: fromNowMinutes(minutes),
    lapses,
  };
}

function reviewStep(
  intervalDays: number,
  easeFactor: number,
  lapses: number
): ScheduleResult {
  return {
    new_state: "review",
    interval_days: intervalDays,
    ease_factor: easeFactor,
    due_at: fromNowDays(intervalDays),
    lapses,
  };
}

function clampEase(value: number) {
  return Math.max(MIN_EASE, value);
}

function minutesToDays(minutes: number) {
  return minutes / 1440;
}

function fromNowMinutes(minutes: number) {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

function fromNowDays(days: number) {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}
