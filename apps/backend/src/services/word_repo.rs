/// Word repository: CRUD operations for the words, meanings, phonetics, etc.
/// Also handles saving/unsaving words and managing favorites.
use rusqlite::{params, Connection};
use uuid::Uuid;

use crate::error::{AppError, Result};
use crate::models::CardFace;
use crate::services::dictionary::NormalizedEntry;

/// Full word detail returned by the repository, including computed fields.
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

/// Upsert a normalized entry into the database and return the word id.
pub fn upsert_word(conn: &Connection, entry: &NormalizedEntry) -> Result<String> {
    let word_lower = entry.word.to_lowercase();

    // Try to find existing word
    let existing_id: Option<String> = conn
        .query_row(
            "SELECT id FROM words WHERE word = ?1",
            params![word_lower],
            |r| r.get(0),
        )
        .optional()?;

    let word_id = if let Some(id) = existing_id {
        // Update timestamp
        conn.execute(
            "UPDATE words SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id = ?1",
            params![id],
        )?;
        // Delete existing meanings/phonetics to re-insert fresh data
        conn.execute("DELETE FROM phonetics WHERE word_id = ?1", params![id])?;
        conn.execute("DELETE FROM meanings WHERE word_id = ?1", params![id])?;
        id
    } else {
        let id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO words (id, word, source) VALUES (?1, ?2, 'dictionaryapi.dev')",
            params![id, word_lower],
        )?;
        id
    };

    // Insert phonetics
    if entry.phonetic_text.is_some() || entry.phonetic_audio_url.is_some() {
        let ph_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO phonetics (id, word_id, text, audio_url) VALUES (?1, ?2, ?3, ?4)",
            params![
                ph_id,
                word_id,
                entry.phonetic_text,
                entry.phonetic_audio_url
            ],
        )?;
    }

    // Insert meanings and definitions
    for (m_pos, meaning) in entry.meanings.iter().enumerate() {
        let m_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO meanings (id, word_id, part_of_speech, position) VALUES (?1, ?2, ?3, ?4)",
            params![m_id, word_id, meaning.part_of_speech, m_pos as i64],
        )?;

        for (d_pos, def) in meaning.definitions.iter().enumerate() {
            let d_id = Uuid::new_v4().to_string();
            conn.execute(
                "INSERT INTO definitions (id, meaning_id, definition, example, position)
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                params![d_id, m_id, def.definition, def.example, d_pos as i64],
            )?;

            for syn in &def.synonyms {
                conn.execute(
                    "INSERT INTO definition_synonyms (definition_id, synonym) VALUES (?1, ?2)",
                    params![d_id, syn],
                )?;
            }
            for ant in &def.antonyms {
                conn.execute(
                    "INSERT INTO definition_antonyms (definition_id, antonym) VALUES (?1, ?2)",
                    params![d_id, ant],
                )?;
            }
        }
    }

    Ok(word_id)
}

/// Store a translation for a word.
pub fn upsert_translation(conn: &Connection, word_id: &str, lang: &str, text: &str) -> Result<()> {
    let id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO translations (id, word_id, target_lang, text)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(word_id, target_lang) DO UPDATE SET text = excluded.text,
             created_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')",
        params![id, word_id, lang, text],
    )?;
    Ok(())
}

/// Load full word detail by id.
pub fn get_word_by_id(conn: &Connection, word_id: &str) -> Result<WordDetail> {
    load_word_detail(conn, "WHERE w.id = ?1", params![word_id])
}

/// Load full word detail by word string (case-insensitive).
pub fn get_word_by_text(conn: &Connection, word: &str) -> Result<Option<WordDetail>> {
    match load_word_detail(conn, "WHERE w.word = ?1", params![word.to_lowercase()]) {
        Ok(w) => Ok(Some(w)),
        Err(AppError::NotFound(_)) => Ok(None),
        Err(e) => Err(e),
    }
}

fn load_word_detail(
    conn: &Connection,
    where_clause: &str,
    params: impl rusqlite::Params,
) -> Result<WordDetail> {
    let sql = format!(
        "SELECT w.id, w.word, w.source, w.created_at, w.updated_at,
                ph.text, ph.audio_url,
                t.text as translation_uk,
                CASE WHEN sw.word_id IS NOT NULL THEN 1 ELSE 0 END as is_saved,
                CASE WHEN f.word_id IS NOT NULL THEN 1 ELSE 0 END as is_favorite
         FROM words w
         LEFT JOIN phonetics ph ON ph.word_id = w.id
         LEFT JOIN translations t ON t.word_id = w.id AND t.target_lang = 'uk'
         LEFT JOIN saved_words sw ON sw.word_id = w.id
         LEFT JOIN favorites f ON f.word_id = w.id
         {where_clause}
         LIMIT 1"
    );

    let (
        id,
        word,
        source,
        created_at,
        updated_at,
        ph_text,
        ph_audio,
        translation_uk,
        is_saved,
        is_favorite,
    ) = conn
        .query_row(&sql, params, |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, String>(3)?,
                r.get::<_, String>(4)?,
                r.get::<_, Option<String>>(5)?,
                r.get::<_, Option<String>>(6)?,
                r.get::<_, Option<String>>(7)?,
                r.get::<_, i64>(8)?,
                r.get::<_, i64>(9)?,
            ))
        })
        .optional()?
        .ok_or_else(|| AppError::NotFound("Word not found".into()))?;

    let meanings = load_meanings(conn, &id)?;

    Ok(WordDetail {
        id,
        word,
        phonetic_text: ph_text,
        phonetic_audio_url: ph_audio,
        meanings,
        translation_uk,
        source,
        created_at,
        updated_at,
        is_saved: is_saved == 1,
        is_favorite: is_favorite == 1,
    })
}

fn load_meanings(conn: &Connection, word_id: &str) -> Result<Vec<MeaningDetail>> {
    let mut stmt = conn
        .prepare("SELECT id, part_of_speech FROM meanings WHERE word_id = ?1 ORDER BY position")?;
    let meanings: Vec<(String, String)> = stmt
        .query_map(params![word_id], |r| Ok((r.get(0)?, r.get(1)?)))?
        .collect::<std::result::Result<_, _>>()?;

    let mut result = Vec::new();
    for (m_id, pos) in meanings {
        let defs = load_definitions(conn, &m_id)?;
        result.push(MeaningDetail {
            part_of_speech: pos,
            definitions: defs,
        });
    }
    Ok(result)
}

fn load_definitions(conn: &Connection, meaning_id: &str) -> Result<Vec<DefinitionDetail>> {
    let mut stmt = conn.prepare(
        "SELECT id, definition, example FROM definitions
         WHERE meaning_id = ?1 ORDER BY position",
    )?;
    let defs: Vec<(String, String, Option<String>)> = stmt
        .query_map(params![meaning_id], |r| {
            Ok((r.get(0)?, r.get(1)?, r.get(2)?))
        })?
        .collect::<std::result::Result<_, _>>()?;

    let mut result = Vec::new();
    for (d_id, definition, example) in defs {
        let synonyms = load_strings(
            conn,
            "SELECT synonym FROM definition_synonyms WHERE definition_id = ?1",
            &d_id,
        )?;
        let antonyms = load_strings(
            conn,
            "SELECT antonym FROM definition_antonyms WHERE definition_id = ?1",
            &d_id,
        )?;
        result.push(DefinitionDetail {
            definition,
            example,
            synonyms,
            antonyms,
        });
    }
    Ok(result)
}

fn load_strings(conn: &Connection, sql: &str, id: &str) -> Result<Vec<String>> {
    let mut stmt = conn.prepare(sql)?;
    let items: Vec<String> = stmt
        .query_map(params![id], |r| r.get(0))?
        .collect::<std::result::Result<_, _>>()?;
    Ok(items)
}

/// Mark a word as saved.
pub fn save_word(conn: &Connection, word_id: &str) -> Result<()> {
    conn.execute(
        "INSERT OR IGNORE INTO saved_words (word_id) VALUES (?1)",
        params![word_id],
    )?;
    Ok(())
}

/// Remove a word from saved.
pub fn unsave_word(conn: &Connection, word_id: &str) -> Result<()> {
    conn.execute(
        "DELETE FROM saved_words WHERE word_id = ?1",
        params![word_id],
    )?;
    Ok(())
}

/// List all saved words.
pub fn list_saved_words(conn: &Connection) -> Result<Vec<WordDetail>> {
    let mut stmt = conn.prepare(
        "SELECT w.id FROM saved_words sw JOIN words w ON w.id = sw.word_id ORDER BY sw.saved_at DESC",
    )?;
    let ids: Vec<String> = stmt
        .query_map([], |r| r.get(0))?
        .collect::<std::result::Result<_, _>>()?;

    let mut result = Vec::new();
    for id in ids {
        if let Ok(detail) = get_word_by_id(conn, &id) {
            result.push(detail);
        }
    }
    Ok(result)
}

/// Toggle favorite.
pub fn set_favorite(conn: &Connection, word_id: &str, favorite: bool) -> Result<()> {
    if favorite {
        conn.execute(
            "INSERT OR IGNORE INTO favorites (word_id) VALUES (?1)",
            params![word_id],
        )?;
    } else {
        conn.execute("DELETE FROM favorites WHERE word_id = ?1", params![word_id])?;
    }
    Ok(())
}

/// List favorites.
pub fn list_favorites(conn: &Connection) -> Result<Vec<WordDetail>> {
    let mut stmt = conn.prepare("SELECT word_id FROM favorites ORDER BY favorited_at DESC")?;
    let ids: Vec<String> = stmt
        .query_map([], |r| r.get(0))?
        .collect::<std::result::Result<_, _>>()?;

    let mut result = Vec::new();
    for id in ids {
        if let Ok(detail) = get_word_by_id(conn, &id) {
            result.push(detail);
        }
    }
    Ok(result)
}

/// Ensure review cards exist for all faces of a word.
pub fn ensure_review_cards(conn: &Connection, word_id: &str) -> Result<()> {
    for face in CardFace::all() {
        let id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT OR IGNORE INTO review_cards (id, word_id, face) VALUES (?1, ?2, ?3)",
            params![id, word_id, face.as_str()],
        )?;
    }
    Ok(())
}

// Needed for optional() helper
use rusqlite::OptionalExtension;
