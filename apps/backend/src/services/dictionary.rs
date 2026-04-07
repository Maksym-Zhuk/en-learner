/// DictionaryAPI.dev client and response normalization.
///
/// The upstream API returns an array of entries, each with nested arrays of
/// meanings, phonetics, and definitions. We normalize everything into a stable
/// internal schema that the rest of the app relies on.
use serde::{Deserialize, Serialize};
use tracing::warn;

use crate::error::{AppError, Result};

// ---- Raw upstream types -----------------------------------------------

#[derive(Debug, Deserialize)]
struct RawEntry {
    word: Option<String>,
    phonetic: Option<String>,
    phonetics: Option<Vec<RawPhonetic>>,
    meanings: Option<Vec<RawMeaning>>,
}

#[derive(Debug, Deserialize)]
struct RawPhonetic {
    text: Option<String>,
    audio: Option<String>,
}

#[derive(Debug, Deserialize)]
struct RawMeaning {
    #[serde(rename = "partOfSpeech")]
    part_of_speech: Option<String>,
    definitions: Option<Vec<RawDefinition>>,
}

#[derive(Debug, Deserialize)]
struct RawDefinition {
    definition: Option<String>,
    example: Option<String>,
    synonyms: Option<Vec<String>>,
    antonyms: Option<Vec<String>>,
}

// ---- Normalized types -------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NormalizedDefinition {
    pub definition: String,
    pub example: Option<String>,
    pub synonyms: Vec<String>,
    pub antonyms: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NormalizedMeaning {
    pub part_of_speech: String,
    pub definitions: Vec<NormalizedDefinition>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NormalizedEntry {
    /// The canonical word form (lowercase)
    pub word: String,
    /// Best phonetic text across all phonetic records
    pub phonetic_text: Option<String>,
    /// Best audio URL (prefer non-empty)
    pub phonetic_audio_url: Option<String>,
    pub meanings: Vec<NormalizedMeaning>,
}

// ---- Fetcher ----------------------------------------------------------

pub struct DictionaryService {
    client: reqwest::Client,
    base_url: String,
}

impl DictionaryService {
    pub fn new(client: reqwest::Client, base_url: String) -> Self {
        Self { client, base_url }
    }

    /// Fetch and normalize a word from the upstream API.
    pub async fn fetch(&self, word: &str) -> Result<NormalizedEntry> {
        let url = format!(
            "{}/{}",
            self.base_url.trim_end_matches('/'),
            urlencoded(word)
        );
        let resp = self.client.get(&url).send().await?;

        if resp.status() == 404 {
            return Err(AppError::NotFound(format!(
                "Word '{}' not found in dictionary",
                word
            )));
        }

        if !resp.status().is_success() {
            return Err(AppError::ExternalApi(format!(
                "Dictionary API returned status {}",
                resp.status()
            )));
        }

        let entries: Vec<RawEntry> = resp.json().await.map_err(|e| {
            AppError::ExternalApi(format!("Failed to parse dictionary response: {e}"))
        })?;

        normalize(word, entries)
    }
}

fn urlencoded(word: &str) -> String {
    // Simple percent-encode just the word
    word.chars()
        .flat_map(|c| {
            if c.is_alphanumeric() || c == '-' || c == '\'' {
                vec![c]
            } else {
                // percent-encode
                let encoded = format!("%{:02X}", c as u32);
                encoded.chars().collect()
            }
        })
        .collect()
}

fn normalize(query: &str, entries: Vec<RawEntry>) -> Result<NormalizedEntry> {
    if entries.is_empty() {
        return Err(AppError::NotFound(format!(
            "No entries returned for '{}'",
            query
        )));
    }

    // Use the first entry's word field, fall back to query
    let word = entries
        .first()
        .and_then(|e| e.word.clone())
        .unwrap_or_else(|| query.to_lowercase());

    // Collect all phonetics from all entries, picking the best text + audio
    let mut phonetic_text: Option<String> = None;
    let mut phonetic_audio_url: Option<String> = None;

    for entry in &entries {
        // Top-level phonetic field
        if phonetic_text.is_none() {
            if let Some(ref t) = entry.phonetic {
                if !t.is_empty() {
                    phonetic_text = Some(t.clone());
                }
            }
        }

        if let Some(ref phonetics) = entry.phonetics {
            for ph in phonetics {
                if phonetic_text.is_none() {
                    if let Some(ref t) = ph.text {
                        if !t.is_empty() {
                            phonetic_text = Some(t.clone());
                        }
                    }
                }
                if phonetic_audio_url.is_none() {
                    if let Some(ref a) = ph.audio {
                        if !a.is_empty() {
                            phonetic_audio_url = Some(normalize_audio_url(a));
                        }
                    }
                }
            }
        }

        if phonetic_text.is_some() && phonetic_audio_url.is_some() {
            break;
        }
    }

    // Collect all meanings, deduplicating by part_of_speech+definition text
    let mut meanings: Vec<NormalizedMeaning> = Vec::new();

    for entry in &entries {
        if let Some(ref raw_meanings) = entry.meanings {
            for raw_m in raw_meanings {
                let pos = raw_m
                    .part_of_speech
                    .clone()
                    .unwrap_or_else(|| "unknown".into());

                let defs: Vec<NormalizedDefinition> = raw_m
                    .definitions
                    .as_deref()
                    .unwrap_or_default()
                    .iter()
                    .filter_map(|d| {
                        let def_text = d.definition.clone()?;
                        Some(NormalizedDefinition {
                            definition: def_text,
                            example: d.example.clone().filter(|s| !s.is_empty()),
                            synonyms: d.synonyms.clone().unwrap_or_default(),
                            antonyms: d.antonyms.clone().unwrap_or_default(),
                        })
                    })
                    .collect();

                if defs.is_empty() {
                    continue;
                }

                // Merge into existing meaning with same pos, or push new
                if let Some(existing) = meanings.iter_mut().find(|m| m.part_of_speech == pos) {
                    for def in defs {
                        if !existing
                            .definitions
                            .iter()
                            .any(|d| d.definition == def.definition)
                        {
                            existing.definitions.push(def);
                        }
                    }
                } else {
                    meanings.push(NormalizedMeaning {
                        part_of_speech: pos,
                        definitions: defs,
                    });
                }
            }
        }
    }

    if meanings.is_empty() {
        warn!("No meanings parsed for word '{}'", word);
    }

    Ok(NormalizedEntry {
        word,
        phonetic_text,
        phonetic_audio_url,
        meanings,
    })
}

fn normalize_audio_url(url: &str) -> String {
    // Some entries omit the scheme
    if url.starts_with("//") {
        format!("https:{}", url)
    } else {
        url.to_string()
    }
}
