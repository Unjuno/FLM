// Scheduler Module
// 定期タスク実行機能（モデルカタログの定期更新、自動バックアップ等）

use crate::utils::error::AppError;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::Mutex;
use std::fs;
use std::path::PathBuf;
use once_cell::sync::Lazy;

/// スケジュール設定
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScheduleConfig {
    pub task_type: TaskType,
    pub interval_seconds: u64,
    pub enabled: bool,
    pub last_run: Option<String>,
    pub next_run: Option<String>,
}

/// タスクタイプ
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum TaskType {
    UpdateModelCatalog,  // モデルカタログ更新
    AutoBackup,          // 自動バックアップ
    SyncSettings,        // 設定同期
    CleanupLogs,         // ログクリーンアップ
    CertificateRenewal,  // 証明書更新
    ApiKeyRotation,      // APIキーローテーション
}

/// スケジューラー
pub struct Scheduler {
    tasks: Arc<Mutex<Vec<ScheduleConfig>>>,
}

impl Scheduler {
    pub fn new() -> Self {
        Scheduler {
            tasks: Arc::new(Mutex::new(Vec::new())),
        }
    }
    
    /// タスクを追加
    pub async fn add_task(&self, config: ScheduleConfig) -> Result<(), AppError> {
        let mut tasks = self.tasks.lock().await;
        tasks.push(config);
        Ok(())
    }
}

/// スケジュールタスクを追加（便利関数）
/// グローバルスケジューラーインスタンスを使用
static GLOBAL_SCHEDULER: Lazy<Arc<Mutex<Scheduler>>> = Lazy::new(|| {
    Arc::new(Mutex::new(Scheduler::new()))
});

pub async fn add_schedule_task(
    _task_id: &str,
    task_type: TaskType,
    _api_id: &str,
    interval_seconds: u64,
) -> Result<(), AppError> {
    let config = ScheduleConfig {
        task_type,
        interval_seconds,
        enabled: true,
        last_run: None,
        next_run: None,
    };
    
    // グローバルスケジューラーにタスクを追加
    let scheduler = GLOBAL_SCHEDULER.lock().await;
    scheduler.add_task(config).await?;
    
    Ok(())
}

impl Scheduler {
    /// タスクを開始
    pub async fn start_task(&self, task_type: TaskType) -> Result<(), AppError> {
        let tasks = self.tasks.lock().await;
        let task = tasks.iter().find(|t| t.task_type == task_type);
        
        if let Some(task) = task {
            if !task.enabled {
                return Err(AppError::ApiError {
                    message: format!("タスク {} は無効です", format!("{:?}", task_type)),
                    code: "TASK_DISABLED".to_string(),
                    source_detail: None,
                });
            }
            
            match task.task_type {
                TaskType::UpdateModelCatalog => {
                    // モデルカタログ更新を実行
                    use crate::database::connection::get_connection;
                    use crate::database::repository::ModelCatalogRepository;
                    use crate::utils::model_catalog_data::get_predefined_model_catalog;
                    
                    let updated_count = tokio::task::spawn_blocking(|| {
                        let conn = get_connection().map_err(|e| AppError::DatabaseError {
                            message: format!("データベース接続エラー: {}", e),
                            source_detail: None,
                        })?;
                        
                        let catalog_repo = ModelCatalogRepository::new(&conn);
                        let predefined_models = get_predefined_model_catalog();
                        let mut updated_count = 0u32;
                        
                        for model in predefined_models {
                            match catalog_repo.upsert(&model) {
                                Ok(_) => updated_count += 1,
                                Err(e) => {
                                    eprintln!("モデルカタログの更新エラー ({}): {}", model.name, e);
                                }
                            }
                        }
                        
                        Ok::<u32, AppError>(updated_count)
                    }).await.map_err(|e| AppError::ProcessError {
                        message: format!("タスク実行エラー: {}", e),
                        source_detail: None,
                    })??;
                    
                    eprintln!("モデルカタログ更新完了: {}件更新", updated_count);
                },
                TaskType::AutoBackup => {
                    // 自動バックアップを実行
                    use crate::database::connection::get_app_data_dir;
                    use crate::commands::backup::create_backup;
                    use chrono::Utc;
                    
                    let app_data_dir = get_app_data_dir().map_err(|e| AppError::IoError {
                        message: format!("アプリデータディレクトリ取得エラー: {}", e),
                        source_detail: None,
                    })?;
                    
                    let backup_dir = app_data_dir.join("backups");
                    std::fs::create_dir_all(&backup_dir).map_err(|e| AppError::IoError {
                        message: format!("バックアップディレクトリ作成エラー: {}", e),
                        source_detail: None,
                    })?;
                    
                    // バックアップファイル名を生成（タイムスタンプ付き）
                    let timestamp = Utc::now().format("%Y%m%d_%H%M%S");
                    let backup_filename = format!("auto_backup_{}.json", timestamp);
                    let backup_path = backup_dir.join(&backup_filename);
                    
                    // 自動バックアップは暗号化を有効にする（デフォルトパスワードを使用）
                    // セキュリティのため、自動バックアップは常に暗号化される
                    let default_password = "auto_backup_default_password_change_in_settings".to_string();
                    
                    // バックアップを作成（暗号化有効）
                    match create_backup(
                        backup_path.to_string_lossy().to_string(),
                        Some(true), // 暗号化を有効にする
                        Some(default_password.clone()),
                    ).await {
                        Ok(_) => {
                            eprintln!("[INFO] 自動バックアップが正常に作成されました: {}", backup_path.display());
                        }
                        Err(e) => {
                            eprintln!("[ERROR] 自動バックアップの作成に失敗しました: {}", e);
                            // エラーが発生しても処理を続行（他のタスクに影響を与えないため）
                        }
                    }
                    
                    // 古いバックアップを削除（最新10個を保持）
                    cleanup_old_backups(&backup_dir).await;
                },
                TaskType::SyncSettings => {
                    // 設定同期を実行
                    // 実際の実装では、ユーザー設定から同期設定を取得して実行
                    // 現在は簡易実装として、設定データをエクスポートしてローカルファイルに保存
                    use crate::utils::remote_sync;
                    use crate::database::connection::get_app_data_dir;
                    
                    // 設定データをエクスポート
                    if let Ok(settings_data) = remote_sync::export_settings_for_remote().await {
                        // ローカルファイルに保存
                        if let Ok(app_data_dir) = get_app_data_dir() {
                            let sync_dir = app_data_dir.join("sync");
                            let _ = std::fs::create_dir_all(&sync_dir);
                            let sync_file = sync_dir.join("settings_backup.json");
                            let _ = std::fs::write(&sync_file, &settings_data);
                        }
                    }
                },
                TaskType::CleanupLogs => {
                    // ログクリーンアップを実行
                    use crate::database::connection::get_connection;
                    use crate::database::repository::{RequestLogRepository, UserSettingRepository};
                    use rusqlite::params;
                    use chrono::{Utc, Duration};
                    
                    // データベース操作をブロッキングタスクで実行
                    let _deleted_count = tokio::task::spawn_blocking(|| {
                        let conn = get_connection().map_err(|e| AppError::DatabaseError {
                            message: format!("データベース接続エラー: {}", e),
                            source_detail: None,
                        })?;
                        
                        // ログ保持期間設定を取得（デフォルト: 30日）
                        let settings_repo = UserSettingRepository::new(&conn);
                        let log_retention_days = settings_repo.get("log_retention_days")
                            .map_err(|e| AppError::DatabaseError {
                                message: format!("設定の読み込みに失敗しました: {}", e),
                                source_detail: None,
                            })?
                            .and_then(|v| v.parse::<i64>().ok())
                            .unwrap_or(30); // デフォルト: 30日
                        
                        // リクエストログの自動削除（log_retention_daysより古いもの）
                        let request_log_repo = RequestLogRepository::new(&conn);
                        let request_cutoff_date = (Utc::now() - Duration::days(log_retention_days)).to_rfc3339();
                        let deleted_request_logs = request_log_repo.delete_by_date_range(
                            None, // 全API
                            Some(&request_cutoff_date),
                        ).map_err(|e| AppError::DatabaseError {
                            message: format!("リクエストログの削除に失敗しました: {}", e),
                            source_detail: None,
                        })?;
                        
                        // 監査ログの自動削除（設定可能な保持期間より古いもの）
                        let audit_retention_days = settings_repo.get("audit_log_retention_days")
                            .map_err(|e| AppError::DatabaseError {
                                message: format!("設定の読み込みに失敗しました: {}", e),
                                source_detail: None,
                            })?
                            .and_then(|v| v.parse::<i64>().ok())
                            .unwrap_or(90); // デフォルト: 90日
                        let audit_cutoff_date = (Utc::now() - Duration::days(audit_retention_days)).to_rfc3339();
                        let deleted_audit_logs = conn.execute(
                            "DELETE FROM audit_logs WHERE timestamp < ?1",
                            params![audit_cutoff_date],
                        ).map_err(|e| AppError::DatabaseError {
                            message: format!("監査ログの削除に失敗しました: {}", e),
                            source_detail: None,
                        })?;
                        
                        // パフォーマンスメトリクスの自動削除（90日以上古いもの）
                        let metrics_cutoff_date = (Utc::now() - Duration::days(90)).to_rfc3339();
                        let deleted_metrics = conn.execute(
                            "DELETE FROM performance_metrics WHERE timestamp < ?1",
                            params![metrics_cutoff_date],
                        ).map_err(|e| AppError::DatabaseError {
                            message: format!("パフォーマンスメトリクスの削除に失敗しました: {}", e),
                            source_detail: None,
                        })?;
                        
                        #[cfg(debug_assertions)]
                        {
                            eprintln!(
                                "[CleanupLogs] 削除完了: リクエストログ {}件, 監査ログ {}件, メトリクス {}件",
                                deleted_request_logs,
                                deleted_audit_logs,
                                deleted_metrics
                            );
                        }
                        
                        Ok::<usize, AppError>(deleted_request_logs + deleted_audit_logs + deleted_metrics)
                    }).await.map_err(|e| AppError::ProcessError {
                        message: format!("タスク実行エラー: {}", e),
                        source_detail: None,
                    })?;
                },
                TaskType::CertificateRenewal => {
                    // 証明書更新を実行（将来の実装）
                    eprintln!("証明書更新タスク: 未実装");
                },
                TaskType::ApiKeyRotation => {
                    // APIキーローテーションを実行（将来の実装）
                    eprintln!("APIキーローテーションタスク: 未実装");
                },
            }
        }
        
        Ok(())
    }
    
    /// タスク一覧を取得
    pub async fn get_tasks(&self) -> Vec<ScheduleConfig> {
        let tasks = self.tasks.lock().await;
        tasks.clone()
    }
    
    /// タスクを更新
    pub async fn update_task(
        &self,
        task_type: TaskType,
        enabled: Option<bool>,
        interval_seconds: Option<u64>,
    ) -> Result<(), AppError> {
        let mut tasks = self.tasks.lock().await;
        
        if let Some(task) = tasks.iter_mut().find(|t| t.task_type == task_type) {
            if let Some(enabled) = enabled {
                task.enabled = enabled;
            }
            if let Some(interval) = interval_seconds {
                task.interval_seconds = interval;
            }
            Ok(())
        } else {
            Err(AppError::ApiError {
                message: format!("タスク {:?} が見つかりません", task_type),
                code: "TASK_NOT_FOUND".to_string(),
                source_detail: None,
            })
        }
    }
    
    /// タスクを停止（無効化）
    pub async fn stop_task(&self, task_type: TaskType) -> Result<(), AppError> {
        let mut tasks = self.tasks.lock().await;
        
        if let Some(task) = tasks.iter_mut().find(|t| t.task_type == task_type) {
            task.enabled = false;
            Ok(())
        } else {
            Err(AppError::ApiError {
                message: format!("タスク {:?} が見つかりません", task_type),
                code: "TASK_NOT_FOUND".to_string(),
                source_detail: None,
            })
        }
    }
}

/// 古いバックアップファイルを削除（最新N個を保持）
async fn cleanup_old_backups(backup_dir: &PathBuf) {
    if let Ok(entries) = fs::read_dir(backup_dir) {
        let mut backup_files: Vec<(PathBuf, std::time::SystemTime)> = Vec::new();
        
        for entry in entries.flatten() {
            if let Ok(metadata) = entry.metadata() {
                if metadata.is_file() {
                    if let Some(ext) = entry.path().extension() {
                        if ext == "json" {
                            if let Ok(modified) = metadata.modified() {
                                backup_files.push((entry.path(), modified));
                            }
                        }
                    }
                }
            }
        }
        
        // 更新日時でソート（新しい順）
        backup_files.sort_by(|a, b| b.1.cmp(&a.1));
        
        // 最新10個を保持し、それ以外を削除
        const KEEP_COUNT: usize = 10;
        if backup_files.len() > KEEP_COUNT {
            for (path, _) in backup_files.iter().skip(KEEP_COUNT) {
                let _ = fs::remove_file(path);
            }
        }
    }
}
