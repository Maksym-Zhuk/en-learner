use rusqlite_migration::{Migrations, M};
use std::path::PathBuf;

pub type Pool = r2d2::Pool<r2d2_sqlite::SqliteConnectionManager>;

/// Resolve the database file path.
/// Uses XDG_DATA_HOME if set, otherwise ~/.local/share/en-learner/
pub fn resolve_db_path() -> String {
    if let Ok(url) = std::env::var("DATABASE_URL") {
        // Strip "sqlite:" prefix if present
        return url.trim_start_matches("sqlite:").to_string();
    }

    let base = std::env::var("XDG_DATA_HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|_| dirs_or_home().join(".local").join("share"));

    let dir = base.join("en-learner");
    std::fs::create_dir_all(&dir).expect("failed to create data directory");
    dir.join("data.db").to_string_lossy().to_string()
}

fn dirs_or_home() -> PathBuf {
    std::env::var("HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("/tmp"))
}

pub fn init_pool(db_path: &str) -> anyhow::Result<Pool> {
    let manager = r2d2_sqlite::SqliteConnectionManager::file(db_path)
        .with_flags(
            rusqlite::OpenFlags::SQLITE_OPEN_READ_WRITE
                | rusqlite::OpenFlags::SQLITE_OPEN_CREATE
                | rusqlite::OpenFlags::SQLITE_OPEN_URI,
        )
        .with_init(|conn| {
            conn.execute_batch(
                "PRAGMA journal_mode=WAL;
                 PRAGMA foreign_keys=ON;
                 PRAGMA synchronous=NORMAL;
                 PRAGMA busy_timeout=5000;",
            )
        });

    let pool = r2d2::Pool::builder().max_size(8).build(manager)?;

    Ok(pool)
}

pub fn run_migrations(pool: &Pool) -> anyhow::Result<()> {
    let migrations = Migrations::new(vec![
        M::up(include_str!("migrations/001_initial.sql")),
        M::up(include_str!("migrations/002_review.sql")),
        M::up(include_str!("migrations/003_stats.sql")),
        M::up(include_str!("migrations/004_review_log_sessions.sql")),
        M::up(include_str!("migrations/005_public_test_links.sql")),
    ]);

    let mut conn = pool.get()?;
    migrations.to_latest(&mut conn)?;
    Ok(())
}
