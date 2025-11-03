// バックアップ・復元コマンド
// バックエンドエージェント実装（F019: データ管理・バックアップ強化）

use serde::{Deserialize, Serialize};
use crate::database::connection::get_connection;
use crate::database::DatabaseError;
use rusqlite::Connection;
use std::fs;
use std::path::Path;
use chrono::Utc;

/// バックアップデータ構造
#[derive(Debug, Serialize, Deserialize)]
pub struct BackupData {
    pub version: String,
    pub created_at: String,
    pub apis: Vec<ApiBackupData>,
    pub api_keys: Vec<ApiKeyBackupData>,
    pub installed_models: Vec<InstalledModelBackupData>,
    pub request_logs: Vec<RequestLogBackupData>,
    pub alert_history: Vec<AlertHistoryBackupData>,
}

/// API設定のバックアップデータ
#[derive(Debug, Serialize, Deserialize)]
pub struct ApiBackupData {
    pub id: String,
    pub name: String,
    pub model: String,
    pub port: i32,
    pub enable_auth: bool,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
}

/// APIキーのバックアップデータ（暗号化されたキーのみ）
#[derive(Debug, Serialize, Deserialize)]
pub struct ApiKeyBackupData {
    pub api_id: String,
    pub key_hash: String,
    pub encrypted_key: String, // Base64エンコードされた暗号化キー
    pub created_at: String,
    pub updated_at: String,
}

/// インストール済みモデルのバックアップデータ
#[derive(Debug, Serialize, Deserialize)]
pub struct InstalledModelBackupData {
    pub name: String,
    pub size: i64,
    pub parameters: Option<i64>,
    pub installed_at: String,
    pub last_used_at: Option<String>,
    pub usage_count: i32,
}

/// リクエストログのバックアップデータ
#[derive(Debug, Serialize, Deserialize)]
pub struct RequestLogBackupData {
    pub id: String,
    pub api_id: String,
    pub method: String,
    pub path: String,
    pub request_body: Option<String>,
    pub response_status: Option<i32>,
    pub response_time_ms: Option<i32>,
    pub error_message: Option<String>,
    pub created_at: String,
}

/// アラート履歴のバックアップデータ
#[derive(Debug, Serialize, Deserialize)]
pub struct AlertHistoryBackupData {
    pub id: String,
    pub api_id: String,
    pub alert_type: String,
    pub current_value: f64,
    pub threshold: f64,
    pub message: String,
    pub timestamp: String,
    pub resolved_at: Option<String>,
}

/// バックアップ作成レスポンス
#[derive(Debug, Serialize, Deserialize)]
pub struct BackupResponse {
    pub file_path: String,
    pub file_size: u64,
    pub api_count: usize,
    pub model_count: usize,
    pub log_count: usize,
    pub alert_history_count: usize,
    pub json_data: String, // バックアップデータのJSON文字列（フロントエンドでダウンロード用）
}

/// バックアップ作成コマンド
/// データベース全体をJSON形式でバックアップします
#[tauri::command]
pub async fn create_backup(output_path: String) -> Result<BackupResponse, String> {
    // データベース接続を取得
    let conn = get_connection().map_err(|e| {
        format!("データベース接続エラー: {}", e)
    })?;

    // データを取得
    let backup_data = tokio::task::spawn_blocking({
        move || {
            // API情報を取得
            let apis = get_apis(&conn).map_err(|e| format!("API情報の取得に失敗しました: {}", e))?;
            
            // APIキー情報を取得（暗号化されたキーのみ）
            let api_keys = get_api_keys(&conn).map_err(|e| format!("APIキー情報の取得に失敗しました: {}", e))?;
            
            // インストール済みモデル情報を取得
            let installed_models = get_installed_models(&conn).map_err(|e| format!("モデル情報の取得に失敗しました: {}", e))?;
            
            // リクエストログを取得（最新1000件まで）
            let request_logs = get_request_logs(&conn, 1000).map_err(|e| format!("ログ情報の取得に失敗しました: {}", e))?;
            
            // アラート履歴を取得（最新1000件まで）
            let alert_history = get_alert_history(&conn, 1000).map_err(|e| format!("アラート履歴情報の取得に失敗しました: {}", e))?;

            Ok::<BackupData, String>(BackupData {
                version: "1.0".to_string(),
                created_at: Utc::now().to_rfc3339(),
                apis,
                api_keys,
                installed_models,
                request_logs,
                alert_history,
            })
        }
    }).await.map_err(|e| format!("データベース操作エラー: {}", e))??;

    // JSON形式でシリアライズ
    let json_data: String = serde_json::to_string_pretty(&backup_data).map_err(|e| {
        format!("JSONシリアライズエラー: {}", e)
    })?;

    // オプションでファイルに保存（output_pathが指定されている場合）
    if !output_path.is_empty() {
        if let Err(e) = fs::write(&output_path, &json_data) {
            eprintln!("ファイル保存警告: {}", e);
            // エラーを無視して続行（ファイル保存はオプション）
        }
    }

    // ファイルサイズを計算
    let file_size: u64 = json_data.len().try_into().unwrap_or(0u64);

    Ok(BackupResponse {
        file_path: output_path,
        file_size,
        api_count: backup_data.apis.len(),
        model_count: backup_data.installed_models.len(),
        log_count: backup_data.request_logs.len(),
        alert_history_count: backup_data.alert_history.len(),
        json_data, // JSONデータも返す
    })
}

/// 復元コマンド（ファイルパス版）
/// JSON形式のバックアップファイルからデータを復元します
#[tauri::command]
pub async fn restore_backup(backup_path: String) -> Result<RestoreResponse, String> {
    // ファイルが存在するか確認
    if !Path::new(&backup_path).exists() {
        return Err("バックアップファイルが見つかりません".to_string());
    }

    // ファイルを読み込む
    let json_data = fs::read_to_string(&backup_path).map_err(|e| {
        format!("ファイル読み込みエラー: {}", e)
    })?;

    restore_from_json(json_data).await
}

/// 復元コマンド（JSONデータ版）
/// JSON文字列から直接データを復元します（フロントエンドからファイル内容を送信する場合）
#[tauri::command]
pub async fn restore_backup_from_json(json_data: String) -> Result<RestoreResponse, String> {
    restore_from_json(json_data).await
}

/// JSONデータから復元する共通関数
async fn restore_from_json(json_data: String) -> Result<RestoreResponse, String> {

    // JSONをパース
    let backup_data: BackupData = serde_json::from_str(&json_data).map_err(|e| {
        format!("JSON解析エラー: {}", e)
    })?;

    // バージョン確認（将来的にバージョン互換性チェックを追加可能）
    if backup_data.version != "1.0" {
        return Err(format!("サポートされていないバックアップバージョンです: {}", backup_data.version));
    }

    // データベース接続を取得
    let conn = get_connection().map_err(|e| {
        format!("データベース接続エラー: {}", e)
    })?;

    // トランザクション内で復元処理を実行
    let restore_result = tokio::task::spawn_blocking(move || -> Result<RestoreResponse, DatabaseError> {
        let mut conn = conn; // クロージャ内でmutableとして扱う
        let tx = conn.transaction().map_err(|e| {
            DatabaseError::QueryFailed(format!("トランザクション開始エラー: {}", e))
        })?;

        // API設定を復元
        let api_count = restore_apis(&tx, &backup_data.apis)?;
        
        // APIキーを復元
        let api_key_count = restore_api_keys(&tx, &backup_data.api_keys)?;
        
        // インストール済みモデルを復元
        let model_count = restore_installed_models(&tx, &backup_data.installed_models)?;
        
        // リクエストログを復元
        let log_count = restore_request_logs(&tx, &backup_data.request_logs)?;
        
        // アラート履歴を復元
        let alert_history_count = restore_alert_history(&tx, &backup_data.alert_history)?;

        // コミット
        tx.commit().map_err(|e| {
            DatabaseError::QueryFailed(format!("トランザクションコミットエラー: {}", e))
        })?;

        Ok(RestoreResponse {
            api_count,
            api_key_count,
            model_count,
            log_count,
            alert_history_count,
        })
    }).await.map_err(|e| format!("データベース操作エラー: {}", e))?
    .map_err(|e| format!("復元エラー: {}", e))?;

    Ok(restore_result)
}

/// 復元レスポンス
#[derive(Debug, Serialize, Deserialize)]
pub struct RestoreResponse {
    pub api_count: usize,
    pub api_key_count: usize,
    pub model_count: usize,
    pub log_count: usize,
    pub alert_history_count: usize,
}

// データ取得関数

fn get_apis(conn: &Connection) -> Result<Vec<ApiBackupData>, DatabaseError> {
    let mut stmt = conn.prepare(
        "SELECT id, name, model, port, enable_auth, status, created_at, updated_at FROM apis"
    )?;

    let apis = stmt.query_map([], |row| {
        Ok(ApiBackupData {
            id: row.get(0)?,
            name: row.get(1)?,
            model: row.get(2)?,
            port: row.get(3)?,
            enable_auth: row.get(4)?,
            status: row.get(5)?,
            created_at: row.get(6)?,
            updated_at: row.get(7)?,
        })
    })?.collect::<Result<Vec<_>, _>>()?;

    Ok(apis)
}

fn get_api_keys(conn: &Connection) -> Result<Vec<ApiKeyBackupData>, DatabaseError> {
    use base64::{Engine as _, engine::general_purpose::STANDARD};

    let mut stmt = conn.prepare(
        "SELECT api_id, key_hash, encrypted_key, created_at, updated_at FROM api_keys"
    )?;

    let api_keys = stmt.query_map([], |row| {
        let encrypted_key_bytes: Vec<u8> = row.get(2)?;
        Ok(ApiKeyBackupData {
            api_id: row.get(0)?,
            key_hash: row.get(1)?,
            encrypted_key: STANDARD.encode(&encrypted_key_bytes),
            created_at: row.get(3)?,
            updated_at: row.get(4)?,
        })
    })?.collect::<Result<Vec<_>, _>>()?;

    Ok(api_keys)
}

fn get_installed_models(conn: &Connection) -> Result<Vec<InstalledModelBackupData>, DatabaseError> {
    let mut stmt = conn.prepare(
        "SELECT name, size, parameters, installed_at, last_used_at, usage_count FROM installed_models"
    )?;

    let models = stmt.query_map([], |row| {
        Ok(InstalledModelBackupData {
            name: row.get(0)?,
            size: row.get(1)?,
            parameters: row.get(2)?,
            installed_at: row.get(3)?,
            last_used_at: row.get(4)?,
            usage_count: row.get(5)?,
        })
    })?.collect::<Result<Vec<_>, _>>()?;

    Ok(models)
}

fn get_request_logs(conn: &Connection, limit: i32) -> Result<Vec<RequestLogBackupData>, DatabaseError> {
    let mut stmt = conn.prepare(
        "SELECT id, api_id, method, path, request_body, response_status, response_time_ms, error_message, created_at 
         FROM request_logs 
         ORDER BY created_at DESC 
         LIMIT ?"
    )?;

    let logs = stmt.query_map([limit], |row| {
        Ok(RequestLogBackupData {
            id: row.get(0)?,
            api_id: row.get(1)?,
            method: row.get(2)?,
            path: row.get(3)?,
            request_body: row.get(4)?,
            response_status: row.get(5)?,
            response_time_ms: row.get(6)?,
            error_message: row.get(7)?,
            created_at: row.get(8)?,
        })
    })?.collect::<Result<Vec<_>, _>>()?;

    Ok(logs)
}

fn get_alert_history(conn: &Connection, limit: i32) -> Result<Vec<AlertHistoryBackupData>, DatabaseError> {
    let mut stmt = conn.prepare(
        "SELECT id, api_id, alert_type, current_value, threshold, message, timestamp, resolved_at 
         FROM alert_history 
         ORDER BY timestamp DESC 
         LIMIT ?"
    )?;

    let alerts = stmt.query_map([limit], |row| {
        Ok(AlertHistoryBackupData {
            id: row.get(0)?,
            api_id: row.get(1)?,
            alert_type: row.get(2)?,
            current_value: row.get(3)?,
            threshold: row.get(4)?,
            message: row.get(5)?,
            timestamp: row.get(6)?,
            resolved_at: row.get(7)?,
        })
    })?.collect::<Result<Vec<_>, _>>()?;

    Ok(alerts)
}

// データ復元関数

fn restore_apis(tx: &rusqlite::Transaction, apis: &[ApiBackupData]) -> Result<usize, DatabaseError> {
    let mut count = 0;
    
    for api in apis {
        // 既存のAPIを削除（同じIDの場合）
        tx.execute(
            "DELETE FROM apis WHERE id = ?",
            [&api.id],
        )?;

        // APIを挿入
        tx.execute(
            "INSERT INTO apis (id, name, model, port, enable_auth, status, created_at, updated_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            rusqlite::params![
                api.id,
                api.name,
                api.model,
                api.port,
                api.enable_auth,
                api.status,
                api.created_at,
                api.updated_at,
            ],
        )?;
        count += 1;
    }

    Ok(count)
}

fn restore_api_keys(tx: &rusqlite::Transaction, api_keys: &[ApiKeyBackupData]) -> Result<usize, DatabaseError> {
    use base64::{Engine as _, engine::general_purpose::STANDARD};

    let mut count = 0;

    for api_key in api_keys {
        // 既存のAPIキーを削除（同じAPI IDの場合）
        tx.execute(
            "DELETE FROM api_keys WHERE api_id = ?",
            [&api_key.api_id],
        )?;

        // Base64デコード
        let encrypted_key_bytes = STANDARD.decode(&api_key.encrypted_key).map_err(|e| {
            DatabaseError::InvalidData(format!("Base64デコードエラー: {}", e))
        })?;

        // APIキーを挿入
        tx.execute(
            "INSERT INTO api_keys (api_id, key_hash, encrypted_key, created_at, updated_at) 
             VALUES (?, ?, ?, ?, ?)",
            rusqlite::params![
                api_key.api_id,
                api_key.key_hash,
                encrypted_key_bytes,
                api_key.created_at,
                api_key.updated_at,
            ],
        )?;
        count += 1;
    }

    Ok(count)
}

fn restore_installed_models(tx: &rusqlite::Transaction, models: &[InstalledModelBackupData]) -> Result<usize, DatabaseError> {
    let mut count = 0;

    for model in models {
        // 既存のモデルを削除（同じ名前の場合）
        tx.execute(
            "DELETE FROM installed_models WHERE name = ?",
            [&model.name],
        )?;

        // モデルを挿入
        tx.execute(
            "INSERT INTO installed_models (name, size, parameters, installed_at, last_used_at, usage_count) 
             VALUES (?, ?, ?, ?, ?, ?)",
            rusqlite::params![
                model.name,
                model.size,
                model.parameters,
                model.installed_at,
                model.last_used_at,
                model.usage_count,
            ],
        )?;
        count += 1;
    }

    Ok(count)
}

fn restore_request_logs(tx: &rusqlite::Transaction, logs: &[RequestLogBackupData]) -> Result<usize, DatabaseError> {
    let mut count = 0;

    for log in logs {
        // 既存のログを削除（同じIDの場合）
        tx.execute(
            "DELETE FROM request_logs WHERE id = ?",
            [&log.id],
        )?;

        // ログを挿入
        tx.execute(
            "INSERT INTO request_logs (id, api_id, method, path, request_body, response_status, response_time_ms, error_message, created_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            rusqlite::params![
                &log.id,
                &log.api_id,
                &log.method,
                &log.path,
                log.request_body.as_ref(),
                log.response_status,
                log.response_time_ms,
                log.error_message.as_ref(),
                &log.created_at,
            ],
        )?;
        count += 1;
    }

    Ok(count)
}

fn restore_alert_history(tx: &rusqlite::Transaction, alerts: &[AlertHistoryBackupData]) -> Result<usize, DatabaseError> {
    let mut count = 0;

    for alert in alerts {
        // 既存のアラート履歴を削除（同じIDの場合）
        tx.execute(
            "DELETE FROM alert_history WHERE id = ?",
            [&alert.id],
        )?;

        // アラート履歴を挿入
        tx.execute(
            "INSERT INTO alert_history (id, api_id, alert_type, current_value, threshold, message, timestamp, resolved_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            rusqlite::params![
                &alert.id,
                &alert.api_id,
                &alert.alert_type,
                alert.current_value,
                alert.threshold,
                &alert.message,
                &alert.timestamp,
                alert.resolved_at.as_ref(),
            ],
        )?;
        count += 1;
    }

    Ok(count)
}

