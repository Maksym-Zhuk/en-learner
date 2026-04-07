use axum::{
    extract::{Path, Query, State},
    Json,
};
use serde::{Deserialize, Serialize};
use tracing::{debug, info};

use crate::error::{AppError, Result};
use crate::services::{
    dictionary::DictionaryService,
    translator::{LingvaTranslator, TranslatorProvider},
    word_repo,
};
use crate::AppState;

// ---- Request/Response types -------------------------------------------

#[derive(Deserialize)]
pub struct SearchQuery {
    pub q: String,
}

#[derive(Serialize)]
pub struct SearchResponse {
    pub entry: word_repo::WordDetail,
    pub from_cache: bool,
}

// ---- Handlers ---------------------------------------------------------

/// GET /api/words/search?q={word}
///
/// 1. Check DB cache for previously fetched word
/// 2. If not found, call dictionary API + translation API
/// 3. Persist and return
pub async fn search(
    State(state): State<AppState>,
    Query(q): Query<SearchQuery>,
) -> Result<Json<SearchResponse>> {
    let word = q.q.trim().to_lowercase();
    if word.is_empty() {
        return Err(AppError::BadRequest("Search query cannot be empty".into()));
    }

    debug!("Searching for word: '{}'", word);

    let conn = state.db.get()?;

    // Check cache first
    if let Some(detail) = word_repo::get_word_by_text(&conn, &word)? {
        debug!("Cache hit for '{}'", word);
        return Ok(Json(SearchResponse {
            entry: detail,
            from_cache: true,
        }));
    }

    // Fetch from dictionary API
    let dict_service = DictionaryService::new(
        (*state.http).clone(),
        state.config.dictionary_api_url.clone(),
    );

    let normalized = dict_service.fetch(&word).await?;

    // Fetch translation (best-effort, don't fail the whole request)
    let translation = fetch_translation(&state, &normalized.word).await;

    // Persist to DB
    let word_id = word_repo::upsert_word(&conn, &normalized)?;

    if let Some(uk_text) = &translation {
        word_repo::upsert_translation(&conn, &word_id, "uk", uk_text)?;
    }

    let detail = word_repo::get_word_by_id(&conn, &word_id)?;

    info!("Fetched and cached word: '{}' (id={})", word, word_id);

    Ok(Json(SearchResponse {
        entry: detail,
        from_cache: false,
    }))
}

/// GET /api/words/:id
pub async fn get_word(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<word_repo::WordDetail>> {
    let conn = state.db.get()?;
    let detail = word_repo::get_word_by_id(&conn, &id)?;
    Ok(Json(detail))
}

/// GET /api/words/saved
pub async fn list_saved(State(state): State<AppState>) -> Result<Json<Vec<word_repo::WordDetail>>> {
    let conn = state.db.get()?;
    let words = word_repo::list_saved_words(&conn)?;
    Ok(Json(words))
}

/// POST /api/words/:id/save
pub async fn save_word(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>> {
    let conn = state.db.get()?;
    // Verify word exists
    word_repo::get_word_by_id(&conn, &id)?;
    word_repo::save_word(&conn, &id)?;
    // Create review cards automatically
    word_repo::ensure_review_cards(&conn, &id)?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

/// DELETE /api/words/:id/save
pub async fn unsave_word(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>> {
    let conn = state.db.get()?;
    word_repo::unsave_word(&conn, &id)?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

/// POST /api/words/:id/favorite
pub async fn favorite_word(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>> {
    let conn = state.db.get()?;
    word_repo::get_word_by_id(&conn, &id)?;
    word_repo::set_favorite(&conn, &id, true)?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

/// DELETE /api/words/:id/favorite
pub async fn unfavorite_word(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>> {
    let conn = state.db.get()?;
    word_repo::set_favorite(&conn, &id, false)?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

/// GET /api/favorites
pub async fn list_favorites(
    State(state): State<AppState>,
) -> Result<Json<Vec<word_repo::WordDetail>>> {
    let conn = state.db.get()?;
    let words = word_repo::list_favorites(&conn)?;
    Ok(Json(words))
}

// ---- Internal helpers -------------------------------------------------

async fn fetch_translation(state: &AppState, word: &str) -> Option<String> {
    let translator =
        LingvaTranslator::new((*state.http).clone(), state.config.lingva_api_url.clone());

    match translator.translate(word, "en", "uk").await {
        Ok(text) => Some(text),
        Err(e) => {
            tracing::warn!("Translation failed for '{}': {}", word, e);
            None
        }
    }
}
