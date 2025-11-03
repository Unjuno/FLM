// Database Schema Module
// データベースエージェント実装
// SQLiteスキーマの作成と管理を行います

use rusqlite::{Connection, params};
use crate::database::DatabaseError;

/// データベーススキーマを作成
/// DATABASE_SCHEMA.sqlに基づいて全てのテーブル、インデックス、ビューを作成します
pub fn create_schema(conn: &Connection) -> Result<(), DatabaseError> {
    // APIs テーブル
    conn.execute(
        r#"
        CREATE TABLE IF NOT EXISTS apis (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            model TEXT NOT NULL,
            port INTEGER NOT NULL,
            enable_auth INTEGER NOT NULL DEFAULT 1,
            status TEXT NOT NULL DEFAULT 'stopped',
            engine_type TEXT NOT NULL DEFAULT 'ollama',
            engine_config TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            CHECK (port > 0 AND port < 65536),
            CHECK (status IN ('running', 'stopped', 'error')),
            UNIQUE(port)
        )
        "#,
        [],
    )?;
    
    // APIs テーブルのインデックス
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_apis_status ON apis(status)",
        [],
    )?;
    
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_apis_created_at ON apis(created_at)",
        [],
    )?;
    
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_apis_engine_type ON apis(engine_type)",
        [],
    )?;
    
    // API Keys テーブル
    conn.execute(
        r#"
        CREATE TABLE IF NOT EXISTS api_keys (
            id TEXT PRIMARY KEY,
            api_id TEXT NOT NULL,
            key_hash TEXT NOT NULL,
            encrypted_key BLOB NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (api_id) REFERENCES apis(id) ON DELETE CASCADE
        )
        "#,
        [],
    )?;
    
    // API Keys テーブルのインデックス
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_api_keys_api_id ON api_keys(api_id)",
        [],
    )?;
    
    // Models Catalog テーブル
    conn.execute(
        r#"
        CREATE TABLE IF NOT EXISTS models_catalog (
            name TEXT PRIMARY KEY,
            description TEXT,
            size INTEGER,
            parameters INTEGER,
            category TEXT,
            recommended INTEGER DEFAULT 0,
            author TEXT,
            license TEXT,
            tags TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            CHECK (category IN ('chat', 'code', 'translation', 'summarization', 'qa', 'other') OR category IS NULL)
        )
        "#,
        [],
    )?;
    
    // Models Catalog テーブルのインデックス
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_models_catalog_category ON models_catalog(category)",
        [],
    )?;
    
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_models_catalog_recommended ON models_catalog(recommended)",
        [],
    )?;
    
    // Installed Models テーブル
    conn.execute(
        r#"
        CREATE TABLE IF NOT EXISTS installed_models (
            name TEXT PRIMARY KEY,
            size INTEGER NOT NULL,
            parameters INTEGER,
            installed_at TEXT NOT NULL,
            last_used_at TEXT,
            usage_count INTEGER DEFAULT 0,
            CHECK (usage_count >= 0)
        )
        "#,
        [],
    )?;
    
    // Installed Models テーブルのインデックス
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_installed_models_last_used ON installed_models(last_used_at)",
        [],
    )?;
    
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_installed_models_usage_count ON installed_models(usage_count)",
        [],
    )?;
    
    // User Settings テーブル
    conn.execute(
        r#"
        CREATE TABLE IF NOT EXISTS user_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        "#,
        [],
    )?;
    
    // Request Logs テーブル（F006の基盤）
    conn.execute(
        r#"
        CREATE TABLE IF NOT EXISTS request_logs (
            id TEXT PRIMARY KEY,
            api_id TEXT NOT NULL,
            method TEXT NOT NULL,
            path TEXT NOT NULL,
            request_body TEXT,
            response_status INTEGER,
            response_time_ms INTEGER,
            error_message TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (api_id) REFERENCES apis(id) ON DELETE CASCADE
        )
        "#,
        [],
    )?;
    
    // Request Logs テーブルのインデックス
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_request_logs_api_id ON request_logs(api_id)",
        [],
    )?;
    
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_request_logs_created_at ON request_logs(created_at)",
        [],
    )?;
    
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_request_logs_api_created ON request_logs(api_id, created_at)",
        [],
    )?;
    
    // フィルタ機能で使用されるインデックス（BE-006-03で追加）
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_request_logs_response_status ON request_logs(response_status)",
        [],
    )?;
    
    // パス検索用のインデックス（LIKE検索では限定的だが、存在することでクエリプランナーの選択肢が増える）
    // 注意: LIKE '%pattern%'では通常インデックスは使用されないが、前方一致の場合に有効
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_request_logs_path ON request_logs(path)",
        [],
    )?;
    
    // Performance Metrics テーブル（F007の基盤）
    conn.execute(
        r#"
        CREATE TABLE IF NOT EXISTS performance_metrics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            api_id TEXT NOT NULL,
            metric_type TEXT NOT NULL,
            value REAL NOT NULL,
            timestamp TEXT NOT NULL,
            FOREIGN KEY (api_id) REFERENCES apis(id) ON DELETE CASCADE
        )
        "#,
        [],
    )?;
    
    // Performance Metrics テーブルのインデックス
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_performance_metrics_api_id ON performance_metrics(api_id)",
        [],
    )?;
    
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_performance_metrics_timestamp ON performance_metrics(timestamp)",
        [],
    )?;
    
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_performance_metrics_api_type_timestamp ON performance_metrics(api_id, metric_type, timestamp)",
        [],
    )?;
    
    // Alert History テーブル（F012の基盤）
    conn.execute(
        r#"
        CREATE TABLE IF NOT EXISTS alert_history (
            id TEXT PRIMARY KEY,
            api_id TEXT NOT NULL,
            alert_type TEXT NOT NULL,
            current_value REAL NOT NULL,
            threshold REAL NOT NULL,
            message TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            resolved_at TEXT,
            FOREIGN KEY (api_id) REFERENCES apis(id) ON DELETE CASCADE,
            CHECK (alert_type IN ('response_time', 'error_rate', 'cpu_usage', 'memory_usage'))
        )
        "#,
        [],
    )?;
    
    // Alert History テーブルのインデックス
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_alert_history_api_id ON alert_history(api_id)",
        [],
    )?;
    
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_alert_history_timestamp ON alert_history(timestamp)",
        [],
    )?;
    
    // Engine Configs テーブル（マルチエンジン対応）
    conn.execute(
        r#"
        CREATE TABLE IF NOT EXISTS engine_configs (
            id TEXT PRIMARY KEY,
            engine_type TEXT NOT NULL,
            name TEXT NOT NULL,
            base_url TEXT NOT NULL,
            auto_detect INTEGER DEFAULT 1,
            executable_path TEXT,
            is_default INTEGER DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        "#,
        [],
    )?;
    
    // Engine Configs テーブルのインデックス
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_engine_configs_type ON engine_configs(engine_type)",
        [],
    )?;
    
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_engine_configs_default ON engine_configs(is_default)",
        [],
    )?;
    
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_alert_history_api_timestamp ON alert_history(api_id, timestamp)",
        [],
    )?;
    
    // Migrations テーブル
    conn.execute(
        r#"
        CREATE TABLE IF NOT EXISTS migrations (
            version INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            applied_at TEXT NOT NULL
        )
        "#,
        [],
    )?;
    
    // API Details ビュー（読み取り専用）
    conn.execute(
        r#"
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
        LEFT JOIN api_keys ak ON a.id = ak.api_id
        "#,
        [],
    )?;
    
    // デフォルト設定値を挿入
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        r#"
        INSERT OR IGNORE INTO user_settings (key, value, updated_at) VALUES
            ('ollama_path', '', ?1),
            ('default_port', '8080', ?1),
            ('auto_start_ollama', 'true', ?1),
            ('theme', 'light', ?1)
        "#,
        params![now],
    )?;
    
    Ok(())
}

/// スキーマバージョンを取得
/// 将来のマイグレーション管理で使用される可能性があるため保持
#[allow(dead_code)]
pub fn get_schema_version(conn: &Connection) -> Result<i32, DatabaseError> {
    // マイグレーションテーブルが存在するか確認
    let table_exists: bool = conn
        .query_row(
            r#"
            SELECT EXISTS (
                SELECT 1 FROM sqlite_master 
                WHERE type='table' AND name='migrations'
            )
            "#,
            [],
            |row| row.get(0),
        )
        .unwrap_or(false);
    
    if !table_exists {
        return Ok(0);
    }
    
    // 最新のマイグレーション番号を取得
    let version: i32 = conn
        .query_row(
            "SELECT COALESCE(MAX(version), 0) FROM migrations",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);
    
    Ok(version)
}