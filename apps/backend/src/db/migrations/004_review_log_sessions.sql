ALTER TABLE review_logs ADD COLUMN session_id TEXT;

CREATE INDEX IF NOT EXISTS idx_review_logs_session_id ON review_logs(session_id);
