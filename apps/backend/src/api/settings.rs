use axum::{extract::State, Json};
use rusqlite::params;
use serde::Deserialize;

use crate::error::Result;
use crate::models::AppSettings;
use crate::AppState;

#[derive(Deserialize)]
pub struct UpdateSettingsRequest {
    pub dark_mode: Option<bool>,
    pub daily_review_limit: Option<i64>,
    pub new_cards_per_day: Option<i64>,
    pub audio_autoplay: Option<bool>,
    pub show_translation_immediately: Option<bool>,
    pub ui_language: Option<String>,
}

/// GET /api/settings
pub async fn get_settings(State(state): State<AppState>) -> Result<Json<AppSettings>> {
    let conn = state.db.get()?;
    let settings = load_settings(&conn)?;
    Ok(Json(settings))
}

/// PUT /api/settings
pub async fn update_settings(
    State(state): State<AppState>,
    Json(body): Json<UpdateSettingsRequest>,
) -> Result<Json<AppSettings>> {
    let conn = state.db.get()?;

    if let Some(v) = body.dark_mode {
        set_key(&conn, "dark_mode", &v.to_string())?;
    }
    if let Some(v) = body.daily_review_limit {
        set_key(&conn, "daily_review_limit", &v.to_string())?;
    }
    if let Some(v) = body.new_cards_per_day {
        set_key(&conn, "new_cards_per_day", &v.to_string())?;
    }
    if let Some(v) = body.audio_autoplay {
        set_key(&conn, "audio_autoplay", &v.to_string())?;
    }
    if let Some(v) = body.show_translation_immediately {
        set_key(&conn, "show_translation_immediately", &v.to_string())?;
    }
    if let Some(v) = body.ui_language {
        set_key(&conn, "ui_language", &v)?;
    }

    Ok(Json(load_settings(&conn)?))
}

fn load_settings(conn: &rusqlite::Connection) -> Result<AppSettings> {
    fn get(conn: &rusqlite::Connection, key: &str) -> Option<String> {
        conn.query_row(
            "SELECT value FROM app_settings WHERE key = ?1",
            params![key],
            |r| r.get(0),
        )
        .ok()
    }

    Ok(AppSettings {
        dark_mode: get(conn, "dark_mode")
            .and_then(|v| v.parse().ok())
            .unwrap_or(false),
        daily_review_limit: get(conn, "daily_review_limit")
            .and_then(|v| v.parse().ok())
            .unwrap_or(100),
        new_cards_per_day: get(conn, "new_cards_per_day")
            .and_then(|v| v.parse().ok())
            .unwrap_or(20),
        audio_autoplay: get(conn, "audio_autoplay")
            .and_then(|v| v.parse().ok())
            .unwrap_or(false),
        show_translation_immediately: get(conn, "show_translation_immediately")
            .and_then(|v| v.parse().ok())
            .unwrap_or(false),
        ui_language: get(conn, "ui_language").unwrap_or_else(|| "en".into()),
    })
}

fn set_key(conn: &rusqlite::Connection, key: &str, value: &str) -> Result<()> {
    conn.execute(
        "INSERT INTO app_settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, value],
    )?;
    Ok(())
}
