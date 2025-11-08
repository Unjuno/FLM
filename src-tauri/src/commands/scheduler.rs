// Scheduler Commands
// スケジューラー機能のTauri IPCコマンド

use crate::utils::scheduler::{ScheduleConfig, TaskType, Scheduler};
use crate::utils::error::AppError;
use std::sync::Arc;
use tokio::sync::Mutex;
use once_cell::sync::Lazy;

/// グローバルスケジューラーインスタンス
static GLOBAL_SCHEDULER: Lazy<Arc<Mutex<Scheduler>>> = Lazy::new(|| {
    Arc::new(Mutex::new(Scheduler::new()))
});

/// スケジュールタスクを追加
#[tauri::command]
pub async fn add_schedule_task(
    _task_id: String,
    task_type: String,
    _api_id: String,
    interval_seconds: u64,
) -> Result<(), AppError> {
    let task_type_enum = match task_type.as_str() {
        "UpdateModelCatalog" => TaskType::UpdateModelCatalog,
        "AutoBackup" => TaskType::AutoBackup,
        "SyncSettings" => TaskType::SyncSettings,
        "CleanupLogs" => TaskType::CleanupLogs,
        "CertificateRenewal" => TaskType::CertificateRenewal,
        "ApiKeyRotation" => TaskType::ApiKeyRotation,
        _ => return Err(AppError::ApiError {
            message: format!("未知のタスクタイプ:  {}", task_type),
            code: "INVALID_TASK_TYPE".to_string(),
            source_detail: None,
        }),
    };
    
    let scheduler = GLOBAL_SCHEDULER.lock().await;
    scheduler.update_task(task_type_enum, Some(true), Some(interval_seconds)).await
}

/// スケジュールタスクを削除
#[tauri::command]
pub async fn delete_schedule_task(task_type: String) -> Result<(), AppError> {
    // 現在の実装では、タスクを無効化することで削除とみなす
    let task_type_enum = match task_type.as_str() {
        "UpdateModelCatalog" => TaskType::UpdateModelCatalog,
        "AutoBackup" => TaskType::AutoBackup,
        "SyncSettings" => TaskType::SyncSettings,
        "CleanupLogs" => TaskType::CleanupLogs,
        "CertificateRenewal" => TaskType::CertificateRenewal,
        "ApiKeyRotation" => TaskType::ApiKeyRotation,
        _ => return Err(AppError::ApiError {
            message: format!("未知のタスクタイプ:  {}", task_type),
            code: "INVALID_TASK_TYPE".to_string(),
            source_detail: None,
        }),
    };
    
    let scheduler = GLOBAL_SCHEDULER.lock().await;
    scheduler.start_task(task_type_enum).await
}

/// スケジュールタスクを停止
#[tauri::command]
pub async fn stop_schedule_task(task_type: String) -> Result<(), AppError> {
    let task_type_enum = match task_type.as_str() {
        "UpdateModelCatalog" => TaskType::UpdateModelCatalog,
        "AutoBackup" => TaskType::AutoBackup,
        "SyncSettings" => TaskType::SyncSettings,
        "CleanupLogs" => TaskType::CleanupLogs,
        "CertificateRenewal" => TaskType::CertificateRenewal,
        "ApiKeyRotation" => TaskType::ApiKeyRotation,
        _ => return Err(AppError::ApiError {
            message: format!("未知のタスクタイプ:  {}", task_type),
            code: "INVALID_TASK_TYPE".to_string(),
            source_detail: None,
        }),
    };
    
    let scheduler = GLOBAL_SCHEDULER.lock().await;
    scheduler.stop_task(task_type_enum).await
}

/// スケジュールタスク一覧を取得
#[tauri::command]
pub async fn get_schedule_tasks() -> Result<Vec<ScheduleConfig>, AppError> {
    let scheduler = GLOBAL_SCHEDULER.lock().await;
    Ok(scheduler.get_tasks().await)
}

/// スケジュールタスクを更新
#[tauri::command]
pub async fn update_schedule_task(
    task_type: String,
    enabled: Option<bool>,
    interval_seconds: Option<u64>,
) -> Result<(), AppError> {
    let task_type_enum = match task_type.as_str() {
        "UpdateModelCatalog" => TaskType::UpdateModelCatalog,
        "AutoBackup" => TaskType::AutoBackup,
        "SyncSettings" => TaskType::SyncSettings,
        "CleanupLogs" => TaskType::CleanupLogs,
        "CertificateRenewal" => TaskType::CertificateRenewal,
        "ApiKeyRotation" => TaskType::ApiKeyRotation,
        _ => return Err(AppError::ApiError {
            message: format!("未知のタスクタイプ: {}", task_type),
            code: "INVALID_TASK_TYPE".to_string(),
            source_detail: None,
        }),
    };
    
    let scheduler = GLOBAL_SCHEDULER.lock().await;
    scheduler.update_task(task_type_enum, enabled, interval_seconds).await
}

/// スケジュールタスクを開始
#[tauri::command]
pub async fn start_schedule_task(task_type: String) -> Result<(), AppError> {
    let task_type_enum = match task_type.as_str() {
        "UpdateModelCatalog" => TaskType::UpdateModelCatalog,
        "AutoBackup" => TaskType::AutoBackup,
        "SyncSettings" => TaskType::SyncSettings,
        "CleanupLogs" => TaskType::CleanupLogs,
        "CertificateRenewal" => TaskType::CertificateRenewal,
        "ApiKeyRotation" => TaskType::ApiKeyRotation,
        _ => return Err(AppError::ApiError {
            message: format!("未知のタスクタイプ: {}", task_type),
            code: "INVALID_TASK_TYPE".to_string(),
            source_detail: None,
        }),
    };
    
    let scheduler = GLOBAL_SCHEDULER.lock().await;
    scheduler.start_task(task_type_enum).await
}

/// モデルカタログを更新
#[tauri::command]
pub async fn update_model_catalog() -> Result<u32, AppError> {
    use crate::database::connection::get_connection;
    use crate::database::repository::ModelCatalogRepository;
    use crate::utils::model_catalog_data::get_predefined_model_catalog;
    
    // データベース操作をブロッキングタスクで実行
    let updated_count = tokio::task::spawn_blocking(|| {
        let conn = get_connection().map_err(|e| AppError::DatabaseError {
            message: format!("データベース接続エラー: {}", e),
            source_detail: None,
        })?;
        
        let catalog_data = get_predefined_model_catalog();
        let repo = ModelCatalogRepository::new(&conn);
        let mut updated_count = 0u32;
        
        for model in catalog_data {
            if repo.upsert(&model).is_ok() {
                updated_count += 1;
            }
        }
        
        Ok::<u32, AppError>(updated_count)
    }).await.map_err(|e| AppError::ProcessError {
        message: format!("タスク実行エラー: {}", e),
        source_detail: None,
    })??;
    
    Ok(updated_count)
}


