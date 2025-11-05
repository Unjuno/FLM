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
use serde::{Deserialize, Serialize};
use tauri::Manager;

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // データベースを初期化
    if let Err(e) = database::init_database() {
        eprintln!("データの初期化に失敗しました。アプリを再起動して再度お試しください。エラー: {}", e);
        // アプリケーションは継続して起動します（データベースエラーは後で処理可能）
    }
    
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // アプリケーション終了時のクリーンアップ処理を設定
            // すべてのウィンドウに対してイベントハンドラを設定
            if let Some(window) = app.get_webview_window("main") {
                window.clone().on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        // ウィンドウの閉鎖を一時的にブロック
                        api.prevent_close();
                        
                        // 非同期処理を実行（タイムアウト付き）
                        let window_handle = window.clone();
                        tokio::spawn(async move {
                            // 10秒のタイムアウトを設定
                            let timeout = tokio::time::sleep(tokio::time::Duration::from_secs(10));
                            let cleanup_task = api::stop_all_running_apis();
                            
                            tokio::pin!(timeout);
                            
                            tokio::select! {
                                result = cleanup_task => {
                                    match result {
                                        Ok(_) => {
                                            eprintln!("クリーンアップ処理が完了しました");
                                        }
                                        Err(e) => {
                                            eprintln!("クリーンアップ処理中にエラーが発生しました: {}", e);
                                        }
                                    }
                                }
                                _ = timeout.as_mut() => {
                                    eprintln!("警告: クリーンアップ処理がタイムアウトしました（10秒）");
                                }
                            }
                            
                            // クリーンアップ完了またはタイムアウト後にウィンドウを閉じる
                            let _ = window_handle.close();
                        });
                    }
                });
            }
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            get_app_info,
            commands::ollama::detect_ollama,
            commands::ollama::download_ollama,
            commands::ollama::start_ollama,
            commands::ollama::stop_ollama,
            commands::ollama::check_ollama_update,
            commands::ollama::update_ollama,
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
            engine::save_engine_config,
            engine::get_engine_configs,
            engine::delete_engine_config,
            engine::get_engine_models,
            system::get_system_resources,
            system::get_model_recommendation,
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
        ])
        .run(tauri::generate_context!())
        .map_err(|e| {
            eprintln!("Tauriアプリケーションの起動に失敗しました: {}", e);
            e
        })
        .unwrap_or_else(|e| {
            eprintln!("致命的エラー: Tauriアプリケーションの起動に失敗しました。エラーログを確認してください。");
            eprintln!("エラー詳細: {}", e);
            std::process::exit(1);
        });
}

