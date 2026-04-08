use axum::{
    response::IntoResponse,
    routing::{delete, get, post},
    Router,
};

use crate::AppState;

use super::{auth, dashboard, history, review, sets, settings, words};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/health", get(health))
        .merge(auth_routes())
        .merge(word_routes())
        .merge(set_routes())
        .merge(review_routes())
        .merge(dashboard_routes())
        .merge(history_routes())
        .merge(settings_routes())
}

fn auth_routes() -> Router<AppState> {
    Router::new()
        .route("/auth/providers", get(auth::list_providers))
        .route("/auth/register", post(auth::register))
        .route("/auth/login", post(auth::login))
        .route("/auth/logout", post(auth::logout))
        .route("/auth/me", get(auth::me))
        .route("/auth/oauth/:provider/start", post(auth::start_oauth))
        .route("/auth/oauth/:provider/callback", get(auth::complete_oauth))
        .route("/auth/oauth/status/:state", get(auth::oauth_status))
}

fn word_routes() -> Router<AppState> {
    Router::new()
        .route("/words/search", get(words::search))
        .route("/words/saved", get(words::list_saved))
        .route("/words/:id", get(words::get_word))
        .route("/words/:id/save", post(words::save_word))
        .route("/words/:id/save", delete(words::unsave_word))
        .route("/words/:id/favorite", post(words::favorite_word))
        .route("/words/:id/favorite", delete(words::unfavorite_word))
        .route("/words/:id/relearn", post(words::relearn_word))
        .route("/favorites", get(words::list_favorites))
}

fn set_routes() -> Router<AppState> {
    Router::new()
        .route("/sets", get(sets::list_sets).post(sets::create_set))
        .route(
            "/sets/:id",
            get(sets::get_set)
                .put(sets::update_set)
                .delete(sets::delete_set),
        )
        .route("/sets/:id/share", post(review::create_public_set_test_link))
        .route(
            "/sets/:id/share-test",
            post(review::create_public_set_test_link),
        )
        .route(
            "/sets/:id/words",
            get(sets::list_set_words).post(sets::add_word_to_set),
        )
        .route(
            "/sets/:id/words/:word_id",
            delete(sets::remove_word_from_set),
        )
}

fn review_routes() -> Router<AppState> {
    Router::new()
        .route("/review/session", get(review::start_session))
        .route("/review/submit", post(review::submit_review))
        .route("/review/session/:id/summary", get(review::session_summary))
        .route("/public/tests/:token", get(review::public_test_deck))
}

fn dashboard_routes() -> Router<AppState> {
    Router::new().route("/dashboard/stats", get(dashboard::stats))
}

fn history_routes() -> Router<AppState> {
    Router::new()
        .route("/history", get(history::list_history))
        .route("/history", post(history::record_search))
}

fn settings_routes() -> Router<AppState> {
    Router::new().route(
        "/settings",
        get(settings::get_settings).put(settings::update_settings),
    )
}

async fn health() -> impl IntoResponse {
    axum::Json(serde_json::json!({ "ok": true }))
}
