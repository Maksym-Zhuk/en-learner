use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{delete, get, put},
    Json, Router,
};
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;

use crate::{
    errors::AppError,
    models::{
        Claims, CreateCardRequest, CreateDeckRequest, LookupResponse, UpdateCardRequest,
    },
    AppState,
};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/decks", get(list_decks).post(create_deck))
        .route("/decks/:id", delete(delete_deck))
        .route("/decks/:id/cards", get(list_cards).post(create_card))
        .route("/cards/:id", put(update_card).delete(delete_card))
        .route("/lookup", get(lookup_word))
}

async fn list_decks(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Result<impl IntoResponse, AppError> {
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| AppError::Unauthorized)?;

    let rows = sqlx::query(
        r#"SELECT d.id, d.user_id, d.name, d.created_at,
                  COUNT(c.id) AS card_count
           FROM decks d
           LEFT JOIN cards c ON c.deck_id = d.id
           WHERE d.user_id = $1
           GROUP BY d.id
           ORDER BY d.created_at DESC"#,
    )
    .bind(user_id)
    .fetch_all(&state.pool)
    .await?;

    let decks: Vec<Value> = rows
        .iter()
        .map(|r| {
            use sqlx::Row;
            json!({
                "id": r.get::<Uuid, _>("id"),
                "user_id": r.get::<Uuid, _>("user_id"),
                "name": r.get::<String, _>("name"),
                "created_at": r.get::<chrono::DateTime<chrono::Utc>, _>("created_at"),
                "card_count": r.get::<i64, _>("card_count"),
            })
        })
        .collect();

    Ok(Json(decks))
}

async fn create_deck(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(req): Json<CreateDeckRequest>,
) -> Result<impl IntoResponse, AppError> {
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| AppError::Unauthorized)?;

    if req.name.trim().is_empty() {
        return Err(AppError::BadRequest("Deck name cannot be empty".into()));
    }

    let row = sqlx::query(
        "INSERT INTO decks (user_id, name) VALUES ($1, $2) RETURNING id, user_id, name, created_at",
    )
    .bind(user_id)
    .bind(req.name.trim())
    .fetch_one(&state.pool)
    .await?;

    use sqlx::Row;
    Ok((
        StatusCode::CREATED,
        Json(json!({
            "id": row.get::<Uuid, _>("id"),
            "user_id": row.get::<Uuid, _>("user_id"),
            "name": row.get::<String, _>("name"),
            "created_at": row.get::<chrono::DateTime<chrono::Utc>, _>("created_at"),
            "card_count": 0_i64,
        })),
    ))
}

async fn delete_deck(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| AppError::Unauthorized)?;

    let result = sqlx::query("DELETE FROM decks WHERE id = $1 AND user_id = $2")
        .bind(id)
        .bind(user_id)
        .execute(&state.pool)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(StatusCode::NO_CONTENT)
}

async fn list_cards(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(deck_id): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| AppError::Unauthorized)?;

    let owns: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM decks WHERE id = $1 AND user_id = $2",
    )
    .bind(deck_id)
    .bind(user_id)
    .fetch_one(&state.pool)
    .await?;

    if owns == 0 {
        return Err(AppError::NotFound);
    }

    let rows = sqlx::query(
        "SELECT * FROM cards WHERE deck_id = $1 ORDER BY created_at ASC",
    )
    .bind(deck_id)
    .fetch_all(&state.pool)
    .await?;

    use sqlx::Row;
    let cards: Vec<Value> = rows
        .iter()
        .map(|r| {
            json!({
                "id": r.get::<Uuid, _>("id"),
                "deck_id": r.get::<Uuid, _>("deck_id"),
                "word": r.get::<String, _>("word"),
                "definition_en": r.get::<String, _>("definition_en"),
                "example_en": r.get::<String, _>("example_en"),
                "translation_uk": r.get::<String, _>("translation_uk"),
                "example_uk": r.get::<String, _>("example_uk"),
                "created_at": r.get::<chrono::DateTime<chrono::Utc>, _>("created_at"),
            })
        })
        .collect();

    Ok(Json(cards))
}

async fn create_card(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(deck_id): Path<Uuid>,
    Json(req): Json<CreateCardRequest>,
) -> Result<impl IntoResponse, AppError> {
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| AppError::Unauthorized)?;

    let owns: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM decks WHERE id = $1 AND user_id = $2",
    )
    .bind(deck_id)
    .bind(user_id)
    .fetch_one(&state.pool)
    .await?;

    if owns == 0 {
        return Err(AppError::NotFound);
    }

    let row = sqlx::query(
        r#"INSERT INTO cards (deck_id, word, definition_en, example_en, translation_uk, example_uk)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id, deck_id, word, definition_en, example_en, translation_uk, example_uk, created_at"#,
    )
    .bind(deck_id)
    .bind(&req.word)
    .bind(&req.definition_en)
    .bind(&req.example_en)
    .bind(&req.translation_uk)
    .bind(&req.example_uk)
    .fetch_one(&state.pool)
    .await?;

    use sqlx::Row;
    Ok((
        StatusCode::CREATED,
        Json(json!({
            "id": row.get::<Uuid, _>("id"),
            "deck_id": row.get::<Uuid, _>("deck_id"),
            "word": row.get::<String, _>("word"),
            "definition_en": row.get::<String, _>("definition_en"),
            "example_en": row.get::<String, _>("example_en"),
            "translation_uk": row.get::<String, _>("translation_uk"),
            "example_uk": row.get::<String, _>("example_uk"),
            "created_at": row.get::<chrono::DateTime<chrono::Utc>, _>("created_at"),
        })),
    ))
}

async fn update_card(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(card_id): Path<Uuid>,
    Json(req): Json<UpdateCardRequest>,
) -> Result<impl IntoResponse, AppError> {
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| AppError::Unauthorized)?;

    let exists: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*) FROM cards c
           JOIN decks d ON d.id = c.deck_id
           WHERE c.id = $1 AND d.user_id = $2"#,
    )
    .bind(card_id)
    .bind(user_id)
    .fetch_one(&state.pool)
    .await?;

    if exists == 0 {
        return Err(AppError::NotFound);
    }

    sqlx::query(
        r#"UPDATE cards SET
           word = COALESCE($1, word),
           definition_en = COALESCE($2, definition_en),
           example_en = COALESCE($3, example_en),
           translation_uk = COALESCE($4, translation_uk),
           example_uk = COALESCE($5, example_uk)
           WHERE id = $6"#,
    )
    .bind(req.word)
    .bind(req.definition_en)
    .bind(req.example_en)
    .bind(req.translation_uk)
    .bind(req.example_uk)
    .bind(card_id)
    .execute(&state.pool)
    .await?;

    Ok(StatusCode::NO_CONTENT)
}

async fn delete_card(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(card_id): Path<Uuid>,
) -> Result<impl IntoResponse, AppError> {
    let user_id = Uuid::parse_str(&claims.sub).map_err(|_| AppError::Unauthorized)?;

    let result = sqlx::query(
        r#"DELETE FROM cards USING decks
           WHERE cards.id = $1
           AND cards.deck_id = decks.id
           AND decks.user_id = $2"#,
    )
    .bind(card_id)
    .bind(user_id)
    .execute(&state.pool)
    .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize)]
struct LookupQuery {
    word: String,
}

async fn lookup_word(
    Query(q): Query<LookupQuery>,
) -> Result<impl IntoResponse, AppError> {
    let word = q.word.trim().to_lowercase();
    if word.is_empty() {
        return Err(AppError::BadRequest("Word cannot be empty".into()));
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| AppError::Internal(e.to_string()))?;

    let dict_url = format!(
        "https://api.dictionaryapi.dev/api/v2/entries/en/{}",
        urlencoding::encode(&word)
    );
    let trans_url = format!(
        "https://lingva.ml/api/v1/en/uk/{}",
        urlencoding::encode(&word)
    );

    let (dict_res, trans_res) = tokio::join!(
        client.get(&dict_url).send(),
        client.get(&trans_url).send(),
    );

    let dict_json: Value = dict_res
        .map_err(|e| AppError::Internal(e.to_string()))?
        .json()
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

    let trans_json: Value = trans_res
        .map_err(|e| AppError::Internal(e.to_string()))?
        .json()
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

    let definition_en = dict_json[0]["meanings"][0]["definitions"][0]["definition"]
        .as_str()
        .unwrap_or("No definition found")
        .to_string();

    let example_en = dict_json[0]["meanings"][0]["definitions"][0]["example"]
        .as_str()
        .unwrap_or("")
        .to_string();

    let translation_uk = trans_json["translation"]
        .as_str()
        .unwrap_or(&word)
        .to_string();

    let example_uk = if !example_en.is_empty() {
        let ex_url = format!(
            "https://lingva.ml/api/v1/en/uk/{}",
            urlencoding::encode(&example_en)
        );
        if let Ok(res) = client.get(&ex_url).send().await {
            if let Ok(json) = res.json::<Value>().await {
                json["translation"]
                    .as_str()
                    .unwrap_or("")
                    .to_string()
            } else {
                String::new()
            }
        } else {
            String::new()
        }
    } else {
        String::new()
    };

    Ok(Json(LookupResponse {
        word,
        definition_en,
        example_en,
        translation_uk,
        example_uk,
    }))
}
