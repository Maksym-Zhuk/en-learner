use std::collections::HashMap;

use axum::{extract::State, Json};
use serde::Deserialize;
use sqlx::FromRow;

use crate::error::{AppError, Result};
use crate::models::AppSettings;
use crate::AppState;

const MIN_DAILY_REVIEW_LIMIT: i64 = 10;
const MAX_DAILY_REVIEW_LIMIT: i64 = 500;
const MIN_NEW_CARDS_PER_DAY: i64 = 1;
const MAX_NEW_CARDS_PER_DAY: i64 = 100;

#[derive(Deserialize)]
pub struct UpdateSettingsRequest {
    pub dark_mode: Option<bool>,
    pub daily_review_limit: Option<i64>,
    pub new_cards_per_day: Option<i64>,
    pub audio_autoplay: Option<bool>,
    pub show_translation_immediately: Option<bool>,
    pub ui_language: Option<String>,
}

#[derive(FromRow)]
struct SettingRow {
    key: String,
    value: String,
}

struct SettingsPatch {
    values: Vec<(&'static str, String)>,
}

impl UpdateSettingsRequest {
    fn into_patch(self) -> Result<SettingsPatch> {
        let mut values = Vec::new();

        if let Some(value) = self.dark_mode {
            values.push(("dark_mode", value.to_string()));
        }

        if let Some(value) = self.daily_review_limit {
            values.push((
                "daily_review_limit",
                validate_limit(
                    "daily_review_limit",
                    value,
                    MIN_DAILY_REVIEW_LIMIT,
                    MAX_DAILY_REVIEW_LIMIT,
                )?
                .to_string(),
            ));
        }

        if let Some(value) = self.new_cards_per_day {
            values.push((
                "new_cards_per_day",
                validate_limit(
                    "new_cards_per_day",
                    value,
                    MIN_NEW_CARDS_PER_DAY,
                    MAX_NEW_CARDS_PER_DAY,
                )?
                .to_string(),
            ));
        }

        if let Some(value) = self.audio_autoplay {
            values.push(("audio_autoplay", value.to_string()));
        }

        if let Some(value) = self.show_translation_immediately {
            values.push(("show_translation_immediately", value.to_string()));
        }

        if let Some(value) = self.ui_language {
            values.push(("ui_language", normalize_ui_language(&value)?));
        }

        Ok(SettingsPatch { values })
    }
}

impl SettingsPatch {
    async fn persist(&self, pool: &sqlx::PgPool) -> Result<()> {
        for (key, value) in &self.values {
            sqlx::query(
                "INSERT INTO app_settings (key, value) VALUES ($1, $2)
                 ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value",
            )
            .bind(key)
            .bind(value)
            .execute(pool)
            .await?;
        }

        Ok(())
    }
}

pub async fn get_settings(State(state): State<AppState>) -> Result<Json<AppSettings>> {
    Ok(Json(load_settings(state.db.as_ref()).await?))
}

pub async fn update_settings(
    State(state): State<AppState>,
    Json(body): Json<UpdateSettingsRequest>,
) -> Result<Json<AppSettings>> {
    let patch = body.into_patch()?;
    patch.persist(state.db.as_ref()).await?;
    Ok(Json(load_settings(state.db.as_ref()).await?))
}

async fn load_settings(pool: &sqlx::PgPool) -> Result<AppSettings> {
    let rows = sqlx::query_as::<_, SettingRow>("SELECT key, value FROM app_settings")
        .fetch_all(pool)
        .await?;

    Ok(settings_from_rows(rows))
}

fn settings_from_rows(rows: Vec<SettingRow>) -> AppSettings {
    let mut settings = AppSettings::default();
    let values: HashMap<String, String> =
        rows.into_iter().map(|row| (row.key, row.value)).collect();

    if let Some(value) = values.get("dark_mode").and_then(|value| value.parse().ok()) {
        settings.dark_mode = value;
    }

    if let Some(value) = values
        .get("daily_review_limit")
        .and_then(|value| value.parse().ok())
    {
        settings.daily_review_limit = value;
    }

    if let Some(value) = values
        .get("new_cards_per_day")
        .and_then(|value| value.parse().ok())
    {
        settings.new_cards_per_day = value;
    }

    if let Some(value) = values
        .get("audio_autoplay")
        .and_then(|value| value.parse().ok())
    {
        settings.audio_autoplay = value;
    }

    if let Some(value) = values
        .get("show_translation_immediately")
        .and_then(|value| value.parse().ok())
    {
        settings.show_translation_immediately = value;
    }

    if let Some(value) = values
        .get("ui_language")
        .filter(|value| !value.trim().is_empty())
    {
        settings.ui_language = value.clone();
    }

    settings
}

fn validate_limit(name: &str, value: i64, min: i64, max: i64) -> Result<i64> {
    if (min..=max).contains(&value) {
        return Ok(value);
    }

    Err(AppError::BadRequest(format!(
        "{name} must be between {min} and {max}"
    )))
}

fn normalize_ui_language(value: &str) -> Result<String> {
    let normalized = value.trim().to_ascii_lowercase();

    if normalized.is_empty() {
        return Err(AppError::BadRequest(
            "ui_language cannot be empty".to_string(),
        ));
    }

    Ok(normalized)
}

#[cfg(test)]
mod tests {
    use super::{
        normalize_ui_language, settings_from_rows, validate_limit, SettingRow,
        MAX_DAILY_REVIEW_LIMIT, MAX_NEW_CARDS_PER_DAY, MIN_DAILY_REVIEW_LIMIT,
        MIN_NEW_CARDS_PER_DAY,
    };

    #[test]
    fn settings_should_fall_back_to_defaults_for_missing_rows() {
        let settings = settings_from_rows(Vec::new());

        assert!(!settings.dark_mode);
        assert_eq!(settings.daily_review_limit, 100);
        assert_eq!(settings.new_cards_per_day, 20);
        assert!(!settings.audio_autoplay);
        assert!(!settings.show_translation_immediately);
        assert_eq!(settings.ui_language, "en");
    }

    #[test]
    fn settings_should_apply_known_values_from_rows() {
        let settings = settings_from_rows(vec![
            SettingRow {
                key: "dark_mode".into(),
                value: "true".into(),
            },
            SettingRow {
                key: "daily_review_limit".into(),
                value: "150".into(),
            },
            SettingRow {
                key: "new_cards_per_day".into(),
                value: "25".into(),
            },
            SettingRow {
                key: "audio_autoplay".into(),
                value: "true".into(),
            },
            SettingRow {
                key: "show_translation_immediately".into(),
                value: "true".into(),
            },
            SettingRow {
                key: "ui_language".into(),
                value: "uk".into(),
            },
        ]);

        assert!(settings.dark_mode);
        assert_eq!(settings.daily_review_limit, 150);
        assert_eq!(settings.new_cards_per_day, 25);
        assert!(settings.audio_autoplay);
        assert!(settings.show_translation_immediately);
        assert_eq!(settings.ui_language, "uk");
    }

    #[test]
    fn validate_limit_should_reject_out_of_range_values() {
        assert!(validate_limit(
            "daily_review_limit",
            MIN_DAILY_REVIEW_LIMIT - 1,
            MIN_DAILY_REVIEW_LIMIT,
            MAX_DAILY_REVIEW_LIMIT,
        )
        .is_err());

        assert!(validate_limit(
            "new_cards_per_day",
            MAX_NEW_CARDS_PER_DAY + 1,
            MIN_NEW_CARDS_PER_DAY,
            MAX_NEW_CARDS_PER_DAY,
        )
        .is_err());
    }

    #[test]
    fn normalize_ui_language_should_trim_and_lowercase() {
        let value = normalize_ui_language(" UK ").expect("language should normalize");
        assert_eq!(value, "uk");
    }
}
