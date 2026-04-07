use axum::{extract::State, Json};
use chrono::Utc;
use rusqlite::params;
use serde::Serialize;

use crate::error::Result;
use crate::AppState;

#[derive(Serialize)]
pub struct DashboardStats {
    pub total_words_saved: i64,
    pub words_due_today: i64,
    pub current_streak_days: i64,
    pub total_reviews_today: i64,
    pub words_by_state: WordsByState,
    pub hardest_words: Vec<HardWord>,
    pub recent_words: Vec<RecentWord>,
}

#[derive(Serialize)]
pub struct WordsByState {
    pub new: i64,
    pub learning: i64,
    pub review: i64,
    pub relearning: i64,
}

#[derive(Serialize)]
pub struct HardWord {
    pub word_id: String,
    pub word: String,
    pub lapses: i64,
    pub ease_factor: f64,
}

#[derive(Serialize)]
pub struct RecentWord {
    pub word_id: String,
    pub word: String,
    pub phonetic_text: Option<String>,
    pub translation_uk: Option<String>,
    pub last_searched_at: String,
}

/// GET /api/dashboard/stats
pub async fn stats(State(state): State<AppState>) -> Result<Json<DashboardStats>> {
    let conn = state.db.get()?;
    let now = Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
    let today = Utc::now().format("%Y-%m-%d").to_string();
    let today_start = format!("{}T00:00:00Z", today);

    let total_words_saved: i64 =
        conn.query_row("SELECT COUNT(*) FROM saved_words", [], |r| r.get(0))?;

    let words_due_today: i64 = conn.query_row(
        "SELECT COUNT(DISTINCT rc.word_id) FROM review_cards rc
         JOIN saved_words sw ON sw.word_id = rc.word_id
         WHERE rc.due_at <= ?1",
        params![now],
        |r| r.get(0),
    )?;

    let total_reviews_today: i64 = conn.query_row(
        "SELECT COUNT(*) FROM review_logs WHERE reviewed_at >= ?1",
        params![today_start],
        |r| r.get(0),
    )?;

    let streak = compute_streak(&conn)?;

    let words_by_state = {
        let new: i64 = conn.query_row(
            "SELECT COUNT(*) FROM review_cards rc JOIN saved_words sw ON sw.word_id = rc.word_id WHERE rc.state = 'new'",
            [], |r| r.get(0),
        )?;
        let learning: i64 = conn.query_row(
            "SELECT COUNT(*) FROM review_cards rc JOIN saved_words sw ON sw.word_id = rc.word_id WHERE rc.state = 'learning'",
            [], |r| r.get(0),
        )?;
        let review: i64 = conn.query_row(
            "SELECT COUNT(*) FROM review_cards rc JOIN saved_words sw ON sw.word_id = rc.word_id WHERE rc.state = 'review'",
            [], |r| r.get(0),
        )?;
        let relearning: i64 = conn.query_row(
            "SELECT COUNT(*) FROM review_cards rc JOIN saved_words sw ON sw.word_id = rc.word_id WHERE rc.state = 'relearning'",
            [], |r| r.get(0),
        )?;
        WordsByState {
            new,
            learning,
            review,
            relearning,
        }
    };

    let hardest_words: Vec<HardWord> = {
        let mut stmt = conn.prepare(
            "SELECT rc.word_id, w.word, SUM(rc.lapses) as total_lapses, MIN(rc.ease_factor) as min_ease
             FROM review_cards rc
             JOIN words w ON w.id = rc.word_id
             JOIN saved_words sw ON sw.word_id = rc.word_id
             WHERE rc.lapses > 0
             GROUP BY rc.word_id
             ORDER BY total_lapses DESC, min_ease ASC
             LIMIT 5",
        )?;
        let rows: Vec<HardWord> = stmt
            .query_map([], |r| {
                Ok(HardWord {
                    word_id: r.get(0)?,
                    word: r.get(1)?,
                    lapses: r.get(2)?,
                    ease_factor: r.get(3)?,
                })
            })?
            .collect::<std::result::Result<_, _>>()?;
        rows
    };

    let recent_words: Vec<RecentWord> = {
        let mut stmt = conn.prepare(
            "SELECT DISTINCT sh.word_id, w.word, ph.text, t.text, MAX(sh.searched_at)
             FROM search_history sh
             JOIN words w ON w.id = sh.word_id
             LEFT JOIN phonetics ph ON ph.word_id = w.id
             LEFT JOIN translations t ON t.word_id = w.id AND t.target_lang = 'uk'
             WHERE sh.word_id IS NOT NULL
             GROUP BY sh.word_id
             ORDER BY MAX(sh.searched_at) DESC
             LIMIT 8",
        )?;
        let rows: Vec<RecentWord> = stmt
            .query_map([], |r| {
                Ok(RecentWord {
                    word_id: r.get(0)?,
                    word: r.get(1)?,
                    phonetic_text: r.get(2)?,
                    translation_uk: r.get(3)?,
                    last_searched_at: r.get(4)?,
                })
            })?
            .collect::<std::result::Result<_, _>>()?;
        rows
    };

    Ok(Json(DashboardStats {
        total_words_saved,
        words_due_today,
        current_streak_days: streak,
        total_reviews_today,
        words_by_state,
        hardest_words,
        recent_words,
    }))
}

fn compute_streak(conn: &rusqlite::Connection) -> Result<i64> {
    // Count consecutive days with at least one review going backwards from today
    let today = Utc::now().format("%Y-%m-%d").to_string();
    let mut streak = 0i64;
    let mut check_date = today.clone();

    loop {
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM daily_stats WHERE date = ?1 AND words_reviewed > 0",
            params![check_date],
            |r| r.get(0),
        )?;

        if count == 0 && streak == 0 && check_date == today {
            // Today has no reviews yet – that's okay, don't break streak
            // Move to yesterday and continue counting
            check_date = prev_day(&check_date);
            continue;
        }

        if count == 0 {
            break;
        }

        streak += 1;
        check_date = prev_day(&check_date);

        // Safety: don't loop forever
        if streak > 3650 {
            break;
        }
    }

    Ok(streak)
}

fn prev_day(date: &str) -> String {
    // date is "YYYY-MM-DD"
    use chrono::NaiveDate;
    NaiveDate::parse_from_str(date, "%Y-%m-%d")
        .map(|d| {
            (d - chrono::Duration::days(1))
                .format("%Y-%m-%d")
                .to_string()
        })
        .unwrap_or_else(|_| date.to_string())
}
