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
            source_detail: None,
        })?;
        
        let security_settings = ApiSecuritySettingsRepository::find_by_api_id(&conn, &api_id)
            .map_err(|e| AppError::DatabaseError {
                message: format!("セキュリティ設定取得エラー: {}", e),
                source_detail: None,
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
            let window_start_iso = chrono::DateTime::from_timestamp(
                window_start * settings.rate_limit_window_seconds as i64,
                0
            ).ok_or_else(|| AppError::ApiError {
                message: "タイムスタンプ変換エラー".to_string(),
                code: "TIMESTAMP_ERROR".to_string(),
                source_detail: None,
            })?;
            
            // レート制限追跡を取得または作成
            let tracking = RateLimitTrackingRepository::find_by_api_and_identifier(
                &conn,
                &api_id,
                &identifier,
                &window_start_iso,
            ).map_err(|e| AppError::DatabaseError {
                message: format!("レート制限追跡取得エラー: {}", e),
                source_detail: None,
            })?;
            
            if let Some(mut track) = tracking {
                // リクエスト数を増加
                track.request_count += 1;
                RateLimitTrackingRepository::update(&conn, &track).map_err(|e| AppError::DatabaseError {
                    message: format!("レート制限追跡更新エラー: {}", e),
                    source_detail: None,
                })?;
                
                let remaining = (settings.rate_limit_requests - track.request_count).max(0);
                let allowed = track.request_count <= settings.rate_limit_requests;
                
                Ok(RateLimitResult {
                    allowed,
                    remaining,
                    reset_at: window_start_iso.to_rfc3339(),
                })
            } else {
                // 新しい追跡レコードを作成
                let _new_tracking = crate::database::models::RateLimitTracking {
                    id: uuid::Uuid::new_v4().to_string(),
                    api_id: api_id.clone(),
                    identifier: identifier.clone(),
                    window_start: window_start_iso,
                    request_count: 1,
                    created_at: Utc::now(),
                };
                
                RateLimitTrackingRepository::create(&conn, &api_id, &identifier, &window_start_iso).map_err(|e| AppError::DatabaseError {
                    message: format!("レート制限追跡作成エラー: {}", e),
                    source_detail: None,
                })?;
                
                let remaining = settings.rate_limit_requests - 1;
                Ok(RateLimitResult {
                    allowed: true,
                    remaining,
                    reset_at: window_start_iso.to_rfc3339(),
                })
            }
        } else {
            // セキュリティ設定がない場合は許可
            Ok(RateLimitResult {
                allowed: true,
                remaining: 1000,
                reset_at: Utc::now().to_rfc3339(),
            })
        }
    }).await.map_err(|e| AppError::ProcessError {
        message: format!("タスク実行エラー: {}", e),
        source_detail: None,
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
            source_detail: None,
        })?;
        
        let mut settings = ApiSecuritySettingsRepository::find_by_api_id(&conn, &api_id)
            .map_err(|e| AppError::DatabaseError {
                message: format!("セキュリティ設定取得エラー: {}", e),
                source_detail: None,
            })?
            .ok_or_else(|| AppError::ApiError {
                message: "セキュリティ設定が見つかりません".to_string(),
                code: "SETTINGS_NOT_FOUND".to_string(),
                source_detail: None,
            })?;
        
        settings.rate_limit_enabled = config.enabled;
        settings.rate_limit_requests = config.requests;
        settings.rate_limit_window_seconds = config.window_seconds;
        settings.updated_at = Utc::now();
        
        ApiSecuritySettingsRepository::update(&conn, &settings).map_err(|e| AppError::DatabaseError {
            message: format!("セキュリティ設定更新エラー: {}", e),
            source_detail: None,
        })?;
        
        Ok(())
    }).await.map_err(|e| AppError::ProcessError {
        message: format!("タスク実行エラー: {}", e),
        source_detail: None,
    })?
}
