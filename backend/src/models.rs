#![allow(dead_code)]
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct User {
    pub id: Uuid,
    pub email: String,
    pub password_hash: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Deck {
    pub id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Card {
    pub id: Uuid,
    pub deck_id: Uuid,
    pub word: String,
    pub definition_en: String,
    pub example_en: String,
    pub translation_uk: String,
    pub example_uk: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DeckWithCardCount {
    pub id: Uuid,
    pub user_id: Uuid,
    pub name: String,
    pub created_at: DateTime<Utc>,
    pub card_count: i64,
}

#[derive(Debug, Deserialize)]
pub struct CreateDeckRequest {
    pub name: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateCardRequest {
    pub word: String,
    pub definition_en: String,
    pub example_en: String,
    pub translation_uk: String,
    pub example_uk: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCardRequest {
    pub word: Option<String>,
    pub definition_en: Option<String>,
    pub example_en: Option<String>,
    pub translation_uk: Option<String>,
    pub example_uk: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub token: String,
    pub user_id: Uuid,
    pub email: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub email: String,
    pub exp: usize,
}

#[derive(Debug, Deserialize)]
pub struct RegisterRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct LookupResponse {
    pub word: String,
    pub definition_en: String,
    pub example_en: String,
    pub translation_uk: String,
    pub example_uk: String,
}
