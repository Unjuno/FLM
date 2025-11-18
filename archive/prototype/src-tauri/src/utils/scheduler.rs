// Scheduler Module
// 定期タスク実行機能（モデルカタログの定期更新、自動バックアップ等）

use crate::utils::error::AppError;
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::Mutex;

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
    UpdateModelCatalog, // モデルカタログ更新
    AutoBackup,         // 自動バックアップ
    SyncSettings,       // 設定同期
    CleanupLogs,        // ログクリーンアップ
    CertificateRenewal, // 証明書更新
    ApiKeyRotation,     // APIキーローテーション
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
static GLOBAL_SCHEDULER: Lazy<Arc<Mutex<Scheduler>>> =
    Lazy::new(|| Arc::new(Mutex::new(Scheduler::new())));

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
                    })
                    .await
                    .map_err(|e| AppError::ProcessError {
                        message: format!("タスク実行エラー: {}", e),
                        source_detail: None,
                    })??;

                    eprintln!("モデルカタログ更新完了: {}件更新", updated_count);
                }
                TaskType::AutoBackup => {
                    // 自動バックアップを実行
                    use crate::commands::backup::create_backup;
                    use crate::database::connection::get_app_data_dir;
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
                    let default_password =
                        "auto_backup_default_password_change_in_settings".to_string();

                    // バックアップを作成（暗号化有効）
                    match create_backup(
                        backup_path.to_string_lossy().to_string(),
                        Some(true), // 暗号化を有効にする
                        Some(default_password.clone()),
                    )
                    .await
                    {
                        Ok(_) => {
                            eprintln!(
                                "[INFO] 自動バックアップが正常に作成されました: {}",
                                backup_path.display()
                            );
                        }
                        Err(e) => {
                            eprintln!("[ERROR] 自動バックアップの作成に失敗しました: {}", e);
                            // エラーが発生しても処理を続行（他のタスクに影響を与えないため）
                        }
                    }

                    // 古いバックアップを削除（最新10個を保持）
                    cleanup_old_backups(&backup_dir).await;
                }
                TaskType::SyncSettings => {
                    // 設定同期を実行
                    // 実際の実装では、ユーザー設定から同期設定を取得して実行
                    // 現在は簡易実装として、設定データをエクスポートしてローカルファイルに保存
                    use crate::database::connection::get_app_data_dir;
                    use crate::utils::remote_sync;

                    // 設定データをエクスポート
                    match remote_sync::export_settings_for_remote().await {
                        Ok(settings_data) => {
                            // ローカルファイルに保存
                            match get_app_data_dir() {
                                Ok(app_data_dir) => {
                                    let sync_dir = app_data_dir.join("sync");
                                    match std::fs::create_dir_all(&sync_dir) {
                                        Ok(_) => {
                                            let sync_file = sync_dir.join("settings_backup.json");
                                            match std::fs::write(&sync_file, &settings_data) {
                                                Ok(_) => {
                                                    eprintln!("[INFO] 設定同期バックアップが正常に保存されました: {:?}", sync_file);
                                                }
                                                Err(e) => {
                                                    eprintln!("[WARN] 設定同期バックアップの保存に失敗しました: {}", e);
                                                }
                                            }
                                        }
                                        Err(e) => {
                                            eprintln!("[WARN] 設定同期ディレクトリの作成に失敗しました: {}", e);
                                        }
                                    }
                                }
                                Err(e) => {
                                    eprintln!("[WARN] アプリケーションデータディレクトリの取得に失敗しました: {}", e);
                                }
                            }
                        }
                        Err(e) => {
                            eprintln!("[WARN] 設定データのエクスポートに失敗しました: {}", e);
                        }
                    }
                }
                TaskType::CleanupLogs => {
                    // ログクリーンアップを実行
                    use crate::database::connection::get_connection;
                    use crate::database::repository::{
                        RequestLogRepository, UserSettingRepository,
                    };
                    use chrono::{Duration, Utc};
                    use rusqlite::params;

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
                }
                TaskType::CertificateRenewal => {
                    // 証明書更新を実行
                    // 注意: FLMではHTTPSが常に有効（HTTPは使用不可）のため、
                    // すべてのAPIに対して証明書の存在を確認し、必要に応じて更新します
                    use crate::database::connection::get_connection;
                    use crate::database::repository::ApiRepository;
                    use crate::utils::certificate::certificate_exists;

                    // データベース操作をブロッキングタスクで実行
                    let api_list = tokio::task::spawn_blocking(|| {
                        let conn = get_connection().map_err(|e| AppError::DatabaseError {
                            message: format!("データベース接続エラー: {}", e),
                            source_detail: None,
                        })?;

                        let api_repo = ApiRepository::new(&conn);
                        api_repo.find_all().map_err(|e| AppError::DatabaseError {
                            message: format!("API一覧取得エラー: {}", e),
                            source_detail: None,
                        })
                    })
                    .await
                    .map_err(|e| AppError::ProcessError {
                        message: format!("証明書更新タスク実行エラー: {}", e),
                        source_detail: None,
                    })??;

                    let mut renewed_count = 0u32;
                    let mut checked_count = 0u32;

                    // 各APIの証明書を確認
                    for api in api_list {
                        checked_count += 1;

                        // 証明書の存在を確認
                        if certificate_exists(&api.id) {
                            // 証明書が存在する場合、有効期限をチェック
                            // 注意: 現在の実装では、証明書の有効期限チェックは簡易版です
                            // 実際の証明書パースと有効期限の確認は将来の拡張で実装予定
                            // ここでは証明書の存在確認のみを行います

                            // 証明書ファイルの最終更新日時を確認（簡易的な有効期限チェック）
                            use crate::utils::certificate::get_cert_file_path;
                            use std::fs;
                            use std::time::SystemTime;

                            if let Ok(cert_path) = get_cert_file_path(&api.id) {
                                if let Ok(metadata) = fs::metadata(&cert_path) {
                                    if let Ok(modified) = metadata.modified() {
                                        // 証明書の有効期限は通常90日（自己署名証明書の場合）
                                        // 60日以上経過している場合は更新を推奨
                                        match SystemTime::now().duration_since(modified) {
                                            Ok(cert_age) => {
                                                let days_old = cert_age.as_secs() / 86400;

                                                if days_old >= 60 {
                                                    eprintln!("[INFO] 証明書更新を推奨します: API ID={}, 証明書の経過日数={}日", api.id, days_old);
                                                    renewed_count += 1;
                                                }
                                            }
                                            Err(_) => {
                                                // システム時刻が証明書の更新時刻より古い場合（時刻設定の問題）
                                                eprintln!("[WARN] 証明書の更新日時を確認できません: API ID={} (システム時刻の問題の可能性があります)", api.id);
                                            }
                                        }
                                    }
                                }
                            }
                        } else {
                            // 証明書が存在しない場合は警告を出力
                            // 注意: FLMではHTTPSが必須のため、証明書がないAPIは起動できません
                            eprintln!(
                                "[WARN] 証明書が見つかりません: API ID={}, 名前={}",
                                api.id, api.name
                            );
                        }
                    }

                    if renewed_count > 0 {
                        eprintln!("[INFO] 証明書更新タスク完了: {}件の証明書が更新推奨です（確認したAPI数: {}件）", renewed_count, checked_count);
                    } else if checked_count > 0 {
                        eprintln!("[INFO] 証明書更新タスク完了: すべての証明書が有効です（確認したAPI数: {}件）", checked_count);
                    }
                }
                TaskType::ApiKeyRotation => {
                    // APIキーローテーションを実行
                    use crate::commands::api::regenerate_api_key;
                    use crate::database::connection::get_connection;
                    use crate::database::repository::{
                        security_repository::ApiSecuritySettingsRepository, ApiKeyRepository,
                        ApiRepository,
                    };
                    use chrono::{Duration, Utc};

                    // データベース操作をブロッキングタスクで実行
                    let api_list = tokio::task::spawn_blocking(|| {
                        let conn = get_connection().map_err(|e| AppError::DatabaseError {
                            message: format!("データベース接続エラー: {}", e),
                            source_detail: None,
                        })?;

                        let api_repo = ApiRepository::new(&conn);
                        api_repo.find_all().map_err(|e| AppError::DatabaseError {
                            message: format!("API一覧取得エラー: {}", e),
                            source_detail: None,
                        })
                    })
                    .await
                    .map_err(|e| AppError::ProcessError {
                        message: format!("APIキーローテーションタスク実行エラー: {}", e),
                        source_detail: None,
                    })??;

                    let mut rotated_count = 0u32;

                    // 各APIのキーローテーション設定を確認
                    for api in api_list {
                        // 認証が有効なAPIのみ処理
                        if api.enable_auth {
                            // セキュリティ設定を取得（ブロッキングタスクで実行）
                            let settings_result = tokio::task::spawn_blocking({
                                let api_id = api.id.clone();
                                move || {
                                    let conn =
                                        get_connection().map_err(|e| AppError::DatabaseError {
                                            message: format!("データベース接続エラー: {}", e),
                                            source_detail: None,
                                        })?;
                                    ApiSecuritySettingsRepository::find_by_api_id(&conn, &api_id)
                                        .map_err(|e| AppError::DatabaseError {
                                            message: format!("セキュリティ設定取得エラー: {}", e),
                                            source_detail: None,
                                        })
                                }
                            })
                            .await
                            .map_err(|e| AppError::ProcessError {
                                message: format!("タスク実行エラー: {}", e),
                                source_detail: None,
                            })?;

                            match settings_result {
                                Ok(Some(settings)) => {
                                    // キーローテーションが有効な場合のみ処理
                                    if settings.key_rotation_enabled {
                                        // APIキーの最終更新日時を取得
                                        let key_updated_result = tokio::task::spawn_blocking({
                                            let api_id = api.id.clone();
                                            move || {
                                                let conn = get_connection().map_err(|e| {
                                                    AppError::DatabaseError {
                                                        message: format!(
                                                            "データベース接続エラー: {}",
                                                            e
                                                        ),
                                                        source_detail: None,
                                                    }
                                                })?;
                                                let key_repo = ApiKeyRepository::new(&conn);
                                                key_repo.find_by_api_id(&api_id).map_err(|e| {
                                                    AppError::DatabaseError {
                                                        message: format!(
                                                            "APIキー取得エラー: {}",
                                                            e
                                                        ),
                                                        source_detail: None,
                                                    }
                                                })
                                            }
                                        })
                                        .await
                                        .map_err(|e| AppError::ProcessError {
                                            message: format!("タスク実行エラー: {}", e),
                                            source_detail: None,
                                        })?;

                                        // ローテーションが必要かチェック
                                        let should_rotate = match key_updated_result {
                                            Ok(Some(key_data)) => {
                                                let rotation_interval = Duration::days(
                                                    settings.key_rotation_interval_days as i64,
                                                );
                                                let last_updated = key_data.updated_at;
                                                let now = Utc::now();
                                                now.signed_duration_since(last_updated)
                                                    >= rotation_interval
                                            }
                                            Ok(None) => {
                                                // APIキーが存在しない場合はローテーション不要
                                                false
                                            }
                                            Err(_) => {
                                                // エラーが発生した場合はスキップ
                                                false
                                            }
                                        };

                                        if should_rotate {
                                            // APIキーを再生成（非同期で実行）
                                            match regenerate_api_key(api.id.clone()).await {
                                                Ok(_) => {
                                                    eprintln!("[INFO] APIキーローテーション完了: API ID={}", api.id);
                                                    rotated_count += 1;
                                                }
                                                Err(e) => {
                                                    eprintln!("[WARN] APIキーローテーション失敗: API ID={}, エラー={}", api.id, e);
                                                }
                                            }
                                        }
                                    }
                                }
                                Ok(None) => {
                                    // セキュリティ設定がない場合はスキップ
                                }
                                Err(e) => {
                                    eprintln!("[WARN] セキュリティ設定の取得に失敗しました: API ID={}, エラー={}", api.id, e);
                                }
                            }
                        }
                    }

                    if rotated_count > 0 {
                        eprintln!("[INFO] APIキーローテーションタスク完了: {}件のAPIキーがローテーションされました", rotated_count);
                    }
                }
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

/// 古いバックアップファイルを削除（設定に基づいて保持期間と保持数を適用）
async fn cleanup_old_backups(backup_dir: &PathBuf) {
    use crate::database::connection::get_connection;
    use crate::database::repository::UserSettingRepository;

    // データベースから保持設定を取得
    let (keep_count, retention_days) = tokio::task::spawn_blocking(|| {
        match get_connection() {
            Ok(conn) => {
                let settings_repo = UserSettingRepository::new(&conn);

                // 保持数を取得（デフォルト: 10個）
                let keep_count = settings_repo
                    .get("backup_keep_count")
                    .ok()
                    .flatten()
                    .and_then(|v| v.parse::<usize>().ok())
                    .unwrap_or(10);

                // 保持期間を取得（デフォルト: 30日）
                let retention_days = settings_repo
                    .get("backup_retention_days")
                    .ok()
                    .flatten()
                    .and_then(|v| v.parse::<u64>().ok())
                    .unwrap_or(30);

                Ok::<(usize, u64), String>((keep_count, retention_days))
            }
            Err(e) => {
                eprintln!(
                    "[WARN] バックアップ設定の取得に失敗しました: {}。デフォルト値を使用します",
                    e
                );
                Ok((10, 30)) // デフォルト値
            }
        }
    })
    .await
    .unwrap_or_else(|_| Ok((10, 30)))
    .unwrap_or((10, 30));

    if let Ok(entries) = fs::read_dir(backup_dir) {
        let mut backup_files: Vec<(PathBuf, std::time::SystemTime)> = Vec::new();
        let now = std::time::SystemTime::now();
        let retention_duration = std::time::Duration::from_secs(retention_days * 24 * 3600);

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

        let mut deleted_count = 0;
        let mut kept_count = 0;

        for (index, (path, modified)) in backup_files.iter().enumerate() {
            // 保持期間を超えたファイルを削除
            if let Ok(age) = now.duration_since(*modified) {
                if age > retention_duration {
                    if let Ok(_) = fs::remove_file(path) {
                        deleted_count += 1;
                        eprintln!(
                            "[INFO] 保持期間を超えたバックアップを削除しました: {:?}",
                            path
                        );
                    }
                    continue;
                }
            }

            // 保持数を超えたファイルを削除
            if index >= keep_count {
                if let Ok(_) = fs::remove_file(path) {
                    deleted_count += 1;
                    eprintln!(
                        "[INFO] 保持数を超えたバックアップを削除しました: {:?}",
                        path
                    );
                }
            } else {
                kept_count += 1;
            }
        }

        if deleted_count > 0 {
            eprintln!("[INFO] バックアップクリーンアップ完了: {}個を削除、{}個を保持（保持数: {}、保持期間: {}日）", 
                deleted_count, kept_count, keep_count, retention_days);
        }
    }
}
