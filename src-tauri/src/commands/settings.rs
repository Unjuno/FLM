// アプリケーション設定コマンド
// バックエンドエージェント実装
// BE-011-01: アプリケーション設定IPCコマンド実装

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
    /// 通知設定（true | false）
    pub notifications_enabled: Option<bool>,
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
    
    let notifications_enabled = settings_repo.get("notifications_enabled")
        .map_err(|e| format!("設定の読み込みに失敗しました: {}", e))?
        .and_then(|v| v.parse::<bool>().ok());
    
    Ok(AppSettings {
        theme,
        language,
        auto_refresh_interval: auto_refresh_interval.or(Some(30)), // デフォルト: 30秒
        log_retention_days: log_retention_days.or(Some(30)), // デフォルト: 30日
        notifications_enabled: notifications_enabled.or(Some(true)), // デフォルト: 有効
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
    
    if let Some(enabled) = settings.notifications_enabled {
        settings_repo.set("notifications_enabled", &enabled.to_string()).map_err(|e| {
            format!("通知設定の保存に失敗しました: {}", e)
        })?;
    }
    
    Ok(())
}

// データベース整合性チェックコマンド（既存のcheck_database_integrityと重複する可能性があるため、ここでは実装しない）
// データベース管理機能は別のコマンドに実装済み

