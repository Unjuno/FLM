// アプリケーション設定コマンド

use serde::{Deserialize, Serialize};
use crate::database::connection::get_connection;
use crate::database::repository::UserSettingRepository;

/// アプリケーション設定構造体
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppSettings {
    /// テーマ設定（"light" | "dark" | "auto"）
    pub theme: Option<String>,
    /// 言語設定（"ja" | "en"）
    pub language: Option<String>,
    /// 自動更新間隔（秒、デフォルト: 30）
    pub auto_refresh_interval: Option<u32>,
    /// ログ保持期間（日数、デフォルト: 30）
    pub log_retention_days: Option<u32>,
    /// 監査ログ保持期間（日数、デフォルト: 90）
    pub audit_log_retention_days: Option<u32>,
    /// 通知設定（true | false）
    pub notifications_enabled: Option<bool>,
    /// アプリ終了時にAPIを停止するか（true | false、デフォルト: true）
    pub stop_apis_on_exit: Option<bool>,
    /// リクエストボディをログに保存するか（true | false、デフォルト: true、プライバシー保護のため無効化可能）
    pub save_request_body: Option<bool>,
    /// 診断機能を有効にするか（true | false、デフォルト: true、プライバシー保護のため無効化可能）
    pub diagnostics_enabled: Option<bool>,
    /// パフォーマンスメトリクス収集を有効にするか（true | false、デフォルト: true、プライバシー保護のため無効化可能）
    pub performance_metrics_enabled: Option<bool>,
    /// 監査ログにIPアドレスを含めるか（true | false、デフォルト: true、プライバシー保護のため無効化可能）
    pub include_ip_address_in_audit_log: Option<bool>,
    /// デバイスIDの使用を許可するか（true | false、デフォルト: true、リモート同期機能で使用、プライバシー保護のため無効化可能）
    pub device_id_enabled: Option<bool>,
    /// バックアップファイルをデフォルトで暗号化するか（true | false、デフォルト: false、プライバシー保護のため有効化推奨）
    pub backup_encrypt_by_default: Option<bool>,
}

/// アプリケーション設定取得コマンド
/// 全ての設定を取得します（存在しない場合はデフォルト値を返す）
#[tauri::command]
pub async fn get_app_settings() -> Result<AppSettings, String> {
    let conn = get_connection().map_err(|_| {
        "データの読み込みに失敗しました。アプリを再起動して再度お試しください。".to_string()
    })?;
    
    let settings_repo = UserSettingRepository::new(&conn);
    
    // 各設定を取得（存在しない場合はデフォルト値を使用）
    let theme = settings_repo.get("theme").map_err(|e| {
        format!("設定の読み込みに失敗しました: {}", e)
    })?;
    
    let language = settings_repo.get("language").map_err(|e| {
        format!("設定の読み込みに失敗しました: {}", e)
    })?;
    
    let auto_refresh_interval = settings_repo.get("auto_refresh_interval")
        .map_err(|e| format!("設定の読み込みに失敗しました: {}", e))?
        .and_then(|v| v.parse::<u32>().ok());
    
    let log_retention_days = settings_repo.get("log_retention_days")
        .map_err(|e| format!("設定の読み込みに失敗しました: {}", e))?
        .and_then(|v| v.parse::<u32>().ok());
    
    let audit_log_retention_days = settings_repo.get("audit_log_retention_days")
        .map_err(|e| format!("設定の読み込みに失敗しました: {}", e))?
        .and_then(|v| v.parse::<u32>().ok());
    
    let notifications_enabled = settings_repo.get("notifications_enabled")
        .map_err(|e| format!("設定の読み込みに失敗しました: {}", e))?
        .and_then(|v| v.parse::<bool>().ok());
    
    let stop_apis_on_exit = settings_repo.get("stop_apis_on_exit")
        .map_err(|e| format!("設定の読み込みに失敗しました: {}", e))?
        .and_then(|v| v.parse::<bool>().ok());
    
    let save_request_body = settings_repo.get("save_request_body")
        .map_err(|e| format!("設定の読み込みに失敗しました: {}", e))?
        .and_then(|v| v.parse::<bool>().ok());
    
    let diagnostics_enabled = settings_repo.get("diagnostics_enabled")
        .map_err(|e| format!("設定の読み込みに失敗しました: {}", e))?
        .and_then(|v| v.parse::<bool>().ok());
    
    let performance_metrics_enabled = settings_repo.get("performance_metrics_enabled")
        .map_err(|e| format!("設定の読み込みに失敗しました: {}", e))?
        .and_then(|v| v.parse::<bool>().ok());
    
    let include_ip_address_in_audit_log = settings_repo.get("include_ip_address_in_audit_log")
        .map_err(|e| format!("設定の読み込みに失敗しました: {}", e))?
        .and_then(|v| v.parse::<bool>().ok());
    
    let device_id_enabled = settings_repo.get("device_id_enabled")
        .map_err(|e| format!("設定の読み込みに失敗しました: {}", e))?
        .and_then(|v| v.parse::<bool>().ok());
    
    let backup_encrypt_by_default = settings_repo.get("backup_encrypt_by_default")
        .map_err(|e| format!("設定の読み込みに失敗しました: {}", e))?
        .and_then(|v| v.parse::<bool>().ok());
    
    Ok(AppSettings {
        theme,
        language,
        auto_refresh_interval: auto_refresh_interval.or(Some(30)), // デフォルト: 30秒
        log_retention_days: log_retention_days.or(Some(30)), // デフォルト: 30日
        audit_log_retention_days: audit_log_retention_days.or(Some(90)), // デフォルト: 90日
        notifications_enabled: notifications_enabled.or(Some(true)), // デフォルト: 有効
        stop_apis_on_exit: stop_apis_on_exit.or(Some(true)), // デフォルト: 有効（アプリ終了時にAPIを停止）
        save_request_body: save_request_body.or(Some(true)), // デフォルト: 有効（プライバシー保護のため無効化可能）
        diagnostics_enabled: diagnostics_enabled.or(Some(true)), // デフォルト: 有効（プライバシー保護のため無効化可能）
        performance_metrics_enabled: performance_metrics_enabled.or(Some(true)), // デフォルト: 有効（プライバシー保護のため無効化可能）
        include_ip_address_in_audit_log: include_ip_address_in_audit_log.or(Some(true)), // デフォルト: 有効（プライバシー保護のため無効化可能）
        device_id_enabled: device_id_enabled.or(Some(true)), // デフォルト: 有効（リモート同期機能で使用、プライバシー保護のため無効化可能）
        backup_encrypt_by_default: backup_encrypt_by_default.or(Some(false)), // デフォルト: 無効（プライバシー保護のため有効化推奨）
    })
}

/// アプリケーション設定更新コマンド
/// 設定を更新します（指定された項目のみ更新）
#[tauri::command]
pub async fn update_app_settings(settings: AppSettings) -> Result<(), String> {
    let conn = get_connection().map_err(|_| {
        "データの保存に失敗しました。アプリを再起動して再度お試しください。".to_string()
    })?;
    
    let settings_repo = UserSettingRepository::new(&conn);
    
    // 指定された項目のみ更新
    if let Some(theme) = settings.theme {
        settings_repo.set("theme", &theme).map_err(|e| {
            format!("テーマ設定の保存に失敗しました: {}", e)
        })?;
    }
    
    if let Some(language) = settings.language {
        settings_repo.set("language", &language).map_err(|e| {
            format!("言語設定の保存に失敗しました: {}", e)
        })?;
    }
    
    if let Some(interval) = settings.auto_refresh_interval {
        settings_repo.set("auto_refresh_interval", &interval.to_string()).map_err(|e| {
            format!("自動更新間隔の保存に失敗しました: {}", e)
        })?;
    }
    
    if let Some(days) = settings.log_retention_days {
        settings_repo.set("log_retention_days", &days.to_string()).map_err(|e| {
            format!("ログ保持期間の保存に失敗しました: {}", e)
        })?;
    }
    
    if let Some(days) = settings.audit_log_retention_days {
        settings_repo.set("audit_log_retention_days", &days.to_string()).map_err(|e| {
            format!("監査ログ保持期間の保存に失敗しました: {}", e)
        })?;
    }
    
    if let Some(enabled) = settings.notifications_enabled {
        settings_repo.set("notifications_enabled", &enabled.to_string()).map_err(|e| {
            format!("通知設定の保存に失敗しました: {}", e)
        })?;
    }
    
    if let Some(stop_on_exit) = settings.stop_apis_on_exit {
        settings_repo.set("stop_apis_on_exit", &stop_on_exit.to_string()).map_err(|e| {
            format!("アプリ終了時のAPI停止設定の保存に失敗しました: {}", e)
        })?;
    }
    
    if let Some(save_body) = settings.save_request_body {
        settings_repo.set("save_request_body", &save_body.to_string()).map_err(|e| {
            format!("リクエストボディ保存設定の保存に失敗しました: {}", e)
        })?;
    }
    
    if let Some(enabled) = settings.diagnostics_enabled {
        settings_repo.set("diagnostics_enabled", &enabled.to_string()).map_err(|e| {
            format!("診断機能設定の保存に失敗しました: {}", e)
        })?;
    }
    
    if let Some(enabled) = settings.performance_metrics_enabled {
        settings_repo.set("performance_metrics_enabled", &enabled.to_string()).map_err(|e| {
            format!("パフォーマンスメトリクス設定の保存に失敗しました: {}", e)
        })?;
    }
    
    if let Some(enabled) = settings.include_ip_address_in_audit_log {
        settings_repo.set("include_ip_address_in_audit_log", &enabled.to_string()).map_err(|e| {
            format!("監査ログIPアドレス設定の保存に失敗しました: {}", e)
        })?;
    }
    
    if let Some(enabled) = settings.device_id_enabled {
        settings_repo.set("device_id_enabled", &enabled.to_string()).map_err(|e| {
            format!("デバイスID設定の保存に失敗しました: {}", e)
        })?;
    }
    
    Ok(())
}

// データベース整合性チェックコマンド（既存のcheck_database_integrityと重複する可能性があるため、ここでは実装しない）
// データベース管理機能は別のコマンドに実装済み

