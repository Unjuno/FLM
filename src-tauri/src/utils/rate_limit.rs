// Rate Limiting Module
// レート制限機能

use crate::utils::error::AppError;
use crate::database::connection::get_connection;
use crate::database::repository::security_repository::{ApiSecuritySettingsRepository, RateLimitTrackingRepository};
use chrono::Utc;
use serde::{Deserialize, Serialize};

/// レート制限設定
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RateLimitConfig {
    pub api_id: String,
    pub enabled: bool,
    pub requests: i32,        // リクエスト数
    pub window_seconds: i32,  // 時間窓（秒）
}

/// レート制限チェック結果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RateLimitResult {
    pub allowed: bool,
    pub remaining: i32,
    pub reset_at: String,
}

/// レート制限をチェック
pub async fn check_rate_limit(
    api_id: &str,
    identifier: &str, // APIキーハッシュまたはIPアドレス
) -> Result<RateLimitResult, AppError> {
    let api_id = api_id.to_string();
    let identifier = identifier.to_string();
    
    // データベース操作はspawn_blockingで実行
    let result = tokio::task::spawn_blocking(move || {
        let conn = get_connection().map_err(|e| AppError::DatabaseError {
            message: format!("データベース接続エラー: {}", e),
        })?;
        
        // セキュリティ設定を取得
        let security_settings = ApiSecuritySettingsRepository::find_by_api_id(&conn, &api_id).map_err(|e| AppError::DatabaseError {
            message: format!("セキュリティ設定取得エラー: {}", e),
        })?;
        
        if let Some(settings) = security_settings {
            if !settings.rate_limit_enabled {
                // レート制限が無効な場合は常に許可
                return Ok(RateLimitResult {
                    allowed: true,
                    remaining: settings.rate_limit_requests,
                    reset_at: Utc::now().to_rfc3339(),
                });
            }
            
            // 現在の時間窓を計算
            let now = Utc::now();
            let window_start = now.timestamp() / settings.rate_limit_window_seconds as i64;
            let window_start_iso = chrono::DateTime::from_timestamp(window_start * settings.rate_limit_window_seconds as i64, 0)
                .ok_or_else(|| AppError::ApiError {
                    message: "タイムスタンプ変換エラー".to_string(),
                    code: "TIMESTAMP_ERROR".to_string(),
                })?;
            
            // レート制限追跡を取得または作成
            let mut tracking = RateLimitTrackingRepository::find_by_api_and_identifier(
                &conn,
                &api_id,
                &identifier,
                &window_start_iso,
            ).map_err(|e| AppError::DatabaseError {
                message: format!("レート制限追跡取得エラー: {}", e),
            })?;
            
            if tracking.is_none() {
                // 新しい時間窓の場合は、新しい追跡レコードを作成
                tracking = Some(RateLimitTrackingRepository::create(
                    &conn,
                    &api_id,
                    &identifier,
                    &window_start_iso,
                ).map_err(|e| AppError::DatabaseError {
                    message: format!("レート制限追跡作成エラー: {}", e),
                })?);
            }
            
            if let Some(mut track) = tracking {
                // リクエスト数を増加
                track.request_count += 1;
                RateLimitTrackingRepository::update(&conn, &track).map_err(|e| AppError::DatabaseError {
                    message: format!("レート制限追跡更新エラー: {}", e),
                })?;
                
                // レート制限チェック
                let allowed = track.request_count <= settings.rate_limit_requests;
                let remaining = if allowed {
                    settings.rate_limit_requests - track.request_count
                } else {
                    0
                };
                
                // リセット時刻を計算
                let reset_at = window_start_iso + chrono::Duration::seconds(settings.rate_limit_window_seconds as i64);
                
                Ok(RateLimitResult {
                    allowed,
                    remaining,
                    reset_at: reset_at.to_rfc3339(),
                })
            } else {
                Err(AppError::ApiError {
                    message: "レート制限追跡の取得に失敗しました".to_string(),
                    code: "TRACKING_ERROR".to_string(),
                })
            }
        } else {
            // セキュリティ設定が存在しない場合は、レート制限なし
            Ok(RateLimitResult {
                allowed: true,
                remaining: 100, // デフォルト値
                reset_at: Utc::now().to_rfc3339(),
            })
        }
    }).await.map_err(|e| AppError::ApiError {
        message: format!("タスク実行エラー: {}", e),
        code: "TASK_ERROR".to_string(),
    })?;
    
    result
}

/// レート制限設定を更新
pub async fn update_rate_limit_config(
    api_id: &str,
    config: RateLimitConfig,
) -> Result<(), AppError> {
    let api_id = api_id.to_string();
    let config = config.clone();
    
    tokio::task::spawn_blocking(move || {
        let conn = get_connection().map_err(|e| AppError::DatabaseError {
            message: format!("データベース接続エラー: {}", e),
        })?;
        
        let mut settings = ApiSecuritySettingsRepository::find_by_api_id(&conn, &api_id).map_err(|e| AppError::DatabaseError {
            message: format!("セキュリティ設定取得エラー: {}", e),
        })?
        .ok_or_else(|| AppError::ApiError {
            message: "セキュリティ設定が見つかりません".to_string(),
            code: "SETTINGS_NOT_FOUND".to_string(),
        })?;
        
        settings.rate_limit_enabled = config.enabled;
        settings.rate_limit_requests = config.requests;
        settings.rate_limit_window_seconds = config.window_seconds;
        settings.updated_at = Utc::now();
        
        ApiSecuritySettingsRepository::update(&conn, &settings).map_err(|e| AppError::DatabaseError {
            message: format!("セキュリティ設定更新エラー: {}", e),
        })?;
        
        Ok(())
    }).await.map_err(|e| AppError::ApiError {
        message: format!("タスク実行エラー: {}", e),
        code: "TASK_ERROR".to_string(),
    })?
}
