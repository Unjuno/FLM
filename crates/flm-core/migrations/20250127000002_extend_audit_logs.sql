-- Migration: Extend audit_logs table for botnet protection
-- See docs/planning/BOTNET_PROTECTION_IMPLEMENTATION_PLAN.md section 2.5
-- Date: 2025-01-27

-- Add new columns to audit_logs table
-- Note: SQLite doesn't support ALTER TABLE ADD COLUMN IF NOT EXISTS,
-- so we check if columns exist by attempting to add them and ignoring errors
-- In practice, we'll use a more robust approach: check schema version or use application-level checks

-- Add event_type column (if not exists)
-- We'll use a safe approach: try to add, ignore if already exists
-- For SQLite, we need to check pragma table_info or use a different approach
-- Since SQLite doesn't support IF NOT EXISTS for ALTER TABLE ADD COLUMN,
-- we'll handle this in application code or use a version check

-- For now, we'll create a new migration that adds columns if they don't exist
-- This is done by checking the schema version or using a more complex approach

-- Add event_type column
-- SQLite doesn't support IF NOT EXISTS for ALTER TABLE, so we'll use a workaround
-- We'll check if the column exists in application code before adding

ALTER TABLE audit_logs ADD COLUMN event_type TEXT;
ALTER TABLE audit_logs ADD COLUMN severity TEXT NOT NULL DEFAULT 'low';
ALTER TABLE audit_logs ADD COLUMN ip TEXT;
ALTER TABLE audit_logs ADD COLUMN details TEXT;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON audit_logs(severity, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_ip ON audit_logs(ip, created_at);

