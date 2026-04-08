-- Core word storage

CREATE TABLE IF NOT EXISTS words (
    id          TEXT PRIMARY KEY,
    word        TEXT NOT NULL,
    source      TEXT NOT NULL DEFAULT 'dictionaryapi.dev',
    created_at  TEXT NOT NULL DEFAULT to_char(timezone('UTC', now()), 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    updated_at  TEXT NOT NULL DEFAULT to_char(timezone('UTC', now()), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_words_word_lower ON words(LOWER(word));

CREATE TABLE IF NOT EXISTS phonetics (
    id        TEXT PRIMARY KEY,
    word_id   TEXT NOT NULL REFERENCES words(id) ON DELETE CASCADE,
    text      TEXT,
    audio_url TEXT
);

CREATE INDEX IF NOT EXISTS idx_phonetics_word_id ON phonetics(word_id);

CREATE TABLE IF NOT EXISTS meanings (
    id             TEXT PRIMARY KEY,
    word_id        TEXT NOT NULL REFERENCES words(id) ON DELETE CASCADE,
    part_of_speech TEXT NOT NULL,
    position       INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_meanings_word_id ON meanings(word_id);

CREATE TABLE IF NOT EXISTS definitions (
    id          TEXT PRIMARY KEY,
    meaning_id  TEXT NOT NULL REFERENCES meanings(id) ON DELETE CASCADE,
    definition  TEXT NOT NULL,
    example     TEXT,
    position    INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_definitions_meaning_id ON definitions(meaning_id);

CREATE TABLE IF NOT EXISTS definition_synonyms (
    definition_id TEXT NOT NULL REFERENCES definitions(id) ON DELETE CASCADE,
    synonym       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS definition_antonyms (
    definition_id TEXT NOT NULL REFERENCES definitions(id) ON DELETE CASCADE,
    antonym       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS translations (
    id          TEXT PRIMARY KEY,
    word_id     TEXT NOT NULL REFERENCES words(id) ON DELETE CASCADE,
    target_lang TEXT NOT NULL,
    text        TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT to_char(timezone('UTC', now()), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_translations_word_lang
    ON translations(word_id, target_lang);

CREATE TABLE IF NOT EXISTS cached_responses (
    cache_key   TEXT PRIMARY KEY,
    body        TEXT NOT NULL,
    cached_at   TEXT NOT NULL DEFAULT to_char(timezone('UTC', now()), 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    expires_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS saved_words (
    word_id    TEXT PRIMARY KEY REFERENCES words(id) ON DELETE CASCADE,
    saved_at   TEXT NOT NULL DEFAULT to_char(timezone('UTC', now()), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
);

CREATE TABLE IF NOT EXISTS favorites (
    word_id      TEXT PRIMARY KEY REFERENCES words(id) ON DELETE CASCADE,
    favorited_at TEXT NOT NULL DEFAULT to_char(timezone('UTC', now()), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
);

CREATE TABLE IF NOT EXISTS study_sets (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT,
    created_at  TEXT NOT NULL DEFAULT to_char(timezone('UTC', now()), 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    updated_at  TEXT NOT NULL DEFAULT to_char(timezone('UTC', now()), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
);

CREATE TABLE IF NOT EXISTS study_set_words (
    set_id   TEXT NOT NULL REFERENCES study_sets(id) ON DELETE CASCADE,
    word_id  TEXT NOT NULL REFERENCES words(id) ON DELETE CASCADE,
    added_at TEXT NOT NULL DEFAULT to_char(timezone('UTC', now()), 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    PRIMARY KEY (set_id, word_id)
);

CREATE TABLE IF NOT EXISTS search_history (
    id          TEXT PRIMARY KEY,
    query       TEXT NOT NULL,
    word_id     TEXT REFERENCES words(id) ON DELETE SET NULL,
    searched_at TEXT NOT NULL DEFAULT to_char(timezone('UTC', now()), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
);

CREATE INDEX IF NOT EXISTS idx_search_history_searched_at
    ON search_history(searched_at DESC);

CREATE TABLE IF NOT EXISTS app_settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

INSERT INTO app_settings (key, value) VALUES
    ('dark_mode', 'false'),
    ('daily_review_limit', '100'),
    ('new_cards_per_day', '20'),
    ('audio_autoplay', 'false'),
    ('show_translation_immediately', 'false'),
    ('ui_language', 'en')
ON CONFLICT (key) DO NOTHING;
