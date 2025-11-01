// FLM - Database Connection Module
// データベース接続管理

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
            .map_err(|_| crate::database::DatabaseError::ConnectionFailed(
                "データ保存用のフォルダを作成できませんでした。".to_string()
            ))?;
    }
    
    // データベース接続を開く
    let conn = Connection::open(&db_path)
        .map_err(|_| crate::database::DatabaseError::ConnectionFailed(
            "データの読み込み・保存に失敗しました。アプリを再起動して再度お試しください。".to_string()
        ))?;
    
    // 外部キー制約を有効化
    conn.execute("PRAGMA foreign_keys = ON", [])
        .map_err(|_| crate::database::DatabaseError::ConnectionFailed(
            "データの整合性チェックに失敗しました。アプリを再起動して再度お試しください。".to_string()
        ))?;
    
    // WALモードを有効化（パフォーマンス向上）
    conn.execute("PRAGMA journal_mode = WAL", [])
        .map_err(|_| crate::database::DatabaseError::ConnectionFailed(
            "データの最適化に失敗しました。アプリを再起動して再度お試しください。".to_string()
        ))?;
    
    Ok(conn)
}
