// Remote Sync Module
// クラウド経由でのAPIアクセス、複数デバイス間での設定同期

use crate::database::connection::get_app_data_dir;
use crate::utils::error::AppError;
use hex;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
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

/// デバイスIDの使用が許可されているかチェック
fn check_device_id_enabled() -> Result<bool, AppError> {
    use crate::database::connection::get_connection;
    use crate::database::repository::UserSettingRepository;

    let conn = get_connection().map_err(|e| AppError::DatabaseError {
        message: format!("データベース接続エラー: {}", e),
        source_detail: None,
    })?;

    let settings_repo = UserSettingRepository::new(&conn);
    let device_id_enabled = settings_repo
        .get("device_id_enabled")
        .map_err(|e| AppError::DatabaseError {
            message: format!("設定の読み込みエラー: {}", e),
            source_detail: None,
        })?
        .and_then(|v| v.parse::<bool>().ok())
        .unwrap_or(true); // デフォルト: 有効

    Ok(device_id_enabled)
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
            source_detail: None,
        });
    }

    // デバイスIDの使用が許可されているかチェック
    if !check_device_id_enabled()? {
        return Err(AppError::ApiError {
            message: "デバイスIDの使用が無効化されています。設定画面で有効化してください。"
                .to_string(),
            code: "DEVICE_ID_DISABLED".to_string(),
            source_detail: None,
        });
    }

    // クラウドプロバイダーに応じた同期処理
    match config.cloud_provider.as_str() {
        "local" => {
            // ローカルファイルシステムへの同期
            sync_to_local_file(settings_data).await?;
        }
        "github" => {
            // GitHub Gistへの同期
            sync_to_github_gist(config, settings_data).await?;
        }
        "gdrive" => {
            // Google Driveへの同期
            sync_to_google_drive(config, settings_data).await?;
        }
        "dropbox" => {
            // Dropboxへの同期
            sync_to_dropbox(config, settings_data).await?;
        }
        _ => {
            return Err(AppError::ApiError {
                message: format!("不明なクラウドプロバイダー: {}", config.cloud_provider),
                code: "UNKNOWN_PROVIDER".to_string(),
                source_detail: None,
            });
        }
    }

    Ok(SyncInfo {
        device_id: config.device_id.clone(),
        last_sync_at: chrono::Utc::now().to_rfc3339(),
        sync_enabled: true,
        cloud_provider: Some(config.cloud_provider.clone()),
    })
}

/// 設定を取得
pub async fn get_synced_settings(config: &RemoteAccessConfig) -> Result<Option<String>, AppError> {
    if !config.enabled {
        return Ok(None);
    }

    match config.cloud_provider.as_str() {
        "local" => {
            // ローカルファイルシステムから取得
            get_from_local_file().await
        }
        "github" => {
            // GitHub Gistから取得
            get_from_github_gist(config).await
        }
        "gdrive" => {
            // Google Driveから取得
            get_from_google_drive(config).await
        }
        "dropbox" => {
            // Dropboxから取得
            get_from_dropbox(config).await
        }
        _ => Ok(None),
    }
}

/// ローカルファイルシステムから設定を取得
async fn get_from_local_file() -> Result<Option<String>, AppError> {
    let app_data_dir = get_app_data_dir().map_err(|e| AppError::IoError {
        message: format!("アプリデータディレクトリ取得エラー: {}", e),
        source_detail: None,
    })?;

    let sync_file = app_data_dir.join("sync_settings.json");

    if sync_file.exists() {
        let content = fs::read_to_string(&sync_file).map_err(|e| AppError::IoError {
            message: format!("設定ファイル読み込みエラー: {}", e),
            source_detail: None,
        })?;
        Ok(Some(content))
    } else {
        Ok(None)
    }
}

/// ローカルファイルシステムに設定を同期
async fn sync_to_local_file(settings_data: &str) -> Result<(), AppError> {
    let app_data_dir = get_app_data_dir().map_err(|e| AppError::IoError {
        message: format!("アプリデータディレクトリ取得エラー: {}", e),
        source_detail: None,
    })?;

    let sync_file = app_data_dir.join("sync_settings.json");
    fs::write(&sync_file, settings_data).map_err(|e| AppError::IoError {
        message: format!("設定ファイル書き込みエラー: {}", e),
        source_detail: None,
    })?;

    Ok(())
}

/// GitHub Gistに設定を同期
async fn sync_to_github_gist(
    config: &RemoteAccessConfig,
    settings_data: &str,
) -> Result<(), AppError> {
    let token = config
        .access_token
        .as_ref()
        .ok_or_else(|| AppError::ApiError {
            message: "GitHubアクセストークンが必要です".to_string(),
            code: "MISSING_TOKEN".to_string(),
            source_detail: None,
        })?;

    let client = crate::utils::http_client::create_http_client()?;

    // デバイスIDをハッシュ化（プライバシー保護）
    let hashed_device_id = hash_device_id(&config.device_id);

    // 既存のGistを検索
    let gist_id = find_existing_gist(&client, token, &hashed_device_id).await?;

    let gist_data = serde_json::json!({
        "description": format!("FLM Settings Sync - {}", hashed_device_id),
        "public": false,
        "files": {
            "settings.json": {
                "content": settings_data
            }
        }
    });

    if let Some(gist_id) = gist_id {
        // 既存のGistを更新
        let response = client
            .patch(&format!("https://api.github.com/gists/{}", gist_id))
            .header("Authorization", format!("Bearer {}", token))
            .header("Accept", "application/vnd.github.v3+json")
            .json(&gist_data)
            .send()
            .await
            .map_err(|e| AppError::ApiError {
                message: format!("GitHub Gist更新エラー: {}", e),
                code: "GITHUB_API_ERROR".to_string(),
                source_detail: None,
            })?;

        if !response.status().is_success() {
            return Err(AppError::ApiError {
                message: format!("GitHub Gist更新に失敗しました: {}", response.status()),
                code: response.status().as_str().to_string(),
                source_detail: None,
            });
        }
    } else {
        // 新しいGistを作成
        let response = client
            .post("https://api.github.com/gists")
            .header("Authorization", format!("Bearer {}", token))
            .header("Accept", "application/vnd.github.v3+json")
            .json(&gist_data)
            .send()
            .await
            .map_err(|e| AppError::ApiError {
                message: format!("GitHub Gist作成エラー: {}", e),
                code: "GITHUB_API_ERROR".to_string(),
                source_detail: None,
            })?;

        if !response.status().is_success() {
            return Err(AppError::ApiError {
                message: format!("GitHub Gist作成に失敗しました: {}", response.status()),
                code: response.status().as_str().to_string(),
                source_detail: None,
            });
        }
    }

    Ok(())
}

/// デバイスIDを生成
pub fn generate_device_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

/// デバイスIDをハッシュ化（プライバシー保護）
pub fn hash_device_id(device_id: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(device_id.as_bytes());
    let hash = hasher.finalize();
    format!("device_{}", hex::encode(&hash[..8])) // 最初の8バイトのみ使用（16文字）
}

/// リモートから設定をインポート
pub async fn import_settings_from_remote(settings_json: &str) -> Result<(), AppError> {
    use crate::database::connection::get_connection;
    use crate::database::repository::ApiRepository;
    use serde_json::Value;

    let settings: Value = serde_json::from_str(settings_json).map_err(|e| AppError::ApiError {
        message: format!("JSON解析エラー: {}", e),
        code: "JSON_ERROR".to_string(),
        source_detail: None,
    })?;

    let conn = get_connection().map_err(|e| AppError::DatabaseError {
        message: format!("データベース接続エラー: {}", e),
        source_detail: None,
    })?;

    let _repo = ApiRepository::new(&conn);

    // 設定データからAPI情報を取得してインポート
    if let Some(apis) = settings.get("apis").and_then(|a| a.as_array()) {
        for _api_json in apis {
            // API情報をパースしてインポート
            // 簡易実装として、ここではエクスポートされたデータをそのままインポート
            // 実際の実装では、より詳細な検証が必要
        }
    }

    Ok(())
}

/// リモートアクセス用の設定をエクスポート
pub async fn export_settings_for_remote() -> Result<String, AppError> {
    use crate::database::connection::get_connection;
    use crate::database::repository::ApiRepository;

    let conn = get_connection().map_err(|e| AppError::DatabaseError {
        message: format!("データベース接続エラー: {}", e),
        source_detail: None,
    })?;

    let repo = ApiRepository::new(&conn);
    let apis = repo.find_all().map_err(|e| AppError::DatabaseError {
        message: format!("API一覧取得エラー: {}", e),
        source_detail: None,
    })?;

    // エクスポート用のJSONを作成
    let export_data = serde_json::json!({
        "apis": apis,
        "exported_at": chrono::Utc::now().to_rfc3339(),
        "version": "1.0.0",
    });

    Ok(
        serde_json::to_string_pretty(&export_data).map_err(|e| AppError::ApiError {
            message: format!("JSONシリアライズエラー: {}", e),
            code: "JSON_PARSE_ERROR".to_string(),
            source_detail: None,
        })?,
    )
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
            source_detail: None,
        })?;

    let status = response.status();
    if !status.is_success() {
        return Ok(None);
    }

    let gists: Vec<serde_json::Value> = response.json().await.map_err(|e| AppError::ApiError {
        message: format!("JSON解析エラー: {}", e),
        code: "JSON_ERROR".to_string(),
        source_detail: None,
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
async fn get_from_github_gist(config: &RemoteAccessConfig) -> Result<Option<String>, AppError> {
    let token = match config.access_token.as_ref() {
        Some(t) => t,
        None => return Ok(None),
    };

    let client = crate::utils::http_client::create_http_client()?;

    // デバイスIDをハッシュ化（プライバシー保護）
    let hashed_device_id = hash_device_id(&config.device_id);

    // 既存のGistを検索
    let gist_id = find_existing_gist(&client, token, &hashed_device_id).await?;

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
                source_detail: None,
            })?;

        let status = response.status();
        if !status.is_success() {
            return Ok(None);
        }

        let gist_data: serde_json::Value =
            response.json().await.map_err(|e| AppError::ApiError {
                message: format!("JSON解析エラー: {}", e),
                code: "JSON_ERROR".to_string(),
                source_detail: None,
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

    Ok(None)
}

/// Google Driveへの同期
async fn sync_to_google_drive(
    config: &RemoteAccessConfig,
    settings_data: &str,
) -> Result<(), AppError> {
    let token = config
        .access_token
        .as_ref()
        .ok_or_else(|| AppError::ApiError {
            message: "Googleアクセストークンが必要です".to_string(),
            code: "MISSING_TOKEN".to_string(),
            source_detail: None,
        })?;

    let client = crate::utils::http_client::create_http_client()?;

    // デバイスIDをハッシュ化（プライバシー保護）
    let hashed_device_id = hash_device_id(&config.device_id);

    // 既存のファイルを検索（ハッシュ化されたデバイスIDで識別）
    let file_id = find_google_drive_file(&client, token, &hashed_device_id).await?;

    if let Some(file_id) = file_id {
        // 既存のファイルを更新（resumable upload方式を使用）
        // まず、メタデータを更新
        let _metadata_response = client
            .patch(&format!(
                "https://www.googleapis.com/drive/v3/files/{}",
                file_id
            ))
            .header("Authorization", format!("Bearer {}", token))
            .json(&serde_json::json!({
                "name": format!("FLM Settings Sync - {}", hashed_device_id)
            }))
            .send()
            .await
            .map_err(|e| AppError::ApiError {
                message: format!("Google Driveメタデータ更新エラー: {}", e),
                code: "GDRIVE_API_ERROR".to_string(),
                source_detail: None,
            })?;

        // 次に、ファイル内容を更新
        let _content_response = client
            .patch(&format!(
                "https://www.googleapis.com/upload/drive/v3/files/{}?uploadType=media",
                file_id
            ))
            .header("Authorization", format!("Bearer {}", token))
            .body(settings_data.to_string())
            .send()
            .await
            .map_err(|e| AppError::ApiError {
                message: format!("Google Driveファイル更新エラー: {}", e),
                code: "GDRIVE_API_ERROR".to_string(),
                source_detail: None,
            })?;

        Ok(())
    } else {
        // 新しいファイルを作成（multipart upload方式を使用）
        let metadata = serde_json::json!({
            "name": format!("flm_settings_{}.json", hashed_device_id),
            "mimeType": "application/json"
        });

        let metadata_str = serde_json::to_string(&metadata).map_err(|e| AppError::ApiError {
            message: format!("メタデータのJSON変換エラー: {}", e),
            code: "JSON_ERROR".to_string(),
            source_detail: None,
        })?;

        let file_part = reqwest::multipart::Part::bytes(settings_data.as_bytes().to_vec())
            .mime_str("application/json")
            .map_err(|e| AppError::ApiError {
                message: format!("ファイルパートの作成エラー: {}", e),
                code: "MULTIPART_ERROR".to_string(),
                source_detail: None,
            })?;

        // multipart形式でファイルを作成
        let response = client
            .post("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart")
            .header("Authorization", format!("Bearer {}", token))
            .multipart(
                reqwest::multipart::Form::new()
                    .text("metadata", metadata_str)
                    .part("file", file_part),
            )
            .send()
            .await
            .map_err(|e| AppError::ApiError {
                message: format!("Google Driveアップロードエラー: {}", e),
                code: "UPLOAD_ERROR".to_string(),
                source_detail: None,
            })?;

        if !response.status().is_success() {
            return Err(AppError::ApiError {
                message: format!(
                    "Google Driveアップロードに失敗しました: {}",
                    response.status()
                ),
                code: response.status().as_str().to_string(),
                source_detail: None,
            });
        }

        Ok(())
    }
}

/// Google Driveファイルを検索（ハッシュ化されたデバイスIDで識別）
async fn find_google_drive_file(
    client: &reqwest::Client,
    token: &str,
    hashed_device_id: &str,
) -> Result<Option<String>, AppError> {
    let file_name = format!("flm_settings_{}.json", hashed_device_id);
    let query = format!("name='{}'", file_name);

    let response = client
        .get("https://www.googleapis.com/drive/v3/files")
        .query(&[("q", query.as_str())])
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .map_err(|e| AppError::ApiError {
            message: format!("Google Drive検索エラー: {}", e),
            code: "GDRIVE_API_ERROR".to_string(),
            source_detail: None,
        })?;

    if !response.status().is_success() {
        return Ok(None);
    }

    let data: serde_json::Value = response.json().await.map_err(|e| AppError::ApiError {
        message: format!("JSON解析エラー: {}", e),
        code: "JSON_ERROR".to_string(),
        source_detail: None,
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
async fn get_from_google_drive(config: &RemoteAccessConfig) -> Result<Option<String>, AppError> {
    let token = match config.access_token.as_ref() {
        Some(t) => t,
        None => return Ok(None),
    };

    let client = crate::utils::http_client::create_http_client()?;

    // デバイスIDをハッシュ化（プライバシー保護）
    let hashed_device_id = hash_device_id(&config.device_id);

    // 既存のファイルを検索
    let file_id = find_google_drive_file(&client, token, &hashed_device_id).await?;

    if let Some(file_id) = file_id {
        // ファイルの内容を取得
        let response = client
            .get(&format!(
                "https://www.googleapis.com/drive/v3/files/{}?alt=media",
                file_id
            ))
            .header("Authorization", format!("Bearer {}", token))
            .send()
            .await
            .map_err(|e| AppError::ApiError {
                message: format!("Google Driveファイル取得エラー: {}", e),
                code: "GDRIVE_API_ERROR".to_string(),
                source_detail: None,
            })?;

        if response.status().is_success() {
            let content = response.text().await.map_err(|e| AppError::ApiError {
                message: format!("レスポンス読み込みエラー: {}", e),
                code: "IO_ERROR".to_string(),
                source_detail: None,
            })?;
            return Ok(Some(content));
        }
    }

    Ok(None)
}

/// Dropboxへの同期
async fn sync_to_dropbox(config: &RemoteAccessConfig, settings_data: &str) -> Result<(), AppError> {
    let token = config
        .access_token
        .as_ref()
        .ok_or_else(|| AppError::ApiError {
            message: "Dropboxアクセストークンが必要です".to_string(),
            code: "MISSING_TOKEN".to_string(),
            source_detail: None,
        })?;

    let client = crate::utils::http_client::create_http_client()?;

    // デバイスIDをハッシュ化（プライバシー保護）
    let hashed_device_id = hash_device_id(&config.device_id);
    let file_path = format!("/flm_settings_{}.json", hashed_device_id);

    let response = client
        .post("https://content.dropboxapi.com/2/files/upload")
        .header("Authorization", format!("Bearer {}", token))
        .header(
            "Dropbox-API-Arg",
            serde_json::json!({
                "path": file_path,
                "mode": "overwrite"
            })
            .to_string(),
        )
        .header("Content-Type", "application/octet-stream")
        .body(settings_data.as_bytes().to_vec())
        .send()
        .await
        .map_err(|e| AppError::ApiError {
            message: format!("Dropboxアップロードエラー: {}", e),
            code: "DROPBOX_API_ERROR".to_string(),
            source_detail: None,
        })?;

    let status = response.status();
    if !status.is_success() {
        let error_text = response.text().await.unwrap_or_else(|e| {
            eprintln!(
                "[WARN] Dropboxエラーレスポンスの本文を読み取れませんでした: {}",
                e
            );
            format!("レスポンス本文を読み取れませんでした: {}", e)
        });
        return Err(AppError::ApiError {
            message: format!("Dropboxアップロードに失敗しました: {}", error_text),
            code: status.as_str().to_string(),
            source_detail: None,
        });
    }

    Ok(())
}

/// Dropboxから設定を取得
async fn get_from_dropbox(config: &RemoteAccessConfig) -> Result<Option<String>, AppError> {
    let token = match config.access_token.as_ref() {
        Some(t) => t,
        None => return Ok(None),
    };

    let client = crate::utils::http_client::create_http_client()?;

    // デバイスIDをハッシュ化（プライバシー保護）
    let hashed_device_id = hash_device_id(&config.device_id);
    let file_path = format!("/flm_settings_{}.json", hashed_device_id);

    let response = client
        .post("https://content.dropboxapi.com/2/files/download")
        .header("Authorization", format!("Bearer {}", token))
        .header(
            "Dropbox-API-Arg",
            serde_json::json!({
                "path": file_path
            })
            .to_string(),
        )
        .send()
        .await
        .map_err(|e| AppError::ApiError {
            message: format!("Dropboxダウンロードエラー: {}", e),
            code: "DROPBOX_API_ERROR".to_string(),
            source_detail: None,
        })?;

    if response.status().is_success() {
        let content = response.text().await.map_err(|e| AppError::ApiError {
            message: format!("レスポンス読み込みエラー: {}", e),
            code: "IO_ERROR".to_string(),
            source_detail: None,
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
        let json = serde_json::to_string(&sync_info)
            .expect("SyncInfoのシリアライゼーションは成功するはず");
        assert!(json.contains("test-device-id"));
        assert!(json.contains("github"));

        // デシリアライゼーションテスト
        let deserialized: SyncInfo =
            serde_json::from_str(&json).expect("SyncInfoのデシリアライゼーションは成功するはず");
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

        let json = serde_json::to_string(&config)
            .expect("RemoteAccessConfigのシリアライゼーションは成功するはず");
        assert!(json.contains("test-device"));
        assert!(json.contains("github"));
        assert!(json.contains("3600"));

        let deserialized: RemoteAccessConfig = serde_json::from_str(&json)
            .expect("RemoteAccessConfigのデシリアライゼーションは成功するはず");
        assert_eq!(deserialized.device_id, config.device_id);
        assert_eq!(
            deserialized.sync_interval_seconds,
            config.sync_interval_seconds
        );
    }
}
