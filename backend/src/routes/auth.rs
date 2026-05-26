use axum::{
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    routing::post,
    Json, Router,
};
use axum_extra::extract::cookie::{Cookie, CookieJar, SameSite};
use serde_json::json;
use time::Duration;
use uuid::Uuid;

use crate::{
    auth::create_token,
    errors::AppError,
    models::{AuthResponse, LoginRequest, RegisterRequest},
    AppState,
};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/register", post(register))
        .route("/login", post(login))
        .route("/logout", post(logout))
}

async fn register(
    State(state): State<AppState>,
    Json(req): Json<RegisterRequest>,
) -> Result<impl IntoResponse, AppError> {
    if req.email.is_empty() || req.password.len() < 6 {
        return Err(AppError::BadRequest(
            "Email required and password must be at least 6 characters".into(),
        ));
    }

    let hash = bcrypt::hash(&req.password, 12)
        .map_err(|e| AppError::Internal(e.to_string()))?;

    let row = sqlx::query(
        "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email",
    )
    .bind(&req.email)
    .bind(&hash)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| match &e {
        sqlx::Error::Database(db) if db.constraint() == Some("users_email_key") => {
            AppError::BadRequest("Email already registered".into())
        }
        _ => AppError::Database(e),
    })?;

    use sqlx::Row;
    let id: Uuid = row.get("id");
    let email: String = row.get("email");
    let token = create_token(id, &email, &state.jwt_secret)?;

    let cookie = build_auth_cookie(token.clone());
    let jar = CookieJar::new().add(cookie);

    Ok((
        StatusCode::CREATED,
        jar,
        Json(AuthResponse {
            token,
            user_id: id,
            email,
        }),
    ))
}

async fn login(
    State(state): State<AppState>,
    Json(req): Json<LoginRequest>,
) -> Result<impl IntoResponse, AppError> {
    let row = sqlx::query(
        "SELECT id, email, password_hash FROM users WHERE email = $1",
    )
    .bind(&req.email)
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::Unauthorized)?;

    use sqlx::Row;
    let id: Uuid = row.get("id");
    let email: String = row.get("email");
    let hash: String = row.get("password_hash");

    let valid = bcrypt::verify(&req.password, &hash)
        .map_err(|e| AppError::Internal(e.to_string()))?;
    if !valid {
        return Err(AppError::Unauthorized);
    }

    let token = create_token(id, &email, &state.jwt_secret)?;
    let cookie = build_auth_cookie(token.clone());
    let jar = CookieJar::new().add(cookie);

    Ok((
        StatusCode::OK,
        jar,
        Json(AuthResponse { token, user_id: id, email }),
    ))
}

async fn logout() -> impl IntoResponse {
    let cookie = Cookie::build("auth_token")
        .path("/")
        .max_age(Duration::ZERO)
        .build();
    let jar = CookieJar::new().add(cookie);
    (jar, Json(json!({"message": "Logged out"})))
}

fn build_auth_cookie(token: String) -> Cookie<'static> {
    let mut cookie = Cookie::new("auth_token", token);
    cookie.set_http_only(true);
    cookie.set_same_site(SameSite::Lax);
    cookie.set_path("/");
    cookie.set_max_age(Duration::days(7));
    cookie
}
