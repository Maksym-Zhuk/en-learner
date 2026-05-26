use gloo_net::http::Request;
use serde::{Deserialize, Serialize};
use serde_json::Value;

const API_BASE: &str = "http://localhost:3000/api";

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AuthResponse {
    pub token: String,
    pub user_id: String,
    pub email: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Deck {
    pub id: String,
    pub user_id: String,
    pub name: String,
    pub card_count: i64,
    pub created_at: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Card {
    pub id: String,
    pub deck_id: String,
    pub word: String,
    pub definition_en: String,
    pub example_en: String,
    pub translation_uk: String,
    pub example_uk: String,
    pub created_at: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct LookupResult {
    pub word: String,
    pub definition_en: String,
    pub example_en: String,
    pub translation_uk: String,
    pub example_uk: String,
}

pub async fn register(email: &str, password: &str) -> Result<AuthResponse, String> {
    let res = Request::post(&format!("{API_BASE}/auth/register"))
        .credentials(web_sys::RequestCredentials::Include)
        .json(&serde_json::json!({"email": email, "password": password}))
        .map_err(|e| e.to_string())?
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if res.ok() {
        res.json::<AuthResponse>().await.map_err(|e| e.to_string())
    } else {
        let err: Value = res.json().await.unwrap_or_default();
        Err(err["error"].as_str().unwrap_or("Registration failed").to_string())
    }
}

pub async fn login(email: &str, password: &str) -> Result<AuthResponse, String> {
    let res = Request::post(&format!("{API_BASE}/auth/login"))
        .credentials(web_sys::RequestCredentials::Include)
        .json(&serde_json::json!({"email": email, "password": password}))
        .map_err(|e| e.to_string())?
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if res.ok() {
        res.json::<AuthResponse>().await.map_err(|e| e.to_string())
    } else {
        let err: Value = res.json().await.unwrap_or_default();
        Err(err["error"].as_str().unwrap_or("Login failed").to_string())
    }
}

pub async fn logout(token: &str) -> Result<(), String> {
    Request::post(&format!("{API_BASE}/auth/logout"))
        .credentials(web_sys::RequestCredentials::Include)
        .header("Authorization", &format!("Bearer {token}"))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub async fn get_decks(token: &str) -> Result<Vec<Deck>, String> {
    let res = Request::get(&format!("{API_BASE}/decks"))
        .credentials(web_sys::RequestCredentials::Include)
        .header("Authorization", &format!("Bearer {token}"))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if res.ok() {
        res.json::<Vec<Deck>>().await.map_err(|e| e.to_string())
    } else {
        Err("Failed to load decks".to_string())
    }
}

pub async fn create_deck(token: &str, name: &str) -> Result<Deck, String> {
    let res = Request::post(&format!("{API_BASE}/decks"))
        .credentials(web_sys::RequestCredentials::Include)
        .header("Authorization", &format!("Bearer {token}"))
        .json(&serde_json::json!({"name": name}))
        .map_err(|e| e.to_string())?
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if res.ok() {
        res.json::<Deck>().await.map_err(|e| e.to_string())
    } else {
        let err: Value = res.json().await.unwrap_or_default();
        Err(err["error"].as_str().unwrap_or("Failed to create deck").to_string())
    }
}

pub async fn delete_deck(token: &str, deck_id: &str) -> Result<(), String> {
    let res = Request::delete(&format!("{API_BASE}/decks/{deck_id}"))
        .credentials(web_sys::RequestCredentials::Include)
        .header("Authorization", &format!("Bearer {token}"))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if res.ok() || res.status() == 204 {
        Ok(())
    } else {
        Err("Failed to delete deck".to_string())
    }
}

pub async fn get_cards(token: &str, deck_id: &str) -> Result<Vec<Card>, String> {
    let res = Request::get(&format!("{API_BASE}/decks/{deck_id}/cards"))
        .credentials(web_sys::RequestCredentials::Include)
        .header("Authorization", &format!("Bearer {token}"))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if res.ok() {
        res.json::<Vec<Card>>().await.map_err(|e| e.to_string())
    } else {
        Err("Failed to load cards".to_string())
    }
}

pub async fn create_card(token: &str, deck_id: &str, card: &LookupResult) -> Result<Card, String> {
    let res = Request::post(&format!("{API_BASE}/decks/{deck_id}/cards"))
        .credentials(web_sys::RequestCredentials::Include)
        .header("Authorization", &format!("Bearer {token}"))
        .json(&serde_json::json!({
            "word": card.word,
            "definition_en": card.definition_en,
            "example_en": card.example_en,
            "translation_uk": card.translation_uk,
            "example_uk": card.example_uk,
        }))
        .map_err(|e| e.to_string())?
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if res.ok() {
        res.json::<Card>().await.map_err(|e| e.to_string())
    } else {
        let err: Value = res.json().await.unwrap_or_default();
        Err(err["error"].as_str().unwrap_or("Failed to save card").to_string())
    }
}

pub async fn delete_card(token: &str, card_id: &str) -> Result<(), String> {
    let res = Request::delete(&format!("{API_BASE}/cards/{card_id}"))
        .credentials(web_sys::RequestCredentials::Include)
        .header("Authorization", &format!("Bearer {token}"))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if res.ok() || res.status() == 204 {
        Ok(())
    } else {
        Err("Failed to delete card".to_string())
    }
}

pub async fn lookup_word(token: &str, word: &str) -> Result<LookupResult, String> {
    let encoded = js_sys::encode_uri_component(word);
    let res = Request::get(&format!("{API_BASE}/lookup?word={encoded}"))
        .credentials(web_sys::RequestCredentials::Include)
        .header("Authorization", &format!("Bearer {token}"))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if res.ok() {
        res.json::<LookupResult>().await.map_err(|e| e.to_string())
    } else {
        let err: Value = res.json().await.unwrap_or_default();
        Err(err["error"].as_str().unwrap_or("Word not found").to_string())
    }
}
