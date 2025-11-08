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
    
    // Error Logs テーブル（エラーログ永続化）
    conn.execute(
        r#"
        CREATE TABLE IF NOT EXISTS error_logs (
            id TEXT PRIMARY KEY,
            error_category TEXT NOT NULL,
            error_message TEXT NOT NULL,
            error_stack TEXT,
            context TEXT,
            source TEXT,
            api_id TEXT,
            user_agent TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (api_id) REFERENCES apis(id) ON DELETE SET NULL
        )
        "#,
        [],
    )?;
    
    // Error Logs テーブルのインデックス
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_error_logs_category ON error_logs(error_category)",
        [],
    )?;
    
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs(created_at)",
        [],
    )?;
    
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_error_logs_api_id ON error_logs(api_id)",
        [],
    )?;
    
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_error_logs_category_created ON error_logs(error_category, created_at)",
        [],
    )?;
    
    // API Security Settings テーブル（セキュリティ強化機能）
    conn.execute(
        r#"
        CREATE TABLE IF NOT EXISTS api_security_settings (
            api_id TEXT PRIMARY KEY,
            ip_whitelist TEXT,  -- JSON配列形式: ["192.168.1.1", "10.0.0.0/8"]
            rate_limit_enabled INTEGER DEFAULT 0,
            rate_limit_requests INTEGER DEFAULT 100,  -- リクエスト数
            rate_limit_window_seconds INTEGER DEFAULT 60,  -- 時間窓（秒）
            key_rotation_enabled INTEGER DEFAULT 0,
            key_rotation_interval_days INTEGER DEFAULT 30,  -- ローテーション間隔（日）
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (api_id) REFERENCES apis(id) ON DELETE CASCADE
        )
        "#,
        [],
    )?;
    
    // API Security Settings テーブルのインデックス
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_api_security_settings_api_id ON api_security_settings(api_id)",
        [],
    )?;
    
    // Rate Limit Tracking テーブル（レート制限の追跡用）
    conn.execute(
        r#"
        CREATE TABLE IF NOT EXISTS rate_limit_tracking (
            id TEXT PRIMARY KEY,
            api_id TEXT NOT NULL,
            identifier TEXT NOT NULL,  -- APIキーハッシュまたはIPアドレス
            request_count INTEGER DEFAULT 1,
            window_start TEXT NOT NULL,  -- 時間窓の開始時刻 (ISO 8601)
            created_at TEXT NOT NULL,
            FOREIGN KEY (api_id) REFERENCES apis(id) ON DELETE CASCADE,
            UNIQUE(api_id, identifier, window_start)
        )
        "#,
        [],
    )?;
    
    // Rate Limit Tracking テーブルのインデックス
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_rate_limit_tracking_api_id ON rate_limit_tracking(api_id)",
        [],
    )?;
    
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_rate_limit_tracking_identifier ON rate_limit_tracking(identifier)",
        [],
    )?;
    
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_rate_limit_tracking_window ON rate_limit_tracking(api_id, identifier, window_start)",
        [],
    )?;
    
    // OAuth2 Tokens テーブル（v2.0: OAuth2認証対応）
    conn.execute(
        r#"
        CREATE TABLE IF NOT EXISTS oauth_tokens (
            id TEXT PRIMARY KEY,
            api_id TEXT NOT NULL,
            access_token TEXT NOT NULL,
            refresh_token TEXT,
            token_type TEXT NOT NULL DEFAULT 'Bearer',
            expires_at TEXT,
            scope TEXT,  -- JSON配列形式: ["read", "write"]
            client_id TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (api_id) REFERENCES apis(id) ON DELETE CASCADE
        )
        "#,
        [],
    )?;
    
    // OAuth2 Tokens テーブルのインデックス
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_oauth_tokens_api_id ON oauth_tokens(api_id)",
        [],
    )?;
    
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_oauth_tokens_access_token ON oauth_tokens(access_token)",
        [],
    )?;
    
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_oauth_tokens_expires_at ON oauth_tokens(expires_at)",
        [],
    )?;


    // Audit Logs テーブル（v2.0: 監査ログ機能）
    conn.execute(
        r#"
        CREATE TABLE IF NOT EXISTS audit_logs (
            id TEXT PRIMARY KEY,
            api_id TEXT NOT NULL,
            user_id TEXT,
            action TEXT NOT NULL,
            resource_type TEXT NOT NULL,
            resource_id TEXT,
            details TEXT,  -- JSON形式で詳細情報を保存
            ip_address TEXT,
            user_agent TEXT,
            timestamp TEXT NOT NULL,
            success INTEGER NOT NULL DEFAULT 1,
            FOREIGN KEY (api_id) REFERENCES apis(id) ON DELETE CASCADE
        )
        "#,
        [],
    )?;

    // Audit Logs テーブルのインデックス
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_audit_logs_api_id ON audit_logs(api_id)",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id)",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action)",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp)",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_audit_logs_api_timestamp ON audit_logs(api_id, timestamp)",
        [],
    )?;

    // Plugins テーブル（v2.0: プラグインアーキテクチャ）
    conn.execute(
        r#"
        CREATE TABLE IF NOT EXISTS plugins (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            version TEXT NOT NULL,
            author TEXT NOT NULL,
            description TEXT,
            enabled INTEGER NOT NULL DEFAULT 1,
            plugin_type TEXT NOT NULL,
            library_path TEXT,  -- 動的ライブラリのパス（.dylib, .so, .dll）
            permissions TEXT,  -- JSON形式でプラグインの権限を保存
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            CHECK (plugin_type IN ('engine', 'model', 'auth', 'logging', 'custom'))
        )
        "#,
        [],
    )?;
    
    // 既存のテーブルにpermissionsカラムを追加（マイグレーション）
    let _ = conn.execute(
        "ALTER TABLE plugins ADD COLUMN permissions TEXT",
        [],
    );

    // Plugins テーブルのインデックス
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_plugins_enabled ON plugins(enabled)",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_plugins_type ON plugins(plugin_type)",
        [],
    )?;

    // Shared Models テーブル（モデル共有機能）
    conn.execute(
        r#"
        CREATE TABLE IF NOT EXISTS shared_models (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            author TEXT NOT NULL,
            description TEXT,
            tags TEXT,  -- JSON形式で保存
            download_count INTEGER NOT NULL DEFAULT 0,
            rating REAL,
            model_path TEXT,
            platform TEXT,  -- 'local', 'huggingface', 'ollama'
            platform_model_id TEXT,  -- プラットフォーム固有のモデルID
            license TEXT,
            is_public INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        "#,
        [],
    )?;

    // Shared Models テーブルのインデックス
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_shared_models_platform ON shared_models(platform)",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_shared_models_author ON shared_models(author)",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_shared_models_created_at ON shared_models(created_at)",
        [],
    )?;


    // Comments テーブル
    conn.execute(
        r#"
        CREATE TABLE IF NOT EXISTS comments (
            id TEXT PRIMARY KEY,
            api_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            content TEXT NOT NULL,
            parent_comment_id TEXT,  -- 返信の場合、親コメントのID
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (api_id) REFERENCES apis(id) ON DELETE CASCADE,
            FOREIGN KEY (parent_comment_id) REFERENCES comments(id) ON DELETE CASCADE
        )
        "#,
        [],
    )?;

    // Comments テーブルのインデックス
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_comments_api_id ON comments(api_id)",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id)",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_comment_id)",
        [],
    )?;

    // Annotations テーブル
    conn.execute(
        r#"
        CREATE TABLE IF NOT EXISTS annotations (
            id TEXT PRIMARY KEY,
            api_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            annotation_type TEXT NOT NULL,
            content TEXT NOT NULL,
            position TEXT,  -- JSON形式で位置情報を保存
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (api_id) REFERENCES apis(id) ON DELETE CASCADE,
            CHECK (annotation_type IN ('note', 'warning', 'suggestion', 'bug'))
        )
        "#,
        [],
    )?;

    // Annotations テーブルのインデックス
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_annotations_api_id ON annotations(api_id)",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_annotations_user_id ON annotations(user_id)",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_annotations_type ON annotations(annotation_type)",
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
