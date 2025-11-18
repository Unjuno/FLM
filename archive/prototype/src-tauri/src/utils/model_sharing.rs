// Model Sharing Module
// 作成したカスタムモデルをコミュニティと共有する機能

use crate::utils::error::AppError;
use crate::utils::huggingface;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// 共有モデル情報
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SharedModelInfo {
    pub id: String,
    pub name: String,
    pub author: String,
    pub description: Option<String>,
    pub tags: Vec<String>,
    pub download_count: i64,
    pub rating: Option<f64>,
    pub model_path: Option<String>,
    pub platform: Option<String>,
    pub license: Option<String>,
    pub is_public: bool,
    pub created_at: String,
    pub updated_at: String,
}

/// モデル共有設定
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelSharingConfig {
    pub model_name: String,
    pub model_path: String,
    pub description: Option<String>,
    pub tags: Vec<String>,
    pub license: Option<String>,
    pub is_public: bool,
}

/// モデル共有設定（拡張版）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelSharingConfigExtended {
    pub model_name: String,
    pub model_path: String,
    pub description: Option<String>,
    pub tags: Vec<String>,
    pub license: Option<String>,
    pub is_public: bool,
    pub platform: Option<String>, // "huggingface", "ollama", "local"
    pub platform_token: Option<String>, // プラットフォーム認証トークン（Hugging Face Hub用）
    pub repo_id: Option<String>,  // リポジトリID（Hugging Face Hub用、例: "username/model-name"）
}

/// モデルを共有
/// Hugging Face Hub、Ollama Hub、またはローカルデータベースに保存
pub async fn share_model(config: ModelSharingConfig) -> Result<SharedModelInfo, AppError> {
    share_model_extended(ModelSharingConfigExtended {
        model_name: config.model_name,
        model_path: config.model_path,
        description: config.description,
        tags: config.tags,
        license: config.license,
        is_public: config.is_public,
        platform: None, // デフォルトはローカル
        platform_token: None,
        repo_id: None,
    })
    .await
}

/// モデルを共有（拡張版）
pub async fn share_model_extended(
    config: ModelSharingConfigExtended,
) -> Result<SharedModelInfo, AppError> {
    // モデル情報を検証
    if !PathBuf::from(&config.model_path).exists() {
        return Err(AppError::ApiError {
            message: "モデルファイルが見つかりません".to_string(),
            code: "FILE_NOT_FOUND".to_string(),
            source_detail: None,
        });
    }

    // プラットフォームが指定されている場合、そのプラットフォームにアップロード
    if let Some(platform) = &config.platform {
        match platform.as_str() {
            "huggingface" => {
                return upload_to_huggingface_hub(&config).await;
            }
            "ollama" => {
                // Ollama Hubは公式APIが提供されていないため、ローカルに保存
                // 将来的にOllama Hub APIが公開された場合、ここで実装
                return save_to_local_database(&config).await;
            }
            _ => {
                // その他のプラットフォームはローカルに保存
                return save_to_local_database(&config).await;
            }
        }
    }

    // プラットフォームが指定されていない場合はローカルデータベースに保存
    save_to_local_database(&config).await
}

/// Hugging Face Hubにモデルをアップロード
async fn upload_to_huggingface_hub(
    config: &ModelSharingConfigExtended,
) -> Result<SharedModelInfo, AppError> {
    // Hugging Face Hub APIへのアップロードには認証トークンが必要
    let token = config
        .platform_token
        .as_ref()
        .ok_or_else(|| AppError::ApiError {
            message: "Hugging Face Hubの認証トークンが必要です".to_string(),
            code: "TOKEN_REQUIRED".to_string(),
            source_detail: None,
        })?;

    // リポジトリIDを取得（指定されていない場合はモデル名から生成）
    let repo_id = config
        .repo_id
        .as_ref()
        .map(|s| s.as_str())
        .unwrap_or(&config.model_name);

    // リポジトリの作成（存在しない場合）
    let client = crate::utils::http_client::create_http_client()?;
    let create_repo_url = "https://huggingface.co/api/repos/create";

    let create_response = client
        .post(create_repo_url)
        .header("Authorization", &format!("Bearer {}", token))
        .json(&serde_json::json!({
            "name": repo_id,
            "type": "model"
        }))
        .send()
        .await
        .map_err(|e| AppError::ApiError {
            message: format!("Hugging Face Hub API接続エラー: {}", e),
            code: "API_ERROR".to_string(),
            source_detail: None,
        })?;

    let status = create_response.status();
    if !status.is_success() {
        let error_text = create_response.text().await.unwrap_or_else(|e| {
            eprintln!("[WARN] エラーレスポンスの本文を読み取れませんでした: {}", e);
            format!("レスポンス本文を読み取れませんでした: {}", e)
        });
        return Err(AppError::ApiError {
            message: format!("Hugging Face Hub APIエラー: {} - {}", status, error_text),
            code: status.as_str().to_string(),
            source_detail: None,
        });
    }

    // モデルファイルをアップロード
    let model_path = PathBuf::from(&config.model_path);
    if !model_path.exists() {
        return Err(AppError::ApiError {
            message: format!("モデルファイルが見つかりません: {}", config.model_path),
            code: "FILE_NOT_FOUND".to_string(),
            source_detail: None,
        });
    }

    // ファイルをアップロード
    upload_model_file_to_huggingface(&client, token, repo_id, &model_path).await?;

    // メタデータファイル（README、ライセンス等）をアップロード（オプション）
    if let Some(description) = &config.description {
        upload_readme_to_huggingface(
            &client,
            token,
            repo_id,
            description,
            &config.tags,
            &config.license,
        )
        .await?;
    }

    // モデル情報を取得して返す
    let model_info = crate::utils::huggingface::get_huggingface_model_info(repo_id)
        .await
        .map_err(|e| AppError::ApiError {
            message: format!("モデル情報取得エラー: {}", e),
            code: "MODEL_INFO_ERROR".to_string(),
            source_detail: None,
        })?;

    Ok(SharedModelInfo {
        id: format!("hf:{}", repo_id),
        name: config.model_name.clone(),
        author: model_info.author,
        description: config.description.clone(),
        tags: config.tags.clone(),
        download_count: model_info.downloads,
        rating: None,
        model_path: Some(config.model_path.clone()),
        platform: Some("huggingface".to_string()),
        license: config.license.clone(),
        is_public: config.is_public,
        created_at: chrono::Utc::now().to_rfc3339(),
        updated_at: chrono::Utc::now().to_rfc3339(),
    })
}

/// Hugging Face Hubにモデルファイルをアップロード
async fn upload_model_file_to_huggingface(
    client: &reqwest::Client,
    token: &str,
    repo_id: &str,
    model_path: &PathBuf,
) -> Result<(), AppError> {
    use std::fs::File;
    use std::io::Read;

    // ファイルを読み込む
    let mut file = File::open(model_path).map_err(|e| AppError::IoError {
        message: format!("ファイル読み込みエラー: {}", e),
        source_detail: None,
    })?;

    let mut file_data = Vec::new();
    file.read_to_end(&mut file_data)
        .map_err(|e| AppError::IoError {
            message: format!("ファイル読み込みエラー: {}", e),
            source_detail: None,
        })?;

    // ファイル名を取得
    let file_name = model_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("model.bin");

    // Hugging Face Hub APIにアップロード
    // 注意: Hugging Face HubのアップロードAPIは複雑で、LFS（Large File Storage）を使用する必要があります
    // 簡易実装として、直接アップロードを試みます
    let upload_url = format!("https://huggingface.co/api/models/{}/upload", repo_id);

    // multipart/form-dataでアップロード
    let form = reqwest::multipart::Form::new()
        .text("path", file_name.to_string())
        .part(
            "file",
            reqwest::multipart::Part::bytes(file_data)
                .file_name(file_name.to_string())
                .mime_str("application/octet-stream")
                .map_err(|e| AppError::ApiError {
                    message: format!("multipart作成エラー: {}", e),
                    code: "MULTIPART_ERROR".to_string(),
                    source_detail: None,
                })?,
        );

    let response = client
        .post(&upload_url)
        .header("Authorization", &format!("Bearer {}", token))
        .multipart(form)
        .send()
        .await
        .map_err(|e| AppError::ApiError {
            message: format!("アップロードリクエストエラー: {}", e),
            code: "UPLOAD_ERROR".to_string(),
            source_detail: None,
        })?;

    let status = response.status();
    if !status.is_success() {
        let error_text = response.text().await.unwrap_or_else(|e| {
            eprintln!("[WARN] エラーレスポンスの本文を読み取れませんでした: {}", e);
            format!("レスポンス本文を読み取れませんでした: {}", e)
        });
        return Err(AppError::ApiError {
            message: format!("ファイルアップロードエラー: HTTP {} - {}", status, error_text),
            code: status.as_str().to_string(),
            source_detail: Some(format!("Hugging Face Hubへのファイルアップロードに失敗しました。大容量ファイルの場合はLFS（Large File Storage）が必要な可能性があります。エラー詳細: {}", error_text)),
        });
    }

    eprintln!(
        "[INFO] モデルファイルのアップロードが完了しました: {}",
        file_name
    );
    Ok(())
}

/// Hugging Face HubにREADMEファイルをアップロード
async fn upload_readme_to_huggingface(
    client: &reqwest::Client,
    token: &str,
    repo_id: &str,
    description: &str,
    tags: &[String],
    license: &Option<String>,
) -> Result<(), AppError> {
    // README.mdの内容を生成
    let mut readme_content = format!("# {}\n\n", repo_id.split('/').last().unwrap_or(repo_id));
    readme_content.push_str(&format!("{}\n\n", description));

    if !tags.is_empty() {
        readme_content.push_str("## タグ\n\n");
        for tag in tags {
            readme_content.push_str(&format!("- {}\n", tag));
        }
        readme_content.push_str("\n");
    }

    if let Some(license_str) = license {
        readme_content.push_str(&format!("## ライセンス\n\n{}\n\n", license_str));
    }

    // README.mdをアップロード
    let upload_url = format!("https://huggingface.co/api/models/{}/upload", repo_id);

    let form = reqwest::multipart::Form::new()
        .text("path", "README.md")
        .part(
            "file",
            reqwest::multipart::Part::bytes(readme_content.into_bytes())
                .file_name("README.md")
                .mime_str("text/markdown")
                .map_err(|e| AppError::ApiError {
                    message: format!("multipart作成エラー: {}", e),
                    code: "MULTIPART_ERROR".to_string(),
                    source_detail: None,
                })?,
        );

    let response = client
        .post(&upload_url)
        .header("Authorization", &format!("Bearer {}", token))
        .multipart(form)
        .send()
        .await
        .map_err(|e| AppError::ApiError {
            message: format!("READMEアップロードリクエストエラー: {}", e),
            code: "UPLOAD_ERROR".to_string(),
            source_detail: None,
        })?;

    let status = response.status();
    if !status.is_success() {
        let error_text = response.text().await.unwrap_or_else(|e| {
            eprintln!("[WARN] エラーレスポンスの本文を読み取れませんでした: {}", e);
            format!("レスポンス本文を読み取れませんでした: {}", e)
        });
        eprintln!(
            "[WARN] READMEアップロードに失敗しましたが、処理を続行します: HTTP {} - {}",
            status, error_text
        );
        // READMEのアップロード失敗は致命的ではないため、警告のみ
    } else {
        eprintln!("[INFO] README.mdのアップロードが完了しました");
    }

    Ok(())
}

/// ローカルデータベースにモデル情報を保存
async fn save_to_local_database(
    config: &ModelSharingConfigExtended,
) -> Result<SharedModelInfo, AppError> {
    use crate::database::connection::get_connection;
    use chrono::Utc;
    use uuid::Uuid;

    let conn = get_connection().map_err(|e| AppError::DatabaseError {
        message: format!("データベース接続エラー: {}", e),
        source_detail: None,
    })?;

    // IDを生成
    let id = format!("local:{}", Uuid::new_v4().to_string());

    // タグをJSON形式に変換
    let tags_json = serde_json::to_string(&config.tags).map_err(|e| AppError::DatabaseError {
        message: format!("タグのJSON変換エラー: {}", e),
        source_detail: None,
    })?;

    // 現在時刻を取得
    let now = Utc::now().to_rfc3339();

    // モデル共有情報をデータベースに保存
    conn.execute(
        r#"
        INSERT INTO shared_models 
        (id, name, author, description, tags, download_count, rating, model_path, platform, license, is_public, created_at, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
        "#,
        {
            use rusqlite::params;
            params![
                id,
                config.model_name,
                "ユーザー", // 実際の実装ではユーザー情報を取得
                config.description,
                tags_json,
                0i64, // download_count
                None::<f64>, // rating
                config.model_path,
                "local",
                config.license,
                if config.is_public { 1 } else { 0 },
                &now, // clone()を避けるために参照を使用
                &now, // clone()を避けるために参照を使用
            ]
        }
    ).map_err(|e| AppError::DatabaseError {
        message: format!("モデル共有情報の保存エラー: {}", e),
        source_detail: None,
    })?;

    let shared_info = SharedModelInfo {
        id,
        name: config.model_name.clone(),
        author: "ユーザー".to_string(),
        description: config.description.clone(),
        tags: config.tags.clone(),
        download_count: 0,
        rating: None,
        model_path: Some(config.model_path.clone()),
        platform: Some("local".to_string()),
        license: config.license.clone(),
        is_public: config.is_public,
        created_at: now.clone(), // SharedModelInfoの所有権が必要なのでclone()が必要
        updated_at: now,         // 最後の使用なので所有権を移動
    };

    Ok(shared_info)
}

/// 共有モデルを検索
pub async fn search_shared_models(
    query: Option<String>,
    tags: Option<Vec<String>>,
    limit: Option<u32>,
) -> Result<Vec<SharedModelInfo>, AppError> {
    let limit_value = limit.unwrap_or(50);
    let mut results = Vec::new();

    // ローカルデータベースから検索
    let local_models =
        search_local_shared_models(query.as_deref(), tags.as_deref(), limit_value).await?;
    results.extend(local_models);

    // 検索クエリがある場合、Hugging Face Hub APIからも検索
    if let Some(query_str) = query {
        let hf_models = search_huggingface_models(&query_str, tags.as_deref(), limit_value).await?;
        results.extend(hf_models);
    }

    // 重複を除去（IDで）
    results.sort_by(|a, b| b.download_count.cmp(&a.download_count));
    results.dedup_by(|a, b| a.id == b.id);

    // 制限数まで返す
    results.truncate(limit_value as usize);

    Ok(results)
}

/// ローカルデータベースから共有モデルを検索
async fn search_local_shared_models(
    query: Option<&str>,
    tags: Option<&[String]>,
    limit: u32,
) -> Result<Vec<SharedModelInfo>, AppError> {
    use crate::database::connection::get_connection;

    let conn = get_connection().map_err(|e| AppError::DatabaseError {
        message: format!("データベース接続エラー: {}", e),
        source_detail: None,
    })?;

    // SQLクエリを構築（監査レポート推奨: クエリビルダーパターンの導入を検討）
    // 現時点では、可読性を向上させるため、条件構築を明確に分離
    let base_query = "SELECT id, name, author, description, tags, download_count, rating, model_path, platform, license, is_public, created_at, updated_at FROM shared_models";
    let mut conditions = Vec::new();
    let mut param_values: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    // クエリ条件を追加（名前・説明文での検索）
    if let Some(query_str) = query {
        if !query_str.is_empty() {
            conditions.push("(name LIKE ? OR description LIKE ?)".to_string());
            let query_pattern = format!("%{}%", query_str);
            // 同じパターンを2回使用するため、clone()は必要
            param_values.push(Box::new(query_pattern.clone()));
            param_values.push(Box::new(query_pattern));
        }
    }

    // タグ条件を追加（JSON配列として保存されているため、LIKE検索を使用）
    if let Some(tags_filter) = tags {
        if !tags_filter.is_empty() {
            for tag in tags_filter {
                conditions.push("tags LIKE ?".to_string());
                let tag_pattern = format!("%\"{}\"%", tag);
                param_values.push(Box::new(tag_pattern));
            }
        }
    }

    // WHERE句の構築
    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!(" WHERE {}", conditions.join(" AND "))
    };

    // 最終的なSQLクエリの構築
    let sql = format!(
        "{}{} ORDER BY download_count DESC LIMIT ?",
        base_query, where_clause
    );
    param_values.push(Box::new(limit as i64));

    // パラメータを参照のスライスに変換
    let param_refs: Vec<&dyn rusqlite::ToSql> = param_values
        .iter()
        .map(|p| p.as_ref() as &dyn rusqlite::ToSql)
        .collect();

    let mut stmt = conn.prepare(&sql).map_err(|e| AppError::DatabaseError {
        message: format!("SQL準備エラー: {}", e),
        source_detail: None,
    })?;

    let models: Vec<SharedModelInfo> = stmt
        .query_map(rusqlite::params_from_iter(param_refs), |row| {
            let tags_json: String = row.get(4)?;
            let tags: Vec<String> = serde_json::from_str(&tags_json).unwrap_or_else(|e| {
                eprintln!("[WARN] タグJSONのパースエラー: {} (JSON: {})", e, tags_json);
                Vec::new()
            });

            Ok(SharedModelInfo {
                id: format!("local:{}", row.get::<_, String>(0)?),
                name: row.get(1)?,
                author: row.get(2)?,
                description: row.get(3)?,
                tags,
                download_count: row.get(5)?,
                rating: row.get(6)?,
                model_path: row.get::<_, Option<String>>(7).ok().flatten(),
                platform: row.get::<_, Option<String>>(8).ok().flatten(),
                license: row.get::<_, Option<String>>(9).ok().flatten(),
                is_public: row.get::<_, i64>(10)? != 0,
                created_at: row.get(11)?,
                updated_at: row.get(12)?,
            })
        })
        .map_err(|e| AppError::DatabaseError {
            message: format!("データベース読み込みエラー: {}", e),
            source_detail: None,
        })?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| AppError::DatabaseError {
            message: format!("データベース読み込みエラー: {}", e),
            source_detail: None,
        })?;

    Ok(models)
}

/// Hugging Face Hubからモデルを検索
async fn search_huggingface_models(
    query: &str,
    tags: Option<&[String]>,
    limit: u32,
) -> Result<Vec<SharedModelInfo>, AppError> {
    // Hugging Face Hub APIを使用して検索
    let search_result = huggingface::search_huggingface_models(query, Some(limit)).await?;

    // HuggingFaceModelをSharedModelInfoに変換
    let shared_models: Vec<SharedModelInfo> = search_result
        .models
        .iter()
        .map(|hf_model| {
            // タグフィルタリング（指定されている場合）
            let mut model_tags = hf_model.tags.clone();
            if let Some(filter_tags) = tags {
                // 指定されたタグのいずれかが含まれているかチェック
                if !filter_tags.iter().any(|tag| model_tags.contains(tag)) {
                    return None;
                }
            }

            // タスクやパイプラインタグもタグに追加
            if let Some(ref task) = hf_model.task {
                model_tags.push(task.clone());
            }
            if let Some(ref pipeline) = hf_model.pipeline_tag {
                model_tags.push(pipeline.clone());
            }

            Some(SharedModelInfo {
                id: format!("hf:{}", hf_model.id),
                name: hf_model.id.clone(),
                author: hf_model.author.clone(),
                description: None, // HuggingFaceModelにはsummaryフィールドがない
                tags: model_tags,
                download_count: hf_model.downloads,
                rating: None,
                model_path: None,
                platform: Some("huggingface".to_string()),
                license: None, // HuggingFaceModelにはlicenseフィールドがない
                is_public: true,
                created_at: String::new(), // HuggingFaceModelにはcreated_atフィールドがない
                updated_at: String::new(), // HuggingFaceModelにはupdated_atフィールドがない
            })
        })
        .filter_map(|x| x)
        .collect();

    Ok(shared_models)
}

/// 共有モデルをダウンロード
pub async fn download_shared_model(
    model_id: &str,
    target_path: Option<PathBuf>,
) -> Result<PathBuf, AppError> {
    use crate::database::connection::get_app_data_dir;

    // モデルIDからプラットフォームを特定
    let (platform, model_name) = if model_id.starts_with("hf:") {
        ("huggingface", &model_id[3..])
    } else if model_id.starts_with("local:") {
        ("local", &model_id[6..])
    } else {
        return Err(AppError::ApiError {
            message: format!("不明なモデルID形式: {}", model_id),
            code: "INVALID_MODEL_ID".to_string(),
            source_detail: None,
        });
    };

    match platform {
        "huggingface" => {
            // Hugging Face Hubからダウンロード
            let app_data_dir = get_app_data_dir().map_err(|e| AppError::IoError {
                message: format!("アプリデータディレクトリ取得エラー: {}", e),
                source_detail: None,
            })?;

            let download_path = target_path.unwrap_or_else(|| {
                app_data_dir
                    .join("models")
                    .join(model_name.replace('/', "_"))
            });

            // ディレクトリを作成
            if let Some(parent) = download_path.parent() {
                std::fs::create_dir_all(parent).map_err(|e| AppError::IoError {
                    message: format!("ディレクトリ作成エラー: {}", e),
                    source_detail: None,
                })?;
            }

            // Hugging Face Hubからモデルファイルをダウンロード
            download_huggingface_model(model_name, &download_path).await?;

            Ok(download_path)
        }
        "local" => {
            // ローカルデータベースからモデル情報を取得
            use crate::database::connection::get_connection;

            let conn = get_connection().map_err(|e| AppError::DatabaseError {
                message: format!("データベース接続エラー: {}", e),
                source_detail: None,
            })?;

            use rusqlite::params;
            let model_path: Option<String> = conn
                .query_row(
                    "SELECT model_path FROM shared_models WHERE id = ?1",
                    params![model_name],
                    |row| row.get(0),
                )
                .map_err(|e| AppError::DatabaseError {
                    message: format!("モデル情報取得エラー: {}", e),
                    source_detail: None,
                })?;

            if let Some(path_str) = model_path {
                let path = PathBuf::from(&path_str);
                if path.exists() {
                    Ok(path)
                } else {
                    Err(AppError::IoError {
                        message: format!("モデルファイルが見つかりません: {}", path_str),
                        source_detail: None,
                    })
                }
            } else {
                Err(AppError::ApiError {
                    message: format!("モデルID '{}' が見つかりません", model_id),
                    code: "MODEL_NOT_FOUND".to_string(),
                    source_detail: None,
                })
            }
        }
        _ => Err(AppError::ApiError {
            message: format!("不明なプラットフォーム: {}", platform),
            code: "UNKNOWN_PLATFORM".to_string(),
            source_detail: None,
        }),
    }
}

/// Hugging Face Hubからモデルファイルをダウンロード
async fn download_huggingface_model(model_id: &str, target_dir: &PathBuf) -> Result<(), AppError> {
    use futures_util::StreamExt;
    use std::fs::File;
    use std::io::Write;

    let client = crate::utils::http_client::create_http_client()?;

    // 1. モデルのファイルリストを取得
    let files_url = format!("https://huggingface.co/api/models/{}/tree/main", model_id);
    let response = client
        .get(&files_url)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| AppError::ApiError {
            message: format!("Hugging Face Hub APIリクエストエラー: {}", e),
            code: "API_ERROR".to_string(),
            source_detail: None,
        })?;

    let status = response.status();
    if !status.is_success() {
        let error_text = response.text().await.unwrap_or_else(|e| {
            eprintln!("[WARN] エラーレスポンスの本文を読み取れませんでした: {}", e);
            format!("レスポンス本文を読み取れませんでした: {}", e)
        });
        return Err(AppError::ApiError {
            message: format!("Hugging Face Hub APIエラー: {} - {}", status, error_text),
            code: status.as_str().to_string(),
            source_detail: None,
        });
    }

    let files_json: serde_json::Value = response.json().await.map_err(|e| AppError::ApiError {
        message: format!("JSON解析エラー: {}", e),
        code: "JSON_ERROR".to_string(),
        source_detail: None,
    })?;

    // 2. ファイルリストを解析
    let files: Vec<String> = if let Some(files_array) = files_json.as_array() {
        files_array
            .iter()
            .filter_map(|item| {
                if let Some(file_path) = item.get("path").and_then(|p| p.as_str()) {
                    // 重要なファイルのみをダウンロード（.safetensors, .bin, config.json, tokenizer.json等）
                    if file_path.ends_with(".safetensors")
                        || file_path.ends_with(".bin")
                        || file_path == "config.json"
                        || file_path == "tokenizer.json"
                        || file_path == "tokenizer_config.json"
                        || file_path == "model_index.json"
                        || file_path.ends_with(".json") && file_path.contains("config")
                    {
                        Some(file_path.to_string())
                    } else {
                        None
                    }
                } else {
                    None
                }
            })
            .collect()
    } else {
        // ファイルリストが取得できない場合、主要なファイルを直接ダウンロードを試みる
        vec![
            "config.json".to_string(),
            "model.safetensors".to_string(),
            "tokenizer.json".to_string(),
        ]
    };

    if files.is_empty() {
        return Err(AppError::ApiError {
            message: format!(
                "モデル '{}' のダウンロード可能なファイルが見つかりません",
                model_id
            ),
            code: "NO_FILES_FOUND".to_string(),
            source_detail: None,
        });
    }

    // 3. 各ファイルをダウンロード
    let total_files = files.len();
    for (index, file_path) in files.iter().enumerate() {
        let file_url = format!(
            "https://huggingface.co/{}/resolve/main/{}",
            model_id, file_path
        );
        let file_path_buf = target_dir.join(file_path);

        // ディレクトリを作成
        if let Some(parent) = file_path_buf.parent() {
            std::fs::create_dir_all(parent).map_err(|e| AppError::IoError {
                message: format!("ディレクトリ作成エラー: {}", e),
                source_detail: None,
            })?;
        }

        // ファイルをダウンロード
        eprintln!(
            "[INFO] ファイルをダウンロード中 ({}/{}): {}",
            index + 1,
            total_files,
            file_path
        );

        let file_response = client
            .get(&file_url)
            .send()
            .await
            .map_err(|e| AppError::ApiError {
                message: format!("ファイルダウンロードエラー ({}): {}", file_path, e),
                code: "DOWNLOAD_ERROR".to_string(),
                source_detail: None,
            })?;

        let file_status = file_response.status();
        if !file_status.is_success() {
            let error_text = file_response.text().await.unwrap_or_else(|e| {
                eprintln!("[WARN] エラーレスポンスの本文を読み取れませんでした: {}", e);
                format!("レスポンス本文を読み取れませんでした: {}", e)
            });
            return Err(AppError::ApiError {
                message: format!(
                    "ファイルダウンロードエラー ({}): HTTP {} - {}",
                    file_path, file_status, error_text
                ),
                code: file_status.as_str().to_string(),
                source_detail: None,
            });
        }

        // ストリーミングダウンロード
        let mut file = File::create(&file_path_buf).map_err(|e| AppError::IoError {
            message: format!("ファイル作成エラー ({}): {}", file_path, e),
            source_detail: None,
        })?;

        let mut stream = file_response.bytes_stream();
        while let Some(chunk_result) = stream.next().await {
            let chunk = chunk_result.map_err(|e| AppError::IoError {
                message: format!("ダウンロードストリームエラー ({}): {}", file_path, e),
                source_detail: None,
            })?;

            file.write_all(&chunk).map_err(|e| AppError::IoError {
                message: format!("ファイル書き込みエラー ({}): {}", file_path, e),
                source_detail: None,
            })?;
        }

        eprintln!("[INFO] ファイルダウンロード完了: {}", file_path);
    }

    eprintln!(
        "[INFO] モデル '{}' のダウンロードが完了しました: {}",
        model_id,
        target_dir.to_string_lossy()
    );
    Ok(())
}
