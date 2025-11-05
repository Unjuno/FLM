// Database Connection Module

use rusqlite::Connection;
use std::path::PathBuf;
use super::DatabaseError;

pub type DatabaseConnection = Connection;

/// アプリケーションデータディレクトリのパスを取得
/// OSに応じた適切なディレクトリを返す
pub fn get_app_data_dir() -> Result<PathBuf, DatabaseError> {
    use std::env;
    
    #[cfg(target_os = "windows")]
    {
        let local_app_data = env::var("LOCALAPPDATA")
            .map_err(|_| DatabaseError::ConnectionFailed("システムの設定を読み取れませんでした。".to_string()))?;
        Ok(PathBuf::from(local_app_data).join("FLM"))
    }
    
    #[cfg(target_os = "macos")]
    {
        let home = env::var("HOME")
            .map_err(|_| DatabaseError::ConnectionFailed("システムの設定を読み取れませんでした。".to_string()))?;
        Ok(PathBuf::from(home).join("Library/Application Support/FLM"))
    }
    
    #[cfg(target_os = "linux")]
    {
        let home = env::var("HOME")
            .map_err(|_| DatabaseError::ConnectionFailed("システムの設定を読み取れませんでした。".to_string()))?;
        Ok(PathBuf::from(home).join(".local/share/FLM"))
    }
    
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        Err(DatabaseError::ConnectionFailed("お使いのOSはサポートされていません。".to_string()))
    }
}

/// データベースファイルのパスを取得
pub fn get_database_path() -> Result<PathBuf, DatabaseError> {
    let app_data_dir = get_app_data_dir()?;
    Ok(app_data_dir.join("flm.db"))
}

/// データベース接続を取得
/// データベースファイルが存在しない場合は作成する
pub fn get_connection() -> Result<DatabaseConnection, crate::database::DatabaseError> {
    // データベースパスを取得
    let db_path = get_database_path()
        .map_err(|e| crate::database::DatabaseError::ConnectionFailed(e.to_string()))?;
    
    // 親ディレクトリが存在しない場合は作成
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| crate::database::DatabaseError::ConnectionFailed(
                format!("データ保存用のフォルダを作成できませんでした: {}", e)
            ))?;
    }
    
    // データベース接続を開く
    let conn = Connection::open(&db_path)
        .map_err(|e| crate::database::DatabaseError::ConnectionFailed(
            format!("データベース接続に失敗しました: {}", e)
        ))?;
    
    // 外部キー制約を有効化
    conn.execute("PRAGMA foreign_keys = ON", [])
        .map_err(|e| crate::database::DatabaseError::ConnectionFailed(
            format!("外部キー制約の有効化に失敗しました: {}", e)
        ))?;
    
    // WALモードを有効化（パフォーマンス向上）
    conn.execute("PRAGMA journal_mode = WAL", [])
        .map_err(|e| crate::database::DatabaseError::ConnectionFailed(
            format!("WALモードの有効化に失敗しました: {}", e)
        ))?;
    
    Ok(conn)
}
