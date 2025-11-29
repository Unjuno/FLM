mod app;
mod auth;
mod auth_proxy;
/// アプリケーション メインライブラリ
///
/// このモジュールはTauriアプリケーションのエントリーポイントです。
mod commands;
mod database;
mod ollama;
#[macro_use]
pub mod utils;
pub mod engines;
pub mod plugins;

use app::{initialize_application, setup_cleanup_handler, spawn_startup_task};
use commands::{
    alerts, api, backup, cli_bridge, database as db_commands, engine, http, ipc_version,
    model_converter, model_search, model_sharing, oauth, ollama as ollama_commands, performance,
    plugin, port, remote_sync, scheduler, settings, suggestions, system, updater, get_app_info,
    greet,
};
use serde::{Deserialize, Serialize};
use tauri::Manager;

#[derive(Debug, Serialize, Deserialize)]
pub struct AppInfo {
    pub name: String,
    pub version: String,
    pub description: String,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // アプリケーション初期化（データベースなど）
    initialize_application();

    debug_log!("Tauriビルダーを初期化します...");
    
    let result = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(setup_application)
        .invoke_handler(tauri::generate_handler![
            // === 基本コマンド ===
            greet,
            get_app_info,
            cli_bridge::ipc_detect_engines,
            cli_bridge::ipc_list_models,
            cli_bridge::ipc_proxy_start,
            cli_bridge::ipc_proxy_status,
            cli_bridge::ipc_proxy_stop,
            cli_bridge::ipc_security_policy_show,
            cli_bridge::ipc_security_policy_show,
            cli_bridge::ipc_security_policy_set,
            cli_bridge::ipc_api_keys_list,
            cli_bridge::ipc_api_keys_create,
            cli_bridge::ipc_api_keys_revoke,
            cli_bridge::ipc_config_list,
            cli_bridge::ipc_config_get,
            cli_bridge::ipc_config_set,
            cli_bridge::get_platform,
            cli_bridge::ipc_model_profiles_list,
            cli_bridge::ipc_model_profiles_save,
            cli_bridge::ipc_model_profiles_delete,
            cli_bridge::ipc_api_prompts_list,
            cli_bridge::ipc_api_prompts_show,
            cli_bridge::ipc_api_prompts_set,
            cli_bridge::ipc_security_ip_blocklist_list,
            cli_bridge::ipc_security_ip_blocklist_unblock,
            cli_bridge::ipc_security_ip_blocklist_clear,
            cli_bridge::ipc_security_audit_logs,
            cli_bridge::ipc_security_intrusion,
            cli_bridge::ipc_security_anomaly,
            cli_bridge::ipc_security_install_packaged_ca,
            
            // === Ollama関連 ===
            ollama_commands::detect_ollama,
            ollama_commands::download_ollama,
            ollama_commands::start_ollama,
            ollama_commands::stop_ollama,
            ollama_commands::check_ollama_health,
            ollama_commands::check_ollama_update,
            ollama_commands::update_ollama,
            
            // === ポート管理 ===
            port::resolve_port_conflicts,
            port::find_available_port,
            port::check_port_availability,
            
            // === HTTP通信 ===
            http::send_http_request,
            http::check_proxy_health,
            
            // === API管理 ===
            api::create_api,
            api::list_apis,
            api::start_api,
            api::stop_api,
            api::delete_api,
            api::get_api_details,
            api::update_api,
            api::get_models_list,
            api::get_model_catalog,
            api::get_installed_models,
            api::download_model,
            api::delete_model,
            api::get_huggingface_model_info,
            
            // === モデル検索 ===
            model_search::search_models,
            model_search::search_ollama_library_models, // 後方互換性のため残す
            model_search::get_model_details,
            
            // === APIキー管理 ===
            api::get_api_key,
            api::regenerate_api_key,
            api::delete_api_key,
            
            // === APIセキュリティ設定 ===
            api::get_security_settings,
            api::set_ip_whitelist,
            api::update_rate_limit_config,
            api::update_key_rotation_config,
            
            // === ログ管理 ===
            api::save_request_log,
            api::get_request_logs,
            api::save_error_log,
            api::list_error_logs,
            api::export_error_logs,
            api::get_log_statistics,
            api::export_logs,
            api::delete_logs,
            
            // === 監査ログ ===
            api::search_audit_logs,
            api::export_audit_logs,
            
            // === API設定のインポート/エクスポート ===
            api::export_api_settings,
            api::import_api_settings,
            
            // === パフォーマンス監視 ===
            performance::record_performance_metric,
            performance::get_performance_metrics,
            performance::get_performance_summary,
            
            // === データベース管理 ===
            db_commands::check_database_integrity,
            db_commands::fix_database_integrity,
            db_commands::rollback_database_migration,
            
            // === アプリケーション設定 ===
            settings::get_app_settings,
            settings::update_app_settings,
            
            // === アラート管理 ===
            alerts::get_alert_settings,
            alerts::update_alert_settings,
            alerts::check_performance_alerts,
            alerts::get_alert_history,
            alerts::resolve_alert,
            alerts::resolve_alerts,
            
            // === バックアップ・復元 ===
            backup::create_backup,
            backup::restore_backup,
            backup::restore_backup_from_json,
            
            // === エンジン管理 ===
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
            
            // === システム診断 ===
            system::get_system_resources,
            system::get_memory_usage,
            system::check_memory_health,
            system::get_model_recommendation,
            system::detect_security_block,
            system::diagnose_network,
            system::diagnose_environment,
            system::diagnose_filesystem,
            system::run_comprehensive_diagnostics,
            system::system_firewall_preview,
            system::system_firewall_apply,
            
            // === 提案機能 ===
            suggestions::suggest_api_name,
            suggestions::suggest_error_fix,
            suggestions::suggest_model_parameters,
            
            // === リモート同期 ===
            remote_sync::sync_settings,
            remote_sync::get_synced_settings,
            remote_sync::export_settings_for_remote,
            remote_sync::import_settings_from_remote,
            remote_sync::generate_device_id,
            
            // === プラグイン管理 ===
            plugin::register_plugin,
            plugin::get_all_plugins,
            plugin::get_plugin,
            plugin::set_plugin_enabled,
            plugin::unregister_plugin,
            plugin::update_plugin_permissions,
            plugin::execute_plugin_command,
            
            // === スケジューラー ===
            scheduler::add_schedule_task,
            scheduler::get_schedule_tasks,
            scheduler::update_schedule_task,
            scheduler::delete_schedule_task,
            scheduler::start_schedule_task,
            scheduler::stop_schedule_task,
            scheduler::update_model_catalog,
            
            // === モデル共有 ===
            model_sharing::share_model_command,
            model_sharing::search_shared_models_command,
            model_sharing::download_shared_model_command,
            
            // === OAuth認証 ===
            oauth::start_oauth_flow_command,
            oauth::exchange_oauth_code,
            oauth::refresh_oauth_token,
            
            // === モデルコンバーター ===
            model_converter::convert_model,
            
            // === アプリケーションアップデート ===
            updater::check_app_update,
            updater::install_app_update,
            
            // === IPCバージョン管理 ===
            ipc_version::get_ipc_version,
            ipc_version::check_ipc_compatibility,
        ])
        .run(tauri::generate_context!());

    match result {
        Ok(_) => {
            debug_log!("=== アプリケーション起動完了 ===");
        }
        Err(e) => {
            handle_startup_error(Box::new(e) as Box<dyn std::error::Error>);
        }
    }
}

/// アプリケーションのセットアップ処理
///
/// Tauriアプリケーションの初期設定を行います。
/// クリーンアップハンドラーの登録と起動タスクの開始を担当します。
fn setup_application(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    // アプリケーション終了時のクリーンアップ処理を設定
    if let Some(window) = app.get_webview_window("main") {
        setup_cleanup_handler(window);
    }

    // アプリケーション起動時のバックグラウンドタスクを開始
    // API状態の同期と自動起動を実行（起動をブロックしない）
    spawn_startup_task();

    Ok(())
}

/// アプリケーション起動エラーの処理
///
/// 起動に失敗した場合のエラーログ出力とプロセス終了を担当します。
fn handle_startup_error(e: Box<dyn std::error::Error>) {
    error_log!("=== Tauriアプリケーションの起動に失敗しました ===");
    error_log!("エラー: {}", e);
    debug_log!("エラー詳細: {:?}", e);
    error_log!("プロセスを終了します...");
    std::process::exit(1);
}
