/// アプリケーションクリーンアップモジュール
/// 
/// アプリケーション終了時のクリーンアップ処理を担当します。

use crate::commands::api;
use crate::{debug_log, error_log, warn_log};
use crate::app::runtime::spawn_async_task;
use crate::app::settings::load_app_setting;
use std::sync::atomic::{AtomicBool, Ordering};

/// シャットダウン進行中フラグ
static SHUTDOWN_IN_PROGRESS: AtomicBool = AtomicBool::new(false);

/// アプリケーション終了時のクリーンアップ処理を設定
///
/// ウィンドウのクローズイベントにハンドラを登録し、
/// 必要に応じてAPIを停止してからアプリケーションを終了します。
pub fn setup_cleanup_handler(window: tauri::WebviewWindow) {
    let window_clone = window.clone();
    window.on_window_event(move |event| {
        if let tauri::WindowEvent::CloseRequested { api, .. } = event {
            if SHUTDOWN_IN_PROGRESS.compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst).is_err() {
                return;
            }
            
            // ウィンドウの閉鎖を一時的にブロック
            api.prevent_close();
            
            let window_handle = window_clone.clone();
            
            // クリーンアップ処理をバックグラウンドスレッドで実行（ウィンドウを閉じるのを待たない）
            // デーモンスレッドとして実行し、プロセス終了時に自動的にクリーンアップされる
            spawn_async_task(async {
                perform_cleanup().await;
            });
            
            // ウィンドウを即座に閉じる（クリーンアップ処理の完了を待たない）
            debug_log!("ウィンドウを閉じます...");
            if let Err(e) = window_handle.close() {
                error_log!("ウィンドウの閉鎖に失敗しました: {:?}", e);
                // ウィンドウが閉じられない場合は、強制的にプロセスを終了
                std::process::exit(0);
            }
            debug_log!("ウィンドウを閉じました");
        }
    });
}

/// アプリケーション終了時のクリーンアップ処理を実行
async fn perform_cleanup() {
    let debug_mode = std::env::var("FLM_DEBUG").unwrap_or_default() == "1";
    
    if debug_mode {
        debug_log!("アプリ終了時の設定を確認中...");
    }

    // 設定を確認して、アプリ終了時にAPIを停止するかどうかを決定
    let should_stop_apis = load_app_setting("stop_apis_on_exit", true).await;

    if should_stop_apis {
        if debug_mode {
            debug_log!("バックグラウンドでAPIを停止します...");
        }
        
        // 5秒のタイムアウトを設定（監査レポートの推奨に基づき2秒→5秒に延長）
        let timeout = tokio::time::sleep(tokio::time::Duration::from_secs(5));
        let cleanup_task = api::stop_all_running_apis();

        tokio::pin!(timeout);

        tokio::select! {
            result = cleanup_task => {
                match result {
                    Ok(_) => {
                        if debug_mode {
                            debug_log!("✓ クリーンアップ処理が完了しました");
                        }
                    }
                    Err(e) => {
                        warn_log!("クリーンアップ処理中にエラーが発生しました: {}", e);
                    }
                }
            }
            _ = timeout.as_mut() => {
                warn_log!("クリーンアップ処理がタイムアウトしました（5秒）。処理を中断します。");
            }
        }
    } else {
        if debug_mode {
            debug_log!("設定により、アプリ終了時にAPIを停止しません");
        }
    }
}

