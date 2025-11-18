/// アプリケーション設定読み込み処理
///
/// データベースから設定を読み込む共通処理を提供します。
/// このモジュールは、同期版と非同期版の両方の設定読み込み関数を
/// 提供します。

use crate::database::connection::get_connection;
use crate::database::repository::UserSettingRepository;
use crate::warn_log;

/// 設定値を読み込む
///
/// # Arguments
/// * `key` - 設定キー
/// * `default` - デフォルト値（設定が存在しない場合に使用）
///
/// # Returns
/// 設定値、またはデフォルト値
pub fn load_setting<T: std::str::FromStr + std::fmt::Display>(key: &str, default: T) -> T {
    match get_connection() {
        Ok(conn) => {
            let settings_repo = UserSettingRepository::new(&conn);
            match settings_repo.get(key) {
                Ok(Some(value)) => value.parse().unwrap_or_else(|_| {
                    crate::warn_log!("設定「{}」の値が無効です。デフォルト値を使用します", key);
                    default
                }),
                Ok(None) => {
                    // 初回のみ設定を初期化（デフォルト値で保存）
                    let default_str = default.to_string();
                    if let Err(e) = settings_repo.set(key, &default_str) {
                        crate::warn_log!(
                            "設定「{}」の保存に失敗しました: {}。デフォルト値を使用します",
                            key,
                            e
                        );
                    }
                    default
                }
                Err(e) => {
                    crate::warn_log!(
                        "設定「{}」の読み込みに失敗しました: {}。デフォルト値を使用します",
                        key,
                        e
                    );
                    default
                }
            }
        }
        Err(e) => {
            crate::warn_log!(
                "データベース接続に失敗しました: {}。デフォルト値を使用します",
                e
            );
            default
        }
    }
}

/// アプリケーション設定を読み込む（非同期版）
///
/// ブロッキングタスクとして実行されるため、非同期コンテキストから呼び出せます。
///
/// # Arguments
/// * `key` - 設定キー
/// * `default` - デフォルト値（設定が存在しない場合に使用）
///
/// # Returns
/// 設定値、またはデフォルト値
pub async fn load_app_setting<T: std::str::FromStr + Send + 'static + Clone + std::fmt::Display>(
    key: &str,
    default: T,
) -> T
where
    T::Err: std::fmt::Debug,
{
    let key = key.to_string();
    let default_clone = default.clone();
    tokio::task::spawn_blocking(move || load_setting(&key, default_clone))
        .await
        .unwrap_or_else(|e| {
            warn_log!("設定確認タスクが失敗しました: {}。デフォルト値を使用します", e);
            default
        })
}

