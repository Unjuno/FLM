// アラート検出・通知コマンド
// バックエンドエージェント実装
// BE-012-01: アラート検出・通知IPCコマンド実装

use serde::{Deserialize, Serialize};
use crate::database::connection::get_connection;
use crate::database::repository::{PerformanceMetricRepository, UserSettingRepository, AlertHistoryRepository};
use crate::database::models::AlertHistory;
use chrono::Utc;
use uuid::Uuid;

/// アラート設定
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AlertSettings {
    pub api_id: Option<String>, // Noneの場合はグローバル設定
    /// レスポンス時間の閾値（ミリ秒）
    pub response_time_threshold: Option<f64>,
    /// エラー率の閾値（0.0-1.0）
    pub error_rate_threshold: Option<f64>,
    /// CPU使用率の閾値（0.0-100.0）
    pub cpu_usage_threshold: Option<f64>,
    /// メモリ使用率の閾値（0.0-100.0）
    pub memory_usage_threshold: Option<f64>,
    /// アラート通知を有効にする
    pub notifications_enabled: Option<bool>,
}

/// 検出されたアラート
#[derive(Debug, Serialize, Deserialize)]
pub struct DetectedAlert {
    pub api_id: String,
    pub alert_type: String, // "response_time", "error_rate", "cpu_usage", "memory_usage"
    pub current_value: f64,
    pub threshold: f64,
    pub timestamp: String,
    pub message: String,
}

/// アラート設定を取得
#[tauri::command]
pub async fn get_alert_settings(api_id: Option<String>) -> Result<AlertSettings, String> {
    let conn = get_connection().map_err(|_| {
        "データの読み込みに失敗しました。アプリを再起動して再度お試しください。".to_string()
    })?;
    
    let settings_repo = UserSettingRepository::new(&conn);
    
    // 設定キーのプレフィックス
    let prefix = if let Some(id) = &api_id {
        format!("alert_{}_", id)
    } else {
        "alert_global_".to_string()
    };
    
    // 各設定を取得
    let response_time_threshold = settings_repo.get(&format!("{}response_time", prefix))
        .map_err(|e| format!("設定の読み込みに失敗しました: {}", e))?
        .and_then(|v| v.parse::<f64>().ok());
    
    let error_rate_threshold = settings_repo.get(&format!("{}error_rate", prefix))
        .map_err(|e| format!("設定の読み込みに失敗しました: {}", e))?
        .and_then(|v| v.parse::<f64>().ok());
    
    let cpu_usage_threshold = settings_repo.get(&format!("{}cpu_usage", prefix))
        .map_err(|e| format!("設定の読み込みに失敗しました: {}", e))?
        .and_then(|v| v.parse::<f64>().ok());
    
    let memory_usage_threshold = settings_repo.get(&format!("{}memory_usage", prefix))
        .map_err(|e| format!("設定の読み込みに失敗しました: {}", e))?
        .and_then(|v| v.parse::<f64>().ok());
    
    let notifications_enabled = settings_repo.get(&format!("{}notifications_enabled", prefix))
        .map_err(|e| format!("設定の読み込みに失敗しました: {}", e))?
        .and_then(|v| v.parse::<bool>().ok());
    
    Ok(AlertSettings {
        api_id,
        response_time_threshold: response_time_threshold.or(Some(5000.0)), // デフォルト: 5秒
        error_rate_threshold: error_rate_threshold.or(Some(0.1)), // デフォルト: 10%
        cpu_usage_threshold: cpu_usage_threshold.or(Some(80.0)), // デフォルト: 80%
        memory_usage_threshold: memory_usage_threshold.or(Some(80.0)), // デフォルト: 80%
        notifications_enabled: notifications_enabled.or(Some(true)), // デフォルト: 有効
    })
}

/// アラート設定を保存
#[tauri::command]
pub async fn update_alert_settings(settings: AlertSettings) -> Result<(), String> {
    let conn = get_connection().map_err(|_| {
        "データの保存に失敗しました。アプリを再起動して再度お試しください。".to_string()
    })?;
    
    let settings_repo = UserSettingRepository::new(&conn);
    
    // 設定キーのプレフィックス
    let prefix = if let Some(id) = &settings.api_id {
        format!("alert_{}_", id)
    } else {
        "alert_global_".to_string()
    };
    
    // 各設定を保存
    if let Some(threshold) = settings.response_time_threshold {
        settings_repo.set(&format!("{}response_time", prefix), &threshold.to_string()).map_err(|e| {
            format!("レスポンス時間閾値の保存に失敗しました: {}", e)
        })?;
    }
    
    if let Some(threshold) = settings.error_rate_threshold {
        settings_repo.set(&format!("{}error_rate", prefix), &threshold.to_string()).map_err(|e| {
            format!("エラー率閾値の保存に失敗しました: {}", e)
        })?;
    }
    
    if let Some(threshold) = settings.cpu_usage_threshold {
        settings_repo.set(&format!("{}cpu_usage", prefix), &threshold.to_string()).map_err(|e| {
            format!("CPU使用率閾値の保存に失敗しました: {}", e)
        })?;
    }
    
    if let Some(threshold) = settings.memory_usage_threshold {
        settings_repo.set(&format!("{}memory_usage", prefix), &threshold.to_string()).map_err(|e| {
            format!("メモリ使用率閾値の保存に失敗しました: {}", e)
        })?;
    }
    
    if let Some(enabled) = settings.notifications_enabled {
        settings_repo.set(&format!("{}notifications_enabled", prefix), &enabled.to_string()).map_err(|e| {
            format!("通知設定の保存に失敗しました: {}", e)
        })?;
    }
    
    Ok(())
}

/// アラートを履歴に保存するヘルパー関数
fn save_alert_to_history(conn: &rusqlite::Connection, alert: &DetectedAlert) {
    let history_repo = AlertHistoryRepository::new(conn);
    let timestamp = match chrono::DateTime::parse_from_rfc3339(&alert.timestamp) {
        Ok(dt) => dt.with_timezone(&Utc),
        Err(_) => Utc::now(),
    };
    let alert_history = AlertHistory {
        id: Uuid::new_v4().to_string(),
        api_id: alert.api_id.clone(),
        alert_type: alert.alert_type.clone(),
        current_value: alert.current_value,
        threshold: alert.threshold,
        message: alert.message.clone(),
        timestamp,
        resolved_at: None,
    };
    let _ = history_repo.create(&alert_history);
}

/// パフォーマンスアラートをチェック
#[tauri::command]
pub async fn check_performance_alerts(api_id: String) -> Result<Vec<DetectedAlert>, String> {
    let conn = get_connection().map_err(|_| {
        "データの読み込みに失敗しました。アプリを再起動して再度お試しください。".to_string()
    })?;
    
    // アラート設定を取得（API固有設定を優先、なければグローバル設定）
    let api_settings = get_alert_settings(Some(api_id.clone())).await?;
    let global_settings = get_alert_settings(None).await?;
    
    // API固有設定がない場合はグローバル設定を使用
    let settings = AlertSettings {
        response_time_threshold: api_settings.response_time_threshold.or(global_settings.response_time_threshold),
        error_rate_threshold: api_settings.error_rate_threshold.or(global_settings.error_rate_threshold),
        cpu_usage_threshold: api_settings.cpu_usage_threshold.or(global_settings.cpu_usage_threshold),
        memory_usage_threshold: api_settings.memory_usage_threshold.or(global_settings.memory_usage_threshold),
        notifications_enabled: api_settings.notifications_enabled.or(global_settings.notifications_enabled),
        api_id: Some(api_id.clone()),
    };
    
    // 通知が無効の場合は早期リターン
    if !settings.notifications_enabled.unwrap_or(true) {
        return Ok(vec![]);
    }
    
    let metric_repo = PerformanceMetricRepository::new(&conn);
    
    // 直近1時間のメトリクスを取得
    let one_hour_ago = Utc::now() - chrono::Duration::hours(1);
    let start_date = Some(one_hour_ago.to_rfc3339());
    
    let mut alerts = Vec::new();
    
    // レスポンス時間をチェック
    if let Some(threshold) = settings.response_time_threshold {
        if let Ok(metrics) = metric_repo.find_by_api_id_and_range(
            &api_id,
            start_date.as_deref(),
            None,
            Some("avg_response_time"),
        ) {
            // 最新の平均レスポンス時間を取得
            if let Some(latest) = metrics.first() {
                if latest.value > threshold {
                    let alert = DetectedAlert {
                        api_id: api_id.clone(),
                        alert_type: "response_time".to_string(),
                        current_value: latest.value,
                        threshold,
                        timestamp: Utc::now().to_rfc3339(),
                        message: format!(
                            "平均レスポンス時間が閾値を超過しました: {:.2}ms (閾値: {:.2}ms)",
                            latest.value, threshold
                        ),
                    };
                    save_alert_to_history(&conn, &alert);
                    alerts.push(alert);
                }
            }
        }
    }
    
    // エラー率をチェック
    if let Some(threshold) = settings.error_rate_threshold {
        if let Ok(metrics) = metric_repo.find_by_api_id_and_range(
            &api_id,
            start_date.as_deref(),
            None,
            Some("error_rate"),
        ) {
            if let Some(latest) = metrics.first() {
                if latest.value > threshold {
                    let alert = DetectedAlert {
                        api_id: api_id.clone(),
                        alert_type: "error_rate".to_string(),
                        current_value: latest.value,
                        threshold,
                        timestamp: Utc::now().to_rfc3339(),
                        message: format!(
                            "エラー率が閾値を超過しました: {:.2}% (閾値: {:.2}%)",
                            latest.value * 100.0, threshold * 100.0
                        ),
                    };
                    save_alert_to_history(&conn, &alert);
                    alerts.push(alert);
                }
            }
        }
    }
    
    // CPU使用率をチェック
    if let Some(threshold) = settings.cpu_usage_threshold {
        if let Ok(metrics) = metric_repo.find_by_api_id_and_range(
            &api_id,
            start_date.as_deref(),
            None,
            Some("cpu_usage"),
        ) {
            if let Some(latest) = metrics.first() {
                if latest.value > threshold {
                    let alert = DetectedAlert {
                        api_id: api_id.clone(),
                        alert_type: "cpu_usage".to_string(),
                        current_value: latest.value,
                        threshold,
                        timestamp: Utc::now().to_rfc3339(),
                        message: format!(
                            "CPU使用率が閾値を超過しました: {:.2}% (閾値: {:.2}%)",
                            latest.value, threshold
                        ),
                    };
                    save_alert_to_history(&conn, &alert);
                    alerts.push(alert);
                }
            }
        }
    }
    
    // メモリ使用率をチェック
    if let Some(threshold) = settings.memory_usage_threshold {
        if let Ok(metrics) = metric_repo.find_by_api_id_and_range(
            &api_id,
            start_date.as_deref(),
            None,
            Some("memory_usage"),
        ) {
            if let Some(latest) = metrics.first() {
                if latest.value > threshold {
                    let alert = DetectedAlert {
                        api_id: api_id.clone(),
                        alert_type: "memory_usage".to_string(),
                        current_value: latest.value,
                        threshold,
                        timestamp: Utc::now().to_rfc3339(),
                        message: format!(
                            "メモリ使用率が閾値を超過しました: {:.2}% (閾値: {:.2}%)",
                            latest.value, threshold
                        ),
                    };
                    save_alert_to_history(&conn, &alert);
                    alerts.push(alert);
                }
            }
        }
    }
    
    Ok(alerts)
}

/// アラート履歴取得リクエスト
#[derive(Debug, Serialize, Deserialize)]
pub struct GetAlertHistoryRequest {
    pub api_id: Option<String>,
    pub unresolved_only: Option<bool>,
    pub limit: Option<i32>,
}

/// アラート履歴情報（フロントエンド用）
#[derive(Debug, Serialize, Deserialize)]
pub struct AlertHistoryInfo {
    pub id: String,
    pub api_id: String,
    pub alert_type: String,
    pub current_value: f64,
    pub threshold: f64,
    pub message: String,
    pub timestamp: String,
    pub resolved_at: Option<String>,
}

/// アラート履歴を取得
#[tauri::command]
pub async fn get_alert_history(request: GetAlertHistoryRequest) -> Result<Vec<AlertHistoryInfo>, String> {
    let conn = get_connection().map_err(|_| {
        "データの読み込みに失敗しました。アプリを再起動して再度お試しください。".to_string()
    })?;
    
    let history_repo = AlertHistoryRepository::new(&conn);
    
    let alerts = if let Some(api_id) = request.api_id {
        history_repo.find_by_api_id(&api_id, request.limit).map_err(|e| {
            format!("アラート履歴の取得に失敗しました: {}", e)
        })?
    } else {
        history_repo.find_all(request.unresolved_only.unwrap_or(false), request.limit).map_err(|e| {
            format!("アラート履歴の取得に失敗しました: {}", e)
        })?
    };
    
    let result: Vec<AlertHistoryInfo> = alerts.into_iter().map(|alert| {
        AlertHistoryInfo {
            id: alert.id,
            api_id: alert.api_id,
            alert_type: alert.alert_type,
            current_value: alert.current_value,
            threshold: alert.threshold,
            message: alert.message,
            timestamp: alert.timestamp.to_rfc3339(),
            resolved_at: alert.resolved_at.map(|dt| dt.to_rfc3339()),
        }
    }).collect();
    
    Ok(result)
}

/// アラートを解決済みとしてマーク
#[tauri::command]
pub async fn resolve_alert(alert_id: String) -> Result<(), String> {
    let conn = get_connection().map_err(|_| {
        "データの保存に失敗しました。アプリを再起動して再度お試しください。".to_string()
    })?;
    
    let history_repo = AlertHistoryRepository::new(&conn);
    history_repo.mark_resolved(&alert_id).map_err(|e| {
        format!("アラートの解決に失敗しました: {}", e)
    })?;
    
    Ok(())
}

/// 複数のアラートを一括で解決済みとしてマーク
#[tauri::command]
pub async fn resolve_alerts(alert_ids: Vec<String>) -> Result<usize, String> {
    let conn = get_connection().map_err(|_| {
        "データの保存に失敗しました。アプリを再起動して再度お試しください。".to_string()
    })?;
    
    let history_repo = AlertHistoryRepository::new(&conn);
    let mut resolved_count = 0;
    
    for alert_id in alert_ids {
        if history_repo.mark_resolved(&alert_id).is_ok() {
            resolved_count += 1;
        }
    }
    
    Ok(resolved_count)
}

