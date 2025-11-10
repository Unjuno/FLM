// API管理コマンド

use serde::{Deserialize, Serialize};
use crate::database::models::*;
use crate::database::repository::{ApiRepository, ApiKeyRepository, InstalledModelRepository, RequestLogRepository, ModelCatalogRepository, error_log_repository::ErrorLogRepository};
use crate::database::connection::get_connection;
use crate::database::DatabaseError;
use crate::utils::error::AppError;
use crate::auth; // 認証モジュール（監査レポートの推奨事項に基づき追加）
use crate::ollama::current_ollama_base_url;
use chrono::Utc;
use std::collections::HashMap;
use uuid::Uuid;
use bytes::Bytes;
use tauri::Emitter;
// ログマクロをインポート（必要に応じて使用）
// use crate::{debug_log, error_log, log_pid};

/// API作成設定
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiCreateConfig {
    pub name: String,
    pub model_name: String,
    pub port: Option<u16>,
    pub enable_auth: Option<bool>,
    pub engine_type: Option<String>, // エンジンタイプ（デフォルト: 'ollama'）
    pub engine_config: Option<String>, // エンジン固有設定（JSON形式）
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
    // 0. 入力検証（監査レポートの推奨事項に基づき追加）
    use crate::utils::input_validation;
    input_validation::validate_api_name(&config.name).map_err(|e| {
        format!("API名の検証に失敗しました: {}", e)
    })?;
    input_validation::validate_model_name(&config.model_name).map_err(|e| {
        format!("モデル名の検証に失敗しました: {}", e)
    })?;
    
    // 1. エンジンタイプの決定（デフォルト: 'ollama'）
    let engine_type = config.engine_type.as_deref().unwrap_or("ollama");
    
    // 2. モデルがインストールされているか確認（データベースから取得）
    // 注意: API作成時はエンジンを起動せず、インストール済みモデルのみを確認します
    // エンジンの起動は、APIを実際に使用する際（start_api関数など）に行います
    let model_exists = tokio::task::spawn_blocking({
        let model_name = config.model_name.clone();
        move || {
            let conn = get_connection().map_err(|e| {
                format!("データベース接続に失敗しました: {}. アプリを再起動して再度お試しください。", e)
            })?;
            
            let model_repo = InstalledModelRepository::new(&conn);
            let installed_models = model_repo.find_all().map_err(|e| {
                format!("インストール済みモデルの取得に失敗しました: {}. アプリを再起動して再度お試しください。", e)
            })?;
            
            Ok::<bool, String>(installed_models.iter().any(|m| m.name == model_name))
        }
    }).await.map_err(|e| format!("データベース操作エラー: {e}"))??;
    
    if !model_exists {
        return Err(format!(
            "選択されたAIモデル「{}」が見つかりませんでした。\n\n先に「モデル管理」画面からこのモデルをダウンロードしてください。",
            config.model_name
        ));
    }
    
    // 4. エンジン設定の検証（モデルパラメータ、メモリ設定、マルチモーダル設定）
    if let Some(ref engine_config_json) = config.engine_config {
        use crate::utils::model_params;
        model_params::validate_engine_config(engine_config_json.as_str()).map_err(|e| {
            format!("エンジン設定の検証に失敗しました（API名: {name}、エンジン: {engine}）: {e}", 
                name = config.name, engine = engine_type)
        })?;
    }
    
    // 5. ポート番号の決定（自動検出）
    // まず、要求されたポートが使用可能かチェック（TCPレベル）
    let requested_port = config.port.unwrap_or(8080);
    eprintln!("API作成: ポート {} の検証を開始します", requested_port);
    
    let port_available = match crate::commands::port::check_port_availability(requested_port).await {
        Ok(available) => available,
        Err(e) => {
            eprintln!("警告: ポート検証エラー: {}。自動検出を試みます。", e);
            false
        }
    };
    
    let port = if port_available {
        eprintln!("✓ ポート {} を使用します", requested_port);
        requested_port as i32
    } else {
        eprintln!("ポート {} は使用中のため、代替ポートを検出中...", requested_port);
        // TCPレベルで使用中の場合は、自動的に利用可能なポートを検出
        match crate::commands::port::find_available_port(Some(requested_port)).await {
            Ok(port_result) => {
                eprintln!("✓ 代替ポート {} を使用します", port_result.recommended_port);
                port_result.recommended_port as i32
            },
            Err(e) => {
                eprintln!("✗ 代替ポートの検出に失敗しました: {}", e);
                // 最後の手段: 8000-9000の範囲からランダムに試す
                eprintln!("ポート範囲 8000-9000 から検索中...");
                let mut fallback_port = None;
                for p in 8000..9000 {
                    if crate::commands::port::is_api_port_pair_available(p) {
                        fallback_port = Some(p);
                        break;
                    }
                }
                match fallback_port {
                    Some(p) => {
                        eprintln!("✓ フォールバックポート {} を使用します", p);
                        p as i32
                    },
                    None => {
                        return Err(format!("使用可能なポート番号が見つかりませんでした。他のアプリケーションがポートを使用している可能性があります。エラー: {}", e));
                    }
                }
            }
        }
    };
    
    // ポート番号の範囲チェック（念のため）
    if port < 1024 || port > 65535 {
        return Err(format!("無効なポート番号: {}。ポート番号は1024から65535の間である必要があります。", port));
    }
    
    // 6. 認証設定のデフォルト値
    let enable_auth = config.enable_auth.unwrap_or(true);
    
    // 7. API ID生成
    let api_id = Uuid::new_v4().to_string();
    
    // 8. データベース操作をブロッキングタスクで実行（Sendトレイトの問題を回避）
    let (final_port, api_key) = tokio::task::spawn_blocking({
        let config_clone = config.clone();
        let api_id_clone = api_id.clone();
        let port_for_db = port;
        let enable_auth_for_db = enable_auth;
        let engine_type_for_db = engine_type.to_string();
        move || {
            // データベース接続を取得
            let conn = get_connection().map_err(|e| {
                format!("データベース接続に失敗しました: {}. アプリを再起動して再度お試しください。", e)
            })?;
            
            // ポート番号の重複をチェック（他のAPIが既に使用している場合）
            let api_repo = ApiRepository::new(&conn);
            let final_port_local = port_for_db;
            match api_repo.find_by_port(port_for_db) {
                Ok(Some(existing_api)) => {
                    // ポートが既に使用されている場合は、エラーを返す
                    // フロントエンド側で自動修正が機能するように、エラーメッセージに「使用中」を含める
                    // （TCPレベルのチェックで既に検出されているはずだが、念のため）
                    return Err(format!(
                        "ポート番号 {} は既にAPI「{}」で使用中です。自動的に代替ポートが検出されますが、別のポート番号を手動で指定することもできます。",
                        port_for_db, existing_api.name
                    ));
                },
                Ok(None) => {
                    // ポートが使用されていない場合はそのまま使用
                },
                Err(e) => {
                    return Err(format!("データベースエラーが発生しました: {}. アプリを再起動して再度お試しください。", e));
                }
            }

            // 近接ポートの競合（HTTPSリダイレクトで利用する port+1）をチェック
            let existing_apis = api_repo.find_all().map_err(|e| {
                format!("既存APIの取得に失敗しました: {}. アプリを再起動して再度お試しください。", e)
            })?;
            let port_u16 = final_port_local as u16;
            if let Some(conflict) = existing_apis.iter().find(|api| {
                let existing_port = api.port as u16;
                if existing_port == port_u16 {
                    false
                } else {
                    existing_port.abs_diff(port_u16) <= 1
                }
            }) {
                return Err(format!(
                    "ポート番号 {} は API「{}」(ポート {}) に隣接しているため使用できません。HTTPSリダイレクトで連番のポートを共有できないため、2以上離れたポート番号を選択してください。",
                    port_u16,
                    conflict.name,
                    conflict.port
                ));
            }
            
            // API設定を作成
            let api = Api {
                id: api_id_clone.clone(),
                name: config_clone.name.clone(),
                model: config_clone.model_name.clone(),
                port: final_port_local,
                enable_auth: enable_auth_for_db,
                status: ApiStatus::Stopped,
                engine_type: Some(engine_type_for_db),
                engine_config: config_clone.engine_config.clone(),
                created_at: Utc::now(),
                updated_at: Utc::now(),
            };
            
            // データベースに保存
            api_repo.create(&api).map_err(|e| {
                format!("APIの設定を保存できませんでした: {}. アプリを再起動して再度お試しください。", e)
            })?;
            
            // APIキー生成（認証が有効な場合）
            let api_key_result = if enable_auth_for_db {
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
                    format!("セキュリティキーの暗号化に失敗しました: {}. アプリを再起動して再度お試しください。", e)
                })?;
                
                // Base64デコードしてバイト配列に変換（データベースに保存するため）
                let encrypted_key_bytes = STANDARD.decode(&encrypted_key_str).map_err(|e| {
                    format!("セキュリティキーのデコードに失敗しました: {}. アプリを再起動して再度お試しください。", e)
                })?;
                
                // データベースに保存
                let key_id = Uuid::new_v4().to_string();
                let api_key_data = ApiKey {
                    id: key_id,
                    api_id: api_id_clone.clone(),
                    key_hash: key_hash.clone(),
                    encrypted_key: encrypted_key_bytes,
                    created_at: Utc::now(),
                    updated_at: Utc::now(),
                };
                
                let key_repo = ApiKeyRepository::new(&conn);
                key_repo.create(&api_key_data).map_err(|e| {
                    format!("セキュリティキーのデータベース保存に失敗しました: {}. アプリを再起動して再度お試しください。", e)
                })?;
                
                Some(generated_key)
            } else {
                None
            };
            
            Ok::<(i32, Option<String>), String>((final_port_local, api_key_result))
        }
    }).await.map_err(|e| format!("データベース操作エラー: {e}"))??;
    
    // 9. エンドポイントURL生成（HTTPSとローカルIPも含む）
    // 注意: final_port変数は最終的に決定されたポート番号を使用
    use crate::utils::network;
    // API作成時は証明書がまだ生成されていないため、Noneを渡す（起動時に自動生成される）
    let endpoint = network::format_endpoint_url(final_port as u16, None);
    
    // 注意: 認証プロキシの起動と証明書生成は、API起動時（start_api）に行います
    // API作成時は設定の保存のみを行います
    
    Ok(ApiCreateResponse {
        id: api_id,
        name: config.name,
        endpoint,
        api_key,
        model_name: config.model_name,
        port: final_port as u16,
        status: "stopped".to_string(),
    })
}

/// API一覧取得コマンド
#[tauri::command]
pub async fn list_apis() -> Result<Vec<ApiInfo>, String> {
    let conn = get_connection().map_err(|e| {
        format!("データベース接続に失敗しました: {}. アプリを再起動して再度お試しください。", e)
    })?;
    
    let api_repo = ApiRepository::new(&conn);
    let apis = api_repo.find_all().map_err(|e| {
        format!("作成済みAPIの一覧を取得できませんでした: {}. アプリを再起動して再度お試しください。", e)
    })?;
    
    use crate::utils::network;
    let api_infos: Vec<ApiInfo> = apis.into_iter().map(|api| {
        let endpoint = network::format_endpoint_url(api.port as u16, Some(&api.id));
        ApiInfo {
            id: api.id,
            name: api.name,
            endpoint,
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
#[allow(non_snake_case)] // Tauri v2のフロントエンドとの互換性のためcamelCaseを使用
pub async fn start_api(apiId: String) -> Result<(), String> {
    let api_id = apiId; // Tauri v2の自動変換に対応
    // データベース操作を同期的に実行（非Send型のため）
    let (port, enable_auth, engine_type, engine_base_url) = tokio::task::spawn_blocking({
        let api_id = api_id.clone();
        move || {
            let conn = get_connection().map_err(|_| {
                "データの読み込みに失敗しました。アプリを再起動して再度お試しください。".to_string()
            })?;
            
            let api_repo = ApiRepository::new(&conn);
            let api = api_repo.find_by_id(&api_id).map_err(|_| {
                "指定されたAPIが見つかりませんでした。API一覧を確認してください。".to_string()
            })?;
            
            // エンジンベースURLを取得
            let engine_base_url = api.engine_type.as_deref()
                .map(|et| {
                    match et {
                        "ollama" => {
                            use crate::engines::{ollama::OllamaEngine, traits::LLMEngine};
                            OllamaEngine::new().get_base_url()
                        },
                        "lm_studio" => {
                            use crate::engines::{lm_studio::LMStudioEngine, traits::LLMEngine};
                            LMStudioEngine::new().get_base_url()
                        },
                        "vllm" => {
                            use crate::engines::{vllm::VLLMEngine, traits::LLMEngine};
                            VLLMEngine::new().get_base_url()
                        },
                        "llama_cpp" => {
                            use crate::engines::{llama_cpp::LlamaCppEngine, traits::LLMEngine};
                            LlamaCppEngine::new().get_base_url()
                        },
                        _ => current_ollama_base_url(),
                    }
                })
                .unwrap_or_else(current_ollama_base_url);
            
            Ok::<(u16, bool, Option<String>, String), String>((
                api.port as u16, 
                api.enable_auth,
                api.engine_type,
                engine_base_url
            ))
        }
    }).await.map_err(|e| format!("データベース操作エラー: {e}"))??;
    
    let mut selected_port = port;
    let mut port_changed = false;

    let update_port_in_db = |new_port: u16| {
        let api_id = api_id.clone();
        let task = tokio::task::spawn_blocking(move || {
            let conn = get_connection().map_err(|_| {
                "ポート情報の更新に失敗しました。アプリを再起動して再度お試しください。".to_string()
            })?;

            let api_repo = ApiRepository::new(&conn);
            let mut api = api_repo.find_by_id(&api_id).map_err(|_| {
                "指定されたAPIが見つかりませんでした。API一覧を確認してください。".to_string()
            })?;

            api.port = new_port as i32;
            api_repo.update(&api).map_err(|_| {
                "ポート情報の更新に失敗しました。アプリを再起動して再度お試しください。".to_string()
            })
        });
        async move { task.await.map_err(|e| format!("データベース操作エラー: {e}"))??; Ok::<(), String>(()) }
    };

    if !crate::commands::port::is_api_port_pair_available(selected_port as u16) {
        let detection = crate::commands::port::find_available_port(Some(selected_port as u16))
            .await
            .map_err(|e| format!("使用可能なポート番号の検出に失敗しました: {}", e))?;

        if detection.recommended_port != selected_port {
            selected_port = detection.recommended_port;
            port_changed = true;
            update_port_in_db(selected_port).await?;
        }
    }
    
    // 注意: API作成時はエンジンを起動しません
    // エンジンの起動は、APIを実際に使用する際（start_api関数など）に行います
    // ここでは、APIの設定を保存するだけです
    
    // デバッグモードのチェック（環境変数で制御）
    let debug_mode = std::env::var("FLM_DEBUG").unwrap_or_default() == "1";
    
    // 3. SSL証明書を生成（HTTPS必須）
    // セキュリティ: HTTPは使用不可（パスワード漏洩のリスクがあるため）
    // 注意: 証明書生成はstart_apiで行う（認証プロキシ起動時）
    // API作成時は証明書生成をスキップ（Node.js側で自動生成される）
    
    // 4. 認証プロキシを起動（認証が有効な場合）
    if enable_auth {
        fn is_addr_in_use_error(error: &AppError) -> bool {
            match error {
                AppError::AuthError { message, .. }
                | AppError::ProcessError { message, .. }
                | AppError::ConnectionError { message, .. } => {
                    message.contains("EADDRINUSE")
                        || message.contains("address already in use")
                        || message.contains("ポート") && message.contains("使用")
                }
                _ => false,
            }
        }

        let mut current_port = selected_port;
        let mut attempts = 0;
        if debug_mode {
            eprintln!("[DEBUG] ===== 認証プロキシ起動処理開始 =====");
            eprintln!("[DEBUG] 認証プロキシ起動設定: ポート={}, API_ID={}, エンジン={}, ベースURL={}",
                current_port, api_id, engine_type.as_deref().unwrap_or("ollama"), engine_base_url);
            eprintln!("[DEBUG] ポート {} の使用状況を再確認中...", current_port);
        }

        loop {
            if debug_mode {
                eprintln!("[DEBUG] start_auth_proxyを呼び出します (ポート {})...", current_port);
            }
            match auth::start_auth_proxy(
                current_port as u16,
                None,
                Some(engine_base_url.clone()),
                Some(api_id.clone()),
                engine_type.clone(),
            ).await {
                Ok(_) => {
                    if debug_mode {
                        eprintln!("[DEBUG] ✓ 認証プロキシの起動に成功しました (ポート {})", current_port);
                        eprintln!("[DEBUG] ===== 認証プロキシ起動処理完了 =====");
                    }
                    selected_port = current_port;
                    if selected_port != port {
                        port_changed = true;
                    }
                    break;
                }
                Err(e) => {
                    if is_addr_in_use_error(&e) && attempts < 20 {
                        attempts += 1;
                        if debug_mode {
                            eprintln!("[WARN] ポート {} が使用中のため再試行します (試行回数: {})", current_port, attempts);
                        }

                        const PORT_MIN: u16 = 1024;
                        let mut next_port = current_port as u32 + 1;
                        let mut wrapped = false;
                        let mut candidate: Option<u16> = None;

                        loop {
                            if next_port > u16::MAX as u32 {
                                if wrapped {
                                    break;
                                }
                                next_port = PORT_MIN as u32;
                                wrapped = true;
                            }

                            let port_candidate = next_port as u16;
                            if crate::commands::port::is_api_port_pair_available(port_candidate) {
                                candidate = Some(port_candidate);
                                break;
                            }

                            next_port += 1;

                            if wrapped && port_candidate == current_port {
                                break;
                            }
                        }

                        let Some(new_port) = candidate else {
                            return Err(format!(
                                "認証プロキシの起動に失敗しました: {}. 使用可能な別のポートを自動的に検出できませんでした。",
                                e
                            ));
                        };

                        current_port = new_port;
                        update_port_in_db(current_port).await?;
                        port_changed = true;
                        continue;
                    } else {
                        eprintln!("[ERROR] ===== 認証プロキシ起動エラー =====");
                        eprintln!("[ERROR] エラー詳細: {:?}", e);
                        eprintln!("[ERROR] ポート: {}", current_port);
                        eprintln!("[ERROR] API_ID: {}", api_id);
                        return Err(format!(
                            "認証プロキシの起動に失敗しました: {}. ポート番号 {} が他のアプリケーションで使用されていないか確認してください。",
                            e, current_port
                        ));
                    }
                }
            }
        }
    } else {
        if debug_mode {
            eprintln!("[DEBUG] 認証は無効のため、認証プロキシは起動しません");
        }
    }
    
    // 5. ステータスを更新（同期的に実行）
    tokio::task::spawn_blocking({
        let api_id = api_id.clone();
        let port_to_update = selected_port as i32;
        let port_changed = port_changed;
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
            if port_changed {
                api.port = port_to_update;
            }
            
            api_repo.update(&api).map_err(|_| {
                "APIの状態を更新できませんでした。アプリを再起動して再度お試しください。".to_string()
            })
        }
    }).await.map_err(|e| format!("データベース操作エラー: {e}"))??;
    
    Ok(())
}

/// API停止コマンド
#[tauri::command]
#[allow(non_snake_case)] // Tauri v2のフロントエンドとの互換性のためcamelCaseを使用
pub async fn stop_api(apiId: String) -> Result<(), String> {
    let api_id = apiId; // Tauri v2の自動変換に対応
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

/// 実行中のすべてのAPIを停止する（アプリケーション終了時のクリーンアップ用）
/// 
/// この関数は、アプリケーション終了時に実行中のすべてのAPIを停止します。
/// - 認証プロキシプロセス（Node.jsプロセス）を終了
/// - データベースのステータスを「stopped」に更新
/// 
/// エラーが発生しても処理を続行し、すべてのAPIに対して停止処理を試みます。
pub async fn stop_all_running_apis() -> Result<(), String> {
    // デバッグモードのチェック（環境変数で制御）
    let debug_mode = std::env::var("FLM_DEBUG").unwrap_or_default() == "1";
    
    if debug_mode {
        eprintln!("[DEBUG] ===== 全API停止処理開始 =====");
        eprintln!("[DEBUG] 実行中のAPI一覧を取得中...");
    }
    
    // 1. 実行中のAPI一覧を取得
    let running_apis = tokio::task::spawn_blocking(|| {
        let conn = get_connection().map_err(|_| {
            "データの読み込みに失敗しました。アプリを再起動して再度お試しください。".to_string()
        })?;
        
        let api_repo = ApiRepository::new(&conn);
        let apis = api_repo.find_all().map_err(|_| {
            "API一覧の取得に失敗しました。アプリを再起動して再度お試しください。".to_string()
        })?;
        
        // 実行中のAPIのみをフィルタリング
        let running: Vec<(String, u16)> = apis
            .into_iter()
            .filter(|api| api.status == ApiStatus::Running)
            .map(|api| (api.id, api.port as u16))
            .collect();
        
        Ok::<Vec<(String, u16)>, String>(running)
    }).await.map_err(|e| format!("データベース操作エラー: {e}"))??;
    
    // デバッグモードのチェック（環境変数で制御）
    let debug_mode = std::env::var("FLM_DEBUG").unwrap_or_default() == "1";
    
    if debug_mode {
        eprintln!("[DEBUG] 実行中のAPI数: {}", running_apis.len());
    }
    
    // 2. 各APIを停止（監査レポートの推奨事項に基づきプロセス監視を強化）
    for (api_id, port) in running_apis {
        if debug_mode {
            eprintln!("[DEBUG] API停止中: ID={}, ポート={}", api_id, port);
        }
        // 認証プロキシを停止
        if let Err(e) = auth::stop_auth_proxy_by_port(port).await {
            eprintln!("警告: ポート {} の認証プロキシ停止に失敗しました: {:?}", port, e);
            // エラーが発生しても処理を続行
        }
        
        // プロセスが実際に停止したかを確認（監査レポートの推奨事項に基づき追加）
        // 少し待機してから確認
        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
        let is_still_running = auth::check_proxy_running(port).await;
        if is_still_running {
            eprintln!("警告: ポート {} のプロセスが停止していない可能性があります。手動で確認してください。", port);
        }
        
        // ステータスを更新（同期的に実行）
        let api_id_clone = api_id.clone();
        match tokio::task::spawn_blocking(move || {
            let conn = get_connection().map_err(|_| {
                "データの読み込みに失敗しました。アプリを再起動して再度お試しください。".to_string()
            })?;
            
            let api_repo = ApiRepository::new(&conn);
            let mut api = api_repo.find_by_id(&api_id_clone).map_err(|_| {
                "指定されたAPIが見つかりませんでした。API一覧を確認してください。".to_string()
            })?;
            
            api.status = ApiStatus::Stopped;
            api.updated_at = Utc::now();
            
            api_repo.update(&api).map_err(|_| {
                "APIの状態を更新できませんでした。アプリを再起動して再度お試しください。".to_string()
            })
        }).await {
            Ok(Ok(_)) => {
                // 成功
            }
            Ok(Err(e)) => {
                eprintln!("警告: API {} のステータス更新に失敗しました: {}", api_id, e);
            }
            Err(e) => {
                eprintln!("警告: API {} のステータス更新タスクが失敗しました: {}", api_id, e);
            }
        }
    }
    
    if debug_mode {
        eprintln!("[DEBUG] ===== 全API停止処理完了 =====");
    }
    Ok(())
}

/// API削除コマンド
#[tauri::command]
#[allow(non_snake_case)] // Tauri v2のフロントエンドとの互換性のためcamelCaseを使用
pub async fn delete_api(apiId: String) -> Result<(), String> {
    let api_id = apiId; // Tauri v2の自動変換に対応
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
#[allow(non_snake_case)] // Tauri v2のフロントエンドとの互換性のためcamelCaseを使用
pub async fn get_api_details(apiId: String) -> Result<ApiDetailsResponse, String> {
    let api_id = apiId; // Tauri v2の自動変換に対応
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
                encryption::decrypt_api_key(&encrypted_str).map_err(|e| {
                    eprintln!("[WARN] APIキーの復号化に失敗しました: {}", e);
                    e
                }).ok()
            }
            _ => None,
        }
    } else {
        None
    };
    
    use crate::utils::network;
    let endpoint = network::format_endpoint_url(api.port as u16, Some(&api.id));
    
    Ok(ApiDetailsResponse {
        id: api.id,
        name: api.name,
        endpoint,
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
    // 入力検証（監査レポートの推奨事項に基づき追加）
    use crate::utils::input_validation;
    if let Some(ref name) = config.name {
        input_validation::validate_api_name(name).map_err(|e| {
            format!("API名の検証に失敗しました: {}", e)
        })?;
    }
    
    // エンジン設定（engine_config）の検証（モデルパラメータ、メモリ設定、マルチモーダル設定）
    if let Some(ref engine_config_json) = config.engine_config {
        use crate::utils::model_params;
        model_params::validate_engine_config(engine_config_json.as_str()).map_err(|e| {
            format!("エンジン設定の検証に失敗しました（API ID: {}）: {e}", api_id)
        })?;
    }
    
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
            if let Some(engine_config) = config.engine_config {
                api.engine_config = Some(engine_config);
                // エンジン設定が変更された場合は再起動が必要
                if was_running_flag {
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
        if let Err(e) = auth::stop_auth_proxy_by_port(old_port as u16).await {
            eprintln!("[WARN] 認証プロキシの停止に失敗しました（ポート {}）: {}", old_port, e);
        }
        
        // 2. エンジンタイプとベースURLを取得（再起動時に必要）
        let (engine_type_for_restart, engine_base_url_for_restart) = tokio::task::spawn_blocking({
            let api_id = api_id.clone();
            move || {
                let conn = get_connection().map_err(|_| {
                    "データの読み込みに失敗しました".to_string()
                })?;
                let api_repo = ApiRepository::new(&conn);
                let api = api_repo.find_by_id(&api_id).map_err(|_| {
                    "APIが見つかりませんでした".to_string()
                })?;
                
                // エンジンベースURLを取得
                let engine_base_url = api.engine_type.as_deref()
                    .map(|et| {
                        match et {
                            "ollama" => {
                                use crate::engines::{ollama::OllamaEngine, traits::LLMEngine};
                                OllamaEngine::new().get_base_url()
                            },
                            "lm_studio" => {
                                use crate::engines::{lm_studio::LMStudioEngine, traits::LLMEngine};
                                LMStudioEngine::new().get_base_url()
                            },
                            "vllm" => {
                                use crate::engines::{vllm::VLLMEngine, traits::LLMEngine};
                                VLLMEngine::new().get_base_url()
                            },
                            "llama_cpp" => {
                                use crate::engines::{llama_cpp::LlamaCppEngine, traits::LLMEngine};
                                LlamaCppEngine::new().get_base_url()
                            },
                            _ => current_ollama_base_url(),
                        }
                    })
                    .unwrap_or_else(current_ollama_base_url);
                
                Ok::<(Option<String>, String), String>((api.engine_type, engine_base_url))
            }
        }).await.map_err(|e| format!("データベース操作エラー: {e}"))??;
        
        // 3. 新しい設定で再起動
        // ポート番号が変更された場合、新しいポートで起動する必要がある
        if new_enable_auth {
            auth::start_auth_proxy(
                new_port as u16, 
                None, 
                Some(engine_base_url_for_restart.clone()), 
                Some(api_id.clone()),
                engine_type_for_restart.clone()
            ).await.map_err(|_| {
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
    pub engine_config: Option<String>, // エンジン固有設定（JSON形式）
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
pub async fn regenerate_api_key(apiId: String) -> Result<String, String> {
    let api_id = apiId; // Tauri v2の自動変換に対応
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
#[allow(non_snake_case)] // Tauri v2のフロントエンドとの互換性のためcamelCaseを使用
pub async fn delete_api_key(apiId: String) -> Result<(), String> {
    let api_id = apiId; // Tauri v2の自動変換に対応
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
    let client = crate::utils::http_client::create_http_client()?;
    let base_url = current_ollama_base_url();
    let tags_endpoint = format!("{}/api/tags", base_url.trim_end_matches('/'));
    let response = client
        .get(&tags_endpoint)
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
    let re = regex::Regex::new(r"(\d+(?:\.\d+)?)\s*[bB]").map_err(|e| {
        eprintln!("[WARN] パラメータサイズ抽出用の正規表現コンパイルに失敗しました: {}", e);
        e
    }).ok()?;
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
    eprintln!("[DEBUG] ===== モデルダウンロード開始 =====");
    eprintln!("[DEBUG] モデル名: {}", model_name);
    eprintln!("[DEBUG] Ollamaの実行状態を確認中...");
    
    match check_ollama_running().await {
        Ok(true) => {
            eprintln!("[DEBUG] ✓ Ollamaは実行中です");
        },
        Ok(false) => {
            eprintln!("[ERROR] ✗ Ollamaが実行されていません");
            return Err("AIエンジンが実行されていません。先にAIエンジンを起動してください。ホーム画面から「Ollamaセットアップ」を実行するか、Ollamaを手動で起動してください。".to_string());
        },
        Err(e) => {
            eprintln!("[ERROR] Ollama状態確認エラー: {:?}", e);
            return Err(format!("AIエンジンの状態を確認できませんでした。Ollamaが正常にインストールされているか確認してください。エラー詳細: {}", e));
        }
    }
    
    let base_url = current_ollama_base_url();
    let pull_endpoint = format!("{}/api/pull", base_url.trim_end_matches('/'));
    eprintln!("[DEBUG] Ollama APIにモデルダウンロードリクエストを送信: {}", pull_endpoint);
    
    // Ollama APIにモデルダウンロードリクエストを送信
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30)) // タイムアウトを30秒に設定
        .build()
        .map_err(|e| {
            eprintln!("[ERROR] HTTPクライアント作成エラー: {:?}", e);
            format!("HTTPクライアントの作成に失敗しました: {}", e)
        })?;
    
    eprintln!("[DEBUG] モデルダウンロードリクエスト送信: モデル名={}", model_name);
    let response = client
        .post(&pull_endpoint)
        .json(&serde_json::json!({
            "name": model_name.clone(),
            "stream": true
        }))
        .send()
        .await
        .map_err(|e| {
            eprintln!("[ERROR] Ollama API接続エラー: {:?}", e);
            let error_msg = if e.is_timeout() {
                format!("Ollama APIへの接続がタイムアウトしました（30秒）。Ollamaが正常に起動しているか確認してください。エラー詳細: {}", e)
            } else if e.is_connect() {
                let (_, port) = crate::ollama::current_ollama_host_port();
                format!("Ollama APIに接続できませんでした（ポート{}）。Ollamaが正常に起動しているか確認してください。エラー詳細: {}", port, e)
            } else {
                format!("Ollama APIへの接続中にエラーが発生しました。エラー詳細: {}", e)
            };
            error_msg
        })?;
    
    eprintln!("[DEBUG] Ollama APIレスポンス受信: ステータスコード={}", response.status());
    
    let status = response.status();
    if !status.is_success() {
        eprintln!("[ERROR] ✗ Ollama APIエラー: ステータスコード={}", status);
        let error_body = response.text().await.unwrap_or_else(|_| "レスポンス本文を読み取れませんでした".to_string());
        eprintln!("[ERROR] エラー詳細: {}", error_body);
        
        // エラーレスポンスをJSONとして解析して、より詳細なエラーメッセージを取得
        let error_message = if let Ok(error_json) = serde_json::from_str::<serde_json::Value>(&error_body) {
            if let Some(error_msg) = error_json.get("error").and_then(|e| e.as_str()) {
                format!("Ollama APIエラー: {} (HTTP {})", error_msg, status)
            } else {
                format!("AIモデルのダウンロードに失敗しました（HTTP {}）。エラー詳細: {}", status, error_body)
            }
        } else {
            format!("AIモデルのダウンロードに失敗しました（HTTP {}）。AIエンジンが正常に動作しているか確認してください。エラー詳細: {}", status, error_body)
        };
        
        return Err(error_message);
    }
    
    eprintln!("[DEBUG] ✓ Ollama APIリクエスト成功、ストリーミング開始");
    
    // ストリーミングレスポンスを処理
    // Ollama APIは各行がJSONオブジェクトの形式で進捗を返す
    let mut stream = response.bytes_stream();
    let mut buffer = String::with_capacity(4096); // 初期容量を設定してメモリアロケーションを最適化
    let mut aggregated_total_bytes = 0u64;
    let mut aggregated_downloaded_bytes = 0u64;
    let mut layer_totals: HashMap<String, u64> = HashMap::new();
    let mut layer_completed: HashMap<String, u64> = HashMap::new();
    let start_time = std::time::Instant::now();
    let mut last_progress_update = std::time::Instant::now();
    
    // バッファサイズの上限（10KB）- メモリリーク防止
    const MAX_BUFFER_SIZE: usize = 10 * 1024;

    let mut update_progress_stats = |json: &serde_json::Value| -> (u64, u64) {
        let digest_key_option = if let Some(digest) = json.get("digest").and_then(|d| d.as_str()) {
            Some(digest.to_string())
        } else if layer_totals.is_empty() {
            Some("__overall__".to_string())
        } else {
            None
        };

        if let Some(ref digest_key) = digest_key_option {
            if let Some(total) = json.get("total").and_then(|t| t.as_u64()) {
                if total > 0 {
                    layer_totals.insert(digest_key.clone(), total);
                }
            }

            if let Some(completed) = json.get("completed").and_then(|c| c.as_u64()) {
                let total_for_key = layer_totals
                    .get(digest_key)
                    .copied()
                    .unwrap_or_default();
                let capped_completed = if total_for_key > 0 {
                    completed.min(total_for_key)
                } else {
                    completed
                };
                layer_completed.insert(digest_key.clone(), capped_completed);
            }
        }

        aggregated_total_bytes = layer_totals.values().copied().sum();
        aggregated_downloaded_bytes = layer_completed.values().copied().sum();

        if aggregated_total_bytes > 0 && aggregated_downloaded_bytes > aggregated_total_bytes {
            aggregated_downloaded_bytes = aggregated_total_bytes;
        }
        
        (aggregated_downloaded_bytes, aggregated_total_bytes)
    };
    
    while let Some(chunk_result) = stream.next().await {
        let chunk: Bytes = match chunk_result {
            Ok(chunk) => chunk,
            Err(e) => {
                eprintln!("[ERROR] ストリーミングデータ受信エラー: {:?}", e);
                let error_msg = if e.is_timeout() {
                    format!("ダウンロード中にタイムアウトが発生しました。ネットワーク接続を確認してください。エラー詳細: {}", e)
                } else if e.is_request() {
                    format!("ダウンロードリクエスト中にエラーが発生しました。エラー詳細: {}", e)
                } else {
                    format!("ダウンロード中にエラーが発生しました。ネットワーク接続を確認してください。エラー詳細: {}", e)
                };
                // エラー進捗を送信（値をコピーして借用チェックを回避）
                let current_downloaded_bytes = aggregated_downloaded_bytes;
                let current_total_bytes = aggregated_total_bytes;
                let error_progress = ModelDownloadProgress {
                    status: "error".to_string(),
                    progress: 0.0,
                    downloaded_bytes: current_downloaded_bytes,
                    total_bytes: current_total_bytes,
                    speed_bytes_per_sec: 0.0,
                    message: Some(error_msg.clone()),
                };
                // エラー進捗を送信（送信に失敗しても処理は続行）
                if let Err(e) = app_handle.emit("model_download_progress", &error_progress) {
                    eprintln!("[WARN] エラー進捗の送信に失敗しました: {}", e);
                }
                return Err(error_msg);
            }
        };
        
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
                    // JSONオブジェクトを解析して進捗情報を更新
                    if let Ok(json) = serde_json::from_str::<serde_json::Value>(&line_str) {
                        update_progress_stats(&json);
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
            
            // 空行はスキップ
            if !line_str.is_empty() {
                // JSONオブジェクトを解析
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(&line_str) {
                    // エラーレスポンスをチェック
                    if let Some(error_msg) = json.get("error").and_then(|e| e.as_str()) {
                        eprintln!("[ERROR] Ollama APIからエラーレスポンスを受信: {}", error_msg);
                        // 値をコピーして借用チェックを回避
                        let current_downloaded_bytes = aggregated_downloaded_bytes;
                        let current_total_bytes = aggregated_total_bytes;
                        let error_progress = ModelDownloadProgress {
                            status: "error".to_string(),
                            progress: 0.0,
                            downloaded_bytes: current_downloaded_bytes,
                            total_bytes: current_total_bytes,
                            speed_bytes_per_sec: 0.0,
                            message: Some(format!("Ollama APIエラー: {}", error_msg)),
                        };
                        // エラー進捗を送信（送信に失敗しても処理は続行）
                        if let Err(e) = app_handle.emit("model_download_progress", &error_progress) {
                            eprintln!("[WARN] エラー進捗の送信に失敗しました: {}", e);
                        }
                        return Err(format!("モデルダウンロード中にエラーが発生しました: {}", error_msg));
                    }
                    
                    // クロージャを呼び出して更新された値を取得
                    let (current_downloaded_bytes, current_total_bytes) = update_progress_stats(&json);
                    
                    // Ollama APIの進捗情報を取得
                    // レスポンス形式: {"status": "pulling manifest", "digest": "...", "total": 100, "completed": 50}
                    let status = json.get("status")
                        .and_then(|s| s.as_str())
                        .unwrap_or("pulling")
                        .to_string();

                    // 速度計算
                    let elapsed = start_time.elapsed().as_secs_f64();
                    let speed = if elapsed > 0.0 {
                        current_downloaded_bytes as f64 / elapsed
                    } else {
                        0.0
                    };
                    
                    // 進捗率を計算
                    let mut progress_percent = if current_total_bytes > 0 {
                        (current_downloaded_bytes as f64 / current_total_bytes as f64) * 100.0
                    } else {
                        0.0
                    };
                    if progress_percent < 0.0 {
                        progress_percent = 0.0;
                    }
                    if progress_percent > 100.0 {
                        progress_percent = 100.0;
                    }
                    
                    // 進捗イベントを送信（0.5秒ごとに更新）
                    if last_progress_update.elapsed().as_millis() >= 500 {
                        let progress = ModelDownloadProgress {
                            status: status.clone(),
                            progress: progress_percent,
                            downloaded_bytes: current_downloaded_bytes,
                            total_bytes: current_total_bytes,
                            speed_bytes_per_sec: speed,
                            message: Some(status.clone()),
                        };
                        
                        if let Err(e) = app_handle.emit("model_download_progress", &progress) {
                            eprintln!("[WARN] モデルダウンロード進捗イベントの送信に失敗しました: {}", e);
                        }
                        last_progress_update = std::time::Instant::now();
                    }
                }
            }
        }
    }
    
    // 残りのバッファを処理
    if !buffer.trim().is_empty() {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(buffer.trim()) {
            update_progress_stats(&json);
            let status = json.get("status")
                .and_then(|s| s.as_str())
                .unwrap_or("completed")
                .to_string();
            
             if status == "success" {
                // ダウンロード完了後、データベースに保存
                // モデル情報を取得（Ollama APIから）
                if let Ok(client) = crate::utils::http_client::create_http_client() {
                 if let Ok(tags_response) = client
                     .get(&format!("{}/api/tags", base_url.trim_end_matches('/')))
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
                                                ps.trim_end_matches('B').parse::<i64>().map_err(|e| {
                                                    eprintln!("[WARN] パラメータサイズのパースに失敗しました (値: {}): {}", ps, e);
                                                    e
                                                }).ok()
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
                                         if let Err(e) = tokio::task::spawn_blocking(move || {
                                             if let Ok(conn) = get_connection() {
                                                 let model_repo = InstalledModelRepository::new(&conn);
                                                 if let Err(err) = model_repo.upsert(&model_to_save) {
                                                     eprintln!("[WARN] モデル情報の保存に失敗しました ({}): {}", model_to_save.name, err);
                                                 }
                                             } else {
                                                 eprintln!("[WARN] データベース接続に失敗しました");
                                             }
                                         }).await {
                                             eprintln!("[WARN] モデル情報の保存タスクが失敗しました: {}", e);
                                         }
                                         break;
                                     }
                                 }
                             }
                         }
                    }
                }
                }
                
                let total_for_report = if aggregated_total_bytes > 0 {
                    aggregated_total_bytes
                } else {
                    aggregated_downloaded_bytes
                };
                let downloaded_for_report = if aggregated_downloaded_bytes > 0 {
                    aggregated_downloaded_bytes
                } else {
                    total_for_report
                };
                let progress = ModelDownloadProgress {
                    status: "completed".to_string(),
                    progress: 100.0,
                    downloaded_bytes: downloaded_for_report,
                    total_bytes: total_for_report,
                    speed_bytes_per_sec: 0.0,
                    message: Some(format!("モデル '{model_name}' のダウンロードが完了しました")),
                };
                if let Err(e) = app_handle.emit("model_download_progress", &progress) {
                    eprintln!("[WARN] モデルダウンロード完了イベントの送信に失敗しました: {}", e);
                }
            }
         }
     } else {
         // 完了通知（バッファが空の場合）
         let total_for_report = if aggregated_total_bytes > 0 {
             aggregated_total_bytes
         } else {
             aggregated_downloaded_bytes
         };
         let downloaded_for_report = if aggregated_downloaded_bytes > 0 {
             aggregated_downloaded_bytes
         } else {
             total_for_report
         };
         let final_progress = ModelDownloadProgress {
             status: "completed".to_string(),
             progress: 100.0,
             downloaded_bytes: downloaded_for_report,
             total_bytes: total_for_report,
             speed_bytes_per_sec: 0.0,
             message: Some(format!("モデル '{model_name}' のダウンロードが完了しました")),
         };
         if let Err(e) = app_handle.emit("model_download_progress", &final_progress) {
             eprintln!("[WARN] モデルダウンロード完了イベントの送信に失敗しました: {}", e);
         }
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
    let base_url = current_ollama_base_url();
    let delete_endpoint = format!("{}/api/delete", base_url.trim_end_matches('/'));
    let client = crate::utils::http_client::create_http_client()?;
    let response = client
        .post(&delete_endpoint)
        .json(&serde_json::json!({
            "name": model_name.clone()
        }))
        .send()
        .await
        .map_err(|_| "AIエンジンに接続できませんでした。AIエンジンが正常に起動しているか確認してください。".to_string())?;
    
    let status = response.status();
    if !status.is_success() {
        return Err(format!("AIモデルの削除に失敗しました（エラーコード: {status}）。AIエンジンが正常に動作しているか確認してください。"));
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
        let client = match crate::utils::http_client::create_http_client() {
            Ok(client) => client,
            Err(e) => {
                // HTTPクライアントの作成に失敗した場合、データベースの情報のみを返す
                // エラーをログに記録するが、データベースから取得した情報は返す
                eprintln!("[WARN] HTTPクライアントの作成に失敗しました。データベースの情報のみを返します: {}", e);
                // データベースから取得したモデル情報を返す（Ollama APIからの追加情報なし）
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
                return Ok(result);
            }
        };
        let base_url = current_ollama_base_url();
        if let Ok(response) = client
            .get(&format!("{}/api/tags", base_url.trim_end_matches('/')))
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
                        if let Err(e) = tokio::task::spawn_blocking(move || {
                            if let Ok(conn) = get_connection() {
                                let model_repo = InstalledModelRepository::new(&conn);
                                for model in models_to_save {
                                    if let Err(err) = model_repo.upsert(&model) {
                                        eprintln!("[WARN] モデル情報の保存に失敗しました ({}): {}", model.name, err);
                                }
                                }
                            } else {
                                eprintln!("[WARN] データベース接続に失敗しました");
                            }
                        }).await {
                            eprintln!("[WARN] モデル情報の一括更新タスクが失敗しました: {}", e);
                        }
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
    /// エラーメッセージが存在するログのみを取得するかどうか（デフォルト: false）
    #[serde(default)]
    pub errors_only: bool,
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

/// リクエストログ一覧取得レスポンス（CODE-002修正: 総件数を含む）
#[derive(Debug, Serialize, Deserialize)]
pub struct GetRequestLogsResponse {
    pub logs: Vec<RequestLogInfo>,
    pub total_count: i64,
}

/// リクエストログ一覧取得コマンド（F006の基盤 + フィルタ機能拡張 + CODE-002修正）
#[tauri::command]
pub async fn get_request_logs(request: GetRequestLogsRequest) -> Result<GetRequestLogsResponse, String> {
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
        request.errors_only,
    ).map_err(|e| {
        format!("リクエストログの取得に失敗しました: {e}")
    })?;
    
    // 総件数を取得（CODE-002修正: 正確な総件数を取得）
    let total_count = log_repo.count_with_filters(
        request.api_id.as_deref(),
        request.start_date.as_deref(),
        request.end_date.as_deref(),
        request.status_codes.as_deref(),
        request.path_filter.as_deref(),
        request.errors_only,
    ).map_err(|e| {
        format!("ログ総件数の取得に失敗しました: {e}")
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
    
    Ok(GetRequestLogsResponse {
        logs: result,
        total_count,
    })
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
    /// リクエストボディを含めるかどうか（デフォルト: false、プライバシー保護のため）
    #[serde(default)]
    pub include_request_body: bool,
    /// リクエストボディをマスク処理するかどうか（include_request_bodyがtrueの場合のみ有効、デフォルト: true）
    #[serde(default = "default_true")]
    pub mask_request_body: bool,
    /// エクスポートファイルを暗号化するかどうか（デフォルト: false）
    #[serde(default)]
    pub encrypt: bool,
    /// 暗号化パスワード（encryptがtrueの場合に必須）
    pub password: Option<String>,
}

fn default_true() -> bool {
    true
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
        false, // エクスポート時はerrors_onlyフィルタは使用しない（全ログをエクスポート）
    ).map_err(|e| {
        format!("リクエストログの取得に失敗しました: {e}")
    })?;
    
    let count = i64::try_from(logs.len()).unwrap_or(0);
    
    // リクエストボディの処理（マスク処理または除外）
    let process_request_body = |body: &Option<String>| -> Option<String> {
        if !request.include_request_body {
            return None;
        }
        
        body.as_ref().map(|b| {
            if request.mask_request_body {
                mask_sensitive_data(b)
            } else {
                b.clone()
            }
        })
    };
    
    // フォーマットに応じてデータを変換
    let data = match request.format.as_str() {
        "csv" => {
            // CSV形式に変換
            let mut csv = String::new();
            // ヘッダー行
            if request.include_request_body {
                csv.push_str("ID,API ID,Method,Path,Request Body,Response Status,Response Time (ms),Error Message,Created At\n");
            } else {
                csv.push_str("ID,API ID,Method,Path,Response Status,Response Time (ms),Error Message,Created At\n");
            }
            
            // データ行
            for log in &logs {
                let request_body_str = process_request_body(&log.request_body)
                    .map(|b| escape_csv_field(&b))
                    .unwrap_or_else(|| "".to_string());
                
                if request.include_request_body {
                    csv.push_str(&format!(
                        "{},{},{},{},{},{},{},{},{}\n",
                        escape_csv_field(&log.id),
                        escape_csv_field(&log.api_id),
                        escape_csv_field(&log.method),
                        escape_csv_field(&log.path),
                        request_body_str,
                        log.response_status.map(|s| s.to_string()).as_deref().unwrap_or(""),
                        log.response_time_ms.map(|t| t.to_string()).as_deref().unwrap_or(""),
                        escape_csv_field(&log.error_message.as_deref().unwrap_or("")),
                        escape_csv_field(&log.created_at.to_rfc3339()),
                    ));
                } else {
                    csv.push_str(&format!(
                        "{},{},{},{},{},{},{},{}\n",
                        escape_csv_field(&log.id),
                        escape_csv_field(&log.api_id),
                        escape_csv_field(&log.method),
                        escape_csv_field(&log.path),
                        log.response_status.map(|s| s.to_string()).as_deref().unwrap_or(""),
                        log.response_time_ms.map(|t| t.to_string()).as_deref().unwrap_or(""),
                        escape_csv_field(&log.error_message.as_deref().unwrap_or("")),
                        escape_csv_field(&log.created_at.to_rfc3339()),
                    ));
                }
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
                    request_body: process_request_body(&log.request_body),
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
            return Err("無効なフォーマットです。'csv' または 'json' を指定してください。".to_string());
        }
    };
    
    // 暗号化処理
    let final_data = if request.encrypt {
        if let Some(password) = request.password {
            encrypt_export_data(&data, &password).map_err(|e| {
                format!("エクスポートデータの暗号化に失敗しました: {}", e)
            })?
        } else {
            return Err("暗号化が有効ですが、パスワードが指定されていません。".to_string());
        }
    } else {
        data
    };
    
    Ok(ExportLogsResponse {
        data: final_data,
        format: request.format,
        count,
    })
}

/// エクスポートデータを暗号化（パスワードベース）
fn encrypt_export_data(data: &str, password: &str) -> Result<String, String> {
    use aes_gcm::{
        aead::{Aead, AeadCore, KeyInit, OsRng},
        Aes256Gcm,
    };
    use sha2::{Sha256, Digest};
    use base64::{Engine as _, engine::general_purpose::STANDARD};
    
    // パスワードから32バイトのキーを生成（SHA-256）
    let mut hasher = Sha256::new();
    hasher.update(password.as_bytes());
    let key_bytes = hasher.finalize();
    
    // AES-256-GCMで暗号化
    #[allow(deprecated)] // aes-gcm 0.10では非推奨だが、依存関係のバージョンアップは中長期改善項目
    let cipher = Aes256Gcm::new_from_slice(&key_bytes)
        .map_err(|e| format!("暗号化キーの生成に失敗しました: {}", e))?;
    
    // Nonceを生成
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
    
    // 暗号化
    let ciphertext = cipher.encrypt(&nonce, data.as_bytes().as_ref())
        .map_err(|e| format!("暗号化エラー: {}", e))?;
    
    // Nonceと暗号文を結合してBase64エンコード
    let nonce_bytes: &[u8] = nonce.as_ref();
    let mut combined: Vec<u8> = nonce_bytes.to_vec();
    combined.extend_from_slice(&ciphertext);
    
    Ok(STANDARD.encode(&combined))
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

/// リクエストボディの機密情報をマスク処理（プライバシー保護）
fn mask_sensitive_data(body: &str) -> String {
    // JSONパースを試みる
    if let Ok(mut json_value) = serde_json::from_str::<serde_json::Value>(body) {
        mask_json_value(&mut json_value);
        serde_json::to_string(&json_value).unwrap_or_else(|_| "***MASKED***".to_string())
    } else {
        // JSONでない場合は、機密情報と思われるパターンをマスク
        let sensitive_patterns = vec![
            // API認証関連
            (r#""api_key"\s*:\s*"[^"]*""#, r#""api_key": "***MASKED***""#),
            (r#""apiKey"\s*:\s*"[^"]*""#, r#""apiKey": "***MASKED***""#),
            (r#""api-key"\s*:\s*"[^"]*""#, r#""api-key": "***MASKED***""#),
            (r#""authorization"\s*:\s*"[^"]*""#, r#""authorization": "***MASKED***""#),
            (r#""Authorization"\s*:\s*"[^"]*""#, r#""Authorization": "***MASKED***""#),
            // パスワード関連
            (r#""password"\s*:\s*"[^"]*""#, r#""password": "***MASKED***""#),
            (r#""passwd"\s*:\s*"[^"]*""#, r#""passwd": "***MASKED***""#),
            (r#""pwd"\s*:\s*"[^"]*""#, r#""pwd": "***MASKED***""#),
            (r#""passphrase"\s*:\s*"[^"]*""#, r#""passphrase": "***MASKED***""#),
            // トークン関連
            (r#""token"\s*:\s*"[^"]*""#, r#""token": "***MASKED***""#),
            (r#""access_token"\s*:\s*"[^"]*""#, r#""access_token": "***MASKED***""#),
            (r#""refresh_token"\s*:\s*"[^"]*""#, r#""refresh_token": "***MASKED***""#),
            (r#""bearer_token"\s*:\s*"[^"]*""#, r#""bearer_token": "***MASKED***""#),
            (r#""jwt"\s*:\s*"[^"]*""#, r#""jwt": "***MASKED***""#),
            // シークレット関連
            (r#""secret"\s*:\s*"[^"]*""#, r#""secret": "***MASKED***""#),
            (r#""secret_key"\s*:\s*"[^"]*""#, r#""secret_key": "***MASKED***""#),
            (r#""private_key"\s*:\s*"[^"]*""#, r#""private_key": "***MASKED***""#),
            // クレジットカード関連
            (r#""credit_card"\s*:\s*"[^"]*""#, r#""credit_card": "***MASKED***""#),
            (r#""card_number"\s*:\s*"[^"]*""#, r#""card_number": "***MASKED***""#),
            (r#""cvv"\s*:\s*"[^"]*""#, r#""cvv": "***MASKED***""#),
            (r#""cvc"\s*:\s*"[^"]*""#, r#""cvc": "***MASKED***""#),
            // 個人情報関連
            (r#""ssn"\s*:\s*"[^"]*""#, r#""ssn": "***MASKED***""#),
            (r#""social_security"\s*:\s*"[^"]*""#, r#""social_security": "***MASKED***""#),
        ];
        
        let mut masked = body.to_string();
        for (pattern, replacement) in sensitive_patterns {
            // 正規表現のコンパイルを試みる
            let regex = match regex::Regex::new(pattern) {
                Ok(re) => re,
                Err(_) => {
                    // 正規表現のコンパイルに失敗した場合は、空の正規表現を使用
                    // 空の正規表現は常にマッチしないため、安全
                    match regex::Regex::new("(?!)") {
                        Ok(re) => re,
                        Err(_) => {
                            // これも失敗する可能性は極めて低いが、念のため
                            // 空文字列の正規表現は常に成功する（コンパイルエラーにならない）
                            // 万が一失敗した場合は、元の文字列をそのまま返す
                            match regex::Regex::new("") {
                                Ok(re) => re,
                                Err(_) => {
                                    // すべての正規表現コンパイルに失敗した場合（理論上発生しない）
                                    // このパターンはスキップして次のパターンに進む
                                    continue;
                                }
                            }
                        }
                    }
                }
            };
            masked = regex.replace_all(&masked, replacement).to_string();
        }
        
        if masked == body {
            "***MASKED***".to_string()
        } else {
            masked
        }
    }
}

/// JSON値の機密情報を再帰的にマスク処理
fn mask_json_value(value: &mut serde_json::Value) {
    use serde_json::Value;
    match value {
        Value::Object(map) => {
            let sensitive_keys = vec![
                // API認証関連
                "api_key", "apiKey", "apikey", "apikey", "api-key", "api_key",
                "authorization", "Authorization", "authorization", "auth",
                // パスワード関連
                "password", "passwd", "pwd", "pass", "passphrase",
                // トークン関連
                "token", "access_token", "refresh_token", "bearer_token", "jwt",
                "session_token", "csrf_token", "xsrf_token",
                // シークレット関連
                "secret", "secret_key", "private_key", "privatekey", "private_key",
                "public_key", "publickey", "public_key",
                // クレジットカード関連
                "credit_card", "creditcard", "card_number", "cardnumber", "cvv", "cvc",
                "expiry", "expiration", "exp_date",
                // 個人情報関連
                "ssn", "social_security", "social_security_number", "tax_id",
                "driver_license", "drivers_license", "license_number",
                // メールアドレス（一部のコンテキストで機密）
                "email", "e-mail", "email_address",
                // 電話番号
                "phone", "phone_number", "mobile", "telephone",
                // その他の機密情報
                "pin", "otp", "verification_code", "security_code",
                "account_number", "routing_number", "iban", "swift",
            ];
            
            for (key, val) in map.iter_mut() {
                let lower_key = key.to_lowercase();
                let is_sensitive = sensitive_keys.iter().any(|sk| lower_key.contains(sk));
                
                if is_sensitive {
                    if let Value::String(s) = val {
                        if s.len() > 8 {
                            *val = Value::String(format!("{}***{}", 
                                &s[..4.min(s.len())], 
                                &s[s.len().saturating_sub(4)..]
                            ));
                        } else {
                            *val = Value::String("***MASKED***".to_string());
                        }
                    } else {
                        *val = Value::String("***MASKED***".to_string());
                    }
                } else {
                    mask_json_value(val);
                }
            }
        },
        Value::Array(arr) => {
            for item in arr.iter_mut() {
                mask_json_value(item);
            }
        },
        _ => {}
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
                    return Err(format!("API ID '{api_id}' が見つかりません"));
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
            format!("API一覧の取得に失敗しました: {e}")
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
        format!("JSON変換に失敗しました: {e}")
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
                            engine_type: Some("ollama".to_string()), // バックアップ復元時はデフォルトでOllama
                            engine_config: None, // バックアップデータに含まれていない場合はNone
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
                                    
                                    // 無限ループを防ぐ（最大100回まで試行）
                                    if counter > 100 {
                                        new_name = format!("{} ({})", api_data.name, chrono::Utc::now().timestamp());
                                        break;
                                    }
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
                            engine_type: Some("ollama".to_string()), // バックアップ復元時はデフォルトでOllama
                            engine_config: None, // バックアップデータに含まれていない場合はNone
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
                    engine_type: Some("ollama".to_string()), // バックアップ復元時はデフォルトでOllama
                    engine_config: None, // バックアップデータに含まれていない場合はNone
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

/// モデルカタログ情報のレスポンス型
#[derive(Debug, Serialize, Deserialize)]
pub struct ModelCatalogInfo {
    pub name: String,
    pub description: Option<String>,
    pub size: Option<i64>,
    pub parameters: Option<i64>,
    pub category: Option<String>,
    pub recommended: bool,
    pub author: Option<String>,
    pub license: Option<String>,
    pub modified_at: Option<String>,
}

/// モデルカタログを取得（データベースから）
#[tauri::command]
pub async fn get_model_catalog() -> Result<Vec<ModelCatalogInfo>, String> {
    use crate::database::connection::get_connection;
    
    // データベースからモデルカタログを取得（非Send型のため）
    let catalog_models = tokio::task::spawn_blocking(|| {
        let conn = get_connection().map_err(|_| {
            "データの読み込みに失敗しました。アプリを再起動して再度お試しください。".to_string()
        })?;
        
        let catalog_repo = ModelCatalogRepository::new(&conn);
        catalog_repo.find_all().map_err(|e| {
            format!("モデルカタログの取得に失敗しました: {}", e)
        })
    }).await.map_err(|e| format!("データベース操作エラー: {e}"))??;
    
    // ModelCatalogをModelCatalogInfoに変換
    let result: Vec<ModelCatalogInfo> = catalog_models.into_iter().map(|model| {
        ModelCatalogInfo {
            name: model.name,
            description: model.description,
            size: model.size,
            parameters: model.parameters,
            category: model.category,
            recommended: model.recommended,
            author: model.author,
            license: model.license,
            modified_at: Some(model.updated_at.to_rfc3339()),
        }
    }).collect();
    
    Ok(result)
}

/// Hugging Faceモデル情報取得コマンド
#[tauri::command]
pub async fn get_huggingface_model_info(model_id: String) -> Result<crate::utils::huggingface::HuggingFaceModel, String> {
    use crate::utils::huggingface;
    
    huggingface::get_huggingface_model_info(&model_id)
        .await
        .map_err(|e| match e {
            crate::utils::error::AppError::ApiError { message, .. } => message,
            _ => format!("モデル情報の取得に失敗しました: {}", e),
        })
}

/// セキュリティ設定取得コマンド
#[tauri::command]
#[allow(non_snake_case)] // Tauri v2のフロントエンドとの互換性のためcamelCaseを使用
pub async fn get_security_settings(apiId: String) -> Result<Option<serde_json::Value>, String> {
    let api_id = apiId; // Tauri v2の自動変換に対応
    use crate::database::repository::security_repository::ApiSecuritySettingsRepository;
    
    let conn = get_connection().map_err(|e| {
        format!("データベース接続エラー: {e}")
    })?;
    
    let settings = ApiSecuritySettingsRepository::find_by_api_id(&conn, &api_id).map_err(|e| {
        format!("セキュリティ設定の取得に失敗しました: {e}")
    })?;
    
    match settings {
        Some(settings) => {
            // IPホワイトリストをJSON配列に変換
            let ip_whitelist: Vec<String> = settings.ip_whitelist
                .as_ref()
                .and_then(|s| serde_json::from_str(s).ok())
                .unwrap_or_else(|| {
                    if let Some(json_str) = settings.ip_whitelist.as_ref() {
                        eprintln!("[WARN] IPホワイトリストJSONのパースエラー (JSON: {})", json_str);
                    }
                    Vec::new()
                });
            
            let result = serde_json::json!({
                "ip_whitelist": ip_whitelist,
                "rate_limit_enabled": settings.rate_limit_enabled,
                "rate_limit_requests": settings.rate_limit_requests,
                "rate_limit_window_seconds": settings.rate_limit_window_seconds,
                "key_rotation_enabled": settings.key_rotation_enabled,
                "key_rotation_interval_days": settings.key_rotation_interval_days,
            });
            
            Ok(Some(result))
        },
        None => Ok(None),
    }
}

/// IPホワイトリスト設定コマンド
#[tauri::command]
pub async fn set_ip_whitelist(api_id: String, whitelist: Vec<String>) -> Result<(), String> {
    // 入力検証（監査レポートの推奨事項に基づき追加）
    use crate::utils::input_validation;
    for ip in &whitelist {
        input_validation::validate_ip_address(ip).map_err(|e| {
            format!("IPアドレスの検証に失敗しました（{}）: {}", ip, e)
        })?;
    }
    
    use crate::database::repository::security_repository::ApiSecuritySettingsRepository;
    use crate::database::models::ApiSecuritySettings;
    
    let conn = get_connection().map_err(|e| {
        format!("データベース接続エラー: {e}")
    })?;
    
    // 既存の設定を取得または新規作成
    let settings = match ApiSecuritySettingsRepository::find_by_api_id(&conn, &api_id).map_err(|e| {
        format!("セキュリティ設定の取得に失敗しました: {e}")
    })? {
        Some(mut s) => {
            // IPホワイトリストをJSON文字列に変換
            let ip_whitelist_json = serde_json::to_string(&whitelist).map_err(|e| {
                format!("IPホワイトリストの変換に失敗しました: {e}")
            })?;
            s.ip_whitelist = Some(ip_whitelist_json);
            s.updated_at = Utc::now();
            s
        },
        None => {
            // 新規作成
            let ip_whitelist_json = serde_json::to_string(&whitelist).map_err(|e| {
                format!("IPホワイトリストの変換に失敗しました: {e}")
            })?;
            ApiSecuritySettings {
                api_id: api_id.clone(),
                ip_whitelist: Some(ip_whitelist_json),
                rate_limit_enabled: false,
                rate_limit_requests: 100,
                rate_limit_window_seconds: 60,
                key_rotation_enabled: false,
                key_rotation_interval_days: 30,
                created_at: Utc::now(),
                updated_at: Utc::now(),
            }
        },
    };
    
    // 設定を保存
    if settings.created_at == settings.updated_at && settings.created_at == Utc::now() {
        // 新規作成
        ApiSecuritySettingsRepository::create(&conn, &settings).map_err(|e| {
            format!("セキュリティ設定の保存に失敗しました: {e}")
        })?;
    } else {
        // 更新
        ApiSecuritySettingsRepository::update(&conn, &settings).map_err(|e| {
            format!("セキュリティ設定の更新に失敗しました: {e}")
        })?;
    }
    
    Ok(())
}

/// レート制限設定更新コマンド
#[tauri::command]
pub async fn update_rate_limit_config(
    api_id: String,
    config: serde_json::Value,
) -> Result<(), String> {
    use crate::database::repository::security_repository::ApiSecuritySettingsRepository;
    use crate::database::models::ApiSecuritySettings;
    
    let enabled = config.get("enabled")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    let requests = config.get("requests")
        .and_then(|v| v.as_i64())
        .unwrap_or(100) as i32;
    let window_seconds = config.get("window_seconds")
        .and_then(|v| v.as_i64())
        .unwrap_or(60) as i32;
    
    let conn = get_connection().map_err(|e| {
        format!("データベース接続エラー: {e}")
    })?;
    
    // 既存の設定を取得または新規作成
    let settings = match ApiSecuritySettingsRepository::find_by_api_id(&conn, &api_id).map_err(|e| {
        format!("セキュリティ設定の取得に失敗しました: {e}")
    })? {
        Some(mut s) => {
            s.rate_limit_enabled = enabled;
            s.rate_limit_requests = requests;
            s.rate_limit_window_seconds = window_seconds;
            s.updated_at = Utc::now();
            s
        },
        None => {
            ApiSecuritySettings {
                api_id: api_id.clone(),
                ip_whitelist: None,
                rate_limit_enabled: enabled,
                rate_limit_requests: requests,
                rate_limit_window_seconds: window_seconds,
                key_rotation_enabled: false,
                key_rotation_interval_days: 30,
                created_at: Utc::now(),
                updated_at: Utc::now(),
            }
        },
    };
    
    // 設定を保存
    if settings.created_at == settings.updated_at && settings.created_at == Utc::now() {
        ApiSecuritySettingsRepository::create(&conn, &settings).map_err(|e| {
            format!("セキュリティ設定の保存に失敗しました: {e}")
        })?;
    } else {
        ApiSecuritySettingsRepository::update(&conn, &settings).map_err(|e| {
            format!("セキュリティ設定の更新に失敗しました: {e}")
        })?;
    }
    
    Ok(())
}

/// APIキーローテーション設定更新コマンド
#[tauri::command]
pub async fn update_key_rotation_config(
    api_id: String,
    enabled: bool,
    interval_days: i32,
) -> Result<(), String> {
    use crate::database::repository::security_repository::ApiSecuritySettingsRepository;
    use crate::database::models::ApiSecuritySettings;
    
    let conn = get_connection().map_err(|e| {
        format!("データベース接続エラー: {e}")
    })?;
    
    // 既存の設定を取得または新規作成
    let settings = match ApiSecuritySettingsRepository::find_by_api_id(&conn, &api_id).map_err(|e| {
        format!("セキュリティ設定の取得に失敗しました: {e}")
    })? {
        Some(mut s) => {
            s.key_rotation_enabled = enabled;
            s.key_rotation_interval_days = interval_days;
            s.updated_at = Utc::now();
            s
        },
        None => {
            ApiSecuritySettings {
                api_id: api_id.clone(),
                ip_whitelist: None,
                rate_limit_enabled: false,
                rate_limit_requests: 100,
                rate_limit_window_seconds: 60,
                key_rotation_enabled: enabled,
                key_rotation_interval_days: interval_days,
                created_at: Utc::now(),
                updated_at: Utc::now(),
            }
        },
    };
    
    // 設定を保存
    if settings.created_at == settings.updated_at && settings.created_at == Utc::now() {
        ApiSecuritySettingsRepository::create(&conn, &settings).map_err(|e| {
            format!("セキュリティ設定の保存に失敗しました: {e}")
        })?;
    } else {
        ApiSecuritySettingsRepository::update(&conn, &settings).map_err(|e| {
            format!("セキュリティ設定の更新に失敗しました: {e}")
        })?;
    }
    
    Ok(())
}

/// 監査ログ検索リクエスト
#[derive(Debug, Serialize, Deserialize)]
pub struct SearchAuditLogsRequest {
    pub api_id: Option<String>,
    pub action: Option<String>,
    pub resource_type: Option<String>,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub limit: Option<u32>,
}

/// 監査ログ検索コマンド
#[tauri::command]
pub async fn search_audit_logs(request: SearchAuditLogsRequest) -> Result<Vec<crate::utils::audit_log::AuditLogEntry>, String> {
    use crate::utils::audit_log::{search_audit_logs, AuditAction};
    
    let action = request.action.as_deref().and_then(|a| {
        match a {
            "Create" => Some(AuditAction::Create),
            "Read" => Some(AuditAction::Read),
            "Update" => Some(AuditAction::Update),
            "Delete" => Some(AuditAction::Delete),
            "Start" => Some(AuditAction::Start),
            "Stop" => Some(AuditAction::Stop),
            "Login" => Some(AuditAction::Login),
            "Logout" => Some(AuditAction::Logout),
            "Share" => Some(AuditAction::Share),
            "Unshare" => Some(AuditAction::Unshare),
            _ => None,
        }
    });
    
    search_audit_logs(
        request.api_id.as_deref(),
        action,
        request.resource_type.as_deref(),
        request.start_date.as_deref(),
        request.end_date.as_deref(),
        request.limit,
    ).await.map_err(|e| format!("監査ログの検索に失敗しました: {}", e))
}

/// エラーログ保存リクエスト
#[derive(Debug, Serialize, Deserialize)]
pub struct SaveErrorLogRequest {
    pub error_category: String,
    pub error_message: String,
    pub error_stack: Option<String>,
    pub context: Option<String>,
    pub source: Option<String>,
    pub api_id: Option<String>,
    pub user_agent: Option<String>,
}

/// エラーログ保存コマンド
#[tauri::command]
pub async fn save_error_log(request: SaveErrorLogRequest) -> Result<(), String> {
    let conn = get_connection().map_err(|e| {
        format!("データベース接続エラー: {}", e)
    })?;
    
    let error_log_repo = ErrorLogRepository::new(&conn);
    
    let error_log = crate::database::repository::error_log_repository::ErrorLog {
        id: Uuid::new_v4().to_string(),
        error_category: request.error_category,
        error_message: request.error_message,
        error_stack: request.error_stack,
        context: request.context,
        source: request.source,
        api_id: request.api_id,
        user_agent: request.user_agent,
        created_at: Utc::now().to_rfc3339(),
    };
    
    error_log_repo.create(&error_log).map_err(|e| {
        format!("エラーログの保存に失敗しました: {}", e)
    })?;
    
    Ok(())
}

/// エラーログ一覧取得リクエスト
#[derive(Debug, Serialize, Deserialize)]
pub struct ListErrorLogsRequest {
    pub error_category: Option<String>,
    pub api_id: Option<String>,
    pub limit: Option<i32>,
    pub offset: Option<i32>,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
}

/// エラーログ情報
#[derive(Debug, Serialize, Deserialize)]
pub struct ErrorLogInfo {
    pub id: String,
    pub error_category: String,
    pub error_message: String,
    pub error_stack: Option<String>,
    pub context: Option<String>,
    pub source: Option<String>,
    pub api_id: Option<String>,
    pub user_agent: Option<String>,
    pub created_at: String,
}

/// エラーログ一覧取得コマンド
#[tauri::command]
pub async fn list_error_logs(request: ListErrorLogsRequest) -> Result<Vec<ErrorLogInfo>, String> {
    let conn = get_connection().map_err(|e| {
        format!("データベース接続エラー: {}", e)
    })?;
    
    let error_log_repo = ErrorLogRepository::new(&conn);
    
    let error_logs = error_log_repo.find_with_filters(
        request.error_category.as_deref(),
        request.api_id.as_deref(),
        request.limit,
        request.offset,
        request.start_date.as_deref(),
        request.end_date.as_deref(),
    ).map_err(|e| format!("エラーログの取得に失敗しました: {}", e))?;
    
    let error_log_infos: Vec<ErrorLogInfo> = error_logs.into_iter().map(|log| {
        ErrorLogInfo {
            id: log.id,
            error_category: log.error_category,
            error_message: log.error_message,
            error_stack: log.error_stack,
            context: log.context,
            source: log.source,
            api_id: log.api_id,
            user_agent: log.user_agent,
            created_at: log.created_at,
        }
    }).collect();
    
    Ok(error_log_infos)
}

/// エラーログエクスポートリクエスト
#[derive(Debug, Serialize, Deserialize)]
pub struct ExportErrorLogsRequest {
    pub format: String, // "csv", "json", "txt"
    pub error_category: Option<String>,
    pub api_id: Option<String>,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
}

/// エラーログエクスポートコマンド
#[tauri::command]
pub async fn export_error_logs(request: ExportErrorLogsRequest) -> Result<String, String> {
    let conn = get_connection().map_err(|e| {
        format!("データベース接続エラー: {}", e)
    })?;
    
    let error_log_repo = ErrorLogRepository::new(&conn);
    
    let error_logs = error_log_repo.find_with_filters(
        request.error_category.as_deref(),
        request.api_id.as_deref(),
        None, // エクスポート時は全件取得
        None,
        request.start_date.as_deref(),
        request.end_date.as_deref(),
    ).map_err(|e| format!("エラーログの取得に失敗しました: {}", e))?;
    
    let format = request.format.to_lowercase();
    let content = match format.as_str() {
        "csv" => {
            let mut csv = String::from("ID,カテゴリ,メッセージ,スタック,コンテキスト,ソース,API ID,ユーザーエージェント,作成日時\n");
            for log in &error_logs {
                csv.push_str(&format!(
                    "{},\"{}\",\"{}\",\"{}\",\"{}\",\"{}\",\"{}\",\"{}\",\"{}\"\n",
                    log.id,
                    log.error_category,
                    log.error_message.replace('"', "\"\""),
                    log.error_stack.as_deref().unwrap_or("").replace('"', "\"\""),
                    log.context.as_deref().unwrap_or("").replace('"', "\"\""),
                    log.source.as_deref().unwrap_or(""),
                    log.api_id.as_deref().unwrap_or(""),
                    log.user_agent.as_deref().unwrap_or(""),
                    log.created_at,
                ));
            }
            csv
        },
        "json" => {
            // ErrorLogInfoに変換してからシリアライズ
            let error_log_infos: Vec<ErrorLogInfo> = error_logs.into_iter().map(|log| {
                ErrorLogInfo {
                    id: log.id,
                    error_category: log.error_category,
                    error_message: log.error_message,
                    error_stack: log.error_stack,
                    context: log.context,
                    source: log.source,
                    api_id: log.api_id,
                    user_agent: log.user_agent,
                    created_at: log.created_at,
                }
            }).collect();
            serde_json::to_string_pretty(&error_log_infos).map_err(|e| {
                format!("JSONシリアライズエラー: {}", e)
            })?
        },
        "txt" => {
            let mut txt = String::from("エラーログ一覧\n");
            txt.push_str(&"=".repeat(80));
            txt.push('\n');
            for log in &error_logs {
                txt.push_str(&format!(
                    "\nID: {}\nカテゴリ: {}\nメッセージ: {}\n",
                    log.id, log.error_category, log.error_message
                ));
                if let Some(stack) = &log.error_stack {
                    txt.push_str(&format!("スタックトレース:\n{}\n", stack));
                }
                if let Some(context) = &log.context {
                    txt.push_str(&format!("コンテキスト: {}\n", context));
                }
                if let Some(source) = &log.source {
                    txt.push_str(&format!("ソース: {}\n", source));
                }
                if let Some(api_id) = &log.api_id {
                    txt.push_str(&format!("API ID: {}\n", api_id));
                }
                txt.push_str(&format!("作成日時: {}\n", log.created_at));
                txt.push_str(&"-".repeat(80));
                txt.push('\n');
            }
            txt
        },
        _ => return Err("サポートされていない形式です。csv、json、txtのいずれかを指定してください。".to_string()),
    };
    
    // ファイル名を生成（タイムスタンプ付き）
    let timestamp = Utc::now().format("%Y%m%d_%H%M%S");
    let filename = format!("error_logs_{}.{}", timestamp, format);
    
    // 一時ディレクトリに保存
    let temp_dir = std::env::temp_dir();
    let file_path = temp_dir.join(&filename);
    
    std::fs::write(&file_path, content).map_err(|e| {
        format!("ファイルの書き込みに失敗しました: {}", e)
    })?;
    
    Ok(file_path.to_string_lossy().to_string())
}

/// 監査ログエクスポートリクエスト
#[derive(Debug, Serialize, Deserialize)]
pub struct ExportAuditLogsRequest {
    pub format: String, // "csv", "json", "txt"
    pub api_id: Option<String>,
    pub action: Option<String>,
    pub resource_type: Option<String>,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    /// IPアドレスとユーザーエージェントを除外するかどうか（デフォルト: false）
    #[serde(default)]
    pub exclude_sensitive_info: bool,
}

/// 監査ログエクスポートコマンド
#[tauri::command]
pub async fn export_audit_logs(request: ExportAuditLogsRequest) -> Result<String, String> {
    use crate::utils::audit_log::{export_audit_logs, ExportFormat, AuditAction};
    
    let format = match request.format.as_str() {
        "csv" => ExportFormat::Csv,
        "json" => ExportFormat::Json,
        "txt" => ExportFormat::Txt,
        _ => return Err("サポートされていない形式です。csv、json、txtのいずれかを指定してください。".to_string()),
    };
    
    let action = request.action.as_deref().and_then(|a| {
        match a {
            "Create" => Some(AuditAction::Create),
            "Read" => Some(AuditAction::Read),
            "Update" => Some(AuditAction::Update),
            "Delete" => Some(AuditAction::Delete),
            "Start" => Some(AuditAction::Start),
            "Stop" => Some(AuditAction::Stop),
            "Login" => Some(AuditAction::Login),
            "Logout" => Some(AuditAction::Logout),
            "Share" => Some(AuditAction::Share),
            "Unshare" => Some(AuditAction::Unshare),
            _ => None,
        }
    });
    
    export_audit_logs(
        format,
        request.api_id.as_deref(),
        action,
        request.resource_type.as_deref(),
        request.start_date.as_deref(),
        request.end_date.as_deref(),
        request.exclude_sensitive_info,
    ).await.map_err(|e| format!("監査ログのエクスポートに失敗しました: {}", e))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::utils::input_validation;
    
    /// API名の検証テスト
    #[test]
    fn test_validate_api_name() {
        // 有効なAPI名
        assert!(input_validation::validate_api_name("Test API").is_ok());
        assert!(input_validation::validate_api_name("API-123").is_ok());
        assert!(input_validation::validate_api_name("My_Test_API").is_ok());
        
        // 無効なAPI名（空文字列）
        assert!(input_validation::validate_api_name("").is_err());
        
        // 無効なAPI名（長すぎる）
        let long_name = "a".repeat(256);
        assert!(input_validation::validate_api_name(&long_name).is_err());
    }
    
    /// モデル名の検証テスト
    #[test]
    fn test_validate_model_name() {
        // 有効なモデル名
        assert!(input_validation::validate_model_name("llama3:8b").is_ok());
        assert!(input_validation::validate_model_name("gpt-4").is_ok());
        assert!(input_validation::validate_model_name("model_name").is_ok());
        
        // 無効なモデル名（空文字列）
        assert!(input_validation::validate_model_name("").is_err());
    }
    
    /// ApiCreateConfigの検証テスト
    #[test]
    fn test_api_create_config_validation() {
        // 有効な設定
        let valid_config = ApiCreateConfig {
            name: "Test API".to_string(),
            model_name: "llama3:8b".to_string(),
            port: Some(8080),
            enable_auth: Some(true),
            engine_type: Some("ollama".to_string()),
            engine_config: None,
        };
        
        assert_eq!(valid_config.name, "Test API");
        assert_eq!(valid_config.model_name, "llama3:8b");
        assert_eq!(valid_config.port, Some(8080));
        assert_eq!(valid_config.enable_auth, Some(true));
        assert_eq!(valid_config.engine_type, Some("ollama".to_string()));
    }
    
    /// ポート番号の検証テスト
    #[test]
    fn test_port_validation() {
        // 有効なポート番号
        assert!((1024..=65535).contains(&8080));
        assert!((1024..=65535).contains(&3000));
        assert!((1024..=65535).contains(&1420));
        
        // 無効なポート番号（範囲外）
        assert!(!(1024..=65535).contains(&1023));
        assert!(!(1024..=65535).contains(&65536));
    }
}
