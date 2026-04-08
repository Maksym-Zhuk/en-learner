CREATE TABLE IF NOT EXISTS users (
    id           TEXT PRIMARY KEY,
    email        TEXT UNIQUE,
    display_name TEXT NOT NULL,
    provider     TEXT NOT NULL DEFAULT 'password',
    created_at   TEXT NOT NULL DEFAULT to_char(timezone('UTC', now()), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
);

CREATE TABLE IF NOT EXISTS user_passwords (
    user_id       TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    password_hash TEXT NOT NULL,
    updated_at    TEXT NOT NULL DEFAULT to_char(timezone('UTC', now()), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
);

CREATE TABLE IF NOT EXISTS auth_sessions (
    token      TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT to_char(timezone('UTC', now()), 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    expires_at TEXT NOT NULL,
    revoked_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id
    ON auth_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at
    ON auth_sessions(expires_at);

CREATE TABLE IF NOT EXISTS oauth_identities (
    provider         TEXT NOT NULL,
    provider_user_id TEXT NOT NULL,
    user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email            TEXT,
    display_name     TEXT,
    created_at       TEXT NOT NULL DEFAULT to_char(timezone('UTC', now()), 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    PRIMARY KEY (provider, provider_user_id)
);

CREATE INDEX IF NOT EXISTS idx_oauth_identities_user_id
    ON oauth_identities(user_id);

CREATE TABLE IF NOT EXISTS oauth_states (
    state         TEXT PRIMARY KEY,
    provider      TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT to_char(timezone('UTC', now()), 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    expires_at    TEXT NOT NULL,
    completed_at  TEXT,
    error         TEXT,
    session_token TEXT REFERENCES auth_sessions(token) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_oauth_states_expires_at
    ON oauth_states(expires_at);
