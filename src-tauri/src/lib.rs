/// FLM アプリケーション メインライブラリ
/// 
/// このモジュールはTauriアプリケーションのエントリーポイントです。
mod commands;
mod database;
mod ollama;
mod auth;
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
use serde::{Deserialize, Serialize};

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
        eprintln!("データの初期化に失敗しました。アプリを再起動して再度お試しください。");
        eprintln!("エラー詳細: {}", e);
        eprintln!("エラータイプ: {:?}", e);
        // アプリケーションは継続して起動します（データベースエラーは後で処理可能）
        // 注意: データベース機能は利用できません
    } else {
        eprintln!("データベースの初期化に成功しました");
    }
    
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            get_app_info,
            commands::ollama::detect_ollama,
            commands::ollama::download_ollama,
            commands::ollama::start_ollama,
            commands::ollama::stop_ollama,
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

