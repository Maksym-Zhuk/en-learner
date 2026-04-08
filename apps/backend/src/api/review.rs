use axum::{
    extract::{Path, Query, State},
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, Row};
use uuid::Uuid;

use crate::clock::{utc_now_string, utc_today_string};
use crate::error::{AppError, Result};
use crate::models::{CardState, ReviewRating};
use crate::services::review_engine;
use crate::AppState;

#[derive(Deserialize)]
pub struct SessionQuery {
    pub set_id: Option<String>,
    pub limit: Option<u32>,
}

#[derive(Serialize, Deserialize, FromRow, Clone)]
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

#[derive(Deserialize, Default)]
pub struct ShareSetUploadRequest {
    pub set_name: Option<String>,
    pub set_description: Option<String>,
    #[serde(default)]
    pub cards: Vec<ReviewCardResponse>,
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

#[derive(FromRow)]
struct PublicSetMeta {
    id: String,
    name: String,
    description: Option<String>,
}

#[derive(FromRow)]
struct SharedDeckRow {
    token: String,
    set_id: String,
    set_name: String,
    set_description: Option<String>,
    cards_json: String,
}

pub async fn start_session(
    State(state): State<AppState>,
    Query(q): Query<SessionQuery>,
) -> Result<Json<ReviewSession>> {
    let limit = q.limit.unwrap_or(20).min(100) as i64;
    let now = utc_now_string();
    let session_id = Uuid::new_v4().to_string();

    let cards = if let Some(set_id) = &q.set_id {
        query_cards_for_set(state.db.as_ref(), set_id, &now, limit).await?
    } else {
        query_all_due_cards(state.db.as_ref(), &now, limit).await?
    };

    let total = cards.len();
    let new_count = cards.iter().filter(|c| c.state == "new").count();
    let review_count = cards.iter().filter(|c| c.state == "review").count();
    let relearning_count = cards.iter().filter(|c| c.state == "relearning").count();

    sqlx::query("INSERT INTO review_sessions (id, set_id, total_cards) VALUES ($1, $2, $3)")
        .bind(&session_id)
        .bind(q.set_id.clone())
        .bind(total as i64)
        .execute(state.db.as_ref())
        .await?;

    Ok(Json(ReviewSession {
        session_id,
        cards,
        total,
        new_count,
        review_count,
        relearning_count,
    }))
}

pub async fn submit_review(
    State(state): State<AppState>,
    Json(body): Json<SubmitReviewRequest>,
) -> Result<Json<SubmitReviewResponse>> {
    let rating = ReviewRating::from_str(&body.rating)
        .ok_or_else(|| AppError::BadRequest(format!("Invalid rating: {}", body.rating)))?;

    let row = sqlx::query(
        "SELECT state, interval_days, ease_factor, reps, lapses
         FROM review_cards
         WHERE id = $1",
    )
    .bind(&body.card_id)
    .fetch_optional(state.db.as_ref())
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Card '{}' not found", body.card_id)))?;

    let state_str: String = row.try_get("state")?;
    let interval: f64 = row.try_get("interval_days")?;
    let ease: f64 = row.try_get("ease_factor")?;
    let reps: i64 = row.try_get("reps")?;
    let lapses: i64 = row.try_get("lapses")?;

    let current_state = CardState::from_str(&state_str);
    let result = review_engine::schedule(&current_state, interval, ease, reps, lapses, &rating);
    let now = utc_now_string();

    sqlx::query(
        "UPDATE review_cards
         SET state = $1,
             due_at = $2,
             interval_days = $3,
             ease_factor = $4,
             reps = reps + 1,
             lapses = $5,
             last_reviewed_at = $6
         WHERE id = $7",
    )
    .bind(result.new_state.as_str())
    .bind(&result.due_at)
    .bind(result.interval_days)
    .bind(result.ease_factor)
    .bind(result.lapses)
    .bind(&now)
    .bind(&body.card_id)
    .execute(state.db.as_ref())
    .await?;

    let log_id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO review_logs
            (id, session_id, card_id, rating, time_spent_ms, state_before, state_after, interval_before, interval_after)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
    )
    .bind(log_id)
    .bind(&body.session_id)
    .bind(&body.card_id)
    .bind(rating.as_str())
    .bind(body.time_spent_ms)
    .bind(&state_str)
    .bind(result.new_state.as_str())
    .bind(interval)
    .bind(result.interval_days)
    .execute(state.db.as_ref())
    .await?;

    sqlx::query("UPDATE review_sessions SET reviewed = reviewed + 1 WHERE id = $1")
        .bind(&body.session_id)
        .execute(state.db.as_ref())
        .await?;

    let today = utc_today_string();
    let minutes = body.time_spent_ms as f64 / 60000.0;
    sqlx::query(
        "INSERT INTO daily_stats (date, words_reviewed, minutes_studied)
         VALUES ($1, 1, $2)
         ON CONFLICT(date) DO UPDATE SET
            words_reviewed = daily_stats.words_reviewed + 1,
            minutes_studied = daily_stats.minutes_studied + EXCLUDED.minutes_studied,
            updated_at = to_char(timezone('UTC', now()), 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"')",
    )
    .bind(today)
    .bind(minutes)
    .execute(state.db.as_ref())
    .await?;

    Ok(Json(SubmitReviewResponse {
        next_due_at: result.due_at,
        interval_days: result.interval_days,
        new_state: result.new_state.as_str().to_string(),
    }))
}

pub async fn session_summary(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<SessionSummary>> {
    sqlx::query(
        "UPDATE review_sessions
         SET finished_at = $2
         WHERE id = $1 AND finished_at IS NULL",
    )
    .bind(&id)
    .bind(utc_now_string())
    .execute(state.db.as_ref())
    .await?;

    Ok(Json(load_session_summary(state.db.as_ref(), &id).await?))
}

pub async fn create_public_set_test_link(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(payload): Json<ShareSetUploadRequest>,
) -> Result<Json<PublicTestLinkResponse>> {
    if !payload.cards.is_empty() {
        return create_uploaded_public_set_test_link(state, id, payload).await;
    }

    let set = load_public_set_meta(state.db.as_ref(), &id)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Set '{id}' not found")))?;

    let token =
        sqlx::query_scalar::<_, String>("SELECT token FROM public_test_links WHERE set_id = $1")
            .bind(&id)
            .fetch_optional(state.db.as_ref())
            .await?
            .unwrap_or_else(|| Uuid::new_v4().simple().to_string());

    sqlx::query(
        "INSERT INTO public_test_links (token, set_id, last_accessed_at)
         VALUES ($1, $2, $3)
         ON CONFLICT(set_id) DO UPDATE SET
            token = EXCLUDED.token,
            last_accessed_at = EXCLUDED.last_accessed_at",
    )
    .bind(&token)
    .bind(&id)
    .bind(utc_now_string())
    .execute(state.db.as_ref())
    .await?;

    let cards_count = count_cards_for_set(state.db.as_ref(), &id).await?;

    Ok(Json(PublicTestLinkResponse {
        token: token.clone(),
        set_id: id,
        set_name: set.name,
        cards_count,
        api_path: format!("/api/public/tests/{token}"),
        web_path: format!("/#/public/tests/{token}"),
    }))
}

async fn create_uploaded_public_set_test_link(
    state: AppState,
    id: String,
    payload: ShareSetUploadRequest,
) -> Result<Json<PublicTestLinkResponse>> {
    let set_name = payload
        .set_name
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "Shared study set".to_string());
    let cards_json = serde_json::to_string(&payload.cards)
        .map_err(|e| AppError::Internal(format!("Failed to serialize shared deck: {e}")))?;

    let token =
        sqlx::query_scalar::<_, String>("SELECT token FROM shared_test_decks WHERE set_id = $1")
            .bind(&id)
            .fetch_optional(state.db.as_ref())
            .await?
            .unwrap_or_else(|| Uuid::new_v4().simple().to_string());

    sqlx::query(
        "INSERT INTO shared_test_decks
            (token, set_id, set_name, set_description, cards_json, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT(set_id) DO UPDATE SET
            token = EXCLUDED.token,
            set_name = EXCLUDED.set_name,
            set_description = EXCLUDED.set_description,
            cards_json = EXCLUDED.cards_json,
            updated_at = EXCLUDED.updated_at",
    )
    .bind(&token)
    .bind(&id)
    .bind(&set_name)
    .bind(payload.set_description)
    .bind(cards_json)
    .bind(utc_now_string())
    .execute(state.db.as_ref())
    .await?;

    Ok(Json(PublicTestLinkResponse {
        token: token.clone(),
        set_id: id,
        set_name,
        cards_count: payload.cards.len() as i64,
        api_path: format!("/api/public/tests/{token}"),
        web_path: format!("/#/public/tests/{token}"),
    }))
}

pub async fn public_test_deck(
    State(state): State<AppState>,
    Path(token): Path<String>,
) -> Result<Json<PublicTestDeckResponse>> {
    if let Some(shared) = load_shared_public_deck(state.db.as_ref(), &token).await? {
        let cards: Vec<ReviewCardResponse> = serde_json::from_str(&shared.cards_json)
            .map_err(|e| AppError::Internal(format!("Failed to read shared deck payload: {e}")))?;

        return Ok(Json(PublicTestDeckResponse {
            token: shared.token,
            set_id: shared.set_id,
            set_name: shared.set_name,
            set_description: shared.set_description,
            total: cards.len(),
            cards,
        }));
    }

    let set = sqlx::query_as::<_, PublicSetMeta>(
        "SELECT s.id, s.name, s.description
         FROM public_test_links ptl
         JOIN study_sets s ON s.id = ptl.set_id
         WHERE ptl.token = $1",
    )
    .bind(&token)
    .fetch_optional(state.db.as_ref())
    .await?
    .ok_or_else(|| AppError::NotFound("Public test link not found".into()))?;

    sqlx::query(
        "UPDATE public_test_links
         SET last_accessed_at = $2
         WHERE token = $1",
    )
    .bind(&token)
    .bind(utc_now_string())
    .execute(state.db.as_ref())
    .await?;

    let cards = query_public_cards_for_set(state.db.as_ref(), &set.id).await?;
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

async fn query_all_due_cards(
    pool: &sqlx::PgPool,
    now: &str,
    limit: i64,
) -> Result<Vec<ReviewCardResponse>> {
    Ok(sqlx::query_as::<_, ReviewCardResponse>(
        "SELECT rc.id, rc.word_id, w.word,
                tr.translation_uk,
                ph.phonetic_text,
                meta.primary_definition,
                meta.primary_example,
                rc.face, rc.state, rc.due_at, rc.interval_days,
                rc.ease_factor, rc.reps, rc.lapses, rc.last_reviewed_at
         FROM review_cards rc
         JOIN words w ON w.id = rc.word_id
         LEFT JOIN LATERAL (
             SELECT t.text AS translation_uk
             FROM translations t
             WHERE t.word_id = w.id AND t.target_lang = 'uk'
             ORDER BY t.created_at ASC, t.id ASC
             LIMIT 1
         ) tr ON TRUE
         LEFT JOIN LATERAL (
             SELECT ph.text AS phonetic_text
             FROM phonetics ph
             WHERE ph.word_id = w.id
             ORDER BY ph.id ASC
             LIMIT 1
         ) ph ON TRUE
         LEFT JOIN LATERAL (
             SELECT
                 (
                    SELECT d.definition
                    FROM definitions d
                    JOIN meanings m ON m.id = d.meaning_id
                    WHERE m.word_id = w.id
                    ORDER BY m.position, d.position
                    LIMIT 1
                 ) AS primary_definition,
                 (
                    SELECT d.example
                    FROM definitions d
                    JOIN meanings m ON m.id = d.meaning_id
                    WHERE m.word_id = w.id AND d.example IS NOT NULL
                    ORDER BY m.position, d.position
                    LIMIT 1
                 ) AS primary_example
         ) meta ON TRUE
         WHERE rc.due_at <= $1
         ORDER BY rc.state DESC, rc.due_at ASC
         LIMIT $2",
    )
    .bind(now)
    .bind(limit)
    .fetch_all(pool)
    .await?)
}

async fn query_cards_for_set(
    pool: &sqlx::PgPool,
    set_id: &str,
    now: &str,
    limit: i64,
) -> Result<Vec<ReviewCardResponse>> {
    Ok(sqlx::query_as::<_, ReviewCardResponse>(
        "SELECT rc.id, rc.word_id, w.word,
                tr.translation_uk,
                ph.phonetic_text,
                meta.primary_definition,
                meta.primary_example,
                rc.face, rc.state, rc.due_at, rc.interval_days,
                rc.ease_factor, rc.reps, rc.lapses, rc.last_reviewed_at
         FROM review_cards rc
         JOIN words w ON w.id = rc.word_id
         JOIN study_set_words sw ON sw.word_id = w.id AND sw.set_id = $1
         LEFT JOIN LATERAL (
             SELECT t.text AS translation_uk
             FROM translations t
             WHERE t.word_id = w.id AND t.target_lang = 'uk'
             ORDER BY t.created_at ASC, t.id ASC
             LIMIT 1
         ) tr ON TRUE
         LEFT JOIN LATERAL (
             SELECT ph.text AS phonetic_text
             FROM phonetics ph
             WHERE ph.word_id = w.id
             ORDER BY ph.id ASC
             LIMIT 1
         ) ph ON TRUE
         LEFT JOIN LATERAL (
             SELECT
                 (
                    SELECT d.definition
                    FROM definitions d
                    JOIN meanings m ON m.id = d.meaning_id
                    WHERE m.word_id = w.id
                    ORDER BY m.position, d.position
                    LIMIT 1
                 ) AS primary_definition,
                 (
                    SELECT d.example
                    FROM definitions d
                    JOIN meanings m ON m.id = d.meaning_id
                    WHERE m.word_id = w.id AND d.example IS NOT NULL
                    ORDER BY m.position, d.position
                    LIMIT 1
                 ) AS primary_example
         ) meta ON TRUE
         WHERE rc.due_at <= $2
         ORDER BY rc.state DESC, rc.due_at ASC
         LIMIT $3",
    )
    .bind(set_id)
    .bind(now)
    .bind(limit)
    .fetch_all(pool)
    .await?)
}

async fn query_public_cards_for_set(
    pool: &sqlx::PgPool,
    set_id: &str,
) -> Result<Vec<ReviewCardResponse>> {
    Ok(sqlx::query_as::<_, ReviewCardResponse>(
        "SELECT rc.id, rc.word_id, w.word,
                tr.translation_uk,
                ph.phonetic_text,
                meta.primary_definition,
                meta.primary_example,
                rc.face, rc.state, rc.due_at, rc.interval_days,
                rc.ease_factor, rc.reps, rc.lapses, rc.last_reviewed_at
         FROM study_set_words sw
         JOIN words w ON w.id = sw.word_id
         JOIN review_cards rc ON rc.word_id = w.id
         LEFT JOIN LATERAL (
             SELECT t.text AS translation_uk
             FROM translations t
             WHERE t.word_id = w.id AND t.target_lang = 'uk'
             ORDER BY t.created_at ASC, t.id ASC
             LIMIT 1
         ) tr ON TRUE
         LEFT JOIN LATERAL (
             SELECT ph.text AS phonetic_text
             FROM phonetics ph
             WHERE ph.word_id = w.id AND ph.text IS NOT NULL
             ORDER BY ph.id ASC
             LIMIT 1
         ) ph ON TRUE
         LEFT JOIN LATERAL (
             SELECT
                 (
                    SELECT d.definition
                    FROM definitions d
                    JOIN meanings m ON m.id = d.meaning_id
                    WHERE m.word_id = w.id
                    ORDER BY m.position, d.position
                    LIMIT 1
                 ) AS primary_definition,
                 (
                    SELECT d.example
                    FROM definitions d
                    JOIN meanings m ON m.id = d.meaning_id
                    WHERE m.word_id = w.id AND d.example IS NOT NULL
                    ORDER BY m.position, d.position
                    LIMIT 1
                 ) AS primary_example
         ) meta ON TRUE
         WHERE sw.set_id = $1
         ORDER BY LOWER(w.word) ASC,
                  CASE rc.face
                      WHEN 'en_to_uk' THEN 0
                      WHEN 'uk_to_en' THEN 1
                      WHEN 'definition_to_word' THEN 2
                      ELSE 3
                  END ASC",
    )
    .bind(set_id)
    .fetch_all(pool)
    .await?)
}

async fn load_session_summary(pool: &sqlx::PgPool, id: &str) -> Result<SessionSummary> {
    let row = sqlx::query(
        "SELECT rs.started_at, rs.finished_at,
                COUNT(rl.id)::BIGINT AS total_reviewed,
                COALESCE(SUM(CASE WHEN rl.rating = 'again' THEN 1 ELSE 0 END), 0)::BIGINT AS again_count,
                COALESCE(SUM(CASE WHEN rl.rating = 'hard'  THEN 1 ELSE 0 END), 0)::BIGINT AS hard_count,
                COALESCE(SUM(CASE WHEN rl.rating = 'good'  THEN 1 ELSE 0 END), 0)::BIGINT AS good_count,
                COALESCE(SUM(CASE WHEN rl.rating = 'easy'  THEN 1 ELSE 0 END), 0)::BIGINT AS easy_count
         FROM review_sessions rs
         LEFT JOIN review_logs rl ON rl.session_id = rs.id
         WHERE rs.id = $1
         GROUP BY rs.id, rs.started_at, rs.finished_at",
    )
    .bind(id)
    .fetch_optional(pool)
    .await?
    .ok_or_else(|| AppError::NotFound(format!("Session '{id}' not found")))?;

    let started_at: String = row.try_get("started_at")?;
    let finished_at: Option<String> = row.try_get("finished_at")?;

    Ok(SessionSummary {
        total_reviewed: row.try_get("total_reviewed")?,
        again_count: row.try_get("again_count")?,
        hard_count: row.try_get("hard_count")?,
        good_count: row.try_get("good_count")?,
        easy_count: row.try_get("easy_count")?,
        duration_ms: compute_duration_ms(&started_at, finished_at.as_deref()),
    })
}

async fn load_public_set_meta(pool: &sqlx::PgPool, set_id: &str) -> Result<Option<PublicSetMeta>> {
    Ok(sqlx::query_as::<_, PublicSetMeta>(
        "SELECT id, name, description FROM study_sets WHERE id = $1",
    )
    .bind(set_id)
    .fetch_optional(pool)
    .await?)
}

async fn count_cards_for_set(pool: &sqlx::PgPool, set_id: &str) -> Result<i64> {
    Ok(sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(rc.id)
         FROM study_set_words sw
         JOIN review_cards rc ON rc.word_id = sw.word_id
         WHERE sw.set_id = $1",
    )
    .bind(set_id)
    .fetch_one(pool)
    .await?)
}

async fn load_shared_public_deck(pool: &sqlx::PgPool, token: &str) -> Result<Option<SharedDeckRow>> {
    Ok(sqlx::query_as::<_, SharedDeckRow>(
        "SELECT token, set_id, set_name, set_description, cards_json
         FROM shared_test_decks
         WHERE token = $1",
    )
    .bind(token)
    .fetch_optional(pool)
    .await?)
}

fn compute_duration_ms(started_at: &str, finished_at: Option<&str>) -> i64 {
    let started = parse_utc(started_at);
    let finished = finished_at.and_then(parse_utc).unwrap_or_else(Utc::now);

    match started {
        Some(started) => (finished - started).num_milliseconds().max(0),
        None => 0,
    }
}

fn parse_utc(value: &str) -> Option<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(value)
        .ok()
        .map(|date| date.with_timezone(&Utc))
}

#[cfg(test)]
mod tests {
    use super::compute_duration_ms;

    #[test]
    fn duration_is_computed_from_iso_timestamps() {
        let duration = compute_duration_ms("2026-04-07T18:00:00Z", Some("2026-04-07T18:01:30Z"));

        assert_eq!(duration, 90_000);
    }
}
