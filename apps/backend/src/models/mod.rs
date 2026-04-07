#![allow(dead_code)]

use serde::{Deserialize, Serialize};

// ============================================================
// Domain models - internal representation used by services and
// DB layer. Separate from API DTOs (response types).
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Word {
    pub id: String,
    pub word: String,
    pub source: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Phonetic {
    pub id: String,
    pub word_id: String,
    pub text: Option<String>,
    pub audio_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Meaning {
    pub id: String,
    pub word_id: String,
    pub part_of_speech: String,
    pub position: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Definition {
    pub id: String,
    pub meaning_id: String,
    pub definition: String,
    pub example: Option<String>,
    pub position: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Translation {
    pub id: String,
    pub word_id: String,
    pub target_lang: String,
    pub text: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StudySet {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CardState {
    New,
    Learning,
    Review,
    Relearning,
}

impl CardState {
    pub fn as_str(&self) -> &'static str {
        match self {
            CardState::New => "new",
            CardState::Learning => "learning",
            CardState::Review => "review",
            CardState::Relearning => "relearning",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "learning" => CardState::Learning,
            "review" => CardState::Review,
            "relearning" => CardState::Relearning,
            _ => CardState::New,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CardFace {
    EnToUk,
    UkToEn,
    DefinitionToWord,
    ExampleToWord,
}

impl CardFace {
    pub fn as_str(&self) -> &'static str {
        match self {
            CardFace::EnToUk => "en_to_uk",
            CardFace::UkToEn => "uk_to_en",
            CardFace::DefinitionToWord => "definition_to_word",
            CardFace::ExampleToWord => "example_to_word",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "uk_to_en" => CardFace::UkToEn,
            "definition_to_word" => CardFace::DefinitionToWord,
            "example_to_word" => CardFace::ExampleToWord,
            _ => CardFace::EnToUk,
        }
    }

    /// All faces generated for a word
    pub fn all() -> Vec<CardFace> {
        vec![
            CardFace::EnToUk,
            CardFace::UkToEn,
            CardFace::DefinitionToWord,
            CardFace::ExampleToWord,
        ]
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ReviewRating {
    Again,
    Hard,
    Good,
    Easy,
}

impl ReviewRating {
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "again" => Some(ReviewRating::Again),
            "hard" => Some(ReviewRating::Hard),
            "good" => Some(ReviewRating::Good),
            "easy" => Some(ReviewRating::Easy),
            _ => None,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            ReviewRating::Again => "again",
            ReviewRating::Hard => "hard",
            ReviewRating::Good => "good",
            ReviewRating::Easy => "easy",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReviewCard {
    pub id: String,
    pub word_id: String,
    pub face: CardFace,
    pub state: CardState,
    pub due_at: String,
    pub interval_days: f64,
    pub ease_factor: f64,
    pub reps: i64,
    pub lapses: i64,
    pub last_reviewed_at: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchHistoryEntry {
    pub id: String,
    pub query: String,
    pub word_id: Option<String>,
    pub searched_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub dark_mode: bool,
    pub daily_review_limit: i64,
    pub new_cards_per_day: i64,
    pub audio_autoplay: bool,
    pub show_translation_immediately: bool,
    pub ui_language: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            dark_mode: false,
            daily_review_limit: 100,
            new_cards_per_day: 20,
            audio_autoplay: false,
            show_translation_immediately: false,
            ui_language: "en".into(),
        }
    }
}
