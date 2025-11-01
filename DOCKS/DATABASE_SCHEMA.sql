-- FLM - データベーススキーマ定義
-- 
-- プロジェクト名: FLM
-- バージョン: 1.0.0
-- 作成日: 2024年
-- 作成者: アーキテクトエージェント (ARCH) / データベースエージェント (DB)
-- データベース: SQLite 3.x
--
-- このスキーマは Rust (rusqlite) で実装されます。

-- ============================================================================
-- テーブル定義
-- ============================================================================

-- ----------------------------------------------------------------------------
-- APIs テーブル: API設定情報
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS apis (
    id TEXT PRIMARY KEY,                    -- UUID (v4)
    name TEXT NOT NULL,                     -- API名
    model TEXT NOT NULL,                    -- 使用モデル名
    port INTEGER NOT NULL,                  -- ポート番号
    enable_auth INTEGER NOT NULL DEFAULT 1, -- 認証有効化フラグ (0/1)
    status TEXT NOT NULL DEFAULT 'stopped', -- ステータス: 'running' | 'stopped'
    created_at TEXT NOT NULL,               -- 作成日時 (ISO 8601)
    updated_at TEXT NOT NULL,               -- 更新日時 (ISO 8601)
    UNIQUE(port)                            -- ポート番号は一意
);

CREATE INDEX IF NOT EXISTS idx_apis_status ON apis(status);
CREATE INDEX IF NOT EXISTS idx_apis_created_at ON apis(created_at);

-- ----------------------------------------------------------------------------
-- API Keys テーブル: APIキー情報（暗号化保存）
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,                    -- UUID (v4)
    api_id TEXT NOT NULL,                   -- APIs.id への外部キー
    key_hash TEXT NOT NULL,                 -- 暗号化されたAPIキー
    encrypted_key BLOB NOT NULL,            -- 暗号化データ (AES-256-GCM)
    created_at TEXT NOT NULL,               -- 作成日時 (ISO 8601)
    updated_at TEXT NOT NULL,               -- 更新日時 (ISO 8601)
    FOREIGN KEY (api_id) REFERENCES apis(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_api_keys_api_id ON api_keys(api_id);

-- ----------------------------------------------------------------------------
-- Models Catalog テーブル: モデルカタログ情報（キャッシュ）
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS models_catalog (
    name TEXT PRIMARY KEY,                  -- モデル名 (例: "llama3")
    description TEXT,                        -- モデル説明
    size INTEGER,                          -- サイズ (バイト)
    parameters INTEGER,                     -- パラメータ数 (例: 8000000000)
    category TEXT,                          -- カテゴリ (例: "chat", "code", "translation")
    recommended INTEGER DEFAULT 0,           -- 推奨モデルフラグ (0/1)
    author TEXT,                            -- 作成者/提供者
    license TEXT,                           -- ライセンス情報
    tags TEXT,                              -- タグ (JSON配列文字列)
    created_at TEXT NOT NULL,               -- 作成日時 (ISO 8601)
    updated_at TEXT NOT NULL                -- 更新日時 (ISO 8601)
);

CREATE INDEX IF NOT EXISTS idx_models_catalog_category ON models_catalog(category);
CREATE INDEX IF NOT EXISTS idx_models_catalog_recommended ON models_catalog(recommended);

-- ----------------------------------------------------------------------------
-- Installed Models テーブル: インストール済みモデル情報
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS installed_models (
    name TEXT PRIMARY KEY,                  -- モデル名
    size INTEGER NOT NULL,                  -- サイズ (バイト)
    parameters INTEGER,                     -- パラメータ数
    installed_at TEXT NOT NULL,             -- インストール日時 (ISO 8601)
    last_used_at TEXT,                     -- 最終使用日時 (ISO 8601)
    usage_count INTEGER DEFAULT 0          -- 使用回数
);

CREATE INDEX IF NOT EXISTS idx_installed_models_last_used ON installed_models(last_used_at);
CREATE INDEX IF NOT EXISTS idx_installed_models_usage_count ON installed_models(usage_count);

-- ----------------------------------------------------------------------------
-- User Settings テーブル: ユーザー設定
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_settings (
    key TEXT PRIMARY KEY,                   -- 設定キー
    value TEXT NOT NULL,                    -- 設定値 (JSON文字列)
    updated_at TEXT NOT NULL                -- 更新日時 (ISO 8601)
);

-- ----------------------------------------------------------------------------
-- Request Logs テーブル: APIリクエストログ（F006の基盤）
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS request_logs (
    id TEXT PRIMARY KEY,                    -- UUID (v4)
    api_id TEXT NOT NULL,                   -- APIs.id への外部キー
    method TEXT NOT NULL,                   -- HTTPメソッド (GET, POST等)
    path TEXT NOT NULL,                     -- リクエストパス
    request_body TEXT,                      -- リクエストボディ (JSON文字列、大きい場合はNULL)
    response_status INTEGER,                -- HTTPステータスコード
    response_time_ms INTEGER,               -- レスポンス時間（ミリ秒）
    error_message TEXT,                     -- エラーメッセージ（エラー発生時）
    created_at TEXT NOT NULL,               -- リクエスト受信日時 (ISO 8601)
    FOREIGN KEY (api_id) REFERENCES apis(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_request_logs_api_id ON request_logs(api_id);
CREATE INDEX IF NOT EXISTS idx_request_logs_created_at ON request_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_request_logs_api_created ON request_logs(api_id, created_at);

-- ============================================================================
-- デフォルト設定値
-- ============================================================================

INSERT OR IGNORE INTO user_settings (key, value, updated_at) VALUES
    ('ollama_path', '', datetime('now')),
    ('default_port', '8080', datetime('now')),
    ('auto_start_ollama', 'true', datetime('now')),
    ('theme', 'light', datetime('now'));

-- ============================================================================
-- ビュー定義
-- ============================================================================

-- API情報とAPIキーの結合ビュー（読み取り専用）
CREATE VIEW IF NOT EXISTS api_details AS
SELECT 
    a.id,
    a.name,
    a.model,
    a.port,
    a.enable_auth,
    a.status,
    a.created_at,
    a.updated_at,
    ak.id AS key_id,
    ak.created_at AS key_created_at
FROM apis a
LEFT JOIN api_keys ak ON a.id = ak.api_id;

-- ============================================================================
-- マイグレーション履歴テーブル
-- ============================================================================

CREATE TABLE IF NOT EXISTS migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL                -- 適用日時 (ISO 8601)
);

-- ============================================================================
-- サンプルデータ（開発用・本番環境では使用しない）
-- ============================================================================

-- 開発環境でのみ使用するサンプルデータ
-- 本番環境では削除すること

-- ============================================================================
-- コメント
-- ============================================================================

-- 注意事項:
-- 1. 暗号化: api_keys.encrypted_key は AES-256-GCM で暗号化
-- 2. タイムゾーン: 全ての日時は UTC (ISO 8601形式) で保存
-- 3. 外部キー制約: SQLiteでは外部キー制約はデフォルトで無効
--    有効化するには: PRAGMA foreign_keys = ON;
-- 4. トランザクション: 全ての書き込み操作はトランザクション内で実行




