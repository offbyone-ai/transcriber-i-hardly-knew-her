-- Server transcription usage tracking
-- PRIVACY NOTE: We only store usage metadata for rate limiting
-- We do NOT store any audio content or transcription text

CREATE TABLE IF NOT EXISTS server_transcription_usage (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  model_used TEXT NOT NULL DEFAULT 'base.en',
  processing_time_ms INTEGER NOT NULL DEFAULT 0,
  audio_length_seconds REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  
  FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);

-- Index for efficient monthly usage queries
CREATE INDEX IF NOT EXISTS idx_usage_user_created 
ON server_transcription_usage(user_id, created_at);

-- Add is_premium column to user table for future premium tiers
ALTER TABLE user ADD COLUMN is_premium INTEGER DEFAULT 0;
