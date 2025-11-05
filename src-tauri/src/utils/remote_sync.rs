// Remote Sync Module
// クラウド経由でのAPIアクセス、複数デバイス間での設定同期

use crate::utils::error::AppError;
use crate::database::connection::get_app_data_dir;
use serde::{Deserialize, Serialize};
use std::fs;
/// 設定同期情報
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncInfo {
    pub device_id: String,
    pub last_sync_at: String,
    pub sync_enabled: bool,
    pub cloud_provider: Option<String>, // "local", "github", "gdrive", "dropbox", etc.
}

/// リモートアクセス設定
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoteAccessConfig {
    pub enabled: bool,
    pub access_token: Option<String>,
    pub device_id: String,
    pub cloud_provider: String,
    pub sync_interval_seconds: u64,
}

/// 設定を同期
pub async fn sync_settings(
    config: &RemoteAccessConfig,
    settings_data: &str,
) -> Result<SyncInfo, AppError> {
    if !config.enabled {
        return Err(AppError::ApiError {
            message: "設定同期が無効になっています".to_string(),
            code: "SYNC_DISABLED".to_string(),
        });
    }
    
    // クラウドプロバイダーに応じた同期処理
    match config.cloud_provider.as_str() {
        "local" => {
            // ローカルファイルシステムへの同期
            sync_to_local_file(settings_data).await?;
        },
        "github" => {
            // GitHub Gistへの同期
            sync_to_github_gist(config, settings_data).await?;
        },
        "gdrive" => {
            // Google Driveへの同期
            sync_to_google_drive(config, settings_data).await?;
        },
        "dropbox" => {
            // Dropboxへの同期
            sync_to_dropbox(config, settings_data).await?;
        },
        _ => {
            return Err(AppError::ApiError {
                message: format!("不明なクラウドプロバイダー: {}", config.cloud_provider),
                code: "UNKNOWN_PROVIDER".to_string(),
            });
        }
    }
    
    Ok(SyncInfo {
        device_id: config.device_id.clone(),
        last_sync_at: chrono::Utc::now().to_rfc3339(),
        sync_enabled: config.enabled,
        cloud_provider: Some(config.cloud_provider.clone()),
    })
}

/// ローカルファイルシステムへの同期
async fn sync_to_local_file(settings_data: &str) -> Result<(), AppError> {
    let app_data_dir = get_app_data_dir()
        .map_err(|e| AppError::IoError {
            message: format!("アプリデータディレクトリ取得エラー: {}", e),
        })?;
    
    let sync_dir = app_data_dir.join("sync");
    fs::create_dir_all(&sync_dir).map_err(|e| AppError::IoError {
        message: format!("ディレクトリ作成エラー: {}", e),
    })?;
    
    let sync_file = sync_dir.join("settings_backup.json");
    fs::write(&sync_file, settings_data).map_err(|e| AppError::IoError {
        message: format!("設定ファイル保存エラー: {}", e),
    })?;
    
    Ok(())
}

/// 設定を取得
pub async fn get_synced_settings(
    config: &RemoteAccessConfig,
) -> Result<Option<String>, AppError> {
    if !config.enabled {
        return Ok(None);
    }
    
    match config.cloud_provider.as_str() {
        "local" => {
            // ローカルファイルシステムから取得
            get_from_local_file().await
        },
        "github" => {
            // GitHub Gistから取得
            get_from_github_gist(config).await
        },
        "gdrive" => {
            // Google Driveから取得
            get_from_google_drive(config).await
        },
        "dropbox" => {
            // Dropboxから取得
            get_from_dropbox(config).await
        },
        _ => {
            Ok(None)
        }
    }
}

/// ローカルファイルシステムから設定を取得
async fn get_from_local_file() -> Result<Option<String>, AppError> {
    let app_data_dir = get_app_data_dir()
        .map_err(|e| AppError::IoError {
            message: format!("アプリデータディレクトリ取得エラー: {}", e),
        })?;
    
    let sync_file = app_data_dir.join("sync").join("settings_backup.json");
    
    if !sync_file.exists() {
        return Ok(None);
    }
    
    let content = fs::read_to_string(&sync_file).map_err(|e| AppError::IoError {
        message: format!("設定ファイル読み込みエラー: {}", e),
    })?;
    
    Ok(Some(content))
}

/// デバイスIDを生成
pub fn generate_device_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

/// リモートアクセス用の設定をエクスポート
pub async fn export_settings_for_remote() -> Result<String, AppError> {
    use crate::database::connection::get_connection;
    use crate::database::repository::ApiRepository;
    
    let conn = get_connection().map_err(|e| AppError::DatabaseError {
        message: format!("データベース接続エラー: {}", e),
    })?;
    
    // API設定とAPIキーを取得（簡易実装）
    let api_repo = ApiRepository::new(&conn);
    let apis = api_repo.find_all().map_err(|e| AppError::DatabaseError {
        message: format!("API取得エラー: {}", e),
    })?;
    
    // エクスポート用のJSONを作成
    let export_data = serde_json::json!({
        "apis": apis,
        "exported_at": chrono::Utc::now().to_rfc3339(),
        "version": "1.0.0",
    });
    
    Ok(serde_json::to_string_pretty(&export_data).map_err(|e| AppError::ApiError {
        message: format!("JSONシリアライズエラー: {}", e),
        code: "SERIALIZATION_ERROR".to_string(),
    })?)
}

/// リモートアクセス用の設定をインポート
pub async fn import_settings_from_remote(
    settings_json: &str,
) -> Result<u32, AppError> {
    use crate::database::connection::get_connection;
    use crate::database::repository::ApiRepository;
    use crate::database::models::{Api, ApiStatus};
    use chrono::Utc;
    use uuid::Uuid;
    
    let import_data: serde_json::Value = serde_json::from_str(settings_json)
        .map_err(|e| AppError::ApiError {
            message: format!("JSON解析エラー: {}", e),
            code: "JSON_PARSE_ERROR".to_string(),
        })?;
    
    let conn = get_connection().map_err(|e| AppError::DatabaseError {
        message: format!("データベース接続エラー: {}", e),
    })?;
    
    let api_repo = ApiRepository::new(&conn);
    let mut imported_count = 0;
    
    if let Some(apis) = import_data["apis"].as_array() {
        for api_data in apis {
            // API設定をパース
            let api_id = api_data.get("id")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
                .unwrap_or_else(|| Uuid::new_v4().to_string());
            
            let name = api_data.get("name")
                .and_then(|v| v.as_str())
                .unwrap_or("Imported API")
                .to_string();
            
            let model = api_data.get("model")
                .and_then(|v| v.as_str())
                .unwrap_or("llama3")
                .to_string();
            
            let port: i32 = api_data.get("port")
                .and_then(|v| v.as_i64())
                .map(|v| v as i32)
                .unwrap_or(8080);
            
            let enable_auth = api_data.get("enable_auth")
                .and_then(|v| v.as_bool())
                .unwrap_or(true);
            
            let engine_type = api_data.get("engine_type")
                .and_then(|v| v.as_str())
                .unwrap_or("ollama")
                .to_string();
            
            let engine_config = api_data.get("engine_config")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            
            // 既存のAPIをチェック（IDまたはポートで）
            let existing_by_id = api_repo.find_by_id(&api_id);
            let existing_by_port = api_repo.find_by_port(port);
            
            // 既存のAPIがある場合はスキップ（競合を避ける）
            let has_existing_by_id = existing_by_id.is_ok();
            let has_existing_by_port = existing_by_port
                .map(|opt| opt.is_some())
                .unwrap_or(false);
            
            if has_existing_by_id || has_existing_by_port {
                continue;
            }
            
            // 新しいAPIを作成
            let api = Api {
                id: api_id,
                name,
                model,
                port,
                enable_auth,
                status: ApiStatus::Stopped,
                engine_type: Some(engine_type),
                engine_config,
                created_at: Utc::now(),
                updated_at: Utc::now(),
            };
            
            if api_repo.create(&api).is_ok() {
                imported_count += 1;
            }
        }
    }
    
    Ok(imported_count)
}

/// GitHub Gistへの同期
async fn sync_to_github_gist(
    config: &RemoteAccessConfig,
    settings_data: &str,
) -> Result<(), AppError> {
    // 実際の実装では、octocrabなどのライブラリを使用してGitHub Gist APIと連携
    // ここでは基盤実装を示します
    
    if config.access_token.is_none() {
        return Err(AppError::ApiError {
            message: "GitHubアクセストークンが必要です".to_string(),
            code: "MISSING_TOKEN".to_string(),
        });
    }
    
    // GitHub Gist APIを使用して設定をアップロード
    // 実際の実装では、reqwestなどを使ってGitHub APIを呼び出す
    // 例: POST https://api.github.com/gists
    
    // 簡易実装として、ローカルファイルに保存（実際の実装ではGitHub APIを使用）
    let app_data_dir = get_app_data_dir()
        .map_err(|e| AppError::IoError {
            message: format!("アプリデータディレクトリ取得エラー: {}", e),
        })?;
    
    let sync_dir = app_data_dir.join("sync").join("github");
    fs::create_dir_all(&sync_dir).map_err(|e| AppError::IoError {
        message: format!("ディレクトリ作成エラー: {}", e),
    })?;
    
    let sync_file = sync_dir.join("settings.json");
    fs::write(&sync_file, settings_data).map_err(|e| AppError::IoError {
        message: format!("設定ファイル保存エラー: {}", e),
    })?;
    
    // GitHub Gist APIを使用して設定をアップロード
    let client = reqwest::Client::new();
    let token = config.access_token.as_ref().unwrap();
    
    // 既存のGistを検索（デバイスIDで識別）
    let gist_id = find_existing_gist(&client, token, &config.device_id).await?;
    
    let response = if let Some(gist_id) = gist_id {
        // 既存のGistを更新
        client
            .patch(&format!("https://api.github.com/gists/{}", gist_id))
            .header("Authorization", format!("Bearer {}", token))
            .header("Accept", "application/vnd.github.v3+json")
            .json(&serde_json::json!({
                "description": format!("FLM Settings Sync - {}", config.device_id),
                "files": {
                    "settings.json": {
                        "content": settings_data
                    }
                }
            }))
            .send()
            .await
            .map_err(|e| AppError::ApiError {
                message: format!("GitHub Gist更新エラー: {}", e),
                code: "GITHUB_API_ERROR".to_string(),
            })?
    } else {
        // 新しいGistを作成
        client
            .post("https://api.github.com/gists")
            .header("Authorization", format!("Bearer {}", token))
            .header("Accept", "application/vnd.github.v3+json")
            .json(&serde_json::json!({
                "description": format!("FLM Settings Sync - {}", config.device_id),
                "public": false,
                "files": {
                    "settings.json": {
                        "content": settings_data
                    }
                }
            }))
            .send()
            .await
            .map_err(|e| AppError::ApiError {
                message: format!("GitHub Gist作成エラー: {}", e),
                code: "GITHUB_API_ERROR".to_string(),
            })?
    };
    
    let status = response.status();
    if !status.is_success() {
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        return Err(AppError::ApiError {
            message: format!("GitHub Gist APIエラー: HTTP {} - {}", status, error_text),
            code: status.as_str().to_string(),
        });
    }
    
    Ok(())
}

/// 既存のGistを検索（デバイスIDで識別）
async fn find_existing_gist(
    client: &reqwest::Client,
    token: &str,
    device_id: &str,
) -> Result<Option<String>, AppError> {
    let response = client
        .get("https://api.github.com/gists")
        .header("Authorization", format!("Bearer {}", token))
        .header("Accept", "application/vnd.github.v3+json")
        .send()
        .await
        .map_err(|e| AppError::ApiError {
            message: format!("GitHub Gist一覧取得エラー: {}", e),
            code: "GITHUB_API_ERROR".to_string(),
        })?;
    
    if !response.status().is_success() {
        return Ok(None);
    }
    
    let gists: Vec<serde_json::Value> = response.json().await
        .map_err(|e| AppError::ApiError {
            message: format!("GitHub Gist一覧解析エラー: {}", e),
            code: "JSON_ERROR".to_string(),
        })?;
    
    // デバイスIDを含むGistを検索
    for gist in gists {
        if let Some(description) = gist.get("description").and_then(|d| d.as_str()) {
            if description.contains(device_id) {
                if let Some(id) = gist.get("id").and_then(|i| i.as_str()) {
                    return Ok(Some(id.to_string()));
                }
            }
        }
    }
    
    Ok(None)
}

/// GitHub Gistから設定を取得
async fn get_from_github_gist(
    config: &RemoteAccessConfig,
) -> Result<Option<String>, AppError> {
    if config.access_token.is_none() {
        return Ok(None);
    }
    
    let client = reqwest::Client::new();
    let token = config.access_token.as_ref().unwrap();
    
    // 既存のGistを検索
    let gist_id = find_existing_gist(&client, token, &config.device_id).await?;
    
    if let Some(gist_id) = gist_id {
        // Gistの内容を取得
        let response = client
            .get(&format!("https://api.github.com/gists/{}", gist_id))
            .header("Authorization", format!("Bearer {}", token))
            .header("Accept", "application/vnd.github.v3+json")
            .send()
            .await
            .map_err(|e| AppError::ApiError {
                message: format!("GitHub Gist取得エラー: {}", e),
                code: "GITHUB_API_ERROR".to_string(),
            })?;
        
        if response.status().is_success() {
            let gist_data: serde_json::Value = response.json().await
                .map_err(|e| AppError::ApiError {
                    message: format!("GitHub Gist解析エラー: {}", e),
                    code: "JSON_ERROR".to_string(),
                })?;
            
            // settings.jsonファイルの内容を取得
            if let Some(files) = gist_data.get("files") {
                if let Some(settings_file) = files.get("settings.json") {
                    if let Some(content) = settings_file.get("content").and_then(|c| c.as_str()) {
                        return Ok(Some(content.to_string()));
                    }
                }
            }
        }
    }
    
    Ok(None)
}

/// Google Driveへの同期
async fn sync_to_google_drive(
    config: &RemoteAccessConfig,
    settings_data: &str,
) -> Result<(), AppError> {
    if config.access_token.is_none() {
        return Err(AppError::ApiError {
            message: "Googleアクセストークンが必要です".to_string(),
            code: "MISSING_TOKEN".to_string(),
        });
    }
    
    let client = reqwest::Client::new();
    let token = config.access_token.as_ref().unwrap();
    
    // 既存のファイルを検索（デバイスIDで識別）
    let file_id = find_google_drive_file(&client, token, &config.device_id).await?;
    
    if let Some(file_id) = file_id {
        // 既存のファイルを更新（resumable upload方式を使用）
        // まず、メタデータを更新
        let metadata_response = client
            .patch(&format!("https://www.googleapis.com/drive/v3/files/{}", file_id))
            .header("Authorization", format!("Bearer {}", token))
            .header("Content-Type", "application/json")
            .json(&serde_json::json!({
                "name": format!("flm_settings_{}.json", config.device_id),
                "description": format!("FLM Settings Sync - {}", config.device_id)
            }))
            .send()
            .await
            .map_err(|e| AppError::ApiError {
                message: format!("Google Driveメタデータ更新エラー: {}", e),
                code: "GOOGLE_DRIVE_API_ERROR".to_string(),
            })?;
        
        let metadata_status = metadata_response.status();
        if !metadata_status.is_success() {
            let error_text = metadata_response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
            return Err(AppError::ApiError {
                message: format!("Google Driveメタデータ更新エラー: HTTP {} - {}", metadata_status, error_text),
                code: metadata_status.as_str().to_string(),
            });
        }
        
        // 次に、ファイル内容を更新
        let content_response = client
            .patch(&format!("https://www.googleapis.com/upload/drive/v3/files/{}?uploadType=media", file_id))
            .header("Authorization", format!("Bearer {}", token))
            .header("Content-Type", "application/json")
            .body(settings_data.as_bytes().to_vec())
            .send()
            .await
            .map_err(|e| AppError::ApiError {
                message: format!("Google Drive更新エラー: {}", e),
                code: "GOOGLE_DRIVE_API_ERROR".to_string(),
            })?;
        
        let content_status = content_response.status();
        if !content_status.is_success() {
            let error_text = content_response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
            return Err(AppError::ApiError {
                message: format!("Google Driveファイル更新エラー: HTTP {} - {}", content_status, error_text),
                code: content_status.as_str().to_string(),
            });
        }
        
        Ok(())
    } else {
        // 新しいファイルを作成（resumable upload方式を使用）
        // まず、メタデータを送信してupload URLを取得
        let metadata = serde_json::json!({
            "name": format!("flm_settings_{}.json", config.device_id),
            "description": format!("FLM Settings Sync - {}", config.device_id),
            "mimeType": "application/json"
        });
        
        let upload_response = client
            .post("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable")
            .header("Authorization", format!("Bearer {}", token))
            .header("Content-Type", "application/json; charset=UTF-8")
            .json(&metadata)
            .send()
            .await
            .map_err(|e| AppError::ApiError {
                message: format!("Google DriveアップロードURL取得エラー: {}", e),
                code: "GOOGLE_DRIVE_API_ERROR".to_string(),
            })?;
        
        let upload_status = upload_response.status();
        if !upload_status.is_success() {
            let error_text = upload_response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
            return Err(AppError::ApiError {
                message: format!("Google DriveアップロードURL取得エラー: HTTP {} - {}", upload_status, error_text),
                code: upload_status.as_str().to_string(),
            });
        }
        
        // アップロードURLを取得
        let upload_url = upload_response.headers()
            .get("Location")
            .and_then(|h| h.to_str().ok())
            .ok_or_else(|| AppError::ApiError {
                message: "Google DriveアップロードURLが見つかりません".to_string(),
                code: "MISSING_UPLOAD_URL".to_string(),
            })?;
        
        // ファイル内容をアップロード
        let response = client
            .put(upload_url)
            .header("Content-Type", "application/json")
            .body(settings_data.as_bytes().to_vec())
            .send()
            .await
            .map_err(|e| AppError::ApiError {
                message: format!("Google Driveアップロードエラー: {}", e),
                code: "GOOGLE_DRIVE_API_ERROR".to_string(),
            })?;
        
        let upload_status = response.status();
        if !upload_status.is_success() {
            let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
            return Err(AppError::ApiError {
                message: format!("Google Drive APIエラー: HTTP {} - {}", upload_status, error_text),
                code: upload_status.as_str().to_string(),
            });
        }
        
        Ok(())
    }
}

/// Google Driveファイルを検索（デバイスIDで識別）
async fn find_google_drive_file(
    client: &reqwest::Client,
    token: &str,
    device_id: &str,
) -> Result<Option<String>, AppError> {
    let file_name = format!("flm_settings_{}.json", device_id);
    
    let response = client
        .get("https://www.googleapis.com/drive/v3/files")
        .query(&[("q", format!("name='{}'", file_name)), ("fields", "files(id,name)".to_string())])
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .map_err(|e| AppError::ApiError {
            message: format!("Google Drive検索エラー: {}", e),
            code: "GOOGLE_DRIVE_API_ERROR".to_string(),
        })?;
    
    if !response.status().is_success() {
        return Ok(None);
    }
    
    let data: serde_json::Value = response.json().await
        .map_err(|e| AppError::ApiError {
            message: format!("Google Drive検索結果解析エラー: {}", e),
            code: "JSON_ERROR".to_string(),
        })?;
    
    if let Some(files) = data.get("files").and_then(|f| f.as_array()) {
        if let Some(file) = files.first() {
            if let Some(id) = file.get("id").and_then(|i| i.as_str()) {
                return Ok(Some(id.to_string()));
            }
        }
    }
    
    Ok(None)
}

/// Google Driveから設定を取得
async fn get_from_google_drive(
    config: &RemoteAccessConfig,
) -> Result<Option<String>, AppError> {
    if config.access_token.is_none() {
        return Ok(None);
    }
    
    let client = reqwest::Client::new();
    let token = config.access_token.as_ref().unwrap();
    
    // 既存のファイルを検索
    let file_id = find_google_drive_file(&client, token, &config.device_id).await?;
    
    if let Some(file_id) = file_id {
        // ファイルの内容を取得
        let response = client
            .get(&format!("https://www.googleapis.com/drive/v3/files/{}?alt=media", file_id))
            .header("Authorization", format!("Bearer {}", token))
            .send()
            .await
            .map_err(|e| AppError::ApiError {
                message: format!("Google Driveファイル取得エラー: {}", e),
                code: "GOOGLE_DRIVE_API_ERROR".to_string(),
            })?;
        
        if response.status().is_success() {
            let content = response.text().await
                .map_err(|e| AppError::ApiError {
                    message: format!("Google Driveファイル内容取得エラー: {}", e),
                    code: "IO_ERROR".to_string(),
                })?;
            return Ok(Some(content));
        }
    }
    
    Ok(None)
}

/// Dropboxへの同期
async fn sync_to_dropbox(
    config: &RemoteAccessConfig,
    settings_data: &str,
) -> Result<(), AppError> {
    if config.access_token.is_none() {
        return Err(AppError::ApiError {
            message: "Dropboxアクセストークンが必要です".to_string(),
            code: "MISSING_TOKEN".to_string(),
        });
    }
    
    let client = reqwest::Client::new();
    let token = config.access_token.as_ref().unwrap();
    let file_path = format!("/flm_settings_{}.json", config.device_id);
    
    // Dropbox API v2を使用してファイルをアップロード
    let response = client
        .post("https://content.dropboxapi.com/2/files/upload")
        .header("Authorization", format!("Bearer {}", token))
        .header("Dropbox-API-Arg", serde_json::json!({
            "path": file_path,
            "mode": "overwrite",
            "autorename": false,
            "mute": false
        }).to_string())
        .header("Content-Type", "application/octet-stream")
        .body(settings_data.as_bytes().to_vec())
        .send()
        .await
        .map_err(|e| AppError::ApiError {
            message: format!("Dropboxアップロードエラー: {}", e),
            code: "DROPBOX_API_ERROR".to_string(),
        })?;
    
    let dropbox_status = response.status();
    if !dropbox_status.is_success() {
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        return Err(AppError::ApiError {
            message: format!("Dropbox APIエラー: HTTP {} - {}", dropbox_status, error_text),
            code: dropbox_status.as_str().to_string(),
        });
    }
    
    Ok(())
}

/// Dropboxから設定を取得
async fn get_from_dropbox(
    config: &RemoteAccessConfig,
) -> Result<Option<String>, AppError> {
    if config.access_token.is_none() {
        return Ok(None);
    }
    
    let client = reqwest::Client::new();
    let token = config.access_token.as_ref().unwrap();
    let file_path = format!("/flm_settings_{}.json", config.device_id);
    
    // Dropbox API v2を使用してファイルをダウンロード
    let response = client
        .post("https://content.dropboxapi.com/2/files/download")
        .header("Authorization", format!("Bearer {}", token))
        .header("Dropbox-API-Arg", serde_json::json!({
            "path": file_path
        }).to_string())
        .send()
        .await
        .map_err(|e| AppError::ApiError {
            message: format!("Dropboxダウンロードエラー: {}", e),
            code: "DROPBOX_API_ERROR".to_string(),
        })?;
    
    if response.status().is_success() {
        let content = response.text().await
            .map_err(|e| AppError::ApiError {
                message: format!("Dropboxファイル内容取得エラー: {}", e),
                code: "IO_ERROR".to_string(),
            })?;
        return Ok(Some(content));
    } else if response.status() == reqwest::StatusCode::NOT_FOUND {
        // ファイルが見つからない場合はNoneを返す
        return Ok(None);
    }
    
    Ok(None)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_device_id() {
        let device_id = generate_device_id();
        assert!(!device_id.is_empty());
        // UUID v4の形式をチェック（36文字、ハイフンを含む）
        assert_eq!(device_id.len(), 36);
        assert!(device_id.contains('-'));
        
        // 2回生成して異なるIDが生成されることを確認
        let device_id2 = generate_device_id();
        assert_ne!(device_id, device_id2);
    }

    #[test]
    fn test_sync_info_serialization() {
        let sync_info = SyncInfo {
            device_id: "test-device-id".to_string(),
            last_sync_at: "2024-01-01T00:00:00Z".to_string(),
            sync_enabled: true,
            cloud_provider: Some("github".to_string()),
        };
        
        // JSONシリアライゼーションテスト
        let json = serde_json::to_string(&sync_info).unwrap();
        assert!(json.contains("test-device-id"));
        assert!(json.contains("github"));
        
        // デシリアライゼーションテスト
        let deserialized: SyncInfo = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.device_id, sync_info.device_id);
        assert_eq!(deserialized.sync_enabled, sync_info.sync_enabled);
    }

    #[test]
    fn test_remote_access_config_serialization() {
        let config = RemoteAccessConfig {
            enabled: true,
            access_token: Some("test-token".to_string()),
            device_id: "test-device".to_string(),
            cloud_provider: "github".to_string(),
            sync_interval_seconds: 3600,
        };
        
        let json = serde_json::to_string(&config).unwrap();
        assert!(json.contains("test-device"));
        assert!(json.contains("github"));
        assert!(json.contains("3600"));
        
        let deserialized: RemoteAccessConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.device_id, config.device_id);
        assert_eq!(deserialized.sync_interval_seconds, config.sync_interval_seconds);
    }
}
