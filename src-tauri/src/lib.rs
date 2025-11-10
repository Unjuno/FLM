/// アプリケーション メインライブラリ
/// 
/// このモジュールはTauriアプリケーションのエントリーポイントです。
mod commands;
mod database;
mod ollama;
mod auth;
mod auth_proxy;
pub mod utils;
pub mod engines;
pub mod plugins;

use commands::{greet, api};
use commands::database as db_commands;
use commands::performance;
use commands::settings;
use commands::alerts;
use commands::backup;
use commands::engine;
use commands::system;
use commands::port;
use commands::suggestions;
use commands::remote_sync;
use commands::oauth;
use commands::updater;
// Plugin, scheduler, and model_sharing modules are used in invoke_handler!
// use commands::plugin;
// use commands::scheduler;
// use commands::model_sharing;
use serde::{Deserialize, Serialize};
use tauri::Manager;
use lazy_static::lazy_static;
use std::sync::{Mutex, atomic::{AtomicBool, Ordering}};
use tokio::runtime::Runtime;

/// デバッグビルドでのみログを出力するマクロ
#[cfg(debug_assertions)]
macro_rules! debug_log {
    ($($arg:tt)*) => {
        eprintln!("[DEBUG] {}", format!($($arg)*));
    };
}

#[cfg(not(debug_assertions))]
macro_rules! debug_log {
    ($($arg:tt)*) => {};
}

/// 警告ログを出力するマクロ（常に出力）
macro_rules! warn_log {
    ($($arg:tt)*) => {
        eprintln!("[WARN] {}", format!($($arg)*));
    };
}

/// エラーログを出力するマクロ（常に出力）
macro_rules! error_log {
    ($($arg:tt)*) => {
        eprintln!("[ERROR] {}", format!($($arg)*));
    };
}

/// アプリケーション情報取得コマンド
#[tauri::command]
fn get_app_info() -> AppInfo {
    AppInfo {
        name: "FLM".to_string(),
        version: "1.0.0".to_string(),
        description: "Local LLM API Management Tool".to_string(),
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AppInfo {
    pub name: String,
    pub version: String,
    pub description: String,
}

// グローバルなTokioランタイムを保持
lazy_static! {
    static ref TOKIO_RUNTIME: Mutex<Option<Runtime>> = Mutex::new(None);
}

static SHUTDOWN_IN_PROGRESS: AtomicBool = AtomicBool::new(false);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    debug_log!("=== アプリケーション起動開始 ===");
    
    // グローバルなTokioランタイムを初期化
    // 注意: Tauri 2.xでは非同期コマンドが自動的にTokioランタイムを使用するため、
    // グローバルランタイムは将来的に削除予定です
    {
        match TOKIO_RUNTIME.lock() {
            Ok(mut rt) => {
                if rt.is_none() {
                    match Runtime::new() {
                        Ok(runtime) => {
                            *rt = Some(runtime);
                            debug_log!("グローバルTokioランタイムを初期化しました");
                        }
                        Err(e) => {
                            error_log!("Tokioランタイムの初期化に失敗しました: {}", e);
                            error_log!("エラー詳細: {:?}", e);
                            // アプリケーションを続行できないため、パニック
                            // これは起動時の致命的エラーなので、panicは適切です
                            panic!("Tokioランタイムの初期化に失敗しました: {}. アプリケーションを再起動してください。", e);
                        }
                    }
                } else {
                    debug_log!("グローバルTokioランタイムは既に初期化されています");
                }
            }
            Err(e) => {
                error_log!("Tokioランタイムのロック取得に失敗しました: {}", e);
                error_log!("エラー詳細: {:?}", e);
                // アプリケーションを続行できないため、パニック
                // これは起動時の致命的エラーなので、panicは適切です
                panic!("Tokioランタイムのロック取得に失敗しました: {}. アプリケーションを再起動してください。", e);
            }
        }
    }
    
    // データベースを初期化
    debug_log!("データベース初期化を開始します...");
    match database::init_database() {
        Ok(_) => {
            debug_log!("データベースの初期化が完了しました");
        },
        Err(e) => {
            warn_log!("データベース初期化エラー: {}", e);
            debug_log!("エラー詳細: {:?}", e);
            warn_log!("警告: データベース初期化に失敗しましたが、アプリケーションは起動を続行します");
            warn_log!("注意: データベース機能が正常に動作しない可能性があります");
            // アプリケーションは継続して起動します（データベースエラーは後で処理可能）
            // ユーザーには、初回データベースアクセス時にエラーメッセージが表示されます
        }
    }
    
    debug_log!("Tauriビルダーを初期化します...");
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            // アプリケーション終了時のクリーンアップ処理を設定
            // すべてのウィンドウに対してイベントハンドラを設定
            if let Some(window) = app.get_webview_window("main") {
                window.clone().on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        if SHUTDOWN_IN_PROGRESS.compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst).is_err() {
                            return;
                        }
                        // ウィンドウの閉鎖を一時的にブロック
                        api.prevent_close();
                        
                        let window_handle = window.clone();
                        
                        // クリーンアップ処理をバックグラウンドスレッドで実行（ウィンドウを閉じるのを待たない）
                        // デーモンスレッドとして実行し、プロセス終了時に自動的にクリーンアップされる
                        std::thread::spawn(move || {
                            // スレッド内で新しいTokioランタイムを作成して非同期処理を実行
                            match tokio::runtime::Runtime::new() {
                                Ok(runtime) => {
                                    runtime.block_on(async {
                            // 設定を確認して、アプリ終了時にAPIを停止するかどうかを決定
                                    let debug_mode = std::env::var("FLM_DEBUG").unwrap_or_default() == "1";
                                    if debug_mode {
                                        debug_log!("アプリ終了時の設定を確認中...");
                                    }
                            let should_stop_apis = tokio::task::spawn_blocking(|| {
                                use crate::database::connection::get_connection;
                                use crate::database::repository::UserSettingRepository;
                                
                                match get_connection() {
                                    Ok(conn) => {
                                        let settings_repo = UserSettingRepository::new(&conn);
                                        match settings_repo.get("stop_apis_on_exit") {
                                            Ok(Some(value)) => {
                                                match value.parse::<bool>() {
                                                    Ok(enabled) => {
                                                        // デバッグモードのチェックは外側で行う
                                                        enabled
                                                    },
                                                    Err(_) => {
                                                                warn_log!("stop_apis_on_exit設定の値が無効です。デフォルト値（true）を使用します");
                                                        true
                                                    }
                                                }
                                            },
                                            Ok(None) => {
                                                // 初回のみ設定を初期化（デフォルト値で保存）
                                                // これにより次回以降はログが表示されない
                                                if let Err(e) = settings_repo.set("stop_apis_on_exit", "true") {
                                                    // 設定の保存に失敗してもデフォルト値を使用するため問題なし
                                                    warn_log!("stop_apis_on_exit設定の保存に失敗しました: {}。デフォルト値（true）を使用します", e);
                                                }
                                                true
                                            },
                                            Err(e) => {
                                                        warn_log!("stop_apis_on_exit設定の読み込みに失敗しました: {}。デフォルト値（true）を使用します", e);
                                                true
                                            }
                                        }
                                    },
                                    Err(e) => {
                                                warn_log!("データベース接続に失敗しました: {}。デフォルト値（true）を使用します", e);
                                        true
                                    }
                                }
                            }).await.unwrap_or_else(|e| {
                                        warn_log!("設定確認タスクが失敗しました: {}。デフォルト値（true）を使用します", e);
                                true
                            });
                            
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
                                    });
                                },
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
            
            // アプリケーション起動時に、停止状態のAPIを自動的に起動
            // バックグラウンドタスクとして実行（起動をブロックしない）
            std::thread::spawn(move || {
                // スレッド内で新しいTokioランタイムを作成して非同期処理を実行
                match tokio::runtime::Runtime::new() {
                    Ok(runtime) => {
                        runtime.block_on(async {
                            debug_log!("アプリケーション起動時: 停止状態のAPIを自動起動します...");
                            
                            // すべてのAPIを取得
                            match commands::api::list_apis().await {
                                Ok(apis) => {
                                    let mut started_count = 0;
                                    let mut failed_count = 0;
                                    
                                    for api_info in apis {
                                        // 停止状態のAPIのみ起動
                                        if api_info.status == "stopped" {
                                            debug_log!("API「{}」を自動起動します...", api_info.name);
                                            match commands::api::start_api(api_info.id.clone()).await {
                                                Ok(_) => {
                                                    debug_log!("✓ API「{}」の起動に成功しました", api_info.name);
                                                    started_count += 1;
                                                },
                                                Err(e) => {
                                                    warn_log!("✗ API「{}」の起動に失敗しました: {}", api_info.name, e);
                                                    failed_count += 1;
                                                }
                                            }
                                        }
                                    }
                                    
                                    if started_count > 0 || failed_count > 0 {
                                        debug_log!("API自動起動完了: 成功={}件, 失敗={}件", started_count, failed_count);
                                    } else {
                                        debug_log!("起動すべき停止状態のAPIはありませんでした");
                                    }
                                },
                                Err(e) => {
                                    warn_log!("API一覧の取得に失敗しました: {}. 自動起動をスキップします。", e);
                                }
                            }
                        });
                    },
                    Err(e) => {
                        warn_log!("API自動起動用のTokioランタイム作成に失敗しました: {:?}", e);
                    }
                }
            });
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            get_app_info,
            commands::ollama::detect_ollama,
            commands::ollama::download_ollama,
            commands::ollama::start_ollama,
            commands::ollama::stop_ollama,
            commands::ollama::check_ollama_health,
            commands::ollama::check_ollama_update,
            commands::ollama::update_ollama,
            commands::port::resolve_port_conflicts,
            api::create_api,
            api::list_apis,
            api::start_api,
            api::stop_api,
            api::delete_api,
            api::get_models_list,
            api::get_model_catalog,
            api::get_api_details,
            api::update_api,
            api::get_api_key,
            api::regenerate_api_key,
            api::delete_api_key,
            api::download_model,
            api::delete_model,
            api::get_installed_models,
            api::save_request_log,
            api::get_request_logs,
            api::save_error_log,
            api::list_error_logs,
            api::export_error_logs,
            api::get_log_statistics,
            api::export_logs,
            api::delete_logs,
            api::export_api_settings,
            api::import_api_settings,
            performance::record_performance_metric,
            performance::get_performance_metrics,
            performance::get_performance_summary,
            db_commands::check_database_integrity,
            db_commands::fix_database_integrity,
            settings::get_app_settings,
            settings::update_app_settings,
            alerts::get_alert_settings,
            alerts::update_alert_settings,
            alerts::check_performance_alerts,
            alerts::get_alert_history,
            alerts::resolve_alert,
            alerts::resolve_alerts,
            backup::create_backup,
            backup::restore_backup,
            backup::restore_backup_from_json,
            engine::get_available_engines,
            engine::detect_engine,
            engine::detect_all_engines,
            engine::start_engine,
            engine::stop_engine,
            engine::install_engine,
            engine::check_engine_update,
            engine::update_engine,
            engine::save_engine_config,
            engine::get_engine_configs,
            engine::delete_engine_config,
            engine::get_engine_models,
            system::get_system_resources,
            system::get_memory_usage,
            system::check_memory_health,
            system::get_model_recommendation,
            system::detect_security_block,
            system::diagnose_network,
            system::diagnose_environment,
            system::diagnose_filesystem,
            system::run_comprehensive_diagnostics,
            port::find_available_port,
            port::check_port_availability,
            suggestions::suggest_api_name,
            suggestions::suggest_error_fix,
            suggestions::suggest_model_parameters,
            remote_sync::sync_settings,
            remote_sync::get_synced_settings,
            remote_sync::export_settings_for_remote,
            remote_sync::import_settings_from_remote,
            remote_sync::generate_device_id,
            commands::plugin::register_plugin,
            commands::plugin::get_all_plugins,
            commands::plugin::get_plugin,
            commands::plugin::set_plugin_enabled,
            commands::plugin::unregister_plugin,
            commands::plugin::update_plugin_permissions,
            commands::plugin::execute_plugin_command,
            commands::scheduler::add_schedule_task,
            commands::scheduler::get_schedule_tasks,
            commands::scheduler::update_schedule_task,
            commands::scheduler::delete_schedule_task,
            commands::scheduler::start_schedule_task,
            commands::scheduler::stop_schedule_task,
            commands::scheduler::update_model_catalog,
            commands::model_sharing::share_model_command,
            commands::model_sharing::search_shared_models_command,
            commands::model_sharing::download_shared_model_command,
            oauth::start_oauth_flow_command,
            oauth::exchange_oauth_code,
            oauth::refresh_oauth_token,
            api::get_huggingface_model_info,
            api::get_security_settings,
            api::set_ip_whitelist,
            api::update_rate_limit_config,
            api::update_key_rotation_config,
            api::search_audit_logs,
            api::export_audit_logs,
            updater::check_app_update,
            updater::install_app_update,
        ])
        .run(tauri::generate_context!())
        .map_err(|e| {
            error_log!("=== Tauriアプリケーションの起動に失敗しました ===");
            error_log!("エラー: {}", e);
            debug_log!("エラー詳細: {:?}", e);
            e
        })
        .unwrap_or_else(|e| {
            error_log!("=== 致命的エラー ===");
            error_log!("Tauriアプリケーションの起動に失敗しました。エラーログを確認してください。");
            error_log!("エラー詳細: {}", e);
            debug_log!("エラー詳細（デバッグ）: {:?}", e);
            error_log!("プロセスを終了します...");
            std::process::exit(1);
        });
    
    debug_log!("=== アプリケーション起動完了 ===");
}


