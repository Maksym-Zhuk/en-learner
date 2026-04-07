/// Spaced repetition scheduling engine.
///
/// Inspired by Anki's SM-2 variant. Each card has a state machine:
///
///   New → Learning → Review
///              ↑          ↓ (lapse)
///           Relearning ←──┘
///
/// Intervals in days. Learning steps use sub-day intervals (stored as fractions).
/// All timestamps are UTC ISO-8601.
use chrono::{Duration, Utc};

use crate::models::{CardState, ReviewRating};

/// Result of scheduling a card after a review.
#[derive(Debug, Clone)]
pub struct ScheduleResult {
    pub new_state: CardState,
    pub interval_days: f64,
    pub ease_factor: f64,
    pub due_at: String,
    pub lapses: i64,
}

/// Constants matching Anki defaults.
const INITIAL_EASE: f64 = 2.5;
const MIN_EASE: f64 = 1.3;
const EASY_BONUS: f64 = 1.3;
const HARD_PENALTY: f64 = 0.15;
const AGAIN_PENALTY: f64 = 0.20;
const LEARNING_GRAD_INTERVAL: f64 = 1.0; // days to graduate from learning
const RELEARNING_INTERVAL: f64 = 1.0;

/// Compute the next schedule for a card given the current state and rating.
pub fn schedule(
    current_state: &CardState,
    interval_days: f64,
    ease_factor: f64,
    reps: i64,
    lapses: i64,
    rating: &ReviewRating,
) -> ScheduleResult {
    match (current_state, rating) {
        // ── New card ────────────────────────────────────────────────────
        (CardState::New, ReviewRating::Again) => ScheduleResult {
            new_state: CardState::Learning,
            interval_days: minutes_to_days(1),
            ease_factor: INITIAL_EASE,
            due_at: from_now_minutes(1),
            lapses,
        },
        (CardState::New, ReviewRating::Hard) => ScheduleResult {
            new_state: CardState::Learning,
            interval_days: minutes_to_days(5),
            ease_factor: INITIAL_EASE,
            due_at: from_now_minutes(5),
            lapses,
        },
        (CardState::New, ReviewRating::Good) => ScheduleResult {
            new_state: CardState::Learning,
            interval_days: minutes_to_days(10),
            ease_factor: INITIAL_EASE,
            due_at: from_now_minutes(10),
            lapses,
        },
        (CardState::New, ReviewRating::Easy) => {
            // Skip learning, go straight to review
            let interval = 4.0_f64;
            ScheduleResult {
                new_state: CardState::Review,
                interval_days: interval,
                ease_factor: clamp_ease(INITIAL_EASE + 0.15),
                due_at: from_now_days(interval),
                lapses,
            }
        }

        // ── Learning card ────────────────────────────────────────────────
        (CardState::Learning, ReviewRating::Again) => ScheduleResult {
            new_state: CardState::Learning,
            interval_days: minutes_to_days(1),
            ease_factor,
            due_at: from_now_minutes(1),
            lapses,
        },
        (CardState::Learning, ReviewRating::Hard) => ScheduleResult {
            new_state: CardState::Learning,
            interval_days: minutes_to_days(10),
            ease_factor: clamp_ease(ease_factor - HARD_PENALTY),
            due_at: from_now_minutes(10),
            lapses,
        },
        (CardState::Learning, ReviewRating::Good) => {
            // Graduate to Review after seeing it again correctly
            if reps >= 1 {
                let interval = LEARNING_GRAD_INTERVAL;
                ScheduleResult {
                    new_state: CardState::Review,
                    interval_days: interval,
                    ease_factor,
                    due_at: from_now_days(interval),
                    lapses,
                }
            } else {
                ScheduleResult {
                    new_state: CardState::Learning,
                    interval_days: minutes_to_days(10),
                    ease_factor,
                    due_at: from_now_minutes(10),
                    lapses,
                }
            }
        }
        (CardState::Learning, ReviewRating::Easy) => {
            let interval = (LEARNING_GRAD_INTERVAL * EASY_BONUS).max(1.0);
            ScheduleResult {
                new_state: CardState::Review,
                interval_days: interval,
                ease_factor: clamp_ease(ease_factor + 0.15),
                due_at: from_now_days(interval),
                lapses,
            }
        }

        // ── Review card ──────────────────────────────────────────────────
        (CardState::Review, ReviewRating::Again) => {
            // Lapse: go back to relearning
            let new_lapses = lapses + 1;
            ScheduleResult {
                new_state: CardState::Relearning,
                interval_days: minutes_to_days(10),
                ease_factor: clamp_ease(ease_factor - AGAIN_PENALTY),
                due_at: from_now_minutes(10),
                lapses: new_lapses,
            }
        }
        (CardState::Review, ReviewRating::Hard) => {
            let new_interval = (interval_days * 1.2).max(1.0);
            ScheduleResult {
                new_state: CardState::Review,
                interval_days: new_interval,
                ease_factor: clamp_ease(ease_factor - HARD_PENALTY),
                due_at: from_now_days(new_interval),
                lapses,
            }
        }
        (CardState::Review, ReviewRating::Good) => {
            let new_interval = (interval_days * ease_factor).max(1.0);
            ScheduleResult {
                new_state: CardState::Review,
                interval_days: new_interval,
                ease_factor,
                due_at: from_now_days(new_interval),
                lapses,
            }
        }
        (CardState::Review, ReviewRating::Easy) => {
            let new_interval = (interval_days * ease_factor * EASY_BONUS).max(1.0);
            ScheduleResult {
                new_state: CardState::Review,
                interval_days: new_interval,
                ease_factor: clamp_ease(ease_factor + 0.15),
                due_at: from_now_days(new_interval),
                lapses,
            }
        }

        // ── Relearning card ──────────────────────────────────────────────
        (CardState::Relearning, ReviewRating::Again) => ScheduleResult {
            new_state: CardState::Relearning,
            interval_days: minutes_to_days(5),
            ease_factor,
            due_at: from_now_minutes(5),
            lapses,
        },
        (CardState::Relearning, ReviewRating::Hard) => ScheduleResult {
            new_state: CardState::Relearning,
            interval_days: minutes_to_days(10),
            ease_factor: clamp_ease(ease_factor - HARD_PENALTY),
            due_at: from_now_minutes(10),
            lapses,
        },
        (CardState::Relearning, ReviewRating::Good) => {
            let interval = RELEARNING_INTERVAL;
            ScheduleResult {
                new_state: CardState::Review,
                interval_days: interval,
                ease_factor,
                due_at: from_now_days(interval),
                lapses,
            }
        }
        (CardState::Relearning, ReviewRating::Easy) => {
            let interval = (RELEARNING_INTERVAL * EASY_BONUS).max(1.0);
            ScheduleResult {
                new_state: CardState::Review,
                interval_days: interval,
                ease_factor: clamp_ease(ease_factor + 0.15),
                due_at: from_now_days(interval),
                lapses,
            }
        }
    }
}

fn clamp_ease(e: f64) -> f64 {
    e.max(MIN_EASE)
}

fn minutes_to_days(minutes: u32) -> f64 {
    minutes as f64 / 1440.0
}

fn from_now_minutes(minutes: i64) -> String {
    (Utc::now() + Duration::minutes(minutes))
        .format("%Y-%m-%dT%H:%M:%SZ")
        .to_string()
}

fn from_now_days(days: f64) -> String {
    let seconds = (days * 86400.0) as i64;
    (Utc::now() + Duration::seconds(seconds))
        .format("%Y-%m-%dT%H:%M:%SZ")
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_card_good_stays_learning() {
        let r = schedule(
            &CardState::New,
            0.0,
            INITIAL_EASE,
            0,
            0,
            &ReviewRating::Good,
        );
        assert_eq!(r.new_state, CardState::Learning);
    }

    #[test]
    fn new_card_easy_graduates() {
        let r = schedule(
            &CardState::New,
            0.0,
            INITIAL_EASE,
            0,
            0,
            &ReviewRating::Easy,
        );
        assert_eq!(r.new_state, CardState::Review);
        assert!(r.interval_days >= 4.0);
    }

    #[test]
    fn review_again_lapses() {
        let r = schedule(&CardState::Review, 10.0, 2.5, 5, 0, &ReviewRating::Again);
        assert_eq!(r.new_state, CardState::Relearning);
        assert_eq!(r.lapses, 1);
        assert!(r.ease_factor < 2.5);
    }

    #[test]
    fn review_easy_grows_interval() {
        let r = schedule(&CardState::Review, 10.0, 2.5, 5, 0, &ReviewRating::Easy);
        assert_eq!(r.new_state, CardState::Review);
        assert!(r.interval_days > 10.0 * 2.5);
    }
}
