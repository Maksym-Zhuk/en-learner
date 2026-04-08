use std::sync::Arc;

use axum::{routing::get, Json, Router};
use tower_http::cors::{Any, CorsLayer};
use tower_http::services::{ServeDir, ServeFile};
use tower_http::trace::TraceLayer;
use tracing::{info, warn};

use crate::{api, db, Config};

#[derive(Clone)]
pub struct AppState {
    pub db: Arc<db::Pool>,
    pub http: Arc<reqwest::Client>,
    pub config: Arc<Config>,
}

impl AppState {
    pub fn new(db: Arc<db::Pool>, http: Arc<reqwest::Client>, config: Arc<Config>) -> Self {
        Self { db, http, config }
    }
}

pub fn build_router(state: AppState) -> Router {
    let config = state.config.clone();
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/health", get(health))
        .nest("/api", api::router())
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(state);

    match config.resolve_frontend_dist_dir() {
        Some(frontend_dist) => {
            info!("Serving frontend assets from {}", frontend_dist.display());
            app.fallback_service(
                ServeDir::new(&frontend_dist)
                    .not_found_service(ServeFile::new(frontend_dist.join("index.html"))),
            )
        }
        None if config.serve_frontend => {
            warn!("SERVE_FRONTEND is enabled, but no frontend dist directory was found");
            app
        }
        None => app,
    }
}

pub fn build_http_client() -> anyhow::Result<reqwest::Client> {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .user_agent("en-learner/1.0")
        .build()
        .map_err(Into::into)
}

async fn health() -> Json<serde_json::Value> {
    Json(serde_json::json!({ "ok": true }))
}
