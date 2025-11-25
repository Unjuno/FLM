-- Migration: add model_profiles and api_prompts tables
-- See docs/specs/DB_SCHEMA.md section 7

CREATE TABLE IF NOT EXISTS model_profiles (
    id TEXT PRIMARY KEY,
    engine_id TEXT NOT NULL,
    model_id TEXT NOT NULL,
    label TEXT NOT NULL,
    parameters_json TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_model_profiles_engine_model
    ON model_profiles(engine_id, model_id);
CREATE INDEX IF NOT EXISTS idx_model_profiles_label
    ON model_profiles(label);

CREATE TABLE IF NOT EXISTS api_prompts (
    api_id TEXT PRIMARY KEY,
    template_text TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);


