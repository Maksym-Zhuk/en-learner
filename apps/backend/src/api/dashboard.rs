use axum::{extract::State, Json};
use chrono::{Duration, NaiveDate};
use serde::Serialize;
use sqlx::FromRow;

use crate::clock::{utc_now_string, utc_today_string};
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
    pub recent_sets: Vec<StudySetSummary>,
    pub recent_words: Vec<RecentWord>,
}

#[derive(Serialize)]
pub struct WordsByState {
    pub new: i64,
    pub learning: i64,
    pub review: i64,
    pub relearning: i64,
}

#[derive(Serialize, FromRow)]
pub struct HardWord {
    pub word_id: String,
    pub word: String,
    pub lapses: i64,
    pub ease_factor: f64,
}

#[derive(Serialize, FromRow)]
pub struct RecentWord {
    pub word_id: String,
    pub word: String,
    pub phonetic_text: Option<String>,
    pub translation_uk: Option<String>,
    pub last_searched_at: String,
    pub search_count: i64,
}

#[derive(Serialize, FromRow)]
pub struct StudySetSummary {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub word_count: i64,
    pub created_at: String,
    pub updated_at: String,
}

pub async fn stats(State(state): State<AppState>) -> Result<Json<DashboardStats>> {
    let now = utc_now_string();
    let today = utc_today_string();
    let today_start = format!("{today}T00:00:00Z");

    let total_words_saved = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM saved_words")
        .fetch_one(state.db.as_ref())
        .await?;

    let words_due_today = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(DISTINCT rc.word_id)
         FROM review_cards rc
         JOIN saved_words sw ON sw.word_id = rc.word_id
         WHERE rc.due_at <= $1",
    )
    .bind(&now)
    .fetch_one(state.db.as_ref())
    .await?;

    let total_reviews_today =
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM review_logs WHERE reviewed_at >= $1")
            .bind(&today_start)
            .fetch_one(state.db.as_ref())
            .await?;

    let words_by_state = WordsByState {
        new: count_words_by_state(state.db.as_ref(), "new").await?,
        learning: count_words_by_state(state.db.as_ref(), "learning").await?,
        review: count_words_by_state(state.db.as_ref(), "review").await?,
        relearning: count_words_by_state(state.db.as_ref(), "relearning").await?,
    };

    let hardest_words = sqlx::query_as::<_, HardWord>(
        "SELECT rc.word_id, w.word,
                SUM(rc.lapses)::BIGINT AS lapses,
                MIN(rc.ease_factor) AS ease_factor
         FROM review_cards rc
         JOIN words w ON w.id = rc.word_id
         JOIN saved_words sw ON sw.word_id = rc.word_id
         WHERE rc.lapses > 0
         GROUP BY rc.word_id, w.word
         ORDER BY lapses DESC, ease_factor ASC
         LIMIT 5",
    )
    .fetch_all(state.db.as_ref())
    .await?;

    Ok(Json(DashboardStats {
        total_words_saved,
        words_due_today,
        current_streak_days: compute_streak(state.db.as_ref()).await?,
        total_reviews_today,
        words_by_state,
        hardest_words,
        recent_sets: load_recent_sets(state.db.as_ref()).await?,
        recent_words: load_recent_words(state.db.as_ref()).await?,
    }))
}

async fn count_words_by_state(pool: &sqlx::PgPool, state_name: &str) -> Result<i64> {
    Ok(sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*)
         FROM review_cards rc
         JOIN saved_words sw ON sw.word_id = rc.word_id
         WHERE rc.state = $1",
    )
    .bind(state_name)
    .fetch_one(pool)
    .await?)
}

async fn load_recent_sets(pool: &sqlx::PgPool) -> Result<Vec<StudySetSummary>> {
    Ok(sqlx::query_as::<_, StudySetSummary>(
        "SELECT s.id, s.name, s.description, s.created_at, s.updated_at,
                COUNT(sw.word_id)::BIGINT AS word_count
         FROM study_sets s
         LEFT JOIN study_set_words sw ON sw.set_id = s.id
         GROUP BY s.id, s.name, s.description, s.created_at, s.updated_at
         ORDER BY s.updated_at DESC
         LIMIT 5",
    )
    .fetch_all(pool)
    .await?)
}

async fn load_recent_words(pool: &sqlx::PgPool) -> Result<Vec<RecentWord>> {
    Ok(sqlx::query_as::<_, RecentWord>(
        "SELECT sh.word_id, w.word,
                (
                    SELECT ph.text
                    FROM phonetics ph
                    WHERE ph.word_id = sh.word_id
                      AND ph.text IS NOT NULL
                      AND BTRIM(ph.text) != ''
                    ORDER BY ph.id
                    LIMIT 1
                ) AS phonetic_text,
                (
                    SELECT t.text
                    FROM translations t
                    WHERE t.word_id = sh.word_id
                      AND t.target_lang = 'uk'
                    ORDER BY t.id
                    LIMIT 1
                ) AS translation_uk,
                MAX(sh.searched_at) AS last_searched_at,
                COUNT(*)::BIGINT AS search_count
         FROM search_history sh
         JOIN words w ON w.id = sh.word_id
         WHERE sh.word_id IS NOT NULL
         GROUP BY sh.word_id, w.word
         ORDER BY last_searched_at DESC
         LIMIT 8",
    )
    .fetch_all(pool)
    .await?)
}

async fn compute_streak(pool: &sqlx::PgPool) -> Result<i64> {
    let today = utc_today_string();
    let mut streak = 0_i64;
    let mut check_date = today.clone();

    loop {
        let count = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM daily_stats WHERE date = $1 AND words_reviewed > 0",
        )
        .bind(&check_date)
        .fetch_one(pool)
        .await?;

        if count == 0 && streak == 0 && check_date == today {
            check_date = prev_day(&check_date);
            continue;
        }

        if count == 0 {
            break;
        }

        streak += 1;
        check_date = prev_day(&check_date);

        if streak > 3650 {
            break;
        }
    }

    Ok(streak)
}

fn prev_day(date: &str) -> String {
    NaiveDate::parse_from_str(date, "%Y-%m-%d")
        .map(|d| (d - Duration::days(1)).format("%Y-%m-%d").to_string())
        .unwrap_or_else(|_| date.to_string())
}

#[cfg(test)]
mod tests {
    use super::prev_day;

    #[test]
    fn prev_day_moves_back_one_day() {
        assert_eq!(prev_day("2026-04-08"), "2026-04-07");
    }
}
