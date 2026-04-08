use std::sync::Arc;
use tracing::info;

mod api;
mod app;
mod clock;
mod config;
mod db;
mod error;
mod models;
mod services;

pub use app::AppState;
pub use config::Config;
pub use error::{AppError, Result};

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
    let database_url = db::resolve_database_url(&config.database_url)?;

    // Initialize database pool
    info!("Using postgres database: {}", database_url);
    let pool = db::init_pool(&database_url).await?;
    db::run_migrations(&pool).await?;
    info!("Database initialized and migrations applied");

    let http_client = app::build_http_client()?;

    let state = AppState::new(
        Arc::new(pool),
        Arc::new(http_client),
        Arc::new(config.clone()),
    );
    let app = app::build_router(state);

    let addr = config.listen_addr();
    info!("en-learner backend listening on http://{}", addr);

    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
