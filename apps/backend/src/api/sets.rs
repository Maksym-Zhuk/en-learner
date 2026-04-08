use axum::{
    extract::{Path, State},
    Json,
};
use serde::{Deserialize, Deserializer, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use crate::error::{AppError, Result};
use crate::services::word_repo::{self, WordDetail};
use crate::AppState;

#[derive(Serialize, FromRow)]
pub struct StudySetResponse {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub word_count: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Deserialize)]
pub struct CreateSetRequest {
    pub name: String,
    pub description: Option<String>,
}

#[derive(Deserialize)]
pub struct UpdateSetRequest {
    pub name: Option<String>,
    #[serde(default, deserialize_with = "deserialize_optional_nullable_string")]
    pub description: Option<Option<String>>,
}

#[derive(Deserialize)]
pub struct AddWordRequest {
    pub word_id: String,
}

pub async fn list_sets(State(state): State<AppState>) -> Result<Json<Vec<StudySetResponse>>> {
    let sets = sqlx::query_as::<_, StudySetResponse>(
        "SELECT s.id, s.name, s.description, s.created_at, s.updated_at,
                COUNT(sw.word_id)::BIGINT AS word_count
         FROM study_sets s
         LEFT JOIN study_set_words sw ON sw.set_id = s.id
         GROUP BY s.id, s.name, s.description, s.created_at, s.updated_at
         ORDER BY s.updated_at DESC",
    )
    .fetch_all(state.db.as_ref())
    .await?;

    Ok(Json(sets))
}

pub async fn get_set(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<StudySetResponse>> {
    query_set(state.db.as_ref(), &id)
        .await?
        .map(Json)
        .ok_or_else(|| AppError::NotFound(format!("Set '{id}' not found")))
}

pub async fn create_set(
    State(state): State<AppState>,
    Json(body): Json<CreateSetRequest>,
) -> Result<Json<StudySetResponse>> {
    if body.name.trim().is_empty() {
        return Err(AppError::BadRequest("Set name cannot be empty".into()));
    }

    let id = Uuid::new_v4().to_string();
    sqlx::query("INSERT INTO study_sets (id, name, description) VALUES ($1, $2, $3)")
        .bind(&id)
        .bind(body.name.trim())
        .bind(body.description)
        .execute(state.db.as_ref())
        .await?;

    Ok(Json(query_set(state.db.as_ref(), &id).await?.ok_or_else(
        || AppError::Internal("Failed to load created set".into()),
    )?))
}

pub async fn update_set(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(body): Json<UpdateSetRequest>,
) -> Result<Json<StudySetResponse>> {
    if let Some(name) = &body.name {
        if name.trim().is_empty() {
            return Err(AppError::BadRequest("Set name cannot be empty".into()));
        }

        sqlx::query(
            "UPDATE study_sets
             SET name = $1,
                 updated_at = to_char(timezone('UTC', now()), 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"')
             WHERE id = $2",
        )
        .bind(name.trim())
        .bind(&id)
        .execute(state.db.as_ref())
        .await?;
    }

    if let Some(desc) = &body.description {
        let trimmed = desc
            .as_ref()
            .map(|value| value.trim())
            .filter(|value| !value.is_empty());

        sqlx::query(
            "UPDATE study_sets
             SET description = $1,
                 updated_at = to_char(timezone('UTC', now()), 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"')
             WHERE id = $2",
        )
        .bind(trimmed)
        .bind(&id)
        .execute(state.db.as_ref())
        .await?;
    }

    query_set(state.db.as_ref(), &id)
        .await?
        .map(Json)
        .ok_or_else(|| AppError::NotFound(format!("Set '{id}' not found")))
}

pub async fn delete_set(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>> {
    let result = sqlx::query("DELETE FROM study_sets WHERE id = $1")
        .bind(&id)
        .execute(state.db.as_ref())
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound(format!("Set '{id}' not found")));
    }

    Ok(Json(serde_json::json!({ "ok": true })))
}

pub async fn list_set_words(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<Vec<WordDetail>>> {
    let word_ids = sqlx::query_scalar::<_, String>(
        "SELECT word_id FROM study_set_words WHERE set_id = $1 ORDER BY added_at DESC",
    )
    .bind(&id)
    .fetch_all(state.db.as_ref())
    .await?;

    let mut words = Vec::with_capacity(word_ids.len());
    for word_id in word_ids {
        if let Ok(detail) = word_repo::get_word_by_id(state.db.as_ref(), &word_id).await {
            words.push(detail);
        }
    }

    Ok(Json(words))
}

pub async fn add_word_to_set(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(body): Json<AddWordRequest>,
) -> Result<Json<serde_json::Value>> {
    if query_set(state.db.as_ref(), &id).await?.is_none() {
        return Err(AppError::NotFound(format!("Set '{id}' not found")));
    }

    word_repo::get_word_by_id(state.db.as_ref(), &body.word_id).await?;

    sqlx::query(
        "INSERT INTO study_set_words (set_id, word_id) VALUES ($1, $2)
         ON CONFLICT (set_id, word_id) DO NOTHING",
    )
    .bind(&id)
    .bind(&body.word_id)
    .execute(state.db.as_ref())
    .await?;

    word_repo::save_word(state.db.as_ref(), &body.word_id).await?;
    word_repo::ensure_review_cards(state.db.as_ref(), &body.word_id).await?;

    sqlx::query(
        "UPDATE study_sets
         SET updated_at = to_char(timezone('UTC', now()), 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"')
         WHERE id = $1",
    )
    .bind(&id)
    .execute(state.db.as_ref())
    .await?;

    Ok(Json(serde_json::json!({ "ok": true })))
}

pub async fn remove_word_from_set(
    State(state): State<AppState>,
    Path((set_id, word_id)): Path<(String, String)>,
) -> Result<Json<serde_json::Value>> {
    sqlx::query("DELETE FROM study_set_words WHERE set_id = $1 AND word_id = $2")
        .bind(set_id)
        .bind(word_id)
        .execute(state.db.as_ref())
        .await?;

    Ok(Json(serde_json::json!({ "ok": true })))
}

async fn query_set(pool: &sqlx::PgPool, id: &str) -> Result<Option<StudySetResponse>> {
    let row = sqlx::query_as::<_, StudySetResponse>(
        "SELECT s.id, s.name, s.description, s.created_at, s.updated_at,
                COUNT(sw.word_id)::BIGINT AS word_count
         FROM study_sets s
         LEFT JOIN study_set_words sw ON sw.set_id = s.id
         WHERE s.id = $1
         GROUP BY s.id, s.name, s.description, s.created_at, s.updated_at",
    )
    .bind(id)
    .fetch_optional(pool)
    .await?;

    Ok(row)
}

fn deserialize_optional_nullable_string<'de, D>(
    deserializer: D,
) -> std::result::Result<Option<Option<String>>, D::Error>
where
    D: Deserializer<'de>,
{
    let value = serde_json::Value::deserialize(deserializer)?;

    match value {
        serde_json::Value::Null => Ok(Some(None)),
        serde_json::Value::String(text) => Ok(Some(Some(text))),
        _ => Err(serde::de::Error::custom(
            "description must be a string or null",
        )),
    }
}
