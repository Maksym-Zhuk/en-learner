use axum::{
    extract::{Path, Query, State},
    Json,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use tracing::{debug, info};

use crate::error::{AppError, Result};
use crate::services::{
    dictionary::DictionaryService,
    translator::{LingvaTranslator, TranslatorProvider},
    word_repo,
};
use crate::AppState;

#[derive(Deserialize)]
pub struct SearchQuery {
    pub q: String,
}

#[derive(Serialize)]
pub struct SearchResponse {
    pub entry: word_repo::WordDetail,
    pub from_cache: bool,
}

#[derive(Deserialize)]
pub struct ResetReviewRequest {
    pub mode: Option<String>,
}

#[derive(Serialize)]
pub struct ResetReviewResponse {
    pub word_id: String,
    pub cards_reset: usize,
    pub mode: String,
    pub due_at: String,
    pub queued_at: String,
}

pub async fn search(
    State(state): State<AppState>,
    Query(q): Query<SearchQuery>,
) -> Result<Json<SearchResponse>> {
    let word = q.q.trim().to_lowercase();
    if word.is_empty() {
        return Err(AppError::BadRequest("Search query cannot be empty".into()));
    }

    debug!("Searching for word: '{word}'");

    if let Some(detail) = word_repo::get_word_by_text(state.db.as_ref(), &word).await? {
        debug!("Cache hit for '{word}'");
        return Ok(Json(SearchResponse {
            entry: detail,
            from_cache: true,
        }));
    }

    let dict_service = DictionaryService::new(
        (*state.http).clone(),
        state.config.dictionary_api_url.clone(),
    );

    let normalized = dict_service.fetch(&word).await?;
    let translation = fetch_translation(&state, &normalized.word).await;

    let word_id = word_repo::upsert_word(state.db.as_ref(), &normalized).await?;

    if let Some(uk_text) = &translation {
        word_repo::upsert_translation(state.db.as_ref(), &word_id, "uk", uk_text).await?;
    }

    let detail = word_repo::get_word_by_id(state.db.as_ref(), &word_id).await?;

    info!("Fetched and cached word: '{word}' (id={word_id})");

    Ok(Json(SearchResponse {
        entry: detail,
        from_cache: false,
    }))
}

pub async fn get_word(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<word_repo::WordDetail>> {
    Ok(Json(
        word_repo::get_word_by_id(state.db.as_ref(), &id).await?,
    ))
}

pub async fn list_saved(State(state): State<AppState>) -> Result<Json<Vec<word_repo::WordDetail>>> {
    Ok(Json(word_repo::list_saved_words(state.db.as_ref()).await?))
}

pub async fn save_word(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>> {
    word_repo::get_word_by_id(state.db.as_ref(), &id).await?;
    word_repo::save_word(state.db.as_ref(), &id).await?;
    word_repo::ensure_review_cards(state.db.as_ref(), &id).await?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

pub async fn unsave_word(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>> {
    word_repo::unsave_word(state.db.as_ref(), &id).await?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

pub async fn favorite_word(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>> {
    word_repo::get_word_by_id(state.db.as_ref(), &id).await?;
    word_repo::set_favorite(state.db.as_ref(), &id, true).await?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

pub async fn unfavorite_word(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>> {
    word_repo::set_favorite(state.db.as_ref(), &id, false).await?;
    Ok(Json(serde_json::json!({ "ok": true })))
}

pub async fn list_favorites(
    State(state): State<AppState>,
) -> Result<Json<Vec<word_repo::WordDetail>>> {
    Ok(Json(word_repo::list_favorites(state.db.as_ref()).await?))
}

pub async fn relearn_word(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(body): Json<ResetReviewRequest>,
) -> Result<Json<ResetReviewResponse>> {
    word_repo::get_word_by_id(state.db.as_ref(), &id).await?;

    let mode = body
        .mode
        .as_deref()
        .and_then(word_repo::ResetReviewMode::from_str)
        .unwrap_or(word_repo::ResetReviewMode::Forgotten);

    let result = word_repo::reset_review_cards(state.db.as_ref(), &id, mode).await?;
    let queued_at = Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();

    Ok(Json(ResetReviewResponse {
        word_id: id,
        cards_reset: result.cards_reset,
        mode: result.mode.as_str().to_string(),
        due_at: result.due_at,
        queued_at,
    }))
}

async fn fetch_translation(state: &AppState, word: &str) -> Option<String> {
    let translator =
        LingvaTranslator::new((*state.http).clone(), state.config.lingva_api_url.clone());

    match translator.translate(word, "en", "uk").await {
        Ok(text) => Some(text),
        Err(e) => {
            tracing::warn!("Translation failed for '{word}': {e}");
            None
        }
    }
}
