// Audit Log Module
// 監査ログ機能

use crate::utils::error::AppError;
use chrono::Utc;
use hex;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

/// 監査ログエントリ
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditLogEntry {
    pub id: String,
    pub api_id: String,
    pub user_id: Option<String>,
    pub action: AuditAction,
    pub resource_type: String,
    pub resource_id: Option<String>,
    pub details: Option<String>, // JSON形式で詳細情報を保存
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub timestamp: String,
    pub success: bool,
}

/// 監査アクション
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum AuditAction {
    Create,         // 作成
    Read,           // 読み取り
    Update,         // 更新
    Delete,         // 削除
    Start,          // 起動
    Stop,           // 停止
    Login,          // ログイン
    Logout,         // ログアウト
    Share,          // 共有
    Unshare,        // 共有解除
    Custom(String), // カスタムアクション
}

/// IPアドレスをハッシュ化（プライバシー保護）
fn hash_ip_address(ip: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(ip.as_bytes());
    let hash = hasher.finalize();
    format!("ip_{}", hex::encode(&hash[..8])) // 最初の8バイトのみ使用（16文字）
}

/// ユーザーエージェントを簡略化（プライバシー保護）
fn simplify_user_agent(ua: &str) -> String {
    // ブラウザ名のみを抽出（バージョン情報は除外）
    // 例: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    // -> "Chrome"

    let ua_lower = ua.to_lowercase();

    // 主要なブラウザ名を検出
    if ua_lower.contains("chrome") && !ua_lower.contains("edg") {
        "Chrome".to_string()
    } else if ua_lower.contains("firefox") {
        "Firefox".to_string()
    } else if ua_lower.contains("safari") && !ua_lower.contains("chrome") {
        "Safari".to_string()
    } else if ua_lower.contains("edg") {
        "Edge".to_string()
    } else if ua_lower.contains("opera") {
        "Opera".to_string()
    } else if ua_lower.contains("msie") || ua_lower.contains("trident") {
        "Internet Explorer".to_string()
    } else {
        // ブラウザ名が特定できない場合は、最初の50文字に制限
        ua.chars().take(50).collect()
    }
}

/// 監査ログを記録
pub async fn log_audit_event(
    api_id: &str,
    action: AuditAction,
    resource_type: &str,
    resource_id: Option<&str>,
    details: Option<&str>,
    ip_address: Option<&str>,
    user_agent: Option<&str>,
    user_id: Option<&str>,
    success: bool,
) -> Result<AuditLogEntry, AppError> {
    use crate::database::connection::get_connection;
    use crate::database::repository::UserSettingRepository;

    // 設定を確認してIPアドレスを含めるかどうかを決定
    let conn = get_connection().map_err(|e| AppError::DatabaseError {
        message: format!("データベース接続エラー: {}", e),
        source_detail: None,
    })?;

    let settings_repo = UserSettingRepository::new(&conn);
    let include_ip = settings_repo
        .get("include_ip_address_in_audit_log")
        .ok()
        .flatten()
        .and_then(|v| v.parse::<bool>().ok())
        .unwrap_or(true); // デフォルト: 有効

    // IPアドレスとユーザーエージェントをプライバシー保護処理
    let processed_ip = if include_ip {
        ip_address.map(|ip| hash_ip_address(ip))
    } else {
        None // IPアドレスを含めない設定の場合はNone
    };
    let processed_ua = user_agent.map(|ua| simplify_user_agent(ua));

    let entry = AuditLogEntry {
        id: uuid::Uuid::new_v4().to_string(),
        api_id: api_id.to_string(),
        user_id: user_id.map(|s| s.to_string()),
        action: action.clone(),
        resource_type: resource_type.to_string(),
        resource_id: resource_id.map(|s| s.to_string()),
        details: details.map(|s| s.to_string()),
        ip_address: processed_ip,
        user_agent: processed_ua,
        timestamp: Utc::now().to_rfc3339(),
        success,
    };

    // アクションを文字列に変換
    let action_str = match &action {
        AuditAction::Create => "Create",
        AuditAction::Read => "Read",
        AuditAction::Update => "Update",
        AuditAction::Delete => "Delete",
        AuditAction::Start => "Start",
        AuditAction::Stop => "Stop",
        AuditAction::Login => "Login",
        AuditAction::Logout => "Logout",
        AuditAction::Share => "Share",
        AuditAction::Unshare => "Unshare",
        AuditAction::Custom(s) => s.as_str(),
    };

    use rusqlite::params;
    conn.execute(
        "INSERT INTO audit_logs (id, api_id, user_id, action, resource_type, resource_id, details, ip_address, user_agent, timestamp, success)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        params![
            entry.id,
            entry.api_id,
            entry.user_id,
            action_str,
            entry.resource_type,
            entry.resource_id,
            entry.details,
            entry.ip_address,
            entry.user_agent,
            entry.timestamp,
            if entry.success { 1 } else { 0 },
        ],
    ).map_err(|e| AppError::DatabaseError {
        message: format!("監査ログ記録エラー: {}", e),
        source_detail: None,
    })?;

    Ok(entry)
}

/// 監査ログを検索
pub async fn search_audit_logs(
    api_id: Option<&str>,
    action: Option<AuditAction>,
    resource_type: Option<&str>,
    start_date: Option<&str>,
    end_date: Option<&str>,
    limit: Option<u32>,
) -> Result<Vec<AuditLogEntry>, AppError> {
    use crate::database::connection::get_connection;

    let conn = get_connection().map_err(|e| AppError::DatabaseError {
        message: format!("データベース接続エラー: {}", e),
        source_detail: None,
    })?;

    // SQLクエリを構築
    let mut sql = String::from(
        "SELECT id, api_id, user_id, action, resource_type, resource_id, details, ip_address, user_agent, timestamp, success FROM audit_logs WHERE 1=1"
    );
    let mut param_values: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    if let Some(id) = api_id {
        sql.push_str(" AND api_id = ?");
        param_values.push(Box::new(id));
    }

    if let Some(act) = action {
        sql.push_str(" AND action = ?");
        let action_str = match act {
            AuditAction::Create => "Create",
            AuditAction::Read => "Read",
            AuditAction::Update => "Update",
            AuditAction::Delete => "Delete",
            AuditAction::Start => "Start",
            AuditAction::Stop => "Stop",
            AuditAction::Login => "Login",
            AuditAction::Logout => "Logout",
            AuditAction::Share => "Share",
            AuditAction::Unshare => "Unshare",
            AuditAction::Custom(s) => {
                return Err(AppError::ApiError {
                    message: format!("カスタムアクションでの検索はサポートされていません: {}", s),
                    code: "CUSTOM_ACTION_SEARCH_NOT_SUPPORTED".to_string(),
                    source_detail: None,
                })
            }
        };
        param_values.push(Box::new(action_str));
    }

    if let Some(r_type) = resource_type {
        sql.push_str(" AND resource_type = ?");
        param_values.push(Box::new(r_type));
    }

    if let Some(s_date) = start_date {
        sql.push_str(" AND timestamp >= ?");
        param_values.push(Box::new(s_date));
    }

    if let Some(e_date) = end_date {
        sql.push_str(" AND timestamp <= ?");
        param_values.push(Box::new(e_date));
    }

    sql.push_str(" ORDER BY timestamp DESC");

    if let Some(l) = limit {
        sql.push_str(&format!(" LIMIT {}", l));
    }

    // パラメータを参照のスライスに変換
    let param_refs: Vec<&dyn rusqlite::ToSql> = param_values
        .iter()
        .map(|p| p.as_ref() as &dyn rusqlite::ToSql)
        .collect();

    let mut stmt = conn.prepare(&sql).map_err(|e| AppError::DatabaseError {
        message: format!("SQL準備エラー: {}", e),
        source_detail: None,
    })?;

    let rows = stmt
        .query_map(rusqlite::params_from_iter(param_refs), |row| {
            let action_str: String = row.get(3)?;
            let action = match action_str.as_str() {
                "Create" => AuditAction::Create,
                "Read" => AuditAction::Read,
                "Update" => AuditAction::Update,
                "Delete" => AuditAction::Delete,
                "Start" => AuditAction::Start,
                "Stop" => AuditAction::Stop,
                "Login" => AuditAction::Login,
                "Logout" => AuditAction::Logout,
                "Share" => AuditAction::Share,
                "Unshare" => AuditAction::Unshare,
                s => AuditAction::Custom(s.to_string()),
            };

            Ok(AuditLogEntry {
                id: row.get(0)?,
                api_id: row.get(1)?,
                user_id: row.get(2)?,
                action,
                resource_type: row.get(4)?,
                resource_id: row.get(5)?,
                details: row.get(6)?,
                ip_address: row.get(7)?,
                user_agent: row.get(8)?,
                timestamp: row.get(9)?,
                success: row.get::<_, i32>(10)? != 0,
            })
        })
        .map_err(|e| AppError::DatabaseError {
            message: format!("監査ログ検索エラー: {}", e),
            source_detail: None,
        })?;

    let logs: Result<Vec<_>, _> = rows.collect();
    logs.map_err(|e| AppError::DatabaseError {
        message: format!("監査ログ読み込みエラー: {}", e),
        source_detail: None,
    })
}

/// エクスポート形式
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum ExportFormat {
    Json,
    Csv,
    Txt,
}

/// 監査ログをエクスポート
pub async fn export_audit_logs(
    format: ExportFormat,
    api_id: Option<&str>,
    action: Option<AuditAction>,
    resource_type: Option<&str>,
    start_date: Option<&str>,
    end_date: Option<&str>,
    exclude_ip_and_user_agent: bool,
) -> Result<String, AppError> {
    let logs = search_audit_logs(api_id, action, resource_type, start_date, end_date, None).await?;

    match format {
        ExportFormat::Csv => {
            // IPアドレスとユーザーエージェントを除外する場合はヘッダーを変更
            let header = if exclude_ip_and_user_agent {
                "id,api_id,user_id,action,resource_type,resource_id,details,timestamp,success\n"
            } else {
                "id,api_id,user_id,action,resource_type,resource_id,details,ip_address,user_agent,timestamp,success\n"
            };
            let mut csv = String::from(header);
            for log in &logs {
                let action_str = match &log.action {
                    AuditAction::Create => "Create",
                    AuditAction::Read => "Read",
                    AuditAction::Update => "Update",
                    AuditAction::Delete => "Delete",
                    AuditAction::Start => "Start",
                    AuditAction::Stop => "Stop",
                    AuditAction::Login => "Login",
                    AuditAction::Logout => "Logout",
                    AuditAction::Share => "Share",
                    AuditAction::Unshare => "Unshare",
                    AuditAction::Custom(s) => s.as_str(),
                };
                if exclude_ip_and_user_agent {
                    csv.push_str(&format!(
                        "{},{},{},{},{},{},{},{},{}\n",
                        log.id,
                        log.api_id,
                        log.user_id.as_ref().unwrap_or(&"".to_string()),
                        action_str,
                        log.resource_type,
                        log.resource_id.as_ref().unwrap_or(&"".to_string()),
                        log.details
                            .as_ref()
                            .unwrap_or(&"".to_string())
                            .replace(',', ";"),
                        log.timestamp,
                        if log.success { "true" } else { "false" }
                    ));
                } else {
                    csv.push_str(&format!(
                        "{},{},{},{},{},{},{},{},{},{},{}\n",
                        log.id,
                        log.api_id,
                        log.user_id.as_ref().unwrap_or(&"".to_string()),
                        action_str,
                        log.resource_type,
                        log.resource_id.as_ref().unwrap_or(&"".to_string()),
                        log.details
                            .as_ref()
                            .unwrap_or(&"".to_string())
                            .replace(',', ";"),
                        log.ip_address.as_ref().unwrap_or(&"".to_string()),
                        log.user_agent
                            .as_ref()
                            .unwrap_or(&"".to_string())
                            .replace(',', ";"),
                        log.timestamp,
                        if log.success { "true" } else { "false" }
                    ));
                }
            }
            Ok(csv)
        }
        ExportFormat::Txt => {
            let mut txt = String::new();
            for log in &logs {
                let action_str = match &log.action {
                    AuditAction::Create => "Create",
                    AuditAction::Read => "Read",
                    AuditAction::Update => "Update",
                    AuditAction::Delete => "Delete",
                    AuditAction::Start => "Start",
                    AuditAction::Stop => "Stop",
                    AuditAction::Login => "Login",
                    AuditAction::Logout => "Logout",
                    AuditAction::Share => "Share",
                    AuditAction::Unshare => "Unshare",
                    AuditAction::Custom(s) => s.as_str(),
                };
                if exclude_ip_and_user_agent {
                    txt.push_str(&format!(
                        "[{}] {} - {} - {} - {} - {}\n",
                        log.timestamp,
                        action_str,
                        log.api_id,
                        log.resource_type,
                        log.resource_id.as_ref().unwrap_or(&"N/A".to_string()),
                        if log.success { "SUCCESS" } else { "FAILED" }
                    ));
                } else {
                    let ip_info = log
                        .ip_address
                        .as_ref()
                        .map(|ip| format!(" IP:{}", ip))
                        .unwrap_or_default();
                    let ua_info = log
                        .user_agent
                        .as_ref()
                        .map(|ua| format!(" UA:{}", ua))
                        .unwrap_or_default();
                    txt.push_str(&format!(
                        "[{}] {} - {} - {} - {} - {}{}{}\n",
                        log.timestamp,
                        action_str,
                        log.api_id,
                        log.resource_type,
                        log.resource_id.as_ref().unwrap_or(&"N/A".to_string()),
                        if log.success { "SUCCESS" } else { "FAILED" },
                        ip_info,
                        ua_info
                    ));
                }
            }
            Ok(txt)
        }
        ExportFormat::Json => {
            // IPアドレスとユーザーエージェントを除外する場合は、フィールドを削除したログを作成
            let logs_to_export: Vec<serde_json::Value> = if exclude_ip_and_user_agent {
                logs.iter()
                    .map(|log| {
                        let log_json = serde_json::json!({
                            "id": log.id,
                            "api_id": log.api_id,
                            "user_id": log.user_id,
                            "action": match &log.action {
                                AuditAction::Create => "Create",
                                AuditAction::Read => "Read",
                                AuditAction::Update => "Update",
                                AuditAction::Delete => "Delete",
                                AuditAction::Start => "Start",
                                AuditAction::Stop => "Stop",
                                AuditAction::Login => "Login",
                                AuditAction::Logout => "Logout",
                                AuditAction::Share => "Share",
                                AuditAction::Unshare => "Unshare",
                                AuditAction::Custom(s) => s.as_str(),
                            },
                            "resource_type": log.resource_type,
                            "resource_id": log.resource_id,
                            "details": log.details,
                            "timestamp": log.timestamp,
                            "success": log.success,
                        });
                        log_json
                    })
                    .collect()
            } else {
                logs.iter()
                    .map(|log| {
                        serde_json::json!({
                            "id": log.id,
                            "api_id": log.api_id,
                            "user_id": log.user_id,
                            "action": match &log.action {
                                AuditAction::Create => "Create",
                                AuditAction::Read => "Read",
                                AuditAction::Update => "Update",
                                AuditAction::Delete => "Delete",
                                AuditAction::Start => "Start",
                                AuditAction::Stop => "Stop",
                                AuditAction::Login => "Login",
                                AuditAction::Logout => "Logout",
                                AuditAction::Share => "Share",
                                AuditAction::Unshare => "Unshare",
                                AuditAction::Custom(s) => s.as_str(),
                            },
                            "resource_type": log.resource_type,
                            "resource_id": log.resource_id,
                            "details": log.details,
                            "ip_address": log.ip_address,
                            "user_agent": log.user_agent,
                            "timestamp": log.timestamp,
                            "success": log.success,
                        })
                    })
                    .collect()
            };

            serde_json::to_string(&logs_to_export).map_err(|e| AppError::ApiError {
                message: format!("JSONシリアライズエラー: {}", e),
                code: "JSON_ERROR".to_string(),
                source_detail: None,
            })
        }
    }
}
