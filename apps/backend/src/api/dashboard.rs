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
    pub search_count: i64,
}

#[derive(Serialize)]
pub struct StudySetSummary {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub word_count: i64,
    pub created_at: String,
    pub updated_at: String,
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

    let recent_sets = load_recent_sets(&conn)?;
    let recent_words = load_recent_words(&conn)?;

    Ok(Json(DashboardStats {
        total_words_saved,
        words_due_today,
        current_streak_days: streak,
        total_reviews_today,
        words_by_state,
        hardest_words,
        recent_sets,
        recent_words,
    }))
}

fn load_recent_sets(conn: &rusqlite::Connection) -> Result<Vec<StudySetSummary>> {
    let mut stmt = conn.prepare(
        "SELECT s.id, s.name, s.description, s.created_at, s.updated_at,
                COUNT(sw.word_id) as word_count
         FROM study_sets s
         LEFT JOIN study_set_words sw ON sw.set_id = s.id
         GROUP BY s.id, s.name, s.description, s.created_at, s.updated_at
         ORDER BY s.updated_at DESC
         LIMIT 5",
    )?;
    let sets = stmt
        .query_map([], |r| {
            Ok(StudySetSummary {
                id: r.get(0)?,
                name: r.get(1)?,
                description: r.get(2)?,
                created_at: r.get(3)?,
                updated_at: r.get(4)?,
                word_count: r.get(5)?,
            })
        })?
        .collect::<std::result::Result<_, _>>()?;
    Ok(sets)
}

fn load_recent_words(conn: &rusqlite::Connection) -> Result<Vec<RecentWord>> {
    let mut stmt = conn.prepare(
        "SELECT sh.word_id, w.word,
                (
                    SELECT ph.text
                    FROM phonetics ph
                    WHERE ph.word_id = w.id
                      AND ph.text IS NOT NULL
                      AND TRIM(ph.text) != ''
                    ORDER BY ph.id
                    LIMIT 1
                ) AS phonetic_text,
                (
                    SELECT t.text
                    FROM translations t
                    WHERE t.word_id = w.id
                      AND t.target_lang = 'uk'
                    ORDER BY t.id
                    LIMIT 1
                ) AS translation_uk,
                MAX(sh.searched_at) as last_searched_at,
                COUNT(*) as search_count
         FROM search_history sh
         JOIN words w ON w.id = sh.word_id
         WHERE sh.word_id IS NOT NULL
         GROUP BY sh.word_id, w.word
         ORDER BY last_searched_at DESC
         LIMIT 8",
    )?;
    let words = stmt
        .query_map([], |r| {
            Ok(RecentWord {
                word_id: r.get(0)?,
                word: r.get(1)?,
                phonetic_text: r.get(2)?,
                translation_uk: r.get(3)?,
                last_searched_at: r.get(4)?,
                search_count: r.get(5)?,
            })
        })?
        .collect::<std::result::Result<_, _>>()?;
    Ok(words)
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

#[cfg(test)]
mod tests {
    use super::load_recent_words;

    #[test]
    fn recent_words_collapses_multiple_phonetics_into_one_entry() {
        let conn = rusqlite::Connection::open_in_memory().expect("in-memory sqlite");
        conn.execute_batch(
            "CREATE TABLE words (
                id TEXT PRIMARY KEY,
                word TEXT NOT NULL
            );
            CREATE TABLE phonetics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                word_id TEXT NOT NULL,
                text TEXT
            );
            CREATE TABLE translations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                word_id TEXT NOT NULL,
                target_lang TEXT NOT NULL,
                text TEXT NOT NULL
            );
            CREATE TABLE search_history (
                id TEXT PRIMARY KEY,
                query TEXT NOT NULL,
                word_id TEXT,
                searched_at TEXT NOT NULL
            );",
        )
        .expect("schema");

        conn.execute("INSERT INTO words (id, word) VALUES ('word-1', 'run')", [])
            .expect("word");
        conn.execute(
            "INSERT INTO phonetics (word_id, text) VALUES ('word-1', '/rʌn/')",
            [],
        )
        .expect("phonetic 1");
        conn.execute(
            "INSERT INTO phonetics (word_id, text) VALUES ('word-1', '/run/')",
            [],
        )
        .expect("phonetic 2");
        conn.execute(
            "INSERT INTO translations (word_id, target_lang, text) VALUES ('word-1', 'uk', 'бігти')",
            [],
        )
        .expect("translation");
        conn.execute(
            "INSERT INTO search_history (id, query, word_id, searched_at) VALUES ('history-1', 'run', 'word-1', '2026-04-07T12:00:00Z')",
            [],
        )
        .expect("history 1");
        conn.execute(
            "INSERT INTO search_history (id, query, word_id, searched_at) VALUES ('history-2', 'run', 'word-1', '2026-04-07T12:05:00Z')",
            [],
        )
        .expect("history 2");

        let recent_words = load_recent_words(&conn).expect("recent words");

        assert_eq!(recent_words.len(), 1);
        assert_eq!(recent_words[0].word_id, "word-1");
        assert_eq!(recent_words[0].search_count, 2);
        assert_eq!(recent_words[0].translation_uk.as_deref(), Some("бігти"));
    }
}
