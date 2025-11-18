// Database Connection Module

use super::DatabaseError;
use crate::utils::logging::{mask_env_var_value, mask_file_path};
use rusqlite::Connection;
use std::path::PathBuf;
// マクロをインポート
use crate::{debug_log, error_log, warn_log};

pub type DatabaseConnection = Connection;

/// アプリケーションデータディレクトリのパスを取得
/// OSに応じた適切なディレクトリを返す
pub fn get_app_data_dir() -> Result<PathBuf, DatabaseError> {
    use std::env;

    // FLM_DATA_DIR環境変数が設定されている場合はそれを優先使用
    // Node.js側（src/backend/auth/database.ts）と一貫性を保つため
    if let Ok(flm_data_dir) = env::var("FLM_DATA_DIR") {
        debug_log!(
            "FLM_DATA_DIR環境変数を取得: {}",
            mask_env_var_value(&flm_data_dir)
        );
        return Ok(PathBuf::from(flm_data_dir));
    }

    #[cfg(target_os = "windows")]
    {
        // LOCALAPPDATA環境変数を取得（失敗した場合は代替パスを使用）
        let app_data_dir = match env::var("LOCALAPPDATA") {
            Ok(path) => {
                debug_log!("LOCALAPPDATA環境変数を取得: {}", mask_env_var_value(&path));
                PathBuf::from(path).join("FLM")
            }
            Err(_) => {
                // 代替パス: カレントディレクトリまたはユーザーディレクトリ
                warn_log!(
                    "警告: LOCALAPPDATA環境変数が取得できませんでした。代替パスを使用します。"
                );
                match env::var("USERPROFILE") {
                    Ok(user_profile) => {
                        debug_log!(
                            "USERPROFILE環境変数を取得: {}",
                            mask_env_var_value(&user_profile)
                        );
                        PathBuf::from(user_profile)
                            .join("AppData")
                            .join("Local")
                            .join("FLM")
                    }
                    Err(_) => {
                        // 最後の手段: カレントディレクトリ
                        warn_log!("警告: USERPROFILE環境変数も取得できませんでした。カレントディレクトリを使用します。");
                        env::current_dir()
                            .map_err(|e| DatabaseError::ConnectionFailed(
                                format!("システムの設定を読み取れませんでした。カレントディレクトリも取得できませんでした: {}", e)
                            ))?
                            .join(".flm_data")
                    }
                }
            }
        };
        Ok(app_data_dir)
    }

    #[cfg(target_os = "macos")]
    {
        let home = env::var("HOME").map_err(|e| {
            error_log!("HOME環境変数取得エラー: {:?}", e);
            DatabaseError::ConnectionFailed(format!("システムの設定を読み取れませんでした: {}", e))
        })?;
        debug_log!("HOME環境変数を取得: {}", mask_env_var_value(&home));
        Ok(PathBuf::from(home).join("Library/Application Support/FLM"))
    }

    #[cfg(target_os = "linux")]
    {
        let home = env::var("HOME").map_err(|e| {
            error_log!("HOME環境変数取得エラー: {:?}", e);
            DatabaseError::ConnectionFailed(format!("システムの設定を読み取れませんでした: {}", e))
        })?;
        debug_log!("HOME環境変数を取得: {}", mask_env_var_value(&home));
        Ok(PathBuf::from(home).join(".local/share/FLM"))
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        Err(DatabaseError::ConnectionFailed(
            "お使いのOSはサポートされていません。".to_string(),
        ))
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
    let db_path = match get_database_path() {
        Ok(path) => {
            debug_log!(
                "データベースパス: {:?}",
                mask_file_path(&path.to_string_lossy())
            );
            path
        }
        Err(e) => {
            error_log!("データベースパス取得エラー: {:?}", e);
            return Err(crate::database::DatabaseError::ConnectionFailed(format!(
                "データベースの保存先を取得できませんでした: {}",
                e
            )));
        }
    };

    // 親ディレクトリが存在しない場合は作成
    if let Some(parent) = db_path.parent() {
        debug_log!(
            "データベースディレクトリ: {:?}",
            mask_file_path(&parent.to_string_lossy())
        );
        match std::fs::create_dir_all(parent) {
            Ok(_) => {
                debug_log!(
                    "データベースディレクトリを作成しました: {:?}",
                    mask_file_path(&parent.to_string_lossy())
                );
            }
            Err(e) => {
                error_log!(
                    "ディレクトリ作成エラー: {:?} (パス: {:?})",
                    e,
                    mask_file_path(&parent.to_string_lossy())
                );
                return Err(crate::database::DatabaseError::ConnectionFailed(format!(
                    "データ保存用のフォルダを作成できませんでした: {}",
                    e
                )));
            }
        }
    } else {
        warn_log!(
            "警告: データベースパスに親ディレクトリがありません: {:?}",
            mask_file_path(&db_path.to_string_lossy())
        );
    }

    // データベース接続を開く
    debug_log!(
        "データベース接続を開いています: {:?}",
        mask_file_path(&db_path.to_string_lossy())
    );
    let conn = match Connection::open(&db_path) {
        Ok(conn) => {
            debug_log!("データベース接続に成功しました");
            conn
        }
        Err(e) => {
            error_log!(
                "データベース接続エラー: {:?} (パス: {:?})",
                e,
                mask_file_path(&db_path.to_string_lossy())
            );
            return Err(crate::database::DatabaseError::ConnectionFailed(format!(
                "データベース接続に失敗しました: {}",
                e
            )));
        }
    };

    // 外部キー制約を有効化（失敗しても続行）
    if let Err(e) = conn.execute("PRAGMA foreign_keys = ON", []) {
        warn_log!("警告: 外部キー制約の有効化エラー: {:?}", e);
        warn_log!("警告: 外部キー制約の有効化に失敗しましたが、データベース接続は継続します");
        // 外部キー制約の有効化に失敗しても、接続は続行する（一部のSQLiteバージョンや設定で問題が発生する可能性があるため）
        // データベースの基本的な機能は動作する
    } else {
        debug_log!("外部キー制約を有効化しました");
    }

    // WALモードを有効化（パフォーマンス向上）
    // PRAGMA journal_modeは結果を返すため、query_rowを使用
    match conn.query_row("PRAGMA journal_mode = WAL", [], |row| {
        Ok(row.get::<_, String>(0)?)
    }) {
        Ok(mode) => {
            debug_log!("WALモードを有効化しました: {}", mode);
        }
        Err(e) => {
            warn_log!("WALモードの有効化エラー: {:?}", e);
            // WALモードの有効化に失敗しても、接続は続行する（非必須のため）
            warn_log!("警告: WALモードの有効化に失敗しましたが、データベース接続は継続します");
        }
    }

    // データベース接続プールの最適化: パフォーマンス設定を適用
    // キャッシュサイズを増やす（デフォルト: 2MB → 10MB）
    if let Err(e) = conn.execute("PRAGMA cache_size = -10000", []) {
        warn_log!("警告: キャッシュサイズの設定に失敗しました: {:?}", e);
    } else {
        debug_log!("データベースキャッシュサイズを10MBに設定しました");
    }

    // 同期モードを最適化（WALモード使用時はNORMALが推奨）
    if let Err(e) = conn.execute("PRAGMA synchronous = NORMAL", []) {
        warn_log!("警告: 同期モードの設定に失敗しました: {:?}", e);
    } else {
        debug_log!("データベース同期モードをNORMALに設定しました");
    }

    // ページサイズの最適化（デフォルト: 4KB → 8KB、大きなデータに適している）
    // 注意: 既存のデータベースでは変更されないため、新規作成時のみ有効
    if let Err(e) = conn.execute("PRAGMA page_size = 8192", []) {
        debug_log!(
            "ページサイズの設定: 既存データベースのため変更されません（エラーは無視）: {:?}",
            e
        );
    }

    // テンポラリテーブルをメモリに保存（パフォーマンス向上）
    if let Err(e) = conn.execute("PRAGMA temp_store = MEMORY", []) {
        warn_log!("警告: テンポラリテーブルの設定に失敗しました: {:?}", e);
    } else {
        debug_log!("テンポラリテーブルをメモリに保存するように設定しました");
    }

    Ok(conn)
}
