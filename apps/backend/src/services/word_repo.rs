use sqlx::{PgPool, Row};
use uuid::Uuid;

use crate::clock::utc_now_string;
use crate::error::{AppError, Result};
use crate::models::CardFace;
use crate::services::dictionary::NormalizedEntry;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct WordDetail {
    pub id: String,
    pub word: String,
    pub phonetic_text: Option<String>,
    pub phonetic_audio_url: Option<String>,
    pub meanings: Vec<MeaningDetail>,
    pub translation_uk: Option<String>,
    pub source: String,
    pub created_at: String,
    pub updated_at: String,
    pub is_saved: bool,
    pub is_favorite: bool,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct MeaningDetail {
    pub part_of_speech: String,
    pub definitions: Vec<DefinitionDetail>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct DefinitionDetail {
    pub definition: String,
    pub example: Option<String>,
    pub synonyms: Vec<String>,
    pub antonyms: Vec<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ResetReviewMode {
    New,
    Forgotten,
}

impl ResetReviewMode {
    pub fn from_str(value: &str) -> Option<Self> {
        match value {
            "new" | "unlearned" => Some(Self::New),
            "forgotten" | "relearning" => Some(Self::Forgotten),
            _ => None,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::New => "new",
            Self::Forgotten => "forgotten",
        }
    }
}

#[derive(Debug, Clone)]
pub struct ResetReviewResult {
    pub cards_reset: usize,
    pub due_at: String,
    pub mode: ResetReviewMode,
}

pub async fn upsert_word(pool: &PgPool, entry: &NormalizedEntry) -> Result<String> {
    let word_lower = entry.word.to_lowercase();
    let now = utc_now_string();

    let existing_id =
        sqlx::query_scalar::<_, String>("SELECT id FROM words WHERE LOWER(word) = LOWER($1)")
            .bind(&word_lower)
            .fetch_optional(pool)
            .await?;

    let word_id = if let Some(id) = existing_id {
        sqlx::query("UPDATE words SET updated_at = $1 WHERE id = $2")
            .bind(&now)
            .bind(&id)
            .execute(pool)
            .await?;
        sqlx::query("DELETE FROM phonetics WHERE word_id = $1")
            .bind(&id)
            .execute(pool)
            .await?;
        sqlx::query("DELETE FROM meanings WHERE word_id = $1")
            .bind(&id)
            .execute(pool)
            .await?;
        id
    } else {
        let id = Uuid::new_v4().to_string();
        sqlx::query("INSERT INTO words (id, word, source) VALUES ($1, $2, 'dictionaryapi.dev')")
            .bind(&id)
            .bind(&word_lower)
            .execute(pool)
            .await?;
        id
    };

    if entry.phonetic_text.is_some() || entry.phonetic_audio_url.is_some() {
        let ph_id = Uuid::new_v4().to_string();
        sqlx::query("INSERT INTO phonetics (id, word_id, text, audio_url) VALUES ($1, $2, $3, $4)")
            .bind(ph_id)
            .bind(&word_id)
            .bind(entry.phonetic_text.clone())
            .bind(entry.phonetic_audio_url.clone())
            .execute(pool)
            .await?;
    }

    for (m_pos, meaning) in entry.meanings.iter().enumerate() {
        let m_id = Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO meanings (id, word_id, part_of_speech, position) VALUES ($1, $2, $3, $4)",
        )
        .bind(&m_id)
        .bind(&word_id)
        .bind(&meaning.part_of_speech)
        .bind(m_pos as i64)
        .execute(pool)
        .await?;

        for (d_pos, def) in meaning.definitions.iter().enumerate() {
            let d_id = Uuid::new_v4().to_string();
            sqlx::query(
                "INSERT INTO definitions (id, meaning_id, definition, example, position)
                 VALUES ($1, $2, $3, $4, $5)",
            )
            .bind(&d_id)
            .bind(&m_id)
            .bind(&def.definition)
            .bind(def.example.clone())
            .bind(d_pos as i64)
            .execute(pool)
            .await?;

            for syn in &def.synonyms {
                sqlx::query(
                    "INSERT INTO definition_synonyms (definition_id, synonym) VALUES ($1, $2)",
                )
                .bind(&d_id)
                .bind(syn)
                .execute(pool)
                .await?;
            }

            for ant in &def.antonyms {
                sqlx::query(
                    "INSERT INTO definition_antonyms (definition_id, antonym) VALUES ($1, $2)",
                )
                .bind(&d_id)
                .bind(ant)
                .execute(pool)
                .await?;
            }
        }
    }

    Ok(word_id)
}

pub async fn upsert_translation(
    pool: &PgPool,
    word_id: &str,
    lang: &str,
    text: &str,
) -> Result<()> {
    let id = Uuid::new_v4().to_string();
    sqlx::query(
        "INSERT INTO translations (id, word_id, target_lang, text)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT(word_id, target_lang) DO UPDATE
         SET text = EXCLUDED.text,
             created_at = to_char(timezone('UTC', now()), 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"')",
    )
    .bind(id)
    .bind(word_id)
    .bind(lang)
    .bind(text)
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn get_word_by_id(pool: &PgPool, word_id: &str) -> Result<WordDetail> {
    load_word_detail(pool, "WHERE w.id = $1", word_id).await
}

pub async fn get_word_by_text(pool: &PgPool, word: &str) -> Result<Option<WordDetail>> {
    match load_word_detail(pool, "WHERE LOWER(w.word) = LOWER($1)", word).await {
        Ok(word) => Ok(Some(word)),
        Err(AppError::NotFound(_)) => Ok(None),
        Err(error) => Err(error),
    }
}

async fn load_word_detail(pool: &PgPool, where_clause: &str, value: &str) -> Result<WordDetail> {
    let sql = format!(
        "SELECT w.id, w.word, w.source, w.created_at, w.updated_at,
                ph.text, ph.audio_url,
                t.text AS translation_uk,
                CASE WHEN sw.word_id IS NOT NULL THEN TRUE ELSE FALSE END AS is_saved,
                CASE WHEN f.word_id IS NOT NULL THEN TRUE ELSE FALSE END AS is_favorite
         FROM words w
         LEFT JOIN LATERAL (
             SELECT text, audio_url
             FROM phonetics
             WHERE word_id = w.id
             ORDER BY id
             LIMIT 1
         ) ph ON TRUE
         LEFT JOIN LATERAL (
             SELECT text
             FROM translations
             WHERE word_id = w.id AND target_lang = 'uk'
             ORDER BY created_at ASC, id ASC
             LIMIT 1
         ) t ON TRUE
         LEFT JOIN saved_words sw ON sw.word_id = w.id
         LEFT JOIN favorites f ON f.word_id = w.id
         {where_clause}
         LIMIT 1"
    );

    let row = sqlx::query(&sql)
        .bind(value)
        .fetch_optional(pool)
        .await?
        .ok_or_else(|| AppError::NotFound("Word not found".into()))?;

    let id: String = row.try_get("id")?;
    let meanings = load_meanings(pool, &id).await?;

    Ok(WordDetail {
        id,
        word: row.try_get("word")?,
        phonetic_text: row.try_get("text")?,
        phonetic_audio_url: row.try_get("audio_url")?,
        meanings,
        translation_uk: row.try_get("translation_uk")?,
        source: row.try_get("source")?,
        created_at: row.try_get("created_at")?,
        updated_at: row.try_get("updated_at")?,
        is_saved: row.try_get("is_saved")?,
        is_favorite: row.try_get("is_favorite")?,
    })
}

async fn load_meanings(pool: &PgPool, word_id: &str) -> Result<Vec<MeaningDetail>> {
    let rows =
        sqlx::query("SELECT id, part_of_speech FROM meanings WHERE word_id = $1 ORDER BY position")
            .bind(word_id)
            .fetch_all(pool)
            .await?;

    let mut meanings = Vec::with_capacity(rows.len());
    for row in rows {
        let meaning_id: String = row.try_get("id")?;
        meanings.push(MeaningDetail {
            part_of_speech: row.try_get("part_of_speech")?,
            definitions: load_definitions(pool, &meaning_id).await?,
        });
    }

    Ok(meanings)
}

async fn load_definitions(pool: &PgPool, meaning_id: &str) -> Result<Vec<DefinitionDetail>> {
    let rows = sqlx::query(
        "SELECT id, definition, example
         FROM definitions
         WHERE meaning_id = $1
         ORDER BY position",
    )
    .bind(meaning_id)
    .fetch_all(pool)
    .await?;

    let mut definitions = Vec::with_capacity(rows.len());
    for row in rows {
        let definition_id: String = row.try_get("id")?;
        definitions.push(DefinitionDetail {
            definition: row.try_get("definition")?,
            example: row.try_get("example")?,
            synonyms: load_strings(
                pool,
                "SELECT synonym FROM definition_synonyms WHERE definition_id = $1 ORDER BY synonym",
                &definition_id,
            )
            .await?,
            antonyms: load_strings(
                pool,
                "SELECT antonym FROM definition_antonyms WHERE definition_id = $1 ORDER BY antonym",
                &definition_id,
            )
            .await?,
        });
    }

    Ok(definitions)
}

async fn load_strings(pool: &PgPool, sql: &str, id: &str) -> Result<Vec<String>> {
    Ok(sqlx::query_scalar::<_, String>(sql)
        .bind(id)
        .fetch_all(pool)
        .await?)
}

pub async fn save_word(pool: &PgPool, word_id: &str) -> Result<()> {
    sqlx::query(
        "INSERT INTO saved_words (word_id) VALUES ($1)
         ON CONFLICT (word_id) DO NOTHING",
    )
    .bind(word_id)
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn unsave_word(pool: &PgPool, word_id: &str) -> Result<()> {
    sqlx::query("DELETE FROM saved_words WHERE word_id = $1")
        .bind(word_id)
        .execute(pool)
        .await?;

    Ok(())
}

pub async fn list_saved_words(pool: &PgPool) -> Result<Vec<WordDetail>> {
    let ids = sqlx::query_scalar::<_, String>(
        "SELECT w.id
         FROM saved_words sw
         JOIN words w ON w.id = sw.word_id
         ORDER BY sw.saved_at DESC",
    )
    .fetch_all(pool)
    .await?;

    let mut result = Vec::with_capacity(ids.len());
    for id in ids {
        if let Ok(detail) = get_word_by_id(pool, &id).await {
            result.push(detail);
        }
    }
    Ok(result)
}

pub async fn set_favorite(pool: &PgPool, word_id: &str, favorite: bool) -> Result<()> {
    if favorite {
        sqlx::query(
            "INSERT INTO favorites (word_id) VALUES ($1)
             ON CONFLICT (word_id) DO NOTHING",
        )
        .bind(word_id)
        .execute(pool)
        .await?;
    } else {
        sqlx::query("DELETE FROM favorites WHERE word_id = $1")
            .bind(word_id)
            .execute(pool)
            .await?;
    }

    Ok(())
}

pub async fn list_favorites(pool: &PgPool) -> Result<Vec<WordDetail>> {
    let ids =
        sqlx::query_scalar::<_, String>("SELECT word_id FROM favorites ORDER BY favorited_at DESC")
            .fetch_all(pool)
            .await?;

    let mut result = Vec::with_capacity(ids.len());
    for id in ids {
        if let Ok(detail) = get_word_by_id(pool, &id).await {
            result.push(detail);
        }
    }
    Ok(result)
}

pub async fn ensure_review_cards(pool: &PgPool, word_id: &str) -> Result<()> {
    for face in CardFace::all() {
        let id = Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO review_cards (id, word_id, face)
             VALUES ($1, $2, $3)
             ON CONFLICT (word_id, face) DO NOTHING",
        )
        .bind(id)
        .bind(word_id)
        .bind(face.as_str())
        .execute(pool)
        .await?;
    }

    Ok(())
}

pub async fn reset_review_cards(
    pool: &PgPool,
    word_id: &str,
    mode: ResetReviewMode,
) -> Result<ResetReviewResult> {
    ensure_review_cards(pool, word_id).await?;

    let due_at = utc_now_string();
    let result = match mode {
        ResetReviewMode::New => {
            sqlx::query(
                "UPDATE review_cards
                 SET state = 'new',
                     due_at = $1,
                     interval_days = 0,
                     ease_factor = 2.5,
                     reps = 0,
                     lapses = 0,
                     last_reviewed_at = NULL
                 WHERE word_id = $2",
            )
            .bind(&due_at)
            .bind(word_id)
            .execute(pool)
            .await?
        }
        ResetReviewMode::Forgotten => {
            sqlx::query(
                "UPDATE review_cards
                 SET state = CASE
                         WHEN state = 'new' THEN 'new'
                         ELSE 'relearning'
                     END,
                     due_at = $1,
                     interval_days = 0
                 WHERE word_id = $2",
            )
            .bind(&due_at)
            .bind(word_id)
            .execute(pool)
            .await?
        }
    };

    Ok(ResetReviewResult {
        cards_reset: result.rows_affected() as usize,
        due_at,
        mode,
    })
}

#[cfg(test)]
mod tests {
    use super::ResetReviewMode;

    #[test]
    fn reset_mode_aliases_are_supported() {
        assert_eq!(ResetReviewMode::from_str("new"), Some(ResetReviewMode::New));
        assert_eq!(
            ResetReviewMode::from_str("unlearned"),
            Some(ResetReviewMode::New)
        );
        assert_eq!(
            ResetReviewMode::from_str("forgotten"),
            Some(ResetReviewMode::Forgotten)
        );
        assert_eq!(
            ResetReviewMode::from_str("relearning"),
            Some(ResetReviewMode::Forgotten)
        );
        assert_eq!(ResetReviewMode::from_str("unknown"), None);
    }
}
