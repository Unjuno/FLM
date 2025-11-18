/// アプリケーション初期化とセットアップ処理
/// 
/// このモジュールは、アプリケーション起動時と終了時の処理を管理します。

use crate::commands::api;
use crate::database::connection::get_connection;
use crate::database::models::ApiStatus;
use crate::database::repository::{ApiRepository, UserSettingRepository};
use crate::utils::scheduler::{add_schedule_task, TaskType};
use crate::auth_proxy::check_proxy_running;
use chrono::Utc;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::Manager;

static SHUTDOWN_IN_PROGRESS: AtomicBool = AtomicBool::new(false);

/// デバッグモードかどうかを確認
fn is_debug_mode() -> bool {
    std::env::var("FLM_DEBUG").unwrap_or_default() == "1"
}

/// アプリ終了時にAPIを停止するかどうかを設定から取得
async fn should_stop_apis_on_exit() -> bool {
    tokio::task::spawn_blocking(|| {
        match get_connection() {
            Ok(conn) => {
                let settings_repo = UserSettingRepository::new(&conn);
                match settings_repo.get("stop_apis_on_exit") {
                    Ok(Some(value)) => {
                        value.parse::<bool>().unwrap_or_else(|_| {
                            warn_log!("stop_apis_on_exit設定の値が無効です。デフォルト値（true）を使用します");
                            true
                        })
                    }
                    Ok(None) => {
                        // 初回のみ設定を初期化（デフォルト値で保存）
                        if let Err(e) = settings_repo.set("stop_apis_on_exit", "true") {
                            warn_log!("stop_apis_on_exit設定の保存に失敗しました: {}。デフォルト値（true）を使用します", e);
                        }
                        true
                    }
                    Err(e) => {
                        warn_log!("stop_apis_on_exit設定の読み込みに失敗しました: {}。デフォルト値（true）を使用します", e);
                        true
                    }
                }
            }
            Err(e) => {
                warn_log!("データベース接続に失敗しました: {}。デフォルト値（true）を使用します", e);
                true
            }
        }
    })
    .await
    .unwrap_or_else(|e| {
        warn_log!("設定確認タスクが失敗しました: {}。デフォルト値（true）を使用します", e);
        true
    })
}

/// アプリ終了時のクリーンアップ処理
async fn perform_shutdown_cleanup() {
    if is_debug_mode() {
        debug_log!("アプリ終了時の設定を確認中...");
    }

    let should_stop_apis = should_stop_apis_on_exit().await;

    if should_stop_apis {
        if is_debug_mode() {
            debug_log!("バックグラウンドでAPIを停止します...");
        }

        // 5秒のタイムアウトを設定
        let timeout = tokio::time::sleep(tokio::time::Duration::from_secs(5));
        let cleanup_task = api::stop_all_running_apis();

        tokio::pin!(timeout);

        tokio::select! {
            result = cleanup_task => {
                match result {
                    Ok(_) => {
                        if is_debug_mode() {
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
        if is_debug_mode() {
            debug_log!("設定により、アプリ終了時にAPIを停止しません");
        }
    }
}

/// ウィンドウの閉鎖イベントハンドラを設定
pub fn setup_window_close_handler(app: &tauri::App) {
    if let Some(window) = app.get_webview_window("main") {
        window.clone().on_window_event(move |event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // 重複実行を防ぐ
                if SHUTDOWN_IN_PROGRESS
                    .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
                    .is_err()
                {
                    return;
                }

                // ウィンドウの閉鎖を一時的にブロック
                api.prevent_close();

                let window_handle = window.clone();

                // クリーンアップ処理をバックグラウンドスレッドで実行
                std::thread::spawn(move || {
                    // スレッド内で新しいTokioランタイムを作成して非同期処理を実行
                    match tokio::runtime::Runtime::new() {
                        Ok(runtime) => {
                            runtime.block_on(perform_shutdown_cleanup());
                        }
                        Err(e) => {
                            warn_log!("バックグラウンドクリーンアップ用のTokioランタイム作成に失敗しました: {:?}", e);
                        }
                    }
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
}

/// 自動バックアップを初期化
async fn initialize_auto_backup() {
    let result = tokio::task::spawn_blocking(|| {
        match get_connection() {
            Ok(conn) => {
                let settings_repo = UserSettingRepository::new(&conn);
                let enabled = settings_repo
                    .get("auto_backup_enabled")
                    .ok()
                    .flatten()
                    .and_then(|v| v.parse::<bool>().ok())
                    .unwrap_or(true); // デフォルト: 有効

                let interval = settings_repo
                    .get("auto_backup_interval_hours")
                    .ok()
                    .flatten()
                    .and_then(|v| v.parse::<u64>().ok())
                    .unwrap_or(24); // デフォルト: 24時間

                Ok::<(bool, u64), String>((enabled, interval))
            }
            Err(e) => Err(format!("データベース接続エラー: {}", e)),
        }
    })
    .await
    .unwrap_or_else(|e| Err(format!("タスク実行エラー: {}", e)));

    match result {
        Ok((enabled, interval_hours)) if enabled => {
            let interval_seconds = interval_hours * 3600;

            match add_schedule_task("auto_backup", TaskType::AutoBackup, "", interval_seconds).await {
                Ok(_) => {
                    debug_log!("自動バックアップを初期化しました（間隔: {}時間）", interval_hours);
                }
                Err(e) => {
                    warn_log!("自動バックアップの初期化に失敗しました: {}", e);
                }
            }
        }
        _ => {
            debug_log!("自動バックアップは無効です");
        }
    }
}

/// APIの状態を同期（データベースと実際のプロセス状態を一致させる）
async fn sync_api_states() -> Result<(usize, usize, usize), String> {
    debug_log!("アプリケーション起動時: APIの状態を同期します...");

    let apis = api::list_apis().await.map_err(|e| format!("API一覧の取得に失敗: {}", e))?;

    let mut synced_count = 0;
    let mut started_count = 0;
    let mut failed_count = 0;

    // 前回「running」だったAPIのIDを記録
    let previously_running_ids: std::collections::HashSet<String> = apis
        .iter()
        .filter(|api| api.status == "running")
        .map(|api| api.id.clone())
        .collect();

    if !previously_running_ids.is_empty() {
        debug_log!("前回起動中だったAPI数: {}", previously_running_ids.len());
    }

    // データベースで「running」と記録されているAPIの実際の状態を確認
    for api_info in &apis {
        if api_info.status == "running" {
            let is_actually_running = check_proxy_running(api_info.port as u16).await;

            if !is_actually_running {
                debug_log!(
                    "API「{}」(ポート {}) はデータベースでは「running」ですが、実際には停止しています。状態を同期します...",
                    api_info.name,
                    api_info.port
                );

                let api_id = api_info.id.clone();
                match tokio::task::spawn_blocking(move || {
                    let conn = get_connection().ok()?;
                    let api_repo = ApiRepository::new(&conn);
                    let mut api = api_repo.find_by_id(&api_id).ok()?;
                    api.status = ApiStatus::Stopped;
                    api.updated_at = Utc::now();
                    api_repo.update(&api).ok()?;
                    Some(())
                })
                .await
                {
                    Ok(Some(_)) => {
                        debug_log!("✓ API「{}」の状態を「stopped」に更新しました", api_info.name);
                        synced_count += 1;
                    }
                    Ok(None) | Err(_) => {
                        warn_log!("✗ API「{}」の状態更新に失敗しました", api_info.name);
                    }
                }
            }
        }
    }

    if synced_count > 0 {
        debug_log!("API状態同期完了: {}件のAPIの状態を修正しました", synced_count);
    }

    // 再度API一覧を取得（状態が更新された可能性があるため）
    let updated_apis = api::list_apis()
        .await
        .map_err(|e| format!("更新後のAPI一覧の取得に失敗: {}", e))?;

    // 前回「running」だったAPIのみを自動起動
    for api_info in updated_apis {
        if previously_running_ids.contains(&api_info.id) && api_info.status == "stopped" {
            debug_log!("API「{}」は前回起動中でした。自動起動します...", api_info.name);

            match api::start_api(api_info.id.clone()).await {
                Ok(_) => {
                    debug_log!("✓ API「{}」の起動に成功しました", api_info.name);
                    started_count += 1;
                }
                Err(e) => {
                    warn_log!("✗ API「{}」の起動に失敗しました: {}", api_info.name, e);
                    failed_count += 1;
                }
            }
        }
    }

    if started_count > 0 || failed_count > 0 {
        debug_log!(
            "API自動起動完了: 成功={}件, 失敗={}件",
            started_count,
            failed_count
        );
    } else if !previously_running_ids.is_empty() {
        debug_log!("前回起動中だったAPIは既に起動中です");
    } else {
        debug_log!("起動すべき停止状態のAPIはありませんでした");
    }

    Ok((synced_count, started_count, failed_count))
}

/// アプリケーション起動時の初期化処理
pub fn initialize_on_startup() {
    std::thread::spawn(move || {
        match tokio::runtime::Runtime::new() {
            Ok(runtime) => {
                runtime.block_on(async {
                    // API状態の同期と自動起動
                    match sync_api_states().await {
                        Ok(_) => {
                            // 成功時は自動バックアップを初期化
                            initialize_auto_backup().await;
                        }
                        Err(e) => {
                            warn_log!("API状態の同期に失敗しました: {}. 自動起動をスキップします。", e);
                            // エラーが発生しても自動バックアップの初期化を試みる
                            initialize_auto_backup().await;
                        }
                    }
                });
            }
            Err(e) => {
                warn_log!("API自動起動用のTokioランタイム作成に失敗しました: {:?}", e);
            }
        }
    });
}

