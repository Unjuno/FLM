-- Migration: Create config.db schema
-- See docs/DB_SCHEMA.md section 2

-- Settings table
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    notes TEXT
);

-- Engines cache table
CREATE TABLE IF NOT EXISTS engines_cache (
    engine_id TEXT PRIMARY KEY,
    state_json TEXT NOT NULL,
    cached_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Proxy profiles table
CREATE TABLE IF NOT EXISTS proxy_profiles (
    id TEXT PRIMARY KEY,
    config_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_engines_cache_cached_at ON engines_cache(cached_at);
CREATE INDEX IF NOT EXISTS idx_proxy_profiles_created_at ON proxy_profiles(created_at);

