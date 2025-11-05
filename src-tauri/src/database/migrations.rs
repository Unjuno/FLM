// Database Migrations Module
// データベースマイグレーション管理

use rusqlite::Connection;
use crate::database::{DatabaseError, models::Migration};
use chrono::Utc;

/// マイグレーションのバージョン番号
#[allow(dead_code)] // 将来の検証機能で使用予定
const CURRENT_VERSION: i32 = 2;

/// 全てのマイグレーションを実行
pub fn run_migrations(conn: &mut Connection) -> Result<(), DatabaseError> {
    // 現在のマイグレーションバージョンを取得
    let current_version = get_current_version(conn)?;
    
    // 未適用のマイグレーションを実行
    if current_version < 1 {
        apply_migration(conn, 1, "initial_schema", |conn_ref| {
            // 初回スキーマは既にschema.rsで作成済み
            // ここでは追加のマイグレーション処理があれば記述
            let _ = conn_ref; // 未使用警告を回避
            Ok(())
        })?;
    }
    
    // エンジン対応のマイグレーション（バージョン2）
    if current_version < 2 {
        apply_migration(conn, 2, "add_engine_support", |conn_ref| {
            add_engine_support(conn_ref)
        })?;
    }
    
    Ok(())
}

/// エンジン対応のマイグレーション
fn add_engine_support(tx: &mut rusqlite::Transaction) -> Result<(), DatabaseError> {
    // APIsテーブルにengine_typeカラムを追加（既に存在する場合はエラーを無視）
    tx.execute(
        "ALTER TABLE apis ADD COLUMN engine_type TEXT NOT NULL DEFAULT 'ollama'",
        [],
    ).ok(); // エラーは無視（既に存在する場合）
    
    // APIsテーブルにengine_configカラムを追加
    tx.execute(
        "ALTER TABLE apis ADD COLUMN engine_config TEXT",
        [],
    ).ok(); // エラーは無視（既に存在する場合）
    
    // engine_configsテーブルを作成
    tx.execute(
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
    
    // インデックスを作成
    tx.execute(
        "CREATE INDEX IF NOT EXISTS idx_engine_configs_type ON engine_configs(engine_type)",
        [],
    )?;
    
    tx.execute(
        "CREATE INDEX IF NOT EXISTS idx_engine_configs_default ON engine_configs(is_default)",
        [],
    )?;
    
    // APIsテーブルにインデックスを追加
    tx.execute(
        "CREATE INDEX IF NOT EXISTS idx_apis_engine_type ON apis(engine_type)",
        [],
    ).ok(); // エラーは無視
    
    Ok(())
}

/// 現在のマイグレーションバージョンを取得
fn get_current_version(conn: &Connection) -> Result<i32, DatabaseError> {
    // migrationsテーブルが存在しない場合は0を返す
    let table_exists: bool = conn.query_row(
        "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='migrations'",
        [],
        |row| Ok(row.get::<_, i32>(0)? > 0),
    ).unwrap_or(false);
    
    if !table_exists {
        return Ok(0);
    }
    
    // 最新のバージョンを取得
    let version: i32 = conn.query_row(
        "SELECT MAX(version) FROM migrations",
        [],
        |row| row.get(0),
    ).unwrap_or(0);
    
    Ok(version)
}

/// マイグレーションを適用
fn apply_migration<F>(conn: &mut Connection, version: i32, name: &str, migration_fn: F) -> Result<(), DatabaseError>
where
    F: FnOnce(&mut rusqlite::Transaction) -> Result<(), DatabaseError>,
{
    // トランザクション内で実行
    let mut tx = conn.transaction()
        .map_err(|e| DatabaseError::MigrationFailed(
            format!("データベースの更新を開始できませんでした: {}", e)
        ))?;
    
    // マイグレーション関数を実行
    migration_fn(&mut tx)?;
    
    // マイグレーション履歴を記録
    let now = Utc::now().to_rfc3339();
    tx.execute(
        "INSERT INTO migrations (version, name, applied_at) VALUES (?1, ?2, ?3)",
        [&version.to_string(), name, &now],
    ).map_err(|e| DatabaseError::MigrationFailed(
        format!("更新履歴の記録に失敗しました: {}", e)
    ))?;
    
    // トランザクションをコミット
    tx.commit()
        .map_err(|e| DatabaseError::MigrationFailed(
            format!("データベースの更新を完了できませんでした: {}", e)
        ))?;
    
    Ok(())
}

/// マイグレーション履歴を取得
#[allow(dead_code)] // 将来使用予定（管理機能で使用予定）
pub fn get_migrations(conn: &Connection) -> Result<Vec<Migration>, DatabaseError> {
    let mut stmt = conn.prepare(
        "SELECT version, name, applied_at FROM migrations ORDER BY version"
    ).map_err(|_| DatabaseError::QueryFailed("更新履歴の取得に失敗しました。アプリを再起動して再度お試しください。".to_string()))?;
    
    let migrations = stmt.query_map([], |row| {
        let applied_at_str: String = row.get(2)?;
        let applied_at = chrono::DateTime::parse_from_rfc3339(&applied_at_str)
            .map_err(|_| rusqlite::Error::InvalidColumnType(2, "applied_at".to_string(), rusqlite::types::Type::Text))?
            .with_timezone(&Utc);
        
        Ok(Migration {
            version: row.get(0)?,
            name: row.get(1)?,
            applied_at,
        })
    })
    .map_err(|_| DatabaseError::QueryFailed("更新履歴の読み込みに失敗しました。アプリを再起動して再度お試しください。".to_string()))?;
    
    let mut result = Vec::new();
    for migration in migrations {
        result.push(migration?);
    }
    
    Ok(result)
}
