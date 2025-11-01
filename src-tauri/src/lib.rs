/// FLM アプリケーション メインライブラリ
/// 
/// このモジュールはTauriアプリケーションのエントリーポイントです。
mod commands;
mod database;
mod ollama;
mod auth;
mod utils;

use commands::{greet, api};
use commands::database as db_commands;
use commands::performance;
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
        eprintln!("データの初期化に失敗しました。アプリを再起動して再度お試しください。エラー: {}", e);
        // アプリケーションは継続して起動します（データベースエラーは後で処理可能）
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

