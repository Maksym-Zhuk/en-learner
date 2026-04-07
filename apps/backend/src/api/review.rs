use axum::{
    extract::{Path, Query, State},
    Json,
};
use chrono::Utc;
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::{AppError, Result};
use crate::models::{CardState, ReviewRating};
use crate::services::review_engine;
use crate::AppState;

// ---- Request/Response -------------------------------------------------

#[derive(Deserialize)]
pub struct SessionQuery {
    pub set_id: Option<String>,
    pub limit: Option<u32>,
}

#[derive(Serialize)]
pub struct ReviewCardResponse {
    pub id: String,
    pub word_id: String,
    pub word: String,
    pub translation_uk: Option<String>,
    pub phonetic_text: Option<String>,
    pub primary_definition: Option<String>,
    pub primary_example: Option<String>,
    pub face: String,
    pub state: String,
    pub due_at: String,
    pub interval_days: f64,
    pub ease_factor: f64,
    pub reps: i64,
    pub lapses: i64,
    pub last_reviewed_at: Option<String>,
}

#[derive(Serialize)]
pub struct ReviewSession {
    pub session_id: String,
    pub cards: Vec<ReviewCardResponse>,
    pub total: usize,
    pub new_count: usize,
    pub review_count: usize,
    pub relearning_count: usize,
}

#[derive(Deserialize)]
pub struct SubmitReviewRequest {
    pub session_id: String,
    pub card_id: String,
    pub rating: String,
    pub time_spent_ms: i64,
}

#[derive(Serialize)]
pub struct SubmitReviewResponse {
    pub next_due_at: String,
    pub interval_days: f64,
    pub new_state: String,
}

#[derive(Serialize)]
pub struct SessionSummary {
    pub total_reviewed: i64,
    pub again_count: i64,
    pub hard_count: i64,
    pub good_count: i64,
    pub easy_count: i64,
    pub duration_ms: i64,
}

#[derive(Serialize)]
pub struct PublicTestLinkResponse {
    pub token: String,
    pub set_id: String,
    pub set_name: String,
    pub cards_count: i64,
    pub api_path: String,
    pub web_path: String,
}

#[derive(Serialize)]
pub struct PublicTestDeckResponse {
    pub token: String,
    pub set_id: String,
    pub set_name: String,
    pub set_description: Option<String>,
    pub cards: Vec<ReviewCardResponse>,
    pub total: usize,
}

// ---- Handlers ---------------------------------------------------------

/// GET /api/review/session?set_id=&limit=
pub async fn start_session(
    State(state): State<AppState>,
    Query(q): Query<SessionQuery>,
) -> Result<Json<ReviewSession>> {
    let conn = state.db.get()?;
    let limit = q.limit.unwrap_or(20).min(100) as i64;
    let now = Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();

    // Create session record
    let session_id = Uuid::new_v4().to_string();

    // Build query depending on whether we're filtering by set
    let cards = if let Some(set_id) = &q.set_id {
        query_cards_for_set(&conn, set_id, &now, limit)?
    } else {
        query_all_due_cards(&conn, &now, limit)?
    };

    let total = cards.len();
    let new_count = cards.iter().filter(|c| c.state == "new").count();
    let review_count = cards.iter().filter(|c| c.state == "review").count();
    let relearning_count = cards.iter().filter(|c| c.state == "relearning").count();

    // Persist session
    conn.execute(
        "INSERT INTO review_sessions (id, set_id, total_cards) VALUES (?1, ?2, ?3)",
        params![session_id, q.set_id, total as i64],
    )?;

    Ok(Json(ReviewSession {
        session_id,
        cards,
        total,
        new_count,
        review_count,
        relearning_count,
    }))
}

/// POST /api/review/submit
pub async fn submit_review(
    State(state): State<AppState>,
    Json(body): Json<SubmitReviewRequest>,
) -> Result<Json<SubmitReviewResponse>> {
    let rating = ReviewRating::from_str(&body.rating)
        .ok_or_else(|| AppError::BadRequest(format!("Invalid rating: {}", body.rating)))?;

    let conn = state.db.get()?;

    // Load current card state
    let (state_str, interval, ease, reps, lapses): (String, f64, f64, i64, i64) = conn
        .query_row(
            "SELECT state, interval_days, ease_factor, reps, lapses FROM review_cards WHERE id = ?1",
            params![body.card_id],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?)),
        )
        .optional()?
        .ok_or_else(|| AppError::NotFound(format!("Card '{}' not found", body.card_id)))?;

    let current_state = CardState::from_str(&state_str);
    let result = review_engine::schedule(&current_state, interval, ease, reps, lapses, &rating);

    let now = Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();

    // Update card
    conn.execute(
        "UPDATE review_cards SET
            state = ?1, due_at = ?2, interval_days = ?3,
            ease_factor = ?4, reps = reps + 1, lapses = ?5,
            last_reviewed_at = ?6
         WHERE id = ?7",
        params![
            result.new_state.as_str(),
            result.due_at,
            result.interval_days,
            result.ease_factor,
            result.lapses,
            now,
            body.card_id,
        ],
    )?;

    // Log the review
    let log_id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO review_logs
            (id, session_id, card_id, rating, time_spent_ms, state_before, state_after, interval_before, interval_after)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            log_id,
            body.session_id,
            body.card_id,
            rating.as_str(),
            body.time_spent_ms,
            state_str,
            result.new_state.as_str(),
            interval,
            result.interval_days,
        ],
    )?;

    // Update session counter
    conn.execute(
        "UPDATE review_sessions SET reviewed = reviewed + 1 WHERE id = ?1",
        params![body.session_id],
    )?;

    // Update daily stats
    let today = Utc::now().format("%Y-%m-%d").to_string();
    let minutes = body.time_spent_ms as f64 / 60000.0;
    conn.execute(
        "INSERT INTO daily_stats (date, words_reviewed, minutes_studied)
         VALUES (?1, 1, ?2)
         ON CONFLICT(date) DO UPDATE SET
            words_reviewed = words_reviewed + 1,
            minutes_studied = minutes_studied + excluded.minutes_studied,
            updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')",
        params![today, minutes],
    )?;

    Ok(Json(SubmitReviewResponse {
        next_due_at: result.due_at,
        interval_days: result.interval_days,
        new_state: result.new_state.as_str().to_string(),
    }))
}

/// GET /api/review/session/:id/summary
pub async fn session_summary(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<SessionSummary>> {
    let conn = state.db.get()?;

    // Finish session
    conn.execute(
        "UPDATE review_sessions SET finished_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
         WHERE id = ?1 AND finished_at IS NULL",
        params![id],
    )?;

    Ok(Json(load_session_summary(&conn, &id)?))
}

/// POST /api/sets/:id/share-test
pub async fn create_public_set_test_link(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<PublicTestLinkResponse>> {
    let conn = state.db.get()?;
    let set = load_public_set_meta(&conn, &id)?
        .ok_or_else(|| AppError::NotFound(format!("Set '{}' not found", id)))?;

    let token = conn
        .query_row(
            "SELECT token FROM public_test_links WHERE set_id = ?1",
            params![id],
            |row| row.get::<_, String>(0),
        )
        .optional()?
        .unwrap_or_else(|| Uuid::new_v4().simple().to_string());

    conn.execute(
        "INSERT INTO public_test_links (token, set_id, last_accessed_at)
         VALUES (?1, ?2, strftime('%Y-%m-%dT%H:%M:%SZ','now'))
         ON CONFLICT(set_id) DO UPDATE SET
            token = excluded.token,
            last_accessed_at = excluded.last_accessed_at",
        params![token, id],
    )?;

    let cards_count = count_cards_for_set(&conn, &id)?;

    Ok(Json(PublicTestLinkResponse {
        token: token.clone(),
        set_id: id,
        set_name: set.name,
        cards_count,
        api_path: format!("/api/public/tests/{token}"),
        web_path: format!("/#/public/tests/{token}"),
    }))
}

/// GET /api/public/tests/:token
pub async fn public_test_deck(
    State(state): State<AppState>,
    Path(token): Path<String>,
) -> Result<Json<PublicTestDeckResponse>> {
    let conn = state.db.get()?;
    let set = conn
        .query_row(
            "SELECT s.id, s.name, s.description
             FROM public_test_links ptl
             JOIN study_sets s ON s.id = ptl.set_id
             WHERE ptl.token = ?1",
            params![token],
            |row| {
                Ok(PublicSetMeta {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    description: row.get(2)?,
                })
            },
        )
        .optional()?
        .ok_or_else(|| AppError::NotFound("Public test link not found".into()))?;

    conn.execute(
        "UPDATE public_test_links
         SET last_accessed_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
         WHERE token = ?1",
        params![token],
    )?;

    let cards = query_public_cards_for_set(&conn, &set.id)?;
    let total = cards.len();

    Ok(Json(PublicTestDeckResponse {
        token,
        set_id: set.id,
        set_name: set.name,
        set_description: set.description,
        cards,
        total,
    }))
}

// ---- Helpers ----------------------------------------------------------

#[derive(Debug)]
struct PublicSetMeta {
    id: String,
    name: String,
    description: Option<String>,
}

fn query_all_due_cards(
    conn: &rusqlite::Connection,
    now: &str,
    limit: i64,
) -> Result<Vec<ReviewCardResponse>> {
    let mut stmt = conn.prepare(
        "SELECT rc.id, rc.word_id, w.word,
                t.text as translation_uk,
                ph.text as phonetic_text,
                (SELECT definition FROM definitions d
                 JOIN meanings m ON m.id = d.meaning_id
                 WHERE m.word_id = w.id ORDER BY m.position, d.position LIMIT 1) as primary_def,
                (SELECT example FROM definitions d
                 JOIN meanings m ON m.id = d.meaning_id
                 WHERE m.word_id = w.id AND d.example IS NOT NULL
                 ORDER BY m.position, d.position LIMIT 1) as primary_ex,
                rc.face, rc.state, rc.due_at, rc.interval_days,
                rc.ease_factor, rc.reps, rc.lapses, rc.last_reviewed_at
         FROM review_cards rc
         JOIN words w ON w.id = rc.word_id
         LEFT JOIN translations t ON t.word_id = w.id AND t.target_lang = 'uk'
         LEFT JOIN phonetics ph ON ph.word_id = w.id
         WHERE rc.due_at <= ?1
         ORDER BY rc.state DESC, rc.due_at ASC
         LIMIT ?2",
    )?;
    collect_cards(&mut stmt, params![now, limit])
}

fn query_cards_for_set(
    conn: &rusqlite::Connection,
    set_id: &str,
    now: &str,
    limit: i64,
) -> Result<Vec<ReviewCardResponse>> {
    let mut stmt = conn.prepare(
        "SELECT rc.id, rc.word_id, w.word,
                t.text as translation_uk,
                ph.text as phonetic_text,
                (SELECT definition FROM definitions d
                 JOIN meanings m ON m.id = d.meaning_id
                 WHERE m.word_id = w.id ORDER BY m.position, d.position LIMIT 1) as primary_def,
                (SELECT example FROM definitions d
                 JOIN meanings m ON m.id = d.meaning_id
                 WHERE m.word_id = w.id AND d.example IS NOT NULL
                 ORDER BY m.position, d.position LIMIT 1) as primary_ex,
                rc.face, rc.state, rc.due_at, rc.interval_days,
                rc.ease_factor, rc.reps, rc.lapses, rc.last_reviewed_at
         FROM review_cards rc
         JOIN words w ON w.id = rc.word_id
         JOIN study_set_words sw ON sw.word_id = w.id AND sw.set_id = ?1
         LEFT JOIN translations t ON t.word_id = w.id AND t.target_lang = 'uk'
         LEFT JOIN phonetics ph ON ph.word_id = w.id
         WHERE rc.due_at <= ?2
         ORDER BY rc.state DESC, rc.due_at ASC
         LIMIT ?3",
    )?;
    collect_cards(&mut stmt, params![set_id, now, limit])
}

fn query_public_cards_for_set(
    conn: &rusqlite::Connection,
    set_id: &str,
) -> Result<Vec<ReviewCardResponse>> {
    let mut stmt = conn.prepare(
        "SELECT rc.id, rc.word_id, w.word,
                (SELECT t.text
                 FROM translations t
                 WHERE t.word_id = w.id AND t.target_lang = 'uk'
                 ORDER BY t.created_at ASC
                 LIMIT 1) as translation_uk,
                (SELECT ph.text
                 FROM phonetics ph
                 WHERE ph.word_id = w.id AND ph.text IS NOT NULL
                 ORDER BY ph.rowid ASC
                 LIMIT 1) as phonetic_text,
                (SELECT definition FROM definitions d
                 JOIN meanings m ON m.id = d.meaning_id
                 WHERE m.word_id = w.id ORDER BY m.position, d.position LIMIT 1) as primary_def,
                (SELECT example FROM definitions d
                 JOIN meanings m ON m.id = d.meaning_id
                 WHERE m.word_id = w.id AND d.example IS NOT NULL
                 ORDER BY m.position, d.position LIMIT 1) as primary_ex,
                rc.face, rc.state, rc.due_at, rc.interval_days,
                rc.ease_factor, rc.reps, rc.lapses, rc.last_reviewed_at
         FROM study_set_words sw
         JOIN words w ON w.id = sw.word_id
         JOIN review_cards rc ON rc.word_id = w.id
         WHERE sw.set_id = ?1
         ORDER BY LOWER(w.word) ASC,
                  CASE rc.face
                      WHEN 'en_to_uk' THEN 0
                      WHEN 'uk_to_en' THEN 1
                      WHEN 'definition_to_word' THEN 2
                      ELSE 3
                  END ASC",
    )?;
    collect_cards(&mut stmt, params![set_id])
}

fn collect_cards(
    stmt: &mut rusqlite::Statement,
    params: impl rusqlite::Params,
) -> Result<Vec<ReviewCardResponse>> {
    let cards: Vec<ReviewCardResponse> = stmt
        .query_map(params, |r| {
            Ok(ReviewCardResponse {
                id: r.get(0)?,
                word_id: r.get(1)?,
                word: r.get(2)?,
                translation_uk: r.get(3)?,
                phonetic_text: r.get(4)?,
                primary_definition: r.get(5)?,
                primary_example: r.get(6)?,
                face: r.get(7)?,
                state: r.get(8)?,
                due_at: r.get(9)?,
                interval_days: r.get(10)?,
                ease_factor: r.get(11)?,
                reps: r.get(12)?,
                lapses: r.get(13)?,
                last_reviewed_at: r.get(14)?,
            })
        })?
        .collect::<std::result::Result<_, _>>()?;
    Ok(cards)
}

fn load_session_summary(conn: &rusqlite::Connection, id: &str) -> Result<SessionSummary> {
    let (total, again, hard, good, easy, duration_ms): (i64, i64, i64, i64, i64, i64) = conn
        .query_row(
            "SELECT
                COUNT(rl.id),
                COALESCE(SUM(CASE WHEN rl.rating = 'again' THEN 1 ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN rl.rating = 'hard'  THEN 1 ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN rl.rating = 'good'  THEN 1 ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN rl.rating = 'easy'  THEN 1 ELSE 0 END), 0),
                CAST(
                    (julianday(COALESCE(rs.finished_at, strftime('%Y-%m-%dT%H:%M:%SZ','now'))) - julianday(rs.started_at))
                    * 86400000 AS INTEGER
                )
             FROM review_sessions rs
             LEFT JOIN review_logs rl ON rl.session_id = rs.id
             WHERE rs.id = ?1
             GROUP BY rs.id",
            params![id],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?, r.get(5)?)),
        )
        .optional()?
        .ok_or_else(|| AppError::NotFound(format!("Session '{}' not found", id)))?;

    Ok(SessionSummary {
        total_reviewed: total,
        again_count: again,
        hard_count: hard,
        good_count: good,
        easy_count: easy,
        duration_ms,
    })
}

fn load_public_set_meta(
    conn: &rusqlite::Connection,
    set_id: &str,
) -> Result<Option<PublicSetMeta>> {
    Ok(conn
        .query_row(
            "SELECT id, name, description FROM study_sets WHERE id = ?1",
            params![set_id],
            |row| {
                Ok(PublicSetMeta {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    description: row.get(2)?,
                })
            },
        )
        .optional()?)
}

fn count_cards_for_set(conn: &rusqlite::Connection, set_id: &str) -> Result<i64> {
    let total = conn.query_row(
        "SELECT COUNT(rc.id)
         FROM study_set_words sw
         JOIN review_cards rc ON rc.word_id = sw.word_id
         WHERE sw.set_id = ?1",
        params![set_id],
        |row| row.get(0),
    )?;
    Ok(total)
}

#[cfg(test)]
mod tests {
    use super::{count_cards_for_set, load_session_summary, query_public_cards_for_set};
    use rusqlite::params;

    #[test]
    fn session_summary_counts_only_its_own_logs() {
        let conn = rusqlite::Connection::open_in_memory().expect("in-memory sqlite");
        conn.execute_batch(
            "CREATE TABLE review_sessions (
                id TEXT PRIMARY KEY,
                started_at TEXT NOT NULL,
                finished_at TEXT
            );
            CREATE TABLE review_logs (
                id TEXT PRIMARY KEY,
                session_id TEXT,
                rating TEXT NOT NULL
            );",
        )
        .expect("schema");

        conn.execute(
            "INSERT INTO review_sessions (id, started_at, finished_at) VALUES ('session-1', '2026-04-07T18:00:00Z', '2026-04-07T18:01:00Z')",
            [],
        )
        .expect("insert session 1");
        conn.execute(
            "INSERT INTO review_sessions (id, started_at, finished_at) VALUES ('session-2', '2026-04-07T18:02:00Z', '2026-04-07T18:03:00Z')",
            [],
        )
        .expect("insert session 2");

        conn.execute(
            "INSERT INTO review_logs (id, session_id, rating) VALUES ('log-1', 'session-1', 'again')",
            [],
        )
        .expect("insert log 1");
        conn.execute(
            "INSERT INTO review_logs (id, session_id, rating) VALUES ('log-2', 'session-2', 'good')",
            [],
        )
        .expect("insert log 2");

        let summary = load_session_summary(&conn, "session-1").expect("summary");

        assert_eq!(summary.total_reviewed, 1);
        assert_eq!(summary.again_count, 1);
        assert_eq!(summary.good_count, 0);
        assert_eq!(summary.easy_count, 0);
    }

    #[test]
    fn public_cards_for_set_return_all_faces_without_duplicates() {
        let conn = rusqlite::Connection::open_in_memory().expect("in-memory sqlite");
        conn.execute_batch(
            "CREATE TABLE study_set_words (set_id TEXT NOT NULL, word_id TEXT NOT NULL);
             CREATE TABLE words (id TEXT PRIMARY KEY, word TEXT NOT NULL);
             CREATE TABLE review_cards (
                id TEXT PRIMARY KEY,
                word_id TEXT NOT NULL,
                face TEXT NOT NULL,
                state TEXT NOT NULL,
                due_at TEXT NOT NULL,
                interval_days REAL NOT NULL,
                ease_factor REAL NOT NULL,
                reps INTEGER NOT NULL,
                lapses INTEGER NOT NULL,
                last_reviewed_at TEXT
             );
             CREATE TABLE translations (
                id TEXT PRIMARY KEY,
                word_id TEXT NOT NULL,
                target_lang TEXT NOT NULL,
                text TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
             );
             CREATE TABLE phonetics (
                id TEXT PRIMARY KEY,
                word_id TEXT NOT NULL,
                text TEXT,
                audio_url TEXT
             );
             CREATE TABLE meanings (
                id TEXT PRIMARY KEY,
                word_id TEXT NOT NULL,
                part_of_speech TEXT NOT NULL,
                position INTEGER NOT NULL DEFAULT 0
             );
             CREATE TABLE definitions (
                id TEXT PRIMARY KEY,
                meaning_id TEXT NOT NULL,
                definition TEXT NOT NULL,
                example TEXT,
                position INTEGER NOT NULL DEFAULT 0
             );",
        )
        .expect("schema");

        conn.execute(
            "INSERT INTO study_set_words (set_id, word_id) VALUES ('set-1', 'word-1')",
            [],
        )
        .expect("insert set word");
        conn.execute(
            "INSERT INTO words (id, word) VALUES ('word-1', 'apple')",
            [],
        )
        .expect("insert word");
        conn.execute(
            "INSERT INTO translations (id, word_id, target_lang, text) VALUES ('tr-1', 'word-1', 'uk', 'яблуко')",
            [],
        )
        .expect("insert translation");
        conn.execute(
            "INSERT INTO phonetics (id, word_id, text) VALUES ('ph-1', 'word-1', '/a/'), ('ph-2', 'word-1', '/b/')",
            [],
        )
        .expect("insert phonetics");
        conn.execute(
            "INSERT INTO meanings (id, word_id, part_of_speech, position) VALUES ('meaning-1', 'word-1', 'noun', 0)",
            [],
        )
        .expect("insert meaning");
        conn.execute(
            "INSERT INTO definitions (id, meaning_id, definition, example, position) VALUES ('def-1', 'meaning-1', 'fruit', 'An apple a day', 0)",
            [],
        )
        .expect("insert definition");

        for (id, face) in [
            ("card-1", "en_to_uk"),
            ("card-2", "uk_to_en"),
            ("card-3", "definition_to_word"),
            ("card-4", "example_to_word"),
        ] {
            conn.execute(
                "INSERT INTO review_cards
                    (id, word_id, face, state, due_at, interval_days, ease_factor, reps, lapses)
                 VALUES (?1, 'word-1', ?2, 'new', '2026-04-07T18:00:00Z', 0, 2.5, 0, 0)",
                params![id, face],
            )
            .expect("insert review card");
        }

        let cards = query_public_cards_for_set(&conn, "set-1").expect("public cards");

        assert_eq!(cards.len(), 4);
        assert_eq!(cards[0].translation_uk.as_deref(), Some("яблуко"));
        assert_eq!(cards[0].phonetic_text.as_deref(), Some("/a/"));
        assert_eq!(count_cards_for_set(&conn, "set-1").expect("count"), 4);
    }
}
