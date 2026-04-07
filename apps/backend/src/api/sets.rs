use axum::{
    extract::{Path, State},
    Json,
};
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Deserializer, Serialize};
use uuid::Uuid;

use crate::error::{AppError, Result};
use crate::services::word_repo::{self, WordDetail};
use crate::AppState;

#[derive(Serialize)]
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

// ---- Handlers ---------------------------------------------------------

/// GET /api/sets
pub async fn list_sets(State(state): State<AppState>) -> Result<Json<Vec<StudySetResponse>>> {
    let conn = state.db.get()?;
    let mut stmt = conn.prepare(
        "SELECT s.id, s.name, s.description, s.created_at, s.updated_at,
                COUNT(sw.word_id) as word_count
         FROM study_sets s
         LEFT JOIN study_set_words sw ON sw.set_id = s.id
         GROUP BY s.id
         ORDER BY s.updated_at DESC",
    )?;
    let sets: Vec<StudySetResponse> = stmt
        .query_map([], |r| {
            Ok(StudySetResponse {
                id: r.get(0)?,
                name: r.get(1)?,
                description: r.get(2)?,
                created_at: r.get(3)?,
                updated_at: r.get(4)?,
                word_count: r.get(5)?,
            })
        })?
        .collect::<std::result::Result<_, _>>()?;
    Ok(Json(sets))
}

/// GET /api/sets/:id
pub async fn get_set(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<StudySetResponse>> {
    let conn = state.db.get()?;
    query_set(&conn, &id)
        .map(Json)
        .ok_or_else(|| AppError::NotFound(format!("Set '{}' not found", id)))
}

/// POST /api/sets
pub async fn create_set(
    State(state): State<AppState>,
    Json(body): Json<CreateSetRequest>,
) -> Result<Json<StudySetResponse>> {
    if body.name.trim().is_empty() {
        return Err(AppError::BadRequest("Set name cannot be empty".into()));
    }
    let conn = state.db.get()?;
    let id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO study_sets (id, name, description) VALUES (?1, ?2, ?3)",
        params![id, body.name.trim(), body.description],
    )?;
    Ok(Json(query_set(&conn, &id).unwrap()))
}

/// PUT /api/sets/:id
pub async fn update_set(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(body): Json<UpdateSetRequest>,
) -> Result<Json<StudySetResponse>> {
    let conn = state.db.get()?;
    if let Some(name) = &body.name {
        if name.trim().is_empty() {
            return Err(AppError::BadRequest("Set name cannot be empty".into()));
        }
        conn.execute(
            "UPDATE study_sets SET name = ?1, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
             WHERE id = ?2",
            params![name.trim(), id],
        )?;
    }
    if let Some(desc) = &body.description {
        let trimmed = desc
            .as_ref()
            .map(|value| value.trim())
            .filter(|value| !value.is_empty());
        conn.execute(
            "UPDATE study_sets SET description = ?1, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
             WHERE id = ?2",
            params![trimmed, id],
        )?;
    }
    query_set(&conn, &id)
        .map(Json)
        .ok_or_else(|| AppError::NotFound(format!("Set '{}' not found", id)))
}

/// DELETE /api/sets/:id
pub async fn delete_set(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>> {
    let conn = state.db.get()?;
    let affected = conn.execute("DELETE FROM study_sets WHERE id = ?1", params![id])?;
    if affected == 0 {
        return Err(AppError::NotFound(format!("Set '{}' not found", id)));
    }
    Ok(Json(serde_json::json!({ "ok": true })))
}

/// GET /api/sets/:id/words
pub async fn list_set_words(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<Vec<WordDetail>>> {
    let conn = state.db.get()?;
    let mut stmt = conn
        .prepare("SELECT word_id FROM study_set_words WHERE set_id = ?1 ORDER BY added_at DESC")?;
    let word_ids: Vec<String> = stmt
        .query_map(params![id], |r| r.get(0))?
        .collect::<std::result::Result<_, _>>()?;

    let mut words = Vec::new();
    for wid in word_ids {
        if let Ok(detail) = word_repo::get_word_by_id(&conn, &wid) {
            words.push(detail);
        }
    }
    Ok(Json(words))
}

/// POST /api/sets/:id/words
pub async fn add_word_to_set(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(body): Json<AddWordRequest>,
) -> Result<Json<serde_json::Value>> {
    let conn = state.db.get()?;
    // Verify set and word exist
    if query_set(&conn, &id).is_none() {
        return Err(AppError::NotFound(format!("Set '{}' not found", id)));
    }
    word_repo::get_word_by_id(&conn, &body.word_id)?;

    conn.execute(
        "INSERT OR IGNORE INTO study_set_words (set_id, word_id) VALUES (?1, ?2)",
        params![id, body.word_id],
    )?;
    // Also auto-save the word and create cards
    word_repo::save_word(&conn, &body.word_id)?;
    word_repo::ensure_review_cards(&conn, &body.word_id)?;

    // Update set timestamp
    conn.execute(
        "UPDATE study_sets SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id = ?1",
        params![id],
    )?;

    Ok(Json(serde_json::json!({ "ok": true })))
}

/// DELETE /api/sets/:id/words/:word_id
pub async fn remove_word_from_set(
    State(state): State<AppState>,
    Path((set_id, word_id)): Path<(String, String)>,
) -> Result<Json<serde_json::Value>> {
    let conn = state.db.get()?;
    conn.execute(
        "DELETE FROM study_set_words WHERE set_id = ?1 AND word_id = ?2",
        params![set_id, word_id],
    )?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

// ---- Helpers ---------------------------------------------------------

fn query_set(conn: &rusqlite::Connection, id: &str) -> Option<StudySetResponse> {
    conn.query_row(
        "SELECT s.id, s.name, s.description, s.created_at, s.updated_at,
                COUNT(sw.word_id) as word_count
         FROM study_sets s
         LEFT JOIN study_set_words sw ON sw.set_id = s.id
         WHERE s.id = ?1
         GROUP BY s.id",
        params![id],
        |r| {
            Ok(StudySetResponse {
                id: r.get(0)?,
                name: r.get(1)?,
                description: r.get(2)?,
                created_at: r.get(3)?,
                updated_at: r.get(4)?,
                word_count: r.get(5)?,
            })
        },
    )
    .optional()
    .ok()
    .flatten()
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
