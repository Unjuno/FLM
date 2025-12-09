-- Migration: Add engine_health_logs table for UI Extensions
-- Date: 2025-02-01
-- Purpose: Store engine health history for model comparison dashboard

CREATE TABLE IF NOT EXISTS engine_health_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    engine_id TEXT NOT NULL,
    model_id TEXT,
    status TEXT NOT NULL,
    latency_ms INTEGER,
    error_rate REAL DEFAULT 0.0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for efficient queries by engine_id and created_at
CREATE INDEX IF NOT EXISTS idx_engine_health_logs_engine_id ON engine_health_logs(engine_id);
CREATE INDEX IF NOT EXISTS idx_engine_health_logs_model_id ON engine_health_logs(model_id);
CREATE INDEX IF NOT EXISTS idx_engine_health_logs_created_at ON engine_health_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_engine_health_logs_engine_created ON engine_health_logs(engine_id, created_at);

-- Index for model comparison queries
CREATE INDEX IF NOT EXISTS idx_engine_health_logs_model_created ON engine_health_logs(model_id, created_at);

