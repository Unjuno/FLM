// Audit Log Module
// 監査ログ機能

use crate::utils::error::AppError;
use serde::{Deserialize, Serialize};
use chrono::Utc;

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
    Create,    // 作成
    Read,      // 読み取り
    Update,    // 更新
    Delete,    // 削除
    Start,     // 起動
    Stop,      // 停止
    Login,     // ログイン
    Logout,    // ログアウト
    Share,     // 共有
    Unshare,   // 共有解除
    Custom(String), // カスタムアクション
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
    use rusqlite::params;
    
    let entry = AuditLogEntry {
        id: uuid::Uuid::new_v4().to_string(),
        api_id: api_id.to_string(),
        user_id: user_id.map(|s| s.to_string()),
        action: action.clone(),
        resource_type: resource_type.to_string(),
        resource_id: resource_id.map(|s| s.to_string()),
        details: details.map(|s| s.to_string()),
        ip_address: ip_address.map(|s| s.to_string()),
        user_agent: user_agent.map(|s| s.to_string()),
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
    
    let conn = get_connection().map_err(|e| AppError::DatabaseError {
        message: format!("データベース接続エラー: {}", e),
    })?;
    
    conn.execute(
        r#"
        INSERT INTO audit_logs (id, api_id, user_id, action, resource_type, resource_id, details, ip_address, user_agent, timestamp, success)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
        "#,
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
            if entry.success { 1 } else { 0 }
        ],
    ).map_err(|e| AppError::DatabaseError {
        message: format!("監査ログ保存エラー: {}", e),
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
    use rusqlite::params;
    
    let conn = get_connection().map_err(|e| AppError::DatabaseError {
        message: format!("データベース接続エラー: {}", e),
    })?;
    
    let limit = limit.unwrap_or(100);
    
    // 簡易実装: 条件ごとに別々のクエリを準備
    // より洗練された実装では、動的SQLビルダーを使用することを推奨
    let query = "SELECT id, api_id, user_id, action, resource_type, resource_id, details, ip_address, user_agent, timestamp, success FROM audit_logs WHERE (?1 IS NULL OR api_id = ?1) AND (?2 IS NULL OR action = ?2) AND (?3 IS NULL OR resource_type = ?3) AND (?4 IS NULL OR timestamp >= ?4) AND (?5 IS NULL OR timestamp <= ?5) ORDER BY timestamp DESC LIMIT ?6";
    
    let action_str = action.as_ref().map(|a| match a {
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
    });
    
    let mut stmt = conn.prepare(query).map_err(|e| AppError::DatabaseError {
        message: format!("SQL準備エラー: {}", e),
    })?;
    
    let rows = stmt.query_map(
        params![api_id, action_str, resource_type, start_date, end_date, limit],
        |row| {
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
        },
    ).map_err(|e| AppError::DatabaseError {
        message: format!("監査ログ検索エラー: {}", e),
    })?;
    
    let mut entries = Vec::new();
    for row_result in rows {
        entries.push(row_result?);
    }
    
    Ok(entries)
}

/// 監査ログをエクスポート
pub async fn export_audit_logs(
    api_id: Option<&str>,
    start_date: Option<&str>,
    end_date: Option<&str>,
    format: ExportFormat,
) -> Result<String, AppError> {
    // まずログを検索
    let logs = search_audit_logs(api_id, None, None, start_date, end_date, None).await?;
    
    match format {
        ExportFormat::Json => {
            serde_json::to_string(&logs).map_err(|e| AppError::ApiError {
                message: format!("JSONエクスポートエラー: {}", e),
                code: "JSON_ERROR".to_string(),
            })
        },
        ExportFormat::Csv => {
            let mut csv = String::from("id,api_id,user_id,action,resource_type,resource_id,details,ip_address,user_agent,timestamp,success\n");
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
                csv.push_str(&format!(
                    "{},{},{},{},{},{},{},{},{},{},{}\n",
                    log.id,
                    log.api_id,
                    log.user_id.as_ref().unwrap_or(&"".to_string()),
                    action_str,
                    log.resource_type,
                    log.resource_id.as_ref().unwrap_or(&"".to_string()),
                    log.details.as_ref().unwrap_or(&"".to_string()).replace(',', ";"),
                    log.ip_address.as_ref().unwrap_or(&"".to_string()),
                    log.user_agent.as_ref().unwrap_or(&"".to_string()).replace(',', ";"),
                    log.timestamp,
                    if log.success { "true" } else { "false" }
                ));
            }
            Ok(csv)
        },
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
                txt.push_str(&format!(
                    "[{}] {} - {} - {} - {} - {}\n",
                    log.timestamp,
                    action_str,
                    log.api_id,
                    log.resource_type,
                    log.resource_id.as_ref().unwrap_or(&"N/A".to_string()),
                    if log.success { "SUCCESS" } else { "FAILED" }
                ));
            }
            Ok(txt)
        },
    }
}

/// エクスポート形式
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum ExportFormat {
    Json,
    Csv,
    Txt,
}

