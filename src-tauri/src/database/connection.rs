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
        .map_err(|e| {
            eprintln!("データベースパス取得エラー: {}", e);
            crate::database::DatabaseError::ConnectionFailed(e.to_string())
        })?;
    
    eprintln!("データベースパス: {:?}", db_path);
    
    // 親ディレクトリが存在しない場合は作成
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| {
                eprintln!("ディレクトリ作成エラー: {} (パス: {:?})", e, parent);
                crate::database::DatabaseError::ConnectionFailed(
                    format!("データ保存用のフォルダを作成できませんでした: {}", e)
                )
            })?;
    }
    
    // データベース接続を開く（リトライ付き）
    // WALファイルがロックされている場合や、前回の実行が正常に終了しなかった場合に対応
    let conn = match Connection::open_with_flags(&db_path, rusqlite::OpenFlags::SQLITE_OPEN_READ_WRITE | rusqlite::OpenFlags::SQLITE_OPEN_CREATE) {
        Ok(c) => c,
        Err(e) => {
            eprintln!("データベース接続エラー: {} (パス: {:?})", e, db_path);
            
            // エラーメッセージから原因を推測
            let error_msg = format!("{}", e);
            if error_msg.contains("database is locked") || error_msg.contains("database locked") {
                eprintln!("データベースがロックされています。数秒待機して再試行します...");
                // 少し待機してから再試行
                std::thread::sleep(std::time::Duration::from_millis(1000));
                Connection::open_with_flags(&db_path, rusqlite::OpenFlags::SQLITE_OPEN_READ_WRITE | rusqlite::OpenFlags::SQLITE_OPEN_CREATE)
                    .map_err(|e2| {
                        eprintln!("再試行後もエラー: {} (パス: {:?})", e2, db_path);
                        crate::database::DatabaseError::ConnectionFailed(
                            format!("データベースがロックされています。他のプロセスがデータベースを使用していないか確認してください。パス: {:?}", db_path)
                        )
                    })?
            } else {
                return Err(crate::database::DatabaseError::ConnectionFailed(
                    format!("データの読み込み・保存に失敗しました: {} (パス: {:?})。アプリを再起動して再度お試しください。", e, db_path)
                ));
            }
        }
    };
    
    // 外部キー制約を有効化
    conn.execute("PRAGMA foreign_keys = ON", [])
        .map_err(|e| {
            eprintln!("外部キー制約設定エラー: {}", e);
            crate::database::DatabaseError::ConnectionFailed(
                format!("データの整合性チェックに失敗しました: {}。アプリを再起動して再度お試しください。", e)
            )
        })?;
    
    // WALモードを有効化（パフォーマンス向上）
    conn.execute("PRAGMA journal_mode = WAL", [])
        .map_err(|e| {
            eprintln!("WALモード設定エラー: {}", e);
            crate::database::DatabaseError::ConnectionFailed(
                format!("データの最適化に失敗しました: {}。アプリを再起動して再度お試しください。", e)
            )
        })?;
    
    Ok(conn)
}
