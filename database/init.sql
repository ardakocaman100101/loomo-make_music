-- ============================================================================
-- loomo PostgreSQL Database Initialization Schema
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(64) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Songs Table (Lean metadata & file paths; raw note buffers kept on disk/cache)
CREATE TABLE IF NOT EXISTS songs (
  id VARCHAR(255) PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  artist VARCHAR(255),
  source VARCHAR(32) DEFAULT 'local',
  duration REAL DEFAULT 0,
  bpm REAL DEFAULT 120,
  file_path TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Song Tracks Table
CREATE TABLE IF NOT EXISTS song_tracks (
  id SERIAL PRIMARY KEY,
  song_id VARCHAR(255) NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  track_index INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  instrument VARCHAR(128) DEFAULT 'acoustic_grand_piano',
  program INT DEFAULT 0,
  hand VARCHAR(16) DEFAULT 'none',
  CONSTRAINT uq_song_track UNIQUE (song_id, track_index)
);

-- 4. Song Tags Table (Max 25 chars per tag)
CREATE TABLE IF NOT EXISTS song_tags (
  id SERIAL PRIMARY KEY,
  song_id VARCHAR(255) NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  tag VARCHAR(25) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT uq_song_tag UNIQUE (song_id, tag)
);

-- 5. Practice Sessions Telemetry Table
CREATE TABLE IF NOT EXISTS practice_sessions (
  id VARCHAR(255) PRIMARY KEY,
  song_id VARCHAR(255) NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  timestamp BIGINT NOT NULL,
  total_score INT DEFAULT 0,
  accuracy REAL DEFAULT 0,
  streak_max INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Session Hit Metrics Table (Hit timing telemetry)
CREATE TABLE IF NOT EXISTS session_hit_metrics (
  session_id VARCHAR(255) PRIMARY KEY REFERENCES practice_sessions(id) ON DELETE CASCADE,
  perfect INT DEFAULT 0,
  early INT DEFAULT 0,
  late INT DEFAULT 0,
  missed INT DEFAULT 0,
  error INT DEFAULT 0
);

-- 7. Session Duration Metrics Table (Hold accuracy telemetry)
CREATE TABLE IF NOT EXISTS session_duration_metrics (
  session_id VARCHAR(255) PRIMARY KEY REFERENCES practice_sessions(id) ON DELETE CASCADE,
  duration_held INT DEFAULT 0,
  average_duration_score REAL DEFAULT 0
);

-- Indexes for performance & quick lookups
CREATE INDEX IF NOT EXISTS idx_songs_user_id ON songs(user_id);
CREATE INDEX IF NOT EXISTS idx_song_tracks_song_id ON song_tracks(song_id);
CREATE INDEX IF NOT EXISTS idx_song_tags_tag ON song_tags(tag);
CREATE INDEX IF NOT EXISTS idx_song_tags_song_id ON song_tags(song_id);
CREATE INDEX IF NOT EXISTS idx_practice_sessions_song_id ON practice_sessions(song_id);
CREATE INDEX IF NOT EXISTS idx_practice_sessions_timestamp ON practice_sessions(timestamp DESC);
