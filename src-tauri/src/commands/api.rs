// FLM - API管理コマンド
// バックエンドエージェント実装（F001, F002, F003, F004）

use serde::{Deserialize, Serialize};
use crate::database::models::*;
use crate::database::repository::{ApiRepository, ApiKeyRepository, InstalledModelRepository, RequestLogRepository};
use crate::database::connection::get_connection;
use crate::database::DatabaseError;
use chrono::Utc;
use uuid::Uuid;
use bytes::Bytes;
use tauri::Emitter;

/// API作成設定
#[derive(Debug, Serialize, Deserialize)]
pub struct ApiCreateConfig {
    pub name: String,
    pub model_name: String,
    pub port: Option<u16>,
    pub enable_auth: Option<bool>,
}

/// API作成レスポンス
#[derive(Debug, Serialize, Deserialize)]
pub struct ApiCreateResponse {
    pub id: String,
    pub name: String,
    pub endpoint: String,
    pub api_key: Option<String>,
    pub model_name: String,
    pub port: u16,
    pub status: String,
}

/// API情報
#[derive(Debug, Serialize, Deserialize)]
pub struct ApiInfo {
    pub id: String,
    pub name: String,
    pub endpoint: String,
    pub model_name: String,
    pub port: u16,
    pub enable_auth: bool,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
}

/// API作成コマンド
#[tauri::command]
pub async fn create_api(config: ApiCreateConfig) -> Result<ApiCreateResponse, String> {
    // 1. データベース接続を取得
    let conn = get_connection().map_err(|_| {
        "データの保存に失敗しました。アプリを再起動して再度お試しください。".to_string()
    })?;
    
    // 2. Ollamaが起動しているか確認・起動
    use crate::ollama::{check_ollama_running, start_ollama};
    
    if !check_ollama_running().await.map_err(|_| {
        "AIエンジンの状態を確認できませんでした。".to_string()
    })? {
        // Ollamaが起動していない場合は起動を試みる
        start_ollama(None).await.map_err(|_| {
            "AIエンジンの起動に失敗しました。しばらく待ってから再度お試しください。".to_string()
        })?;
        
        // 起動確認のため少し待機
        tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
    }
    
    // 3. モデルが存在するか確認（Ollama APIから取得）
    let client = reqwest::Client::new();
    let response = client
        .get("http://localhost:11434/api/tags")
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
        .map_err(|_| "AIエンジンに接続できませんでした。AIエンジンが正常に起動しているか確認してください。".to_string())?;
    
    if !response.status().is_success() {
        return Err(format!("AIエンジンから情報を取得できませんでした（エラーコード: {}）。AIエンジンが正常に動作しているか確認してください。", response.status()));
    }
    
    let tags: serde_json::Value = response.json().await.map_err(|_| {
        "AIエンジンからの応答を読み取れませんでした。AIエンジンを再起動して再度お試しください。".to_string()
    })?;
    
    let models = tags["models"]
        .as_array()
        .ok_or_else(|| "モデル一覧の形式が不正です".to_string())?
        .iter()
        .map(|m| m["name"].as_str().unwrap_or("").to_string())
        .collect::<Vec<String>>();
    
    // 指定されたモデルが存在するか確認
    if !models.iter().any(|m| m == &config.model_name) {
        return Err(format!(
            "選択されたAIモデル「{}」が見つかりませんでした。\n\n先に「モデル管理」画面からこのモデルをダウンロードしてください。",
            config.model_name
        ));
    }
    
    // 4. ポート番号のデフォルト値
    let port = config.port.unwrap_or(8080) as i32;
    
    // 5. 認証設定のデフォルト値
    let enable_auth = config.enable_auth.unwrap_or(true);
    
    // 6. API ID生成
    let api_id = Uuid::new_v4().to_string();
    
    // 7. API設定を作成
    let api = Api {
        id: api_id.clone(),
        name: config.name.clone(),
        model: config.model_name.clone(), // 既存の実装では`model`フィールドを使用
        port,
        enable_auth,
        status: ApiStatus::Stopped,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };
    
    // 8. データベースに保存
    let api_repo = ApiRepository::new(&conn);
    api_repo.create(&api).map_err(|_| {
        "APIの設定を保存できませんでした。アプリを再起動して再度お試しください。".to_string()
    })?;
    
    // 9. APIキー生成（認証が有効な場合）
    let api_key = if enable_auth {
        use crate::database::encryption;
        use rand::RngCore;
        use base64::{Engine as _, engine::general_purpose::STANDARD};
        
        // 32文字以上のランダムAPIキーを生成
        let mut key_bytes = vec![0u8; 32];
        rand::thread_rng().fill_bytes(&mut key_bytes);
        let generated_key = STANDARD.encode(&key_bytes)
            .chars()
            .take(32)
            .collect::<String>();
        
        // ハッシュを生成（検証用）
        use sha2::{Sha256, Digest};
        let mut hasher = Sha256::new();
        hasher.update(&generated_key);
        let key_hash = hex::encode(hasher.finalize());
        
        // 暗号化して保存
        let encrypted_key_str = encryption::encrypt_api_key(&generated_key).map_err(|_| {
            "セキュリティキーの作成に失敗しました。アプリを再起動して再度お試しください。".to_string()
        })?;
        
        // Base64デコードしてバイト配列に変換（データベースに保存するため）
        let encrypted_key_bytes = STANDARD.decode(&encrypted_key_str).map_err(|_| {
            "セキュリティキーの保存に失敗しました。アプリを再起動して再度お試しください。".to_string()
        })?;
        
        // データベースに保存
        let key_id = Uuid::new_v4().to_string();
        let api_key_data = ApiKey {
            id: key_id,
            api_id: api_id.clone(),
            key_hash: key_hash.clone(),
            encrypted_key: encrypted_key_bytes,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };
        
        let key_repo = ApiKeyRepository::new(&conn);
        key_repo.create(&api_key_data).map_err(|_| {
            "セキュリティキーの保存に失敗しました。アプリを再起動して再度お試しください。".to_string()
        })?;
        
        Some(generated_key)
    } else {
        None
    };
    
    // 10. エンドポイントURL生成
    let endpoint = format!("http://localhost:{port}");
    
    // 注意: 認証プロキシの起動は、現在はAPI作成時には行わず、
    // start_apiコマンドで起動します（認証エージェントの統合待ち）
    
    Ok(ApiCreateResponse {
        id: api_id,
        name: config.name,
        endpoint,
        api_key,
        model_name: config.model_name,
        port: port as u16,
        status: "stopped".to_string(),
    })
}

/// API一覧取得コマンド
#[tauri::command]
pub async fn list_apis() -> Result<Vec<ApiInfo>, String> {
    let conn = get_connection().map_err(|_| {
        "データの読み込みに失敗しました。アプリを再起動して再度お試しください。".to_string()
    })?;
    
    let api_repo = ApiRepository::new(&conn);
    let apis = api_repo.find_all().map_err(|_| {
        "作成済みAPIの一覧を取得できませんでした。アプリを再起動して再度お試しください。".to_string()
    })?;
    
    let api_infos: Vec<ApiInfo> = apis.into_iter().map(|api| {
        ApiInfo {
            id: api.id,
            name: api.name,
            endpoint: format!("http://localhost:{}", api.port),
            model_name: api.model,
            port: api.port as u16,
            enable_auth: api.enable_auth,
            status: api.status.as_str().to_string(),
            created_at: api.created_at.to_rfc3339(),
            updated_at: api.updated_at.to_rfc3339(),
        }
    }).collect();
    
    Ok(api_infos)
}

/// API起動コマンド
#[tauri::command]
pub async fn start_api(api_id: String) -> Result<(), String> {
    // データベース操作を同期的に実行（非Send型のため）
    let (port, enable_auth) = tokio::task::spawn_blocking({
        let api_id = api_id.clone();
        move || {
            let conn = get_connection().map_err(|_| {
                "データの読み込みに失敗しました。アプリを再起動して再度お試しください。".to_string()
            })?;
            
            let api_repo = ApiRepository::new(&conn);
            let api = api_repo.find_by_id(&api_id).map_err(|_| {
                "指定されたAPIが見つかりませんでした。API一覧を確認してください。".to_string()
            })?;
            
            Ok::<(u16, bool), String>((api.port as u16, api.enable_auth))
        }
    }).await.map_err(|e| format!("データベース操作エラー: {e}"))??;
    
    // 2. Ollamaが起動しているか確認・起動
    use crate::ollama::{check_ollama_running, start_ollama};
    
    if !check_ollama_running().await.map_err(|_| {
        "AIエンジンの状態を確認できませんでした。".to_string()
    })? {
        start_ollama(None).await.map_err(|_| {
            "AIエンジンの起動に失敗しました。しばらく待ってから再度お試しください。".to_string()
        })?;
    }
    
    // 3. 認証プロキシを起動（認証が有効な場合）
    if enable_auth {
        use crate::auth;
        
        // 認証プロキシを起動
        // 認証プロキシサーバーはデータベースから直接APIキーのハッシュを確認するため、
        // APIキーを環境変数として渡す必要はない
        // API IDはリクエストログ記録用に環境変数として渡す
        auth::start_auth_proxy(port, None, None, Some(api_id.clone())).await.map_err(|_| {
            "セキュリティ機能の起動に失敗しました。ポート番号が他のアプリで使用されていないか確認してください。".to_string()
        })?;
    }
    
    // 4. ステータスを更新（同期的に実行）
    tokio::task::spawn_blocking({
        let api_id = api_id.clone();
        move || {
            let conn = get_connection().map_err(|_| {
                "データの読み込みに失敗しました。アプリを再起動して再度お試しください。".to_string()
            })?;
            
            let api_repo = ApiRepository::new(&conn);
            let mut api = api_repo.find_by_id(&api_id).map_err(|_| {
                "指定されたAPIが見つかりませんでした。API一覧を確認してください。".to_string()
            })?;
            
            api.status = ApiStatus::Running;
            api.updated_at = Utc::now();
            
            api_repo.update(&api).map_err(|_| {
                "APIの状態を更新できませんでした。アプリを再起動して再度お試しください。".to_string()
            })
        }
    }).await.map_err(|e| format!("データベース操作エラー: {e}"))??;
    
    Ok(())
}

/// API停止コマンド
#[tauri::command]
pub async fn stop_api(api_id: String) -> Result<(), String> {
    // データベース操作を同期的に実行（非Send型のため）
    let port = tokio::task::spawn_blocking({
        let api_id = api_id.clone();
        move || {
            let conn = get_connection().map_err(|_| {
                "データの読み込みに失敗しました。アプリを再起動して再度お試しください。".to_string()
            })?;
            
            let api_repo = ApiRepository::new(&conn);
            let api = api_repo.find_by_id(&api_id).map_err(|_| {
                "指定されたAPIが見つかりませんでした。API一覧を確認してください。".to_string()
            })?;
            
            Ok::<u16, String>(api.port as u16)
        }
    }).await.map_err(|e| format!("データベース操作エラー: {e}"))??;
    
    // 2. 認証プロキシを停止
    use crate::auth;
    auth::stop_auth_proxy_by_port(port).await.map_err(|_| {
        "セキュリティ機能の停止に失敗しました。アプリを再起動して再度お試しください。".to_string()
    })?;
    
    // 3. ステータスを更新（同期的に実行）
    tokio::task::spawn_blocking({
        let api_id = api_id.clone();
        move || {
            let conn = get_connection().map_err(|_| {
                "データの読み込みに失敗しました。アプリを再起動して再度お試しください。".to_string()
            })?;
            
            let api_repo = ApiRepository::new(&conn);
            let mut api = api_repo.find_by_id(&api_id).map_err(|_| {
                "指定されたAPIが見つかりませんでした。API一覧を確認してください。".to_string()
            })?;
            
            api.status = ApiStatus::Stopped;
            api.updated_at = Utc::now();
            
            api_repo.update(&api).map_err(|_| {
                "APIの状態を更新できませんでした。アプリを再起動して再度お試しください。".to_string()
            })
        }
    }).await.map_err(|e| format!("データベース操作エラー: {e}"))??;
    
    Ok(())
}

/// API削除コマンド
#[tauri::command]
pub async fn delete_api(api_id: String) -> Result<(), String> {
    // 1. APIが実行中の場合は停止（データベース操作を同期的に実行）
    let was_running = tokio::task::spawn_blocking({
        let api_id = api_id.clone();
        move || {
            let conn = get_connection().map_err(|_| {
                "データの読み込みに失敗しました。アプリを再起動して再度お試しください。".to_string()
            })?;
            
            let api_repo = ApiRepository::new(&conn);
            match api_repo.find_by_id(&api_id) {
                Ok(api) => Ok::<(bool, u16), String>((api.status == ApiStatus::Running, api.port as u16)),
                Err(_) => Ok((false, 0)),
            }
        }
    }).await.map_err(|e| format!("データベース操作エラー: {e}"))??;
    
    // 2. APIが実行中の場合は停止
    if was_running.0 {
        stop_api(api_id.clone()).await?;
    }
    
    // 3. データベースから削除（CASCADEでAPIキーも削除される）
    tokio::task::spawn_blocking({
        let api_id = api_id.clone();
        move || {
            let conn = get_connection().map_err(|_| {
                "データの読み込みに失敗しました。アプリを再起動して再度お試しください。".to_string()
            })?;
            
            let api_repo = ApiRepository::new(&conn);
            api_repo.delete(&api_id).map_err(|_| {
                "APIの削除に失敗しました。アプリを再起動して再度お試しください。".to_string()
            })
        }
    }).await.map_err(|e| format!("データベース操作エラー: {e}"))??;
    
    Ok(())
}

/// API詳細取得コマンド
#[tauri::command]
pub async fn get_api_details(api_id: String) -> Result<ApiDetailsResponse, String> {
    let conn = get_connection().map_err(|e| {
        format!("データベース接続エラー: {e}")
    })?;
    
    let api_repo = ApiRepository::new(&conn);
    let api = api_repo.find_by_id(&api_id).map_err(|e: DatabaseError| {
        format!("API取得エラー: {e}")
    })?;
    
    // APIキーを取得（認証が有効な場合）
    let api_key = if api.enable_auth {
        let key_repo = ApiKeyRepository::new(&conn);
        match key_repo.find_by_api_id(&api_id) {
            Ok(Some(key_data)) => {
                use crate::database::encryption;
                use base64::{Engine as _, engine::general_purpose::STANDARD};
                
                // 暗号化されたキーを復号化
                let encrypted_str = STANDARD.encode(&key_data.encrypted_key);
                encryption::decrypt_api_key(&encrypted_str).ok()
            }
            _ => None,
        }
    } else {
        None
    };
    
    Ok(ApiDetailsResponse {
        id: api.id,
        name: api.name,
        endpoint: format!("http://localhost:{}", api.port),
        model_name: api.model,
        port: api.port as u16,
        enable_auth: api.enable_auth,
        status: api.status.as_str().to_string(),
        api_key,
        created_at: api.created_at.to_rfc3339(),
        updated_at: api.updated_at.to_rfc3339(),
    })
}

/// API詳細レスポンス
#[derive(Debug, Serialize, Deserialize)]
pub struct ApiDetailsResponse {
    pub id: String,
    pub name: String,
    pub endpoint: String,
    pub model_name: String,
    pub port: u16,
    pub enable_auth: bool,
    pub status: String,
    pub api_key: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

/// API設定更新コマンド
#[tauri::command]
pub async fn update_api(api_id: String, config: ApiUpdateConfig) -> Result<(), String> {
    // データベース操作を同期的に実行（非Send型のため）
    let (was_running, old_port, _enable_auth) = tokio::task::spawn_blocking({
        let api_id = api_id.clone();
        move || {
            let conn = get_connection().map_err(|e| {
                format!("データベース接続エラー: {e}")
            })?;
            
            let api_repo = ApiRepository::new(&conn);
            let api = api_repo.find_by_id(&api_id).map_err(|e: DatabaseError| {
                format!("API取得エラー: {e}")
            })?;
            
            Ok::<(bool, i32, bool), String>((api.status == ApiStatus::Running, api.port, api.enable_auth))
        }
    }).await.map_err(|e| format!("データベース操作エラー: {e}"))??;
    
    // 設定を更新（データベース操作）
    let (new_port, new_enable_auth, needs_restart_flag) = tokio::task::spawn_blocking({
        let api_id = api_id.clone();
        let config = config.clone();
        let was_running_flag = was_running;
        move || {
            let conn = get_connection().map_err(|e| {
                format!("データベース接続エラー: {e}")
            })?;
            
            let api_repo = ApiRepository::new(&conn);
            let mut api = api_repo.find_by_id(&api_id).map_err(|e: DatabaseError| {
                format!("API取得エラー: {e}")
            })?;
            
            let mut needs_restart = false;
            
            if let Some(name) = config.name {
                api.name = name;
            }
            if let Some(port) = config.port {
                let old_port_local = api.port;
                api.port = port as i32;
                // ポート番号が変更された場合は再起動が必要
                if old_port_local != api.port && was_running_flag {
                    needs_restart = true;
                }
            }
            if let Some(enable_auth) = config.enable_auth {
                let old_auth = api.enable_auth;
                api.enable_auth = enable_auth;
                // 認証設定が変更された場合は再起動が必要
                if old_auth != api.enable_auth && was_running_flag {
                    needs_restart = true;
                }
            }
            
            api.updated_at = Utc::now();
            
            api_repo.update(&api).map_err(|_| {
                "APIの設定を更新できませんでした。アプリを再起動して再度お試しください。".to_string()
            })?;
            
            Ok::<(i32, bool, bool), String>((api.port, api.enable_auth, needs_restart))
        }
    }).await.map_err(|e| format!("データベース操作エラー: {e}"))??;
    
    // 設定変更により再起動が必要な場合
    if needs_restart_flag && was_running {
        // 1. 既存の認証プロキシを停止（古いポート番号で）
        use crate::auth;
        let _ = auth::stop_auth_proxy_by_port(old_port as u16).await;
        
        // 2. 新しい設定で再起動
        // ポート番号が変更された場合、新しいポートで起動する必要がある
        if new_enable_auth {
            auth::start_auth_proxy(new_port as u16, None, None, Some(api_id.clone())).await.map_err(|_| {
                "セキュリティ機能の再起動に失敗しました。ポート番号が他のアプリで使用されていないか確認してください。".to_string()
            })?;
        }
    }
    
    Ok(())
}

/// API更新設定
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiUpdateConfig {
    pub name: Option<String>,
    pub port: Option<u16>,
    pub enable_auth: Option<bool>,
}

/// APIキー取得コマンド
#[tauri::command]
pub async fn get_api_key(api_id: String) -> Result<Option<String>, String> {
    let conn = get_connection().map_err(|e| {
        format!("データベース接続エラー: {e}")
    })?;
    
    let api_repo = ApiRepository::new(&conn);
    let api = api_repo.find_by_id(&api_id).map_err(|e: DatabaseError| {
        format!("API取得エラー: {e}")
    })?;
    
    if !api.enable_auth {
        return Ok(None);
    }
    
    let key_repo = ApiKeyRepository::new(&conn);
    let key_data = key_repo.find_by_api_id(&api_id).map_err(|_| {
        "セキュリティキーの取得に失敗しました。アプリを再起動して再度お試しください。".to_string()
    })?;
    
    match key_data {
        Some(key_data) => {
            use crate::database::encryption;
            use base64::{Engine as _, engine::general_purpose::STANDARD};
            
            // 暗号化されたキーを復号化
            let encrypted_str = STANDARD.encode(&key_data.encrypted_key);
            let decrypted_key = encryption::decrypt_api_key(&encrypted_str).map_err(|_| {
                "セキュリティキーの復号化に失敗しました。アプリを再起動して再度お試しください。".to_string()
            })?;
            
            Ok(Some(decrypted_key))
        }
        // Noneはパターンマッチングのリテラル（Clippyの誤検知を抑制）
        #[allow(clippy::single_match, non_snake_case)]
        None => Ok(None),
    }
}

/// APIキー再生成コマンド
#[tauri::command]
#[allow(non_snake_case)] // Noneはパターンマッチングのリテラル（Clippyの誤検知）
pub async fn regenerate_api_key(api_id: String) -> Result<String, String> {
    let conn = get_connection().map_err(|e| {
        format!("データベース接続エラー: {e}")
    })?;
    
    let api_repo = ApiRepository::new(&conn);
    let api = api_repo.find_by_id(&api_id).map_err(|e: DatabaseError| {
        format!("API取得エラー: {e}")
    })?;
    
    if !api.enable_auth {
        return Err("認証が有効になっていないAPIのAPIキーは再生成できません".to_string());
    }
    
    let key_repo = ApiKeyRepository::new(&conn);
    
    // 新しいAPIキーを生成
    use crate::database::encryption;
    use rand::RngCore;
    use base64::{Engine as _, engine::general_purpose::STANDARD};
    
    // 32文字以上のランダムAPIキーを生成
    let mut key_bytes = vec![0u8; 32];
    rand::thread_rng().fill_bytes(&mut key_bytes);
    let generated_key = STANDARD.encode(&key_bytes)
        .chars()
        .take(32)
        .collect::<String>();
    
    // ハッシュを生成（検証用）
    use sha2::{Sha256, Digest};
    let mut hasher = Sha256::new();
    hasher.update(&generated_key);
    let key_hash = hex::encode(hasher.finalize());
    
    // 暗号化して保存
    let encrypted_key_str = encryption::encrypt_api_key(&generated_key).map_err(|e| {
        format!("APIキー暗号化エラー: {e}")
    })?;
    
    // Base64デコードしてバイト配列に変換（データベースに保存するため）
    let encrypted_key_bytes = STANDARD.decode(&encrypted_key_str).map_err(|e| {
        format!("暗号化データのデコードエラー: {e}")
    })?;
    
    // 既存のAPIキーを更新
    match key_repo.find_by_api_id(&api_id) {
        Ok(Some(mut key_data)) => {
            key_data.key_hash = key_hash.clone();
            key_data.encrypted_key = encrypted_key_bytes;
            key_data.updated_at = Utc::now();
            
            key_repo.update(&key_data).map_err(|e: DatabaseError| {
                format!("APIキー更新エラー: {e}")
            })?;
        }
        #[allow(non_snake_case)]
        Ok(None) | Err(_) => {
            // APIキーが存在しない場合は新規作成
            let key_id = Uuid::new_v4().to_string();
            let api_key_data = ApiKey {
                id: key_id,
                api_id: api_id.clone(),
                key_hash: key_hash.clone(),
                encrypted_key: encrypted_key_bytes,
                created_at: Utc::now(),
                updated_at: Utc::now(),
            };
            
            key_repo.create(&api_key_data).map_err(|_| {
                "セキュリティキーの保存に失敗しました。アプリを再起動して再度お試しください。".to_string()
            })?;
        }
    }
    
    Ok(generated_key)
}

/// APIキー削除コマンド
#[tauri::command]
pub async fn delete_api_key(api_id: String) -> Result<(), String> {
    let conn = get_connection().map_err(|e| {
        format!("データベース接続エラー: {e}")
    })?;
    
    let api_repo = ApiRepository::new(&conn);
    let api = api_repo.find_by_id(&api_id).map_err(|e: DatabaseError| {
        format!("API取得エラー: {e}")
    })?;
    
    if !api.enable_auth {
        return Err("認証が有効になっていないAPIにはAPIキーが存在しません".to_string());
    }
    
    let key_repo = ApiKeyRepository::new(&conn);
    
    // APIキーを削除
    key_repo.delete_by_api_id(&api_id).map_err(|e: DatabaseError| {
        format!("APIキー削除エラー: {e}")
    })?;
    
    Ok(())
}

/// モデル一覧取得コマンド（Ollama APIから取得）
#[tauri::command]
pub async fn get_models_list() -> Result<Vec<ModelInfo>, String> {
    use crate::ollama::check_ollama_running;
    
    // Ollamaが実行中か確認
    if !check_ollama_running().await.map_err(|_| {
        "AIエンジンの状態を確認できませんでした。".to_string()
    })? {
        return Err("AIエンジンが実行されていません。先にAIエンジンを起動してください。".to_string());
    }
    
    // Ollama APIからモデル一覧を取得
    let client = reqwest::Client::new();
    let response = client
        .get("http://localhost:11434/api/tags")
        .send()
        .await
        .map_err(|_| "AIエンジンに接続できませんでした。AIエンジンが正常に起動しているか確認してください。".to_string())?;
    
    let tags: serde_json::Value = response.json().await.map_err(|_| {
        "AIエンジンからの応答を読み取れませんでした。AIエンジンを再起動して再度お試しください。".to_string()
    })?;
    
    let models = tags["models"]
        .as_array()
        .ok_or_else(|| "モデル一覧の形式が不正です".to_string())?
        .iter()
        .map(|m| {
            // パラメータサイズを推定（モデル名から）
            let name = m["name"].as_str().unwrap_or("");
            let parameter_size = extract_parameter_size(name);
            
            ModelInfo {
                name: name.to_string(),
                size: m["size"].as_u64(),
                modified_at: m["modified_at"].as_str().unwrap_or("").to_string(),
                parameter_size,
            }
        })
        .collect();
    
    Ok(models)
}

/// モデル名からパラメータサイズを抽出
fn extract_parameter_size(model_name: &str) -> Option<String> {
    // モデル名からパラメータ数を推定（例: "llama3:8b" -> "8B", "mistral:7b" -> "7B"）
    // 正規表現パターン: 数字の後に "b" または "B" が続くパターンを探す
    let re = regex::Regex::new(r"(\d+(?:\.\d+)?)\s*[bB]").ok()?;
    if let Some(captures) = re.captures(model_name) {
        if let Some(size_str) = captures.get(1) {
            // 単位は常に "B" (Billion) とする
            return Some(format!("{}B", size_str.as_str()));
        }
    }
    None
}

/// モデル情報
#[derive(Debug, Serialize, Deserialize)]
pub struct ModelInfo {
    pub name: String,
    pub size: Option<u64>,
    pub modified_at: String,
    pub parameter_size: Option<String>,
}

/// モデルダウンロード進捗情報
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelDownloadProgress {
    pub status: String,             // "pulling" | "completed" | "error"
    pub progress: f64,               // 0.0 - 100.0
    pub downloaded_bytes: u64,       // ダウンロード済みバイト数
    pub total_bytes: u64,            // 総バイト数
    pub speed_bytes_per_sec: f64,    // ダウンロード速度（バイト/秒）
    pub message: Option<String>,     // ステータスメッセージ
}

/// モデルダウンロードコマンド（Ollama API `POST /api/pull` 呼び出し）
/// 進捗はイベント経由で送信されます
#[tauri::command]
pub async fn download_model(
    model_name: String,
    app: tauri::AppHandle,
) -> Result<(), String> {
    // AppHandleをクローンしてSendを保証
    let app_handle = app.clone();
    use crate::ollama::check_ollama_running;
    use futures_util::StreamExt;
    
    // Ollamaが実行中か確認
    if !check_ollama_running().await.map_err(|_| {
        "AIエンジンの状態を確認できませんでした。".to_string()
    })? {
        return Err("AIエンジンが実行されていません。先にAIエンジンを起動してください。".to_string());
    }
    
    // Ollama APIにモデルダウンロードリクエストを送信
    let client = reqwest::Client::new();
    let response = client
        .post("http://localhost:11434/api/pull")
        .json(&serde_json::json!({
            "name": model_name.clone(),
            "stream": true
        }))
        .send()
        .await
        .map_err(|_| "AIエンジンに接続できませんでした。AIエンジンが正常に起動しているか確認してください。".to_string())?;
    
    if !response.status().is_success() {
        return Err(format!("AIモデルのダウンロードに失敗しました（エラーコード: {}）。AIエンジンが正常に動作しているか確認してください。", response.status()));
    }
    
    // ストリーミングレスポンスを処理
    // Ollama APIは各行がJSONオブジェクトの形式で進捗を返す
    let mut stream = response.bytes_stream();
    let mut buffer = String::with_capacity(4096); // 初期容量を設定してメモリアロケーションを最適化
    let mut total_downloaded = 0u64;
    let mut total_size = 0u64;
    let start_time = std::time::Instant::now();
    let mut last_progress_update = std::time::Instant::now();
    
    // バッファサイズの上限（10KB）- メモリリーク防止
    const MAX_BUFFER_SIZE: usize = 10 * 1024;
    
    while let Some(chunk_result) = stream.next().await {
        let chunk: Bytes = chunk_result.map_err(|_| {
            "ダウンロード中にエラーが発生しました。ネットワーク接続を確認してください。".to_string()
        })?;
        
        let chunk_len: usize = chunk.len();
        total_downloaded += chunk_len as u64;
        
        // チャンクを文字列に変換してバッファに追加
        let chunk_str = String::from_utf8_lossy(&chunk);
        
        // バッファサイズのチェック（メモリリーク防止）
        // バッファが上限を超える場合、既存の行を処理してから追加
        if buffer.len() + chunk_str.len() > MAX_BUFFER_SIZE {
            // バッファから完全な行を先に処理してメモリを解放
            while let Some(newline_pos) = buffer.find('\n') {
                // 行を処理する前に、行の位置と内容を取得
                let line_end = newline_pos + 1;
                let line_str = {
                    // スライスの借用を明確にスコープ内で終了させる
                    let line_slice = &buffer[..newline_pos];
                    line_slice.trim().to_string()
                };
                // bufferから処理済み部分を削除（スライスの借用が終了した後）
                buffer.drain(..line_end);
                
                if !line_str.is_empty() {
                    // JSONオブジェクトを解析（total_sizeを更新するため）
                    if let Ok(json) = serde_json::from_str::<serde_json::Value>(&line_str) {
                        if let Some(total) = json.get("total").and_then(|t| t.as_u64()) {
                            if total > 0 {
                                total_size = total_size.max(total);
                            }
                        }
                    }
                }
            }
            
            // バッファをリサイズしてメモリを解放
            if buffer.capacity() > 4096 {
                buffer.shrink_to_fit();
            }
        }
        
        buffer.push_str(&chunk_str);
        
        // バッファから完全な行を処理
        while let Some(newline_pos) = buffer.find('\n') {
            let line_str = buffer[..newline_pos].trim().to_string();
            buffer = buffer[newline_pos + 1..].to_string();
            
            if line_str.is_empty() {
                continue;
            }
            
            // JSONオブジェクトを解析
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&line_str) {
                // Ollama APIの進捗情報を取得
                // レスポンス形式: {"status": "pulling manifest", "digest": "...", "total": 100, "completed": 50}
                let status = json.get("status")
                    .and_then(|s| s.as_str())
                    .unwrap_or("pulling")
                    .to_string();
                
                // 進捗情報を取得（Ollama APIの形式に合わせる）
                let completed = json.get("completed")
                    .and_then(|c| c.as_u64())
                    .unwrap_or(0u64);
                let total = json.get("total")
                    .and_then(|t| t.as_u64())
                    .unwrap_or(0u64);
                
                if total > 0 {
                    total_size = total_size.max(total);
                }
                
                // 速度計算
                let elapsed = start_time.elapsed().as_secs_f64();
                let speed = if elapsed > 0.0 {
                    total_downloaded as f64 / elapsed
                } else {
                    0.0
                };
                
                // 進捗率を計算
                let progress_percent = if total_size > 0 {
                    (completed as f64 / total_size as f64) * 100.0
                } else {
                    0.0
                };
                
                // 進捗イベントを送信（0.5秒ごとに更新）
                if last_progress_update.elapsed().as_millis() >= 500 {
                    let progress = ModelDownloadProgress {
                        status: status.clone(),
                        progress: progress_percent,
                        downloaded_bytes: completed,
                        total_bytes: total_size,
                        speed_bytes_per_sec: speed,
                        message: Some(status.clone()),
                    };
                    
                    let _ = app_handle.emit("model_download_progress", &progress);
                    last_progress_update = std::time::Instant::now();
                }
            }
        }
    }
    
    // 残りのバッファを処理
    if !buffer.trim().is_empty() {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(buffer.trim()) {
            let status = json.get("status")
                .and_then(|s| s.as_str())
                .unwrap_or("completed")
                .to_string();
            
             if status == "success" {
                 // ダウンロード完了後、データベースに保存
                 // モデル情報を取得（Ollama APIから）
                 let client = reqwest::Client::new();
                 if let Ok(tags_response) = client
                     .get("http://localhost:11434/api/tags")
                     .send()
                     .await
                 {
                     if let Ok(tags_json) = tags_response.json::<serde_json::Value>().await {
                         if let Some(models_array) = tags_json["models"].as_array() {
                             for model_data in models_array {
                                 if let Some(name) = model_data["name"].as_str() {
                                     if name == model_name {
                                         let size = model_data["size"].as_u64().unwrap_or(0);
                                         let parameters = extract_parameter_size(name)
                                             .and_then(|ps| {
                                                 ps.trim_end_matches('B').parse::<i64>().ok()
                                                     .map(|p| p * 1_000_000_000)
                                             });
                                         
                                         let installed_model = InstalledModel {
                                             name: name.to_string(),
                                             size: size as i64,
                                             parameters,
                                             installed_at: Utc::now(),
                                             last_used_at: Some(Utc::now()),
                                             usage_count: 0,
                                         };
                                         
                                         // データベースに保存（spawn_blocking内で実行）
                                         let model_to_save = installed_model.clone();
                                         tokio::task::spawn_blocking(move || {
                                             if let Ok(conn) = get_connection() {
                                                 let model_repo = InstalledModelRepository::new(&conn);
                                                 let _ = model_repo.upsert(&model_to_save);
                                             }
                                         }).await.ok();
                                         break;
                                     }
                                 }
                             }
                         }
                     }
                 }
                 
                 let progress = ModelDownloadProgress {
                     status: "completed".to_string(),
                     progress: 100.0,
                     downloaded_bytes: total_downloaded,
                     total_bytes: total_size,
                     speed_bytes_per_sec: 0.0,
                     message: Some(format!("モデル '{}' のダウンロードが完了しました", model_name)),
                 };
                 let _ = app_handle.emit("model_download_progress", &progress);
             }
         }
     } else {
         // 完了通知（バッファが空の場合）
         let final_progress = ModelDownloadProgress {
             status: "completed".to_string(),
             progress: 100.0,
             downloaded_bytes: total_downloaded,
             total_bytes: total_size,
             speed_bytes_per_sec: 0.0,
             message: Some(format!("モデル '{}' のダウンロードが完了しました", model_name)),
         };
         let _ = app_handle.emit("model_download_progress", &final_progress);
     }
     
     Ok(())
}

/// モデル削除コマンド（Ollama API `POST /api/delete` 呼び出し）
#[tauri::command]
pub async fn delete_model(model_name: String) -> Result<(), String> {
    use crate::ollama::check_ollama_running;
    use crate::database::connection::get_connection;
    use crate::database::repository::InstalledModelRepository;
    
    // Ollamaが実行中か確認
    if !check_ollama_running().await.map_err(|_| {
        "AIエンジンの状態を確認できませんでした。".to_string()
    })? {
        return Err("AIエンジンが実行されていません。先にAIエンジンを起動してください。".to_string());
    }
    
    // Ollama APIにモデル削除リクエストを送信
    let client = reqwest::Client::new();
    let response = client
        .post("http://localhost:11434/api/delete")
        .json(&serde_json::json!({
            "name": model_name.clone()
        }))
        .send()
        .await
        .map_err(|_| "AIエンジンに接続できませんでした。AIエンジンが正常に起動しているか確認してください。".to_string())?;
    
    if !response.status().is_success() {
        return Err(format!("AIモデルの削除に失敗しました（エラーコード: {}）。AIエンジンが正常に動作しているか確認してください。", response.status()));
    }
    
    // データベースからも削除
    let conn = get_connection().map_err(|_| {
        "データの読み込みに失敗しました。アプリを再起動して再度お試しください。".to_string()
    })?;
    let model_repo = InstalledModelRepository::new(&conn);
    model_repo.delete(&model_name).map_err(|_| {
        "データベースからの削除に失敗しました。アプリを再起動して再度お試しください。".to_string()
    })?;
    
    Ok(())
}

/// インストール済みモデル一覧取得コマンド
#[tauri::command]
pub async fn get_installed_models() -> Result<Vec<InstalledModelInfo>, String> {
    use crate::database::connection::get_connection;
    use crate::database::repository::InstalledModelRepository;
    
    // データベースからインストール済みモデルを取得（非Send型のため）
    let mut installed_models = tokio::task::spawn_blocking(|| {
        let conn = get_connection().map_err(|_| {
            "データの読み込みに失敗しました。アプリを再起動して再度お試しください。".to_string()
        })?;
        
        let model_repo = InstalledModelRepository::new(&conn);
        model_repo.find_all().map_err(|_| {
            "インストール済みAIモデルの一覧を取得できませんでした。アプリを再起動して再度お試しください。".to_string()
        })
    }).await.map_err(|e| format!("データベース操作エラー: {e}"))??;
    
    // Ollama APIからも取得して、最新の情報と同期
    use crate::ollama::check_ollama_running;
    
    // Ollamaが実行中の場合は、Ollama APIからも取得してサイズ情報を更新
    if check_ollama_running().await.map_err(|_| {
        "AIエンジンの状態を確認できませんでした。".to_string()
    })? {
        let client = reqwest::Client::new();
        if let Ok(response) = client
            .get("http://localhost:11434/api/tags")
            .timeout(std::time::Duration::from_secs(5))
            .send()
            .await
        {
            if response.status().is_success() {
                if let Ok(tags) = response.json::<serde_json::Value>().await {
                    if let Some(ollama_models) = tags["models"].as_array() {
                        // Ollama APIからのモデル情報でメモリ上のデータを更新
                        for ollama_model in ollama_models {
                            if let Some(name) = ollama_model["name"].as_str() {
                                if let Some(size) = ollama_model["size"].as_u64() {
                                    // メモリ上のデータを更新
                                    if let Some(db_model) = installed_models.iter_mut().find(|m| m.name == name) {
                                        db_model.size = size as i64;
                                        db_model.last_used_at = Some(Utc::now());
                                    } else {
                                        // 新しいモデルがインストールされている場合は追加
                                        let parameter_size = extract_parameter_size(name).and_then(|s| {
                                            if let Ok(num) = s.trim_end_matches('B').parse::<f64>() {
                                                Some((num * 1_000_000_000.0) as i64)
                                            } else {
                                                None
                                            }
                                        });
                                        
                                        let new_model = crate::database::models::InstalledModel {
                                            name: name.to_string(),
                                            size: size as i64,
                                            parameters: parameter_size,
                                            installed_at: Utc::now(),
                                            last_used_at: Some(Utc::now()),
                                            usage_count: 0,
                                        };
                                        installed_models.push(new_model);
                                    }
                                }
                            }
                        }
                        
                        // データベースを一括更新（spawn_blocking内で実行）
                        let models_to_save = installed_models.clone();
                        tokio::task::spawn_blocking(move || {
                            if let Ok(conn) = get_connection() {
                                let model_repo = InstalledModelRepository::new(&conn);
                                for model in models_to_save {
                                    let _ = model_repo.upsert(&model);
                                }
                            }
                        }).await.ok();
                    }
                }
            }
        }
    }
    
    // InstalledModelInfo形式に変換
    let result: Vec<InstalledModelInfo> = installed_models.into_iter().map(|model| {
        InstalledModelInfo {
            name: model.name,
            size: model.size as u64,
            parameters: model.parameters,
            installed_at: model.installed_at.to_rfc3339(),
            last_used_at: model.last_used_at.map(|d| d.to_rfc3339()),
            usage_count: model.usage_count,
        }
    }).collect();
    
    Ok(result)
}

/// インストール済みモデル情報
#[derive(Debug, Serialize, Deserialize)]
pub struct InstalledModelInfo {
    pub name: String,
    pub size: u64,
    pub parameters: Option<i64>,
    pub installed_at: String,
    pub last_used_at: Option<String>,
    pub usage_count: i32,
}

/// リクエストログ保存リクエスト（認証プロキシサーバーから呼び出される）
#[derive(Debug, Serialize, Deserialize)]
pub struct SaveRequestLogRequest {
    pub api_id: String,
    pub method: String,
    pub path: String,
    pub request_body: Option<String>,
    pub response_status: Option<i32>,
    pub response_time_ms: Option<i32>,
    pub error_message: Option<String>,
}

/// リクエストログ保存コマンド（F006の基盤）
/// 認証プロキシサーバーから呼び出されて、リクエストログをデータベースに保存します
#[tauri::command]
pub async fn save_request_log(request: SaveRequestLogRequest) -> Result<(), String> {
    let conn = get_connection().map_err(|_| {
        "データの保存に失敗しました。アプリを再起動して再度お試しください。".to_string()
    })?;
    
    let log_repo = RequestLogRepository::new(&conn);
    
    let log = RequestLog {
        id: Uuid::new_v4().to_string(),
        api_id: request.api_id,
        method: request.method,
        path: request.path,
        request_body: request.request_body,
        response_status: request.response_status,
        response_time_ms: request.response_time_ms,
        error_message: request.error_message,
        created_at: Utc::now(),
    };
    
    log_repo.create(&log).map_err(|_| {
        "リクエストログの保存に失敗しました。アプリを再起動して再度お試しください。".to_string()
    })?;
    
    Ok(())
}

/// リクエストログ取得リクエスト
#[derive(Debug, Serialize, Deserialize)]
pub struct GetRequestLogsRequest {
    pub api_id: Option<String>,
    pub limit: Option<i32>,
    pub offset: Option<i32>,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub status_codes: Option<Vec<i32>>,
    pub path_filter: Option<String>,
}

/// リクエストログ情報（フロントエンド用）
#[derive(Debug, Serialize, Deserialize)]
pub struct RequestLogInfo {
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

/// リクエストログ一覧取得コマンド（F006の基盤 + フィルタ機能拡張）
#[tauri::command]
pub async fn get_request_logs(request: GetRequestLogsRequest) -> Result<Vec<RequestLogInfo>, String> {
    let conn = get_connection().map_err(|_| {
        "データの読み込みに失敗しました。アプリを再起動して再度お試しください。".to_string()
    })?;
    
    let log_repo = RequestLogRepository::new(&conn);
    
    // フィルタ条件を使用してログを取得
    let logs = log_repo.find_with_filters(
        request.api_id.as_deref(),
        request.limit,
        request.offset,
        request.start_date.as_deref(),
        request.end_date.as_deref(),
        request.status_codes.as_deref(),
        request.path_filter.as_deref(),
    ).map_err(|e| {
        format!("リクエストログの取得に失敗しました: {e}")
    })?;
    
    let result: Vec<RequestLogInfo> = logs.into_iter().map(|log| {
        RequestLogInfo {
            id: log.id,
            api_id: log.api_id,
            method: log.method,
            path: log.path,
            request_body: log.request_body,
            response_status: log.response_status,
            response_time_ms: log.response_time_ms,
            error_message: log.error_message,
            created_at: log.created_at.to_rfc3339(),
        }
    }).collect();
    
    Ok(result)
}

/// ログ統計情報リクエスト
#[derive(Debug, Serialize, Deserialize)]
pub struct GetLogStatisticsRequest {
    pub api_id: String,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
}

/// ログ統計情報レスポンス
#[derive(Debug, Serialize, Deserialize)]
pub struct LogStatistics {
    pub total_requests: i64,
    pub avg_response_time_ms: f64,
    pub error_rate: f64,
    pub status_code_distribution: Vec<(i32, i64)>,
}

/// ログ統計情報取得コマンド（BE-006-02）
#[tauri::command]
pub async fn get_log_statistics(request: GetLogStatisticsRequest) -> Result<LogStatistics, String> {
    let conn = get_connection().map_err(|_| {
        "データの読み込みに失敗しました。アプリを再起動して再度お試しください。".to_string()
    })?;
    
    let log_repo = RequestLogRepository::new(&conn);
    
    // リポジトリのget_statisticsメソッドを呼び出し
    let (total_requests, avg_response_time_ms, error_rate, status_code_distribution) = log_repo
        .get_statistics(
            Some(&request.api_id),
            request.start_date.as_deref(),
            request.end_date.as_deref(),
        )
        .map_err(|e| {
            format!("ログ統計情報の取得に失敗しました: {e}")
        })?;
    
    Ok(LogStatistics {
        total_requests,
        avg_response_time_ms,
        error_rate,
        status_code_distribution,
    })
}

/// ログエクスポートリクエスト（BE-008-01）
#[derive(Debug, Serialize, Deserialize)]
pub struct ExportLogsRequest {
    pub api_id: Option<String>,
    pub format: String, // "csv" または "json"
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub status_codes: Option<Vec<i32>>,
    pub path_filter: Option<String>,
}

/// ログエクスポートレスポンス（BE-008-01）
#[derive(Debug, Serialize, Deserialize)]
pub struct ExportLogsResponse {
    pub data: String,
    pub format: String,
    pub count: i64,
}

/// ログエクスポートコマンド（BE-008-01）
/// ログデータをCSV/JSON形式でエクスポートします
#[tauri::command]
pub async fn export_logs(request: ExportLogsRequest) -> Result<ExportLogsResponse, String> {
    let conn = get_connection().map_err(|_| {
        "データの読み込みに失敗しました。アプリを再起動して再度お試しください。".to_string()
    })?;
    
    let log_repo = RequestLogRepository::new(&conn);
    
    // フィルタ条件を使用してログを取得（limitなしで全件取得）
    let logs = log_repo.find_with_filters(
        request.api_id.as_deref(),
        None, // limitなし
        None, // offsetなし
        request.start_date.as_deref(),
        request.end_date.as_deref(),
        request.status_codes.as_deref(),
        request.path_filter.as_deref(),
    ).map_err(|e| {
        format!("リクエストログの取得に失敗しました: {e}")
    })?;
    
    let count = i64::try_from(logs.len()).unwrap_or(0);
    
    // フォーマットに応じてデータを変換
    let data = match request.format.as_str() {
        "csv" => {
            // CSV形式に変換
            let mut csv = String::new();
            // ヘッダー行
            csv.push_str("ID,API ID,Method,Path,Request Body,Response Status,Response Time (ms),Error Message,Created At\n");
            
            // データ行
            for log in &logs {
                csv.push_str(&format!(
                    "{},{},{},{},{},{},{},{},{}\n",
                    escape_csv_field(&log.id),
                    escape_csv_field(&log.api_id),
                    escape_csv_field(&log.method),
                    escape_csv_field(&log.path),
                    escape_csv_field(&log.request_body.as_deref().unwrap_or("")),
                    log.response_status.map(|s| s.to_string()).as_deref().unwrap_or(""),
                    log.response_time_ms.map(|t| t.to_string()).as_deref().unwrap_or(""),
                    escape_csv_field(&log.error_message.as_deref().unwrap_or("")),
                    escape_csv_field(&log.created_at.to_rfc3339()),
                ));
            }
            csv
        },
        "json" => {
            // JSON形式に変換
            let log_infos: Vec<RequestLogInfo> = logs.into_iter().map(|log| {
                RequestLogInfo {
                    id: log.id,
                    api_id: log.api_id,
                    method: log.method,
                    path: log.path,
                    request_body: log.request_body,
                    response_status: log.response_status,
                    response_time_ms: log.response_time_ms,
                    error_message: log.error_message,
                    created_at: log.created_at.to_rfc3339(),
                }
            }).collect();
            
            serde_json::to_string_pretty(&log_infos).map_err(|e| {
                format!("JSON変換に失敗しました: {e}")
            })?
        },
        _ => {
            return Err(format!("無効なフォーマットです。'csv' または 'json' を指定してください。"));
        }
    };
    
    Ok(ExportLogsResponse {
        data,
        format: request.format,
        count,
    })
}

/// CSVフィールドのエスケープ処理（BE-008-01）
fn escape_csv_field(field: &str) -> String {
    // ダブルクォート、改行、カンマが含まれる場合はダブルクォートで囲む
    if field.contains('"') || field.contains('\n') || field.contains(',') {
        format!("\"{}\"", field.replace('"', "\"\""))
    } else {
        field.to_string()
    }
}

/// API設定エクスポート用データ（BE-008-02）
#[derive(Debug, Serialize, Deserialize)]
pub struct ApiSettingsExport {
    pub apis: Vec<ApiSettingsData>,
    pub export_date: String,
    pub version: String,
}

/// API設定データ（BE-008-02）
#[derive(Debug, Serialize, Deserialize)]
pub struct ApiSettingsData {
    pub id: String,
    pub name: String,
    pub model: String,
    pub port: i32,
    pub enable_auth: bool,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
}

/// API設定エクスポートリクエスト（BE-008-02）
#[derive(Debug, Serialize, Deserialize)]
pub struct ExportApiSettingsRequest {
    pub api_ids: Option<Vec<String>>, // Noneの場合は全API
}

/// API設定エクスポートコマンド（BE-008-02）
/// 選択したAPIまたはすべてのAPI設定をJSON形式でエクスポートします
#[tauri::command]
pub async fn export_api_settings(request: ExportApiSettingsRequest) -> Result<String, String> {
    let conn = get_connection().map_err(|_| {
        "データの読み込みに失敗しました。アプリを再起動して再度お試しください。".to_string()
    })?;
    
    let api_repo = ApiRepository::new(&conn);
    
    // API一覧を取得
    let apis = if let Some(api_ids) = request.api_ids {
        // 指定されたAPIのみ取得
        let mut result = Vec::new();
        for api_id in api_ids {
            match api_repo.find_by_id(&api_id) {
                Ok(api) => result.push(api),
                Err(crate::database::DatabaseError::NotFound(_)) => {
                    return Err(format!("API ID '{}' が見つかりません", api_id));
                },
                Err(e) => {
                    return Err(format!("API '{api_id}' の取得に失敗しました: {e}"));
                }
            }
        }
        result
    } else {
        // すべてのAPIを取得
        api_repo.find_all().map_err(|e| {
            format!("API一覧の取得に失敗しました: {}", e)
        })?
    };
    
    // エクスポートデータに変換
    let settings_data: Vec<ApiSettingsData> = apis.into_iter().map(|api| {
        ApiSettingsData {
            id: api.id,
            name: api.name,
            model: api.model,
            port: api.port,
            enable_auth: api.enable_auth,
            status: api.status.as_str().to_string(),
            created_at: api.created_at.to_rfc3339(),
            updated_at: api.updated_at.to_rfc3339(),
        }
    }).collect();
    
    let export_data = ApiSettingsExport {
        apis: settings_data,
        export_date: Utc::now().to_rfc3339(),
        version: "1.0".to_string(),
    };
    
    // JSON形式でエクスポート
    serde_json::to_string_pretty(&export_data).map_err(|e| {
        format!("JSON変換に失敗しました: {}", e)
    })
}

/// API設定インポートリクエスト（BE-008-02）
#[derive(Debug, Serialize, Deserialize)]
pub struct ImportApiSettingsRequest {
    pub json_data: String,
    pub conflict_resolution: String, // "skip", "overwrite", "rename"
}

/// API設定インポートレスポンス（BE-008-02）
#[derive(Debug, Serialize, Deserialize)]
pub struct ImportApiSettingsResponse {
    pub imported: i32,
    pub skipped: i32,
    pub renamed: i32,
    pub errors: Vec<String>,
}

/// API設定インポートコマンド（BE-008-02）
/// JSON形式のAPI設定データをインポートします
#[tauri::command]
pub async fn import_api_settings(request: ImportApiSettingsRequest) -> Result<ImportApiSettingsResponse, String> {
    // JSONデータをパース
    let export_data: ApiSettingsExport = serde_json::from_str(&request.json_data).map_err(|e| {
        format!("JSONの解析に失敗しました: {e}")
    })?;
    
    let conn = get_connection().map_err(|_| {
        "データの保存に失敗しました。アプリを再起動して再度お試しください。".to_string()
    })?;
    
    let api_repo = ApiRepository::new(&conn);
    let mut imported = 0;
    let mut skipped = 0;
    let mut renamed = 0;
    let mut errors = Vec::new();
    
    'api_loop: for api_data in export_data.apis {
        // 既存のAPIをチェック
        let existing_api_result = api_repo.find_by_id(&api_data.id);
        match existing_api_result {
            Ok(_) => {
                // 既存APIが見つかった場合
                match request.conflict_resolution.as_str() {
                    "skip" => {
                        skipped += 1;
                        continue;
                    },
                    "overwrite" => {
                        // 既存APIを更新
                        match api_repo.update(&crate::database::models::Api {
                            id: api_data.id.clone(),
                            name: api_data.name.clone(),
                            model: api_data.model.clone(),
                            port: api_data.port,
                            enable_auth: api_data.enable_auth,
                            status: crate::database::models::ApiStatus::from_str(&api_data.status),
                            created_at: chrono::DateTime::parse_from_rfc3339(&api_data.created_at)
                                .map_err(|_| "日付の解析に失敗しました".to_string())?
                                .with_timezone(&Utc),
                            updated_at: Utc::now(),
                        }) {
                            Ok(_) => {
                                imported += 1;
                            },
                            Err(e) => {
                                errors.push(format!("API '{}' の更新に失敗しました: {}", api_data.name, e));
                            }
                        }
                    },
                    "rename" => {
                        // 新しいIDを生成して名前を変更
                        let new_id = Uuid::new_v4().to_string();
                        let mut new_name = api_data.name.clone();
                        let mut counter = 1;
                        
                        // 名前が既に使用されている場合は番号を追加
                        loop {
                            match api_repo.find_by_name(&new_name) {
                                Ok(Some(_)) => {
                                    // 名前が使用されている場合は番号を追加
                                    new_name = format!("{} ({})", api_data.name, counter);
                                    counter += 1;
                                },
                                #[allow(non_snake_case)]
                                Ok(None) => {
                                    // 名前が使用されていない場合は使用可能
                                    break;
                                },
                                Err(e) => {
                                    errors.push(format!("API名 '{}' の確認に失敗しました: {}", new_name, e));
                                    skipped += 1;
                                    continue 'api_loop;
                                }
                            }
                        }
                        
                        let new_api = crate::database::models::Api {
                            id: new_id,
                            name: new_name.clone(),
                            model: api_data.model,
                            port: api_data.port,
                            enable_auth: api_data.enable_auth,
                            status: crate::database::models::ApiStatus::from_str(&api_data.status),
                            created_at: chrono::DateTime::parse_from_rfc3339(&api_data.created_at)
                                .map_err(|_| "日付の解析に失敗しました".to_string())?
                                .with_timezone(&Utc),
                            updated_at: Utc::now(),
                        };
                        
                        match api_repo.create(&new_api) {
                            Ok(_) => {
                                imported += 1;
                                renamed += 1;
                            },
                            Err(e) => {
                                errors.push(format!("API '{}' のインポートに失敗しました: {}", new_name, e));
                            }
                        }
                        continue 'api_loop;
                    },
                    _ => {
                        errors.push(format!("無効な競合解決方法です: {}", request.conflict_resolution));
                        skipped += 1;
                    }
                }
            },
            Err(crate::database::DatabaseError::NotFound(_)) => {
                // 新規APIとして作成
                let new_api = crate::database::models::Api {
                    id: api_data.id.clone(),
                    name: api_data.name.clone(),
                    model: api_data.model,
                    port: api_data.port,
                    enable_auth: api_data.enable_auth,
                    status: crate::database::models::ApiStatus::from_str(&api_data.status),
                    created_at: chrono::DateTime::parse_from_rfc3339(&api_data.created_at)
                        .map_err(|_| "日付の解析に失敗しました".to_string())?
                        .with_timezone(&Utc),
                    updated_at: Utc::now(),
                };
                
                match api_repo.create(&new_api) {
                    Ok(_) => {
                        imported += 1;
                    },
                    Err(e) => {
                        errors.push(format!("API '{}' のインポートに失敗しました: {}", api_data.name, e));
                    }
                }
            },
            Err(e) => {
                errors.push(format!("API '{}' の確認に失敗しました: {}", api_data.id, e));
                skipped += 1;
            }
        }
    }
    
    Ok(ImportApiSettingsResponse {
        imported,
        skipped,
        renamed,
        errors,
    })
}

/// ログ削除リクエスト（BE-008-03）
#[derive(Debug, Serialize, Deserialize)]
pub struct DeleteLogsRequest {
    pub api_id: Option<String>, // Noneの場合は全API
    pub before_date: Option<String>, // ISO 8601形式の日付文字列（この日付より前のログを削除）
}

/// ログ削除レスポンス（BE-008-03）
#[derive(Debug, Serialize, Deserialize)]
pub struct DeleteLogsResponse {
    pub deleted_count: usize,
}

/// ログ削除コマンド（BE-008-03）
/// 指定した条件に一致するログを削除します
/// 安全のため、api_idとbefore_dateの両方がNoneの場合はエラーを返します
#[tauri::command]
pub async fn delete_logs(request: DeleteLogsRequest) -> Result<DeleteLogsResponse, String> {
    let conn = get_connection().map_err(|_| {
        "データの読み込みに失敗しました。アプリを再起動して再度お試しください。".to_string()
    })?;
    
    let log_repo = RequestLogRepository::new(&conn);
    
    // トランザクション内で削除を実行
    let deleted_count = log_repo.delete_by_date_range(
        request.api_id.as_deref(),
        request.before_date.as_deref(),
    ).map_err(|e| {
        format!("ログの削除に失敗しました: {}", e)
    })?;
    
    Ok(DeleteLogsResponse {
        deleted_count,
    })
}