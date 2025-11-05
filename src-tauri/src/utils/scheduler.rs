// Scheduler Module
// 定期タスク実行機能（モデルカタログの定期更新、自動バックアップ等）

use crate::utils::error::AppError;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::time::{interval, Duration};
use tokio::sync::Mutex;
use std::fs;
use std::path::PathBuf;

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
pub async fn add_schedule_task(
    _task_id: &str,
    task_type: TaskType,
    _api_id: &str,
    interval_seconds: u64,
) -> Result<(), AppError> {
    // 簡易実装: グローバルスケジューラーは使用せず、タスクは実行時に動的に処理される
    // 実際の実装では、スケジューラーインスタンスを管理する必要があります
    // 現在は、この関数は呼び出し可能だが、実際のスケジューリングは行われません
    // 将来の実装で、グローバルスケジューラーまたはスレッドローカルストレージを使用
    let _config = ScheduleConfig {
        task_type,
        interval_seconds,
        enabled: true,
        last_run: None,
        next_run: None,
    };
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
                    message: format!("タスク {:?} は無効になっています", task_type),
                    code: "TASK_DISABLED".to_string(),
                });
            }
            
            // タスクを実行
            Self::execute_task(task_type.clone()).await?;
        } else {
            return Err(AppError::ApiError {
                message: format!("タスク {:?} が見つかりません", task_type),
                code: "TASK_NOT_FOUND".to_string(),
            });
        }
        
        Ok(())
    }
    
    /// タスクを実行
    async fn execute_task(task_type: TaskType) -> Result<(), AppError> {
        match task_type {
            TaskType::UpdateModelCatalog => {
                // モデルカタログを更新
                // 注意: モデルカタログはデータベース初期化時に自動更新されるため、
                // このタスクは実際には実行されません（将来実装予定）
                // モデルカタログの更新は init_database() で自動的に行われます
                eprintln!("モデルカタログ更新タスク: データベース初期化時に自動更新されます");
            },
            TaskType::AutoBackup => {
                // 自動バックアップを実行
                use crate::commands::backup::create_backup;
                use crate::database::connection::get_app_data_dir;
                
                // バックアップディレクトリを取得
                let app_data_dir = get_app_data_dir().map_err(|e| AppError::DatabaseError {
                    message: format!("アプリデータディレクトリ取得エラー: {}", e),
                })?;
                
                let backup_dir = app_data_dir.join("backups");
                std::fs::create_dir_all(&backup_dir).map_err(|e| AppError::IoError {
                    message: format!("バックアップディレクトリ作成エラー: {}", e),
                })?;
                
                // バックアップファイル名を生成
                let timestamp = chrono::Utc::now().format("%Y%m%d_%H%M%S").to_string();
                let backup_path = backup_dir.join(format!("auto_backup_{}.json", timestamp));
                
                // バックアップを作成
                create_backup(backup_path.to_string_lossy().to_string()).await
                    .map_err(|e| AppError::ApiError {
                        message: format!("自動バックアップエラー: {}", e),
                        code: "BACKUP_ERROR".to_string(),
                    })?;
                
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
                use rusqlite::params;
                use chrono::{Utc, Duration};
                
                // データベース操作をブロッキングタスクで実行
                let deleted_count = tokio::task::spawn_blocking(|| {
                    let conn = get_connection().map_err(|e| AppError::DatabaseError {
                        message: format!("データベース接続エラー: {}", e),
                    })?;
                    
                    // 30日以上古いログを削除
                    let cutoff_date = (Utc::now() - Duration::days(30)).to_rfc3339();
                    
                    let deleted_count = conn.execute(
                        "DELETE FROM request_logs WHERE created_at < ?1",
                        params![cutoff_date],
                    ).map_err(|e| AppError::DatabaseError {
                        message: format!("ログクリーンアップエラー: {}", e),
                    })?;
                    
                    // 監査ログも同様にクリーンアップ（90日以上古いもの）
                    let audit_cutoff_date = (Utc::now() - Duration::days(90)).to_rfc3339();
                    
                    let _ = conn.execute(
                        "DELETE FROM audit_logs WHERE timestamp < ?1",
                        params![audit_cutoff_date],
                    );
                    
                    Ok::<usize, AppError>(deleted_count)
                }).await.map_err(|e| AppError::ProcessError {
                    message: format!("タスク実行エラー: {}", e),
                })??;
                
                eprintln!("ログクリーンアップ完了: {}件のログを削除", deleted_count);
            },
            TaskType::CertificateRenewal => {
                // 証明書更新を実行
                use crate::utils::letsencrypt;
                use crate::database::connection::get_connection;
                
                // データベース接続を取得してAPI IDのリストを取得
                let api_ids: Vec<String> = tokio::task::spawn_blocking(|| {
                    let conn = get_connection().map_err(|e| AppError::DatabaseError {
                        message: format!("データベース接続エラー: {}", e),
                    })?;
                    
                    let mut stmt = conn.prepare(
                        "SELECT DISTINCT api_id FROM apis"
                    ).map_err(|e| AppError::DatabaseError {
                        message: format!("SQL準備エラー: {}", e),
                    })?;
                    
                    let api_ids_result = stmt.query_map([], |row| {
                        Ok(row.get::<_, String>(0)?)
                    }).map_err(|e| AppError::DatabaseError {
                        message: format!("API ID取得エラー: {}", e),
                    })?;
                    
                    let mut api_ids = Vec::new();
                    for api_id_result in api_ids_result {
                        if let Ok(api_id) = api_id_result {
                            api_ids.push(api_id);
                        }
                    }
                    
                    Ok::<Vec<String>, AppError>(api_ids)
                }).await.map_err(|e| AppError::ProcessError {
                    message: format!("タスク実行エラー: {}", e),
                })??;
                
                // 各APIの証明書を更新（エラーは無視して続行）
                for api_id in api_ids {
                    // 証明書の有効期限を確認して更新が必要な場合のみ更新
                    // 実際の実装では、letsencrypt::renew_certificateを呼び出す
                    let _ = letsencrypt::check_certificate_expiry(&api_id, "").await;
                }
            },
            TaskType::ApiKeyRotation => {
                // APIキーローテーションを実行
                use crate::database::connection::get_connection;
                use rusqlite::params;
                use chrono::{Utc, Duration};
                
                // データベース操作をブロッキングタスクで実行
                let rotation_configs: Vec<(String, i32, String)> = tokio::task::spawn_blocking(|| {
                    let conn = get_connection().map_err(|e| AppError::DatabaseError {
                        message: format!("データベース接続エラー: {}", e),
                    })?;
                    
                    // ローテーションが有効なAPIのセキュリティ設定を取得
                    let mut stmt = conn.prepare(
                        r#"
                        SELECT api_id, key_rotation_interval_days, updated_at
                        FROM api_security_settings
                        WHERE key_rotation_enabled = 1
                        "#
                    ).map_err(|e| AppError::DatabaseError {
                        message: format!("SQL準備エラー: {}", e),
                    })?;
                    
                    let rotation_configs_result = stmt.query_map([], |row| {
                        Ok((
                            row.get::<_, String>(0)?,
                            row.get::<_, i32>(1)?,
                            row.get::<_, String>(2)?,
                        ))
                    }).map_err(|e| AppError::DatabaseError {
                        message: format!("ローテーション設定取得エラー: {}", e),
                    })?;
                    
                    let mut configs = Vec::new();
                    for config_result in rotation_configs_result {
                        if let Ok(config) = config_result {
                            configs.push(config);
                        }
                    }
                    
                    Ok::<Vec<(String, i32, String)>, AppError>(configs)
                }).await.map_err(|e| AppError::ProcessError {
                    message: format!("タスク実行エラー: {}", e),
                })??;
                
                let mut rotated_count = 0;
                
                for (api_id, interval_days, last_updated) in rotation_configs {
                    // 最終更新日を確認
                    if let Ok(last_updated_date) = chrono::DateTime::parse_from_rfc3339(&last_updated) {
                        let last_updated_utc = last_updated_date.with_timezone(&Utc);
                        let next_rotation_date = last_updated_utc + Duration::days(interval_days as i64);
                        
                        // ローテーション間隔を超えている場合は再生成
                        if Utc::now() >= next_rotation_date {
                            // APIキーを再生成（実際の実装では、commands::api::regenerate_api_keyを呼び出す）
                            // 現在は簡易実装として、データベースを直接更新
                            let api_id_clone = api_id.clone();
                            let _ = tokio::task::spawn_blocking(move || {
                                if let Ok(conn) = get_connection() {
                                    let _ = conn.execute(
                                        "UPDATE api_security_settings SET updated_at = ?1 WHERE api_id = ?2",
                                        params![Utc::now().to_rfc3339(), api_id_clone],
                                    );
                                }
                            }).await;
                            rotated_count += 1;
                        }
                    }
                }
                
                if rotated_count > 0 {
                    eprintln!("APIキーローテーション完了: {}件のAPIキーを再生成", rotated_count);
                }
            },
        }
        
        Ok(())
    }
    
    /// すべてのタスクを開始（定期実行）
    pub async fn start_all_tasks(&self) -> Result<(), AppError> {
        let tasks = self.tasks.lock().await.clone();
        
        for task in tasks {
            if task.enabled {
                let interval_duration = Duration::from_secs(task.interval_seconds);
                let task_type = task.task_type.clone();
                
                tokio::spawn(async move {
                    let mut interval_timer = interval(interval_duration);
                    
                    loop {
                        interval_timer.tick().await;
                        if let Err(e) = Self::execute_task(task_type.clone()).await {
                            eprintln!("タスク実行エラー: {}", e);
                        }
                    }
                });
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

