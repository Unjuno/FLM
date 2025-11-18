/// アプリケーション初期化モジュール
/// 
/// データベース初期化、自動バックアップ設定などの初期化処理を担当します。

use crate::{debug_log, warn_log};
use crate::app::settings;
use crate::utils::scheduler::{add_schedule_task, TaskType};

/// アプリケーション全体を初期化
///
/// データベースの初期化を行い、エラーが発生してもアプリケーションの起動を続行します。
/// データベース初期化に失敗した場合、警告ログを出力しますが、アプリケーションは起動を続けます。
///
/// # エラーハンドリング
/// データベース初期化に失敗しても、アプリケーションは起動を続行します。
/// これは、データベースが必須ではない機能（例: 設定の一時的な保存）を
/// 提供するためです。
pub fn initialize_application() {
    debug_log!("=== アプリケーション起動開始 ===");
    
    // データベースを初期化
    if let Err(e) = init_database() {
        warn_log!("データベース初期化エラー: {}", e);
        warn_log!(
            "警告: データベース初期化に失敗しましたが、アプリケーションは起動を続行します"
        );
        warn_log!("注意: データベース機能が正常に動作しない可能性があります");
    }
}

/// データベースを初期化
/// 
/// # Returns
/// 初期化が成功した場合は`Ok(())`、失敗した場合はエラーメッセージを含む`Err`
fn init_database() -> Result<(), String> {
    debug_log!("データベース初期化を開始します...");
    
    crate::database::init_database()
        .map_err(|e| {
            warn_log!("データベース初期化エラー: {}", e);
            debug_log!("エラー詳細: {:?}", e);
            format!("データベース初期化エラー: {}", e)
        })
        .map(|_| {
            debug_log!("データベースの初期化が完了しました");
        })
}

/// 自動バックアップを初期化
/// 
/// データベースから自動バックアップの設定を読み込み、有効な場合は
/// スケジューラーにタスクを登録します。
/// 
/// # デフォルト値
/// - `auto_backup_enabled`: `true` (有効)
/// - `auto_backup_interval_hours`: `24` (24時間)
pub async fn initialize_auto_backup() {
    // 設定値を読み込む（非同期版を使用）
    let enabled = settings::load_app_setting("auto_backup_enabled", true).await;
    let interval_hours = settings::load_app_setting("auto_backup_interval_hours", 24u64).await;

    if !enabled {
        debug_log!("自動バックアップは無効です");
        return;
    }

    // 自動バックアップが有効な場合、スケジューラーにタスクを追加
    let interval_seconds = interval_hours * 3600; // 時間を秒に変換

    match add_schedule_task("auto_backup", TaskType::AutoBackup, "", interval_seconds).await {
        Ok(_) => {
            debug_log!(
                "自動バックアップを初期化しました（間隔: {}時間）",
                interval_hours
            );
        }
        Err(e) => {
            warn_log!("自動バックアップの初期化に失敗しました: {}", e);
        }
    }
}
