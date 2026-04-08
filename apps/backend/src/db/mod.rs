use anyhow::{bail, Context};
use sqlx::{migrate::Migrator, postgres::PgPoolOptions, PgPool};
use std::time::Duration;

pub type Pool = PgPool;

static MIGRATOR: Migrator = sqlx::migrate!("./src/db/migrations");

pub fn resolve_database_url(database_url: &str) -> anyhow::Result<String> {
    let normalized = database_url.trim();

    if normalized.is_empty() {
        bail!("DATABASE_URL cannot be empty");
    }

    let lower = normalized.to_ascii_lowercase();
    if !lower.starts_with("postgres://") && !lower.starts_with("postgresql://") {
        bail!("DATABASE_URL must use postgres:// or postgresql://");
    }

    Ok(normalized.to_string())
}

pub async fn init_pool(database_url: &str) -> anyhow::Result<Pool> {
    PgPoolOptions::new()
        .max_connections(10)
        .min_connections(1)
        .acquire_timeout(Duration::from_secs(10))
        .connect(database_url)
        .await
        .with_context(|| format!("failed to connect to postgres at {database_url}"))
}

pub async fn run_migrations(pool: &Pool) -> anyhow::Result<()> {
    MIGRATOR.run(pool).await?;
    Ok(())
}
