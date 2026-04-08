use std::fmt;

use argon2::{
    password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use axum::{
    extract::{Path, Query, State},
    http::HeaderMap,
    response::Html,
    Json,
};
use chrono::{Duration, Utc};
use rand_core::OsRng;
use reqwest::Url;
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    error::{AppError, Result},
    AppState,
};

#[derive(Serialize)]
pub struct AuthUserResponse {
    pub id: String,
    pub email: Option<String>,
    pub display_name: String,
    pub provider: String,
    pub created_at: String,
}

#[derive(Serialize)]
pub struct AuthSessionResponse {
    pub token: String,
    pub user: AuthUserResponse,
    pub expires_at: String,
}

#[derive(Serialize)]
pub struct AuthProviderResponse {
    pub id: String,
    pub label: String,
    pub kind: String,
    pub available: bool,
    pub requires_external_browser: bool,
    pub start_path: Option<String>,
    pub description: String,
}

#[derive(Serialize)]
pub struct AuthProvidersResponse {
    pub providers: Vec<AuthProviderResponse>,
}

#[derive(Deserialize)]
pub struct RegisterRequest {
    pub email: String,
    pub password: String,
    pub display_name: String,
}

#[derive(Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Serialize)]
pub struct OAuthStartResponse {
    pub provider: String,
    pub state: String,
    pub authorization_url: String,
    pub poll_path: String,
    pub expires_at: String,
    pub requires_external_browser: bool,
}

#[derive(Serialize)]
pub struct OAuthStatusResponse {
    pub status: String,
    pub session: Option<AuthSessionResponse>,
    pub error: Option<String>,
}

#[derive(Deserialize)]
pub struct OAuthCallbackQuery {
    pub state: String,
    pub code: Option<String>,
    pub error: Option<String>,
    pub error_description: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum AuthProviderId {
    Password,
    Google,
    Github,
    Microsoft,
    Discord,
    Apple,
}

impl AuthProviderId {
    fn as_str(self) -> &'static str {
        match self {
            Self::Password => "password",
            Self::Google => "google",
            Self::Github => "github",
            Self::Microsoft => "microsoft",
            Self::Discord => "discord",
            Self::Apple => "apple",
        }
    }
}

impl fmt::Display for AuthProviderId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

#[derive(Clone, Copy)]
enum UserInfoStrategy {
    Oidc,
    Github,
    Discord,
}

#[derive(Clone, Copy)]
struct OAuthProviderDefinition {
    id: AuthProviderId,
    label: &'static str,
    authorize_url: &'static str,
    token_url: &'static str,
    userinfo_url: &'static str,
    email_url: Option<&'static str>,
    client_id_env: &'static str,
    client_secret_env: &'static str,
    scopes: &'static [&'static str],
    strategy: UserInfoStrategy,
    description: &'static str,
    supported: bool,
}

#[derive(Debug)]
struct ExternalAuthUser {
    provider_user_id: String,
    email: Option<String>,
    display_name: String,
}

#[derive(Deserialize)]
struct OAuthTokenResponse {
    access_token: Option<String>,
}

#[derive(Deserialize)]
struct OidcUserInfo {
    sub: String,
    email: Option<String>,
    name: Option<String>,
    preferred_username: Option<String>,
}

#[derive(Deserialize)]
struct GithubUserInfo {
    id: u64,
    login: String,
    name: Option<String>,
    email: Option<String>,
}

#[derive(Deserialize)]
struct GithubEmailInfo {
    email: String,
    primary: bool,
    verified: bool,
}

#[derive(Deserialize)]
struct DiscordUserInfo {
    id: String,
    email: Option<String>,
    username: String,
    global_name: Option<String>,
}

#[derive(Serialize)]
pub struct LogoutResponse {
    ok: bool,
}

pub async fn list_providers(State(state): State<AppState>) -> Result<Json<AuthProvidersResponse>> {
    Ok(Json(AuthProvidersResponse {
        providers: build_provider_list(&state),
    }))
}

pub async fn register(
    State(state): State<AppState>,
    Json(body): Json<RegisterRequest>,
) -> Result<Json<AuthSessionResponse>> {
    let email = normalize_email(&body.email)?;
    let display_name = normalize_display_name(&body.display_name)?;
    validate_password(&body.password)?;
    let password_hash = hash_password(&body.password)?;

    let conn = state.db.get()?;

    let existing_email: Option<String> = conn
        .query_row(
            "SELECT id FROM users WHERE email = ?1",
            params![email],
            |row| row.get(0),
        )
        .optional()?;

    if existing_email.is_some() {
        return Err(AppError::Conflict(
            "An account with this email already exists".into(),
        ));
    }

    let user_id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO users (id, email, display_name, provider) VALUES (?1, ?2, ?3, 'password')",
        params![user_id, email, display_name],
    )?;
    conn.execute(
        "INSERT INTO user_passwords (user_id, password_hash) VALUES (?1, ?2)",
        params![user_id, password_hash],
    )?;

    let session = create_auth_session(&conn, &state, &user_id)?;
    Ok(Json(session))
}

pub async fn login(
    State(state): State<AppState>,
    Json(body): Json<LoginRequest>,
) -> Result<Json<AuthSessionResponse>> {
    let email = normalize_email(&body.email)?;
    validate_password(&body.password)?;
    let conn = state.db.get()?;

    let record = conn
        .query_row(
            "SELECT users.id, user_passwords.password_hash
             FROM users
             JOIN user_passwords ON user_passwords.user_id = users.id
             WHERE users.email = ?1",
            params![email],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
        )
        .optional()?;

    let Some((user_id, password_hash)) = record else {
        return Err(AppError::Unauthorized("Invalid email or password".into()));
    };

    if !verify_password(&password_hash, &body.password)? {
        return Err(AppError::Unauthorized("Invalid email or password".into()));
    }

    let session = create_auth_session(&conn, &state, &user_id)?;
    Ok(Json(session))
}

pub async fn me(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<AuthUserResponse>> {
    let token = bearer_token(&headers)?;
    let conn = state.db.get()?;
    let session = load_auth_session_by_token(&conn, &token)?
        .ok_or_else(|| AppError::Unauthorized("Session is missing or expired".into()))?;
    Ok(Json(session.user))
}

pub async fn logout(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<LogoutResponse>> {
    let token = bearer_token(&headers)?;
    let conn = state.db.get()?;
    conn.execute(
        "UPDATE auth_sessions
         SET revoked_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
         WHERE token = ?1",
        params![token],
    )?;

    Ok(Json(LogoutResponse { ok: true }))
}

pub async fn start_oauth(
    State(state): State<AppState>,
    Path(provider): Path<String>,
) -> Result<Json<OAuthStartResponse>> {
    let provider = find_provider(&provider)
        .ok_or_else(|| AppError::NotFound(format!("Unknown auth provider '{}'", provider)))?;

    if !provider.supported {
        return Err(AppError::BadRequest(format!(
            "{} auth is not available in this build yet",
            provider.label
        )));
    }

    let client_id = env_required(provider.client_id_env, provider.label)?;
    let _client_secret = env_required(provider.client_secret_env, provider.label)?;
    let redirect_uri = oauth_callback_url(&state, provider)?;
    let state_token = Uuid::new_v4().simple().to_string();
    let expires_at = (Utc::now() + Duration::minutes(10))
        .format("%Y-%m-%dT%H:%M:%SZ")
        .to_string();

    let conn = state.db.get()?;
    conn.execute(
        "INSERT INTO oauth_states (state, provider, expires_at) VALUES (?1, ?2, ?3)",
        params![state_token, provider.id.as_str(), expires_at],
    )?;

    let mut url = Url::parse(provider.authorize_url)
        .map_err(|e| AppError::Internal(format!("Invalid auth provider URL: {e}")))?;

    {
        let mut params = url.query_pairs_mut();
        params.append_pair("response_type", "code");
        params.append_pair("client_id", &client_id);
        params.append_pair("redirect_uri", &redirect_uri);
        params.append_pair("scope", &provider.scopes.join(" "));
        params.append_pair("state", &state_token);
    }

    Ok(Json(OAuthStartResponse {
        provider: provider.id.to_string(),
        state: state_token.clone(),
        authorization_url: url.to_string(),
        poll_path: format!("/api/auth/oauth/status/{}", state_token),
        expires_at,
        requires_external_browser: true,
    }))
}

pub async fn complete_oauth(
    State(state): State<AppState>,
    Path(provider): Path<String>,
    Query(query): Query<OAuthCallbackQuery>,
) -> Result<Html<String>> {
    let provider = find_provider(&provider)
        .ok_or_else(|| AppError::NotFound(format!("Unknown auth provider '{}'", provider)))?;

    let exists: Option<String> = {
        let conn = state.db.get()?;
        conn.query_row(
            "SELECT provider FROM oauth_states WHERE state = ?1",
            params![query.state],
            |row| row.get(0),
        )
        .optional()?
    };

    let Some(stored_provider) = exists else {
        return Ok(Html(oauth_finish_html(
            "Authorization request not found",
            "Start the sign-in flow again from the app.",
            false,
        )));
    };

    if stored_provider != provider.id.as_str() {
        set_oauth_state_error(&state, &query.state, "Provider mismatch")?;

        return Ok(Html(oauth_finish_html(
            "Authorization failed",
            "The provider callback did not match the pending sign-in request.",
            false,
        )));
    }

    if let Some(error) = query.error.or(query.error_description) {
        set_oauth_state_error(&state, &query.state, &error)?;

        return Ok(Html(oauth_finish_html(
            "Authorization cancelled",
            "Return to the app and start sign-in again if you still want to connect this account.",
            false,
        )));
    }

    let Some(code) = query.code else {
        set_oauth_state_error(&state, &query.state, "Missing authorization code")?;

        return Ok(Html(oauth_finish_html(
            "Authorization failed",
            "The provider did not return an authorization code.",
            false,
        )));
    };

    match finish_oauth_flow(&state, provider, &query.state, &code).await {
        Ok(_) => Ok(Html(oauth_finish_html(
            "Authorization complete",
            "You can close this tab and return to the app.",
            true,
        ))),
        Err(error) => {
            let message = match &error {
                AppError::BadRequest(message)
                | AppError::Unauthorized(message)
                | AppError::Conflict(message)
                | AppError::ExternalApi(message)
                | AppError::Internal(message) => message.clone(),
                AppError::NotFound(message) => message.clone(),
                AppError::Database(_)
                | AppError::Pool(_)
                | AppError::Http(_)
                | AppError::Json(_) => "Remote sign-in failed".into(),
            };

            set_oauth_state_error(&state, &query.state, &message)?;

            Ok(Html(oauth_finish_html(
                "Authorization failed",
                "Return to the app and retry sign-in.",
                false,
            )))
        }
    }
}

pub async fn oauth_status(
    State(state): State<AppState>,
    Path(state_token): Path<String>,
) -> Result<Json<OAuthStatusResponse>> {
    let conn = state.db.get()?;
    let row = conn
        .query_row(
            "SELECT expires_at, error, session_token
             FROM oauth_states
             WHERE state = ?1",
            params![state_token],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, Option<String>>(1)?,
                    row.get::<_, Option<String>>(2)?,
                ))
            },
        )
        .optional()?;

    let Some((expires_at, error, session_token)) = row else {
        return Err(AppError::NotFound("Authorization state not found".into()));
    };

    if let Some(error) = error {
        return Ok(Json(OAuthStatusResponse {
            status: "failed".into(),
            session: None,
            error: Some(error),
        }));
    }

    if let Some(session_token) = session_token {
        let session = load_auth_session_by_token(&conn, &session_token)?.ok_or_else(|| {
            AppError::Unauthorized("Remote session expired before it was claimed".into())
        })?;

        return Ok(Json(OAuthStatusResponse {
            status: "complete".into(),
            session: Some(session),
            error: None,
        }));
    }

    if expires_at <= Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string() {
        return Ok(Json(OAuthStatusResponse {
            status: "failed".into(),
            session: None,
            error: Some("Authorization request expired".into()),
        }));
    }

    Ok(Json(OAuthStatusResponse {
        status: "pending".into(),
        session: None,
        error: None,
    }))
}

fn build_provider_list(state: &AppState) -> Vec<AuthProviderResponse> {
    let mut providers = vec![AuthProviderResponse {
        id: AuthProviderId::Password.to_string(),
        label: "Email and password".into(),
        kind: "password".into(),
        available: true,
        requires_external_browser: false,
        start_path: None,
        description: "Remote account stored on the Rust server.".into(),
    }];

    for provider in oauth_provider_definitions() {
        let available = provider.supported
            && state.config.public_backend_url.is_some()
            && std::env::var(provider.client_id_env).is_ok()
            && std::env::var(provider.client_secret_env).is_ok();

        providers.push(AuthProviderResponse {
            id: provider.id.to_string(),
            label: provider.label.into(),
            kind: "oauth".into(),
            available,
            requires_external_browser: true,
            start_path: available.then(|| format!("/api/auth/oauth/{}/start", provider.id)),
            description: provider.description.into(),
        });
    }

    providers
}

fn oauth_provider_definitions() -> &'static [OAuthProviderDefinition] {
    &[
        OAuthProviderDefinition {
            id: AuthProviderId::Google,
            label: "Google",
            authorize_url: "https://accounts.google.com/o/oauth2/v2/auth",
            token_url: "https://oauth2.googleapis.com/token",
            userinfo_url: "https://openidconnect.googleapis.com/v1/userinfo",
            email_url: None,
            client_id_env: "AUTH_GOOGLE_CLIENT_ID",
            client_secret_env: "AUTH_GOOGLE_CLIENT_SECRET",
            scopes: &["openid", "email", "profile"],
            strategy: UserInfoStrategy::Oidc,
            description: "Sign in with a Google account.",
            supported: true,
        },
        OAuthProviderDefinition {
            id: AuthProviderId::Github,
            label: "GitHub",
            authorize_url: "https://github.com/login/oauth/authorize",
            token_url: "https://github.com/login/oauth/access_token",
            userinfo_url: "https://api.github.com/user",
            email_url: Some("https://api.github.com/user/emails"),
            client_id_env: "AUTH_GITHUB_CLIENT_ID",
            client_secret_env: "AUTH_GITHUB_CLIENT_SECRET",
            scopes: &["read:user", "user:email"],
            strategy: UserInfoStrategy::Github,
            description: "Sign in with a GitHub account.",
            supported: true,
        },
        OAuthProviderDefinition {
            id: AuthProviderId::Microsoft,
            label: "Microsoft",
            authorize_url: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
            token_url: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
            userinfo_url: "https://graph.microsoft.com/oidc/userinfo",
            email_url: None,
            client_id_env: "AUTH_MICROSOFT_CLIENT_ID",
            client_secret_env: "AUTH_MICROSOFT_CLIENT_SECRET",
            scopes: &["openid", "email", "profile"],
            strategy: UserInfoStrategy::Oidc,
            description: "Sign in with Microsoft or Outlook.",
            supported: true,
        },
        OAuthProviderDefinition {
            id: AuthProviderId::Discord,
            label: "Discord",
            authorize_url: "https://discord.com/oauth2/authorize",
            token_url: "https://discord.com/api/oauth2/token",
            userinfo_url: "https://discord.com/api/users/@me",
            email_url: None,
            client_id_env: "AUTH_DISCORD_CLIENT_ID",
            client_secret_env: "AUTH_DISCORD_CLIENT_SECRET",
            scopes: &["identify", "email"],
            strategy: UserInfoStrategy::Discord,
            description: "Sign in with Discord.",
            supported: true,
        },
        OAuthProviderDefinition {
            id: AuthProviderId::Apple,
            label: "Apple",
            authorize_url: "https://appleid.apple.com/auth/authorize",
            token_url: "https://appleid.apple.com/auth/token",
            userinfo_url: "",
            email_url: None,
            client_id_env: "AUTH_APPLE_CLIENT_ID",
            client_secret_env: "AUTH_APPLE_CLIENT_SECRET",
            scopes: &["name", "email"],
            strategy: UserInfoStrategy::Oidc,
            description: "Sign in with Apple after server-side setup.",
            supported: false,
        },
    ]
}

fn find_provider(value: &str) -> Option<OAuthProviderDefinition> {
    oauth_provider_definitions()
        .iter()
        .copied()
        .find(|provider| provider.id.as_str() == value)
}

fn normalize_email(email: &str) -> Result<String> {
    let normalized = email.trim().to_ascii_lowercase();
    if normalized.is_empty() || !normalized.contains('@') {
        return Err(AppError::BadRequest(
            "A valid email address is required".into(),
        ));
    }
    Ok(normalized)
}

fn normalize_display_name(display_name: &str) -> Result<String> {
    let normalized = display_name.trim();
    if normalized.is_empty() {
        return Err(AppError::BadRequest("Display name cannot be empty".into()));
    }
    Ok(normalized.to_string())
}

fn validate_password(password: &str) -> Result<()> {
    if password.trim().len() < 8 {
        return Err(AppError::BadRequest(
            "Password must be at least 8 characters long".into(),
        ));
    }
    Ok(())
}

fn hash_password(password: &str) -> Result<String> {
    let salt = SaltString::generate(&mut OsRng);
    let hash = Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map_err(|e| AppError::Internal(format!("Failed to hash password: {e}")))?;
    Ok(hash.to_string())
}

fn verify_password(hash: &str, password: &str) -> Result<bool> {
    let parsed = PasswordHash::new(hash)
        .map_err(|e| AppError::Internal(format!("Invalid password hash: {e}")))?;
    Ok(Argon2::default()
        .verify_password(password.as_bytes(), &parsed)
        .is_ok())
}

fn create_auth_session(
    conn: &rusqlite::Connection,
    state: &AppState,
    user_id: &str,
) -> Result<AuthSessionResponse> {
    let token = Uuid::new_v4().simple().to_string();
    let expires_at = (Utc::now() + Duration::hours(state.config.auth_session_ttl_hours))
        .format("%Y-%m-%dT%H:%M:%SZ")
        .to_string();

    conn.execute(
        "INSERT INTO auth_sessions (token, user_id, expires_at) VALUES (?1, ?2, ?3)",
        params![token, user_id, expires_at],
    )?;

    load_auth_session_by_token(conn, &token)?
        .ok_or_else(|| AppError::Internal("Failed to load created session".into()))
}

fn load_auth_session_by_token(
    conn: &rusqlite::Connection,
    token: &str,
) -> Result<Option<AuthSessionResponse>> {
    conn.query_row(
        "SELECT
            auth_sessions.token,
            auth_sessions.expires_at,
            users.id,
            users.email,
            users.display_name,
            users.provider,
            users.created_at
         FROM auth_sessions
         JOIN users ON users.id = auth_sessions.user_id
         WHERE auth_sessions.token = ?1
           AND auth_sessions.revoked_at IS NULL
           AND auth_sessions.expires_at > strftime('%Y-%m-%dT%H:%M:%SZ', 'now')",
        params![token],
        |row| {
            Ok(AuthSessionResponse {
                token: row.get(0)?,
                expires_at: row.get(1)?,
                user: AuthUserResponse {
                    id: row.get(2)?,
                    email: row.get(3)?,
                    display_name: row.get(4)?,
                    provider: row.get(5)?,
                    created_at: row.get(6)?,
                },
            })
        },
    )
    .optional()
    .map_err(Into::into)
}

fn bearer_token(headers: &HeaderMap) -> Result<String> {
    let authorization = headers
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .ok_or_else(|| AppError::Unauthorized("Missing Authorization header".into()))?;

    let Some(token) = authorization.strip_prefix("Bearer ") else {
        return Err(AppError::Unauthorized(
            "Authorization header must use Bearer <token>".into(),
        ));
    };

    if token.trim().is_empty() {
        return Err(AppError::Unauthorized(
            "Bearer token cannot be empty".into(),
        ));
    }

    Ok(token.trim().to_string())
}

fn env_required(name: &str, provider_label: &str) -> Result<String> {
    std::env::var(name).map_err(|_| {
        AppError::BadRequest(format!(
            "{} auth is not configured on this server",
            provider_label
        ))
    })
}

fn oauth_callback_url(state: &AppState, provider: OAuthProviderDefinition) -> Result<String> {
    let public_backend_url = state.config.public_backend_url.as_ref().ok_or_else(|| {
        AppError::BadRequest(
            "PUBLIC_BACKEND_URL is required before OAuth providers can be enabled".into(),
        )
    })?;

    Ok(format!(
        "{}/api/auth/oauth/{}/callback",
        public_backend_url.trim_end_matches('/'),
        provider.id
    ))
}

async fn finish_oauth_flow(
    state: &AppState,
    provider: OAuthProviderDefinition,
    state_token: &str,
    code: &str,
) -> Result<()> {
    let client_id = env_required(provider.client_id_env, provider.label)?;
    let client_secret = env_required(provider.client_secret_env, provider.label)?;
    let redirect_uri = oauth_callback_url(state, provider)?;
    let access_token = exchange_oauth_code(
        state,
        provider,
        &client_id,
        &client_secret,
        &redirect_uri,
        code,
    )
    .await?;
    let remote_user = fetch_remote_user(state, provider, &access_token).await?;
    let conn = state.db.get()?;
    let user_id = upsert_remote_user(&conn, provider, &remote_user)?;
    let session = create_auth_session(&conn, state, &user_id)?;

    conn.execute(
        "UPDATE oauth_states
         SET completed_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now'),
             error = NULL,
             session_token = ?2
         WHERE state = ?1",
        params![state_token, session.token],
    )?;

    Ok(())
}

fn set_oauth_state_error(state: &AppState, state_token: &str, message: &str) -> Result<()> {
    let conn = state.db.get()?;
    conn.execute(
        "UPDATE oauth_states
         SET completed_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now'),
             error = ?2
         WHERE state = ?1",
        params![state_token, message],
    )?;
    Ok(())
}

async fn exchange_oauth_code(
    state: &AppState,
    provider: OAuthProviderDefinition,
    client_id: &str,
    client_secret: &str,
    redirect_uri: &str,
    code: &str,
) -> Result<String> {
    let response = state
        .http
        .post(provider.token_url)
        .header("Accept", "application/json")
        .form(&[
            ("grant_type", "authorization_code"),
            ("client_id", client_id),
            ("client_secret", client_secret),
            ("code", code),
            ("redirect_uri", redirect_uri),
        ])
        .send()
        .await?;

    if !response.status().is_success() {
        return Err(AppError::ExternalApi(format!(
            "{} token exchange failed with status {}",
            provider.label,
            response.status()
        )));
    }

    let payload: OAuthTokenResponse = response.json().await?;
    payload.access_token.ok_or_else(|| {
        AppError::ExternalApi(format!("{} did not return an access token", provider.label))
    })
}

async fn fetch_remote_user(
    state: &AppState,
    provider: OAuthProviderDefinition,
    access_token: &str,
) -> Result<ExternalAuthUser> {
    match provider.strategy {
        UserInfoStrategy::Oidc => fetch_oidc_user(state, provider, access_token).await,
        UserInfoStrategy::Github => fetch_github_user(state, provider, access_token).await,
        UserInfoStrategy::Discord => fetch_discord_user(state, provider, access_token).await,
    }
}

async fn fetch_oidc_user(
    state: &AppState,
    provider: OAuthProviderDefinition,
    access_token: &str,
) -> Result<ExternalAuthUser> {
    let response = state
        .http
        .get(provider.userinfo_url)
        .bearer_auth(access_token)
        .header("Accept", "application/json")
        .send()
        .await?;

    if !response.status().is_success() {
        return Err(AppError::ExternalApi(format!(
            "{} user info request failed with status {}",
            provider.label,
            response.status()
        )));
    }

    let payload: OidcUserInfo = response.json().await?;
    let display_name = payload
        .name
        .or(payload.preferred_username)
        .unwrap_or_else(|| {
            payload
                .email
                .clone()
                .unwrap_or_else(|| provider.label.into())
        });

    Ok(ExternalAuthUser {
        provider_user_id: payload.sub,
        email: payload.email.map(|value| value.to_ascii_lowercase()),
        display_name,
    })
}

async fn fetch_github_user(
    state: &AppState,
    provider: OAuthProviderDefinition,
    access_token: &str,
) -> Result<ExternalAuthUser> {
    let response = state
        .http
        .get(provider.userinfo_url)
        .bearer_auth(access_token)
        .header("Accept", "application/json")
        .header("User-Agent", "en-learner")
        .send()
        .await?;

    if !response.status().is_success() {
        return Err(AppError::ExternalApi(format!(
            "{} user info request failed with status {}",
            provider.label,
            response.status()
        )));
    }

    let payload: GithubUserInfo = response.json().await?;
    let mut email = payload.email.map(|value| value.to_ascii_lowercase());

    if email.is_none() {
        if let Some(email_url) = provider.email_url {
            let email_response = state
                .http
                .get(email_url)
                .bearer_auth(access_token)
                .header("Accept", "application/json")
                .header("User-Agent", "en-learner")
                .send()
                .await?;

            if email_response.status().is_success() {
                let emails: Vec<GithubEmailInfo> = email_response.json().await?;
                email = emails
                    .into_iter()
                    .find(|candidate| candidate.primary && candidate.verified)
                    .map(|candidate| candidate.email.to_ascii_lowercase());
            }
        }
    }

    Ok(ExternalAuthUser {
        provider_user_id: payload.id.to_string(),
        email,
        display_name: payload.name.unwrap_or(payload.login),
    })
}

async fn fetch_discord_user(
    state: &AppState,
    provider: OAuthProviderDefinition,
    access_token: &str,
) -> Result<ExternalAuthUser> {
    let response = state
        .http
        .get(provider.userinfo_url)
        .bearer_auth(access_token)
        .header("Accept", "application/json")
        .send()
        .await?;

    if !response.status().is_success() {
        return Err(AppError::ExternalApi(format!(
            "{} user info request failed with status {}",
            provider.label,
            response.status()
        )));
    }

    let payload: DiscordUserInfo = response.json().await?;

    Ok(ExternalAuthUser {
        provider_user_id: payload.id,
        email: payload.email.map(|value| value.to_ascii_lowercase()),
        display_name: payload.global_name.unwrap_or(payload.username),
    })
}

fn upsert_remote_user(
    conn: &rusqlite::Connection,
    provider: OAuthProviderDefinition,
    remote_user: &ExternalAuthUser,
) -> Result<String> {
    if let Some(user_id) = conn
        .query_row(
            "SELECT user_id
             FROM oauth_identities
             WHERE provider = ?1 AND provider_user_id = ?2",
            params![provider.id.as_str(), remote_user.provider_user_id],
            |row| row.get::<_, String>(0),
        )
        .optional()?
    {
        conn.execute(
            "UPDATE users
             SET display_name = ?2
             WHERE id = ?1",
            params![user_id, remote_user.display_name],
        )?;
        conn.execute(
            "UPDATE oauth_identities
             SET email = ?3, display_name = ?4
             WHERE provider = ?1 AND provider_user_id = ?2",
            params![
                provider.id.as_str(),
                remote_user.provider_user_id,
                remote_user.email,
                remote_user.display_name,
            ],
        )?;
        return Ok(user_id);
    }

    let existing_user_id = if let Some(email) = &remote_user.email {
        conn.query_row(
            "SELECT id FROM users WHERE email = ?1",
            params![email],
            |row| row.get::<_, String>(0),
        )
        .optional()?
    } else {
        None
    };

    let user_id = if let Some(existing_user_id) = existing_user_id {
        conn.execute(
            "UPDATE users
             SET display_name = ?2, provider = ?3
             WHERE id = ?1",
            params![
                existing_user_id,
                remote_user.display_name,
                provider.id.as_str()
            ],
        )?;
        existing_user_id
    } else {
        let user_id = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO users (id, email, display_name, provider)
             VALUES (?1, ?2, ?3, ?4)",
            params![
                user_id,
                remote_user.email,
                remote_user.display_name,
                provider.id.as_str()
            ],
        )?;
        user_id
    };

    conn.execute(
        "INSERT INTO oauth_identities (provider, provider_user_id, user_id, email, display_name)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![
            provider.id.as_str(),
            remote_user.provider_user_id,
            user_id,
            remote_user.email,
            remote_user.display_name
        ],
    )?;

    Ok(user_id)
}

fn oauth_finish_html(title: &str, message: &str, success: bool) -> String {
    let accent = if success { "#0f766e" } else { "#b91c1c" };
    format!(
        "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><title>{title}</title></head><body style=\"margin:0;font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0;display:grid;place-items:center;min-height:100vh\"><main style=\"max-width:32rem;padding:2rem\"><div style=\"border:1px solid rgba(148,163,184,.25);background:rgba(15,23,42,.84);border-radius:24px;padding:2rem;box-shadow:0 24px 80px rgba(15,23,42,.45)\"><div style=\"display:inline-flex;padding:.5rem .75rem;border-radius:999px;background:{accent};color:white;font-size:.8rem;font-weight:600\">en-learner</div><h1 style=\"font-size:1.9rem;line-height:1.1;margin:1rem 0 .75rem\">{title}</h1><p style=\"margin:0;color:#94a3b8;font-size:1rem;line-height:1.6\">{message}</p></div></main></body></html>"
    )
}

#[cfg(test)]
mod tests {
    use super::{normalize_display_name, normalize_email, validate_password};

    #[test]
    fn email_is_normalized_to_lowercase() {
        let email = normalize_email("  USER@Example.com ").expect("normalized email");
        assert_eq!(email, "user@example.com");
    }

    #[test]
    fn display_name_must_not_be_empty() {
        let error = normalize_display_name("   ").expect_err("should reject empty names");
        assert!(error.to_string().contains("Display name cannot be empty"));
    }

    #[test]
    fn password_must_have_minimum_length() {
        let error = validate_password("1234567").expect_err("should reject short password");
        assert!(error
            .to_string()
            .contains("Password must be at least 8 characters"));
    }
}
