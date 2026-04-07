/// Translation service with a provider trait so backends can be swapped.
///
/// Currently implements Lingva.ml as the primary provider.
/// If Lingva is unreliable, implement `TranslatorProvider` for an alternative
/// (e.g., LibreTranslate, MyMemory) and swap it in the calling code.
use async_trait::async_trait;
use serde::Deserialize;
use tracing::{debug, warn};

use crate::error::{AppError, Result};

// ---- Provider trait ---------------------------------------------------

#[async_trait]
pub trait TranslatorProvider: Send + Sync {
    async fn translate(&self, text: &str, source: &str, target: &str) -> Result<String>;
}

// ---- Lingva provider --------------------------------------------------

pub struct LingvaTranslator {
    client: reqwest::Client,
    base_url: String,
}

impl LingvaTranslator {
    pub fn new(client: reqwest::Client, base_url: String) -> Self {
        Self { client, base_url }
    }
}

#[derive(Deserialize)]
struct LingvaResponse {
    translation: Option<String>,
}

#[async_trait]
impl TranslatorProvider for LingvaTranslator {
    async fn translate(&self, text: &str, source: &str, target: &str) -> Result<String> {
        // URL: /api/v1/{source}/{target}/{query}
        let encoded = percent_encode(text);
        let url = format!(
            "{}/{}/{}/{}",
            self.base_url.trim_end_matches('/'),
            source,
            target,
            encoded
        );

        debug!("Lingva request: {url}");

        let resp = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| AppError::ExternalApi(format!("Lingva request failed: {e}")))?;

        if !resp.status().is_success() {
            return Err(AppError::ExternalApi(format!(
                "Lingva returned status {}",
                resp.status()
            )));
        }

        let body: LingvaResponse = resp
            .json()
            .await
            .map_err(|e| AppError::ExternalApi(format!("Failed to parse Lingva response: {e}")))?;

        body.translation
            .filter(|s| !s.is_empty())
            .ok_or_else(|| AppError::ExternalApi("Lingva returned empty translation".into()))
    }
}

// ---- Fallback provider ------------------------------------------------

/// Used when no translation provider is configured; always returns an error.
#[allow(dead_code)]
pub struct NoOpTranslator;

#[async_trait]
impl TranslatorProvider for NoOpTranslator {
    async fn translate(&self, text: &str, _source: &str, _target: &str) -> Result<String> {
        warn!("NoOpTranslator used – translation unavailable for '{text}'");
        Err(AppError::ExternalApi(
            "Translation service unavailable".into(),
        ))
    }
}

// ---- URL encoding helper ----------------------------------------------

fn percent_encode(input: &str) -> String {
    let mut result = String::with_capacity(input.len() * 3);
    for byte in input.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                result.push(byte as char);
            }
            _ => {
                result.push_str(&format!("%{:02X}", byte));
            }
        }
    }
    result
}
