/// ランタイム管理モジュール
///
/// 非同期処理を実行するためのTokioランタイムの作成と管理を担当します。
/// このモジュールは、バックグラウンドタスクの実行に必要なランタイムを
/// 提供します。

use crate::warn_log;

/// バックグラウンドタスクを実行するためのTokioランタイムを作成し、非同期処理を実行
/// 
/// この関数は、スレッド内で新しいTokioランタイムを作成し、非同期処理を実行します。
/// エラーが発生した場合、警告ログを出力しますが、処理は続行されます。
/// 
/// # Arguments
/// * `task` - 実行する非同期タスク
pub fn spawn_async_task<F>(task: F)
where
    F: std::future::Future<Output = ()> + Send + 'static,
{
    std::thread::spawn(move || {
        match tokio::runtime::Runtime::new() {
            Ok(runtime) => {
                runtime.block_on(task);
            }
            Err(e) => {
                warn_log!("Tokioランタイム作成に失敗しました: {:?}", e);
            }
        }
    });
}

