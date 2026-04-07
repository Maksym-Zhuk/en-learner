use axum::Router;
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};
use tower_http::services::{ServeDir, ServeFile};
use tower_http::trace::TraceLayer;
use tracing::info;

mod api;
mod db;
mod error;
mod models;
mod services;

pub use error::{AppError, Result};

#[derive(Clone)]
pub struct AppState {
    pub db: Arc<db::Pool>,
    pub http: Arc<reqwest::Client>,
    pub config: Arc<Config>,
}

#[derive(Debug, Clone)]
pub struct Config {
    pub host: String,
    pub port: u16,
    pub dictionary_api_url: String,
    pub lingva_api_url: String,
}

impl Config {
    pub fn from_env() -> Self {
        Self {
            host: std::env::var("BACKEND_HOST").unwrap_or_else(|_| "127.0.0.1".into()),
            port: std::env::var("BACKEND_PORT")
                .ok()
                .and_then(|p| p.parse().ok())
                .unwrap_or(3001),
            dictionary_api_url: std::env::var("DICTIONARY_API_URL")
                .unwrap_or_else(|_| "https://api.dictionaryapi.dev/api/v2/entries/en".into()),
            lingva_api_url: std::env::var("LINGVA_API_URL")
                .unwrap_or_else(|_| "https://lingva.ml/api/v1".into()),
        }
    }
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Load .env if present
    let _ = dotenvy::dotenv();

    // Initialize structured logging
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "en_learner_backend=info,tower_http=debug".into()),
        )
        .init();

    let config = Config::from_env();

    // Initialize database pool
    let db_path = db::resolve_db_path();
    info!("Using database at: {}", db_path);
    let pool = db::init_pool(&db_path)?;
    db::run_migrations(&pool)?;
    info!("Database initialized and migrations applied");

    // Build HTTP client with reasonable timeouts
    let http_client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .user_agent("en-learner/1.0")
        .build()?;

    let state = AppState {
        db: Arc::new(pool),
        http: Arc::new(http_client),
        config: Arc::new(config.clone()),
    };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .nest("/api", api::router())
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state(state);

    let app = if let Some(frontend_dist) = resolve_frontend_dist_dir() {
        info!("Serving frontend assets from {}", frontend_dist.display());
        app.fallback_service(
            ServeDir::new(&frontend_dist)
                .not_found_service(ServeFile::new(frontend_dist.join("index.html"))),
        )
    } else {
        app
    };

    let addr = format!("{}:{}", config.host, config.port);
    info!("en-learner backend listening on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

fn resolve_frontend_dist_dir() -> Option<std::path::PathBuf> {
    let mut candidates = Vec::new();

    if let Ok(frontend_dist) = std::env::var("FRONTEND_DIST_DIR") {
        candidates.push(std::path::PathBuf::from(frontend_dist));
    }

    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            candidates.push(exe_dir.join("dist"));
            candidates.push(exe_dir.join("../dist"));
            candidates.push(exe_dir.join("../frontend/dist"));
            candidates.push(exe_dir.join("../../../frontend/dist"));
        }
    }

    candidates
        .into_iter()
        .find(|candidate| candidate.join("index.html").is_file())
}
