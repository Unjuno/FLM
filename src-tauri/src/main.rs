// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct AppInfo {
    pub name: String,
    pub version: String,
    pub description: String,
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to FLM!", name)
}

#[tauri::command]
fn get_app_info() -> AppInfo {
    AppInfo {
        name: env!("CARGO_PKG_NAME").to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        description: env!("CARGO_PKG_DESCRIPTION").to_string(),
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            greet,
            get_app_info,
            // CLI bridge commands
            commands::cli_bridge::ipc_detect_engines,
            commands::cli_bridge::ipc_list_models,
            commands::cli_bridge::ipc_engines_health_history,
            commands::cli_bridge::ipc_proxy_start,
            commands::cli_bridge::ipc_proxy_status,
            commands::cli_bridge::ipc_proxy_stop,
            commands::cli_bridge::ipc_security_policy_show,
            commands::cli_bridge::ipc_security_policy_set,
            commands::cli_bridge::ipc_api_keys_list,
            commands::cli_bridge::ipc_api_keys_create,
            commands::cli_bridge::ipc_api_keys_revoke,
            commands::cli_bridge::ipc_config_list,
            commands::cli_bridge::ipc_config_get,
            commands::cli_bridge::ipc_config_set,
            commands::cli_bridge::get_platform,
            commands::cli_bridge::ipc_model_profiles_list,
            commands::cli_bridge::ipc_model_profiles_save,
            commands::cli_bridge::ipc_model_profiles_delete,
            commands::cli_bridge::ipc_api_prompts_list,
            commands::cli_bridge::ipc_api_prompts_show,
            commands::cli_bridge::ipc_api_prompts_set,
            commands::cli_bridge::ipc_security_ip_blocklist_list,
            commands::cli_bridge::ipc_security_ip_blocklist_unblock,
            commands::cli_bridge::ipc_security_ip_blocklist_clear,
            commands::cli_bridge::ipc_security_ip_whitelist_list,
            commands::cli_bridge::ipc_security_ip_whitelist_add,
            commands::cli_bridge::ipc_security_ip_whitelist_remove,
            commands::cli_bridge::ipc_security_audit_logs,
            commands::cli_bridge::ipc_security_intrusion,
            commands::cli_bridge::ipc_security_anomaly,
            commands::cli_bridge::ipc_security_install_packaged_ca,
            // Firewall commands
            commands::firewall::system_firewall_preview,
            commands::firewall::system_firewall_apply,
            commands::firewall::system_firewall_rollback,
            commands::firewall::system_firewall_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

