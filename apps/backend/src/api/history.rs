use axum::{extract::State, Json};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

use crate::error::Result;
use crate::AppState;

#[derive(Serialize, FromRow)]
pub struct HistoryEntry {
    pub id: String,
    pub query: String,
    pub word_id: Option<String>,
    pub word: Option<String>,
    pub searched_at: String,
}

#[derive(Deserialize)]
pub struct RecordSearchRequest {
    pub query: String,
    pub word_id: Option<String>,
}

pub async fn list_history(State(state): State<AppState>) -> Result<Json<Vec<HistoryEntry>>> {
    let entries = sqlx::query_as::<_, HistoryEntry>(
        "SELECT sh.id, sh.query, sh.word_id, w.word, sh.searched_at
         FROM search_history sh
         LEFT JOIN words w ON w.id = sh.word_id
         ORDER BY sh.searched_at DESC
         LIMIT 100",
    )
    .fetch_all(state.db.as_ref())
    .await?;

    Ok(Json(entries))
}

pub async fn record_search(
    State(state): State<AppState>,
    Json(body): Json<RecordSearchRequest>,
) -> Result<Json<serde_json::Value>> {
    if body.query.trim().is_empty() {
        return Ok(Json(serde_json::json!({ "ok": true })));
    }

    let id = Uuid::new_v4().to_string();

    sqlx::query("INSERT INTO search_history (id, query, word_id) VALUES ($1, $2, $3)")
        .bind(id)
        .bind(body.query.trim())
        .bind(body.word_id)
        .execute(state.db.as_ref())
        .await?;

    sqlx::query(
        "DELETE FROM search_history
         WHERE id NOT IN (
             SELECT id FROM search_history ORDER BY searched_at DESC LIMIT 500
         )",
    )
    .execute(state.db.as_ref())
    .await?;

    Ok(Json(serde_json::json!({ "ok": true })))
}
