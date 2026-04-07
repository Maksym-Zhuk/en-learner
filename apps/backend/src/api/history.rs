use axum::{extract::State, Json};
use rusqlite::params;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::Result;
use crate::AppState;

#[derive(Serialize)]
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

/// GET /api/history
pub async fn list_history(State(state): State<AppState>) -> Result<Json<Vec<HistoryEntry>>> {
    let conn = state.db.get()?;
    let mut stmt = conn.prepare(
        "SELECT sh.id, sh.query, sh.word_id, w.word, sh.searched_at
         FROM search_history sh
         LEFT JOIN words w ON w.id = sh.word_id
         ORDER BY sh.searched_at DESC
         LIMIT 100",
    )?;
    let entries: Vec<HistoryEntry> = stmt
        .query_map([], |r| {
            Ok(HistoryEntry {
                id: r.get(0)?,
                query: r.get(1)?,
                word_id: r.get(2)?,
                word: r.get(3)?,
                searched_at: r.get(4)?,
            })
        })?
        .collect::<std::result::Result<_, _>>()?;
    Ok(Json(entries))
}

/// POST /api/history
pub async fn record_search(
    State(state): State<AppState>,
    Json(body): Json<RecordSearchRequest>,
) -> Result<Json<serde_json::Value>> {
    if body.query.trim().is_empty() {
        return Ok(Json(serde_json::json!({ "ok": true })));
    }
    let conn = state.db.get()?;
    let id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO search_history (id, query, word_id) VALUES (?1, ?2, ?3)",
        params![id, body.query.trim(), body.word_id],
    )?;

    // Prune to keep last 500 entries
    conn.execute(
        "DELETE FROM search_history WHERE id NOT IN (
            SELECT id FROM search_history ORDER BY searched_at DESC LIMIT 500
         )",
        [],
    )?;

    Ok(Json(serde_json::json!({ "ok": true })))
}
