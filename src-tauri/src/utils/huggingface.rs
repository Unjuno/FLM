// Hugging Face Integration Module
// Hugging Face APIとの統合によるカスタムモデル対応

use crate::utils::error::AppError;
use serde::{Deserialize, Serialize};

/// Hugging Faceモデル情報
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HuggingFaceModel {
    pub id: String,
    pub author: String,
    pub downloads: i64,
    pub likes: i64,
    pub tags: Vec<String>,
    pub model_index: Option<String>, // model_index.jsonのパス
    pub pipeline_tag: Option<String>, // パイプラインタイプ（text-generation, conversational等）
    pub library_name: Option<String>, // ライブラリ名（transformers等）
    pub task: Option<String>, // タスク（text-generation, question-answering等）
}

/// Hugging Faceモデル検索結果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HuggingFaceSearchResult {
    pub models: Vec<HuggingFaceModel>,
    pub total: i64,
}

/// Hugging Face APIからモデルを検索
pub async fn search_huggingface_models(
    query: &str,
    limit: Option<u32>,
) -> Result<HuggingFaceSearchResult, AppError> {
    let limit = limit.unwrap_or(20);
    let client = reqwest::Client::new();
    
    // Hugging Face APIで検索
    // URLエンコーディング（手動実装）
    let encoded_query: String = query.chars().map(|c| {
        match c {
            ' ' => "+".to_string(),
            c if c.is_alphanumeric() || ".-_".contains(c) => c.to_string(),
            _ => format!("%{:02X}", c as u8),
        }
    }).collect();
    
    let url = format!(
        "https://huggingface.co/api/models?search={}&limit={}&sort=downloads",
        encoded_query,
        limit
    );
    
    let response = client
        .get(&url)
        .header("User-Agent", "FLM/1.0")
        .send()
        .await
        .map_err(|e| AppError::ApiError {
            message: format!("Hugging Face API接続エラー: {}", e),
            code: "API_ERROR".to_string(),
        })?;

    if !response.status().is_success() {
        return Err(AppError::ApiError {
            message: format!("Hugging Face APIエラー: HTTP {}", response.status()),
            code: response.status().as_str().to_string(),
        });
    }

    let models: Vec<serde_json::Value> = response.json().await
        .map_err(|e| AppError::ApiError {
            message: format!("JSON解析エラー: {}", e),
            code: "JSON_ERROR".to_string(),
        })?;

    let huggingface_models: Vec<HuggingFaceModel> = models.iter()
        .map(|m| {
            HuggingFaceModel {
                id: m["id"].as_str().unwrap_or("").to_string(),
                author: m["author"].as_str().unwrap_or("").to_string(),
                downloads: m["downloads"].as_i64().unwrap_or(0),
                likes: m["likes"].as_i64().unwrap_or(0),
                tags: m["tags"].as_array()
                    .map(|arr| arr.iter()
                        .filter_map(|v| v.as_str().map(|s| s.to_string()))
                        .collect())
                    .unwrap_or_default(),
                model_index: m["model_index"].as_str().map(|s| s.to_string()),
                pipeline_tag: m["pipeline_tag"].as_str().map(|s| s.to_string()),
                library_name: m["library_name"].as_str().map(|s| s.to_string()),
                task: m["task"].as_str().map(|s| s.to_string()),
            }
        })
        .collect();

    Ok(HuggingFaceSearchResult {
        total: huggingface_models.len() as i64,
        models: huggingface_models,
    })
}

/// Hugging Faceモデルの詳細情報を取得
pub async fn get_huggingface_model_info(model_id: &str) -> Result<HuggingFaceModel, AppError> {
    let client = reqwest::Client::new();
    
    let url = format!("https://huggingface.co/api/models/{}", model_id);
    
    let response = client
        .get(&url)
        .header("User-Agent", "FLM/1.0")
        .send()
        .await
        .map_err(|e| AppError::ApiError {
            message: format!("Hugging Face API接続エラー: {}", e),
            code: "API_ERROR".to_string(),
        })?;

    if !response.status().is_success() {
        return Err(AppError::ApiError {
            message: format!("Hugging Face APIエラー: HTTP {}", response.status()),
            code: response.status().as_str().to_string(),
        });
    }

    let json: serde_json::Value = response.json().await
        .map_err(|e| AppError::ApiError {
            message: format!("JSON解析エラー: {}", e),
            code: "JSON_ERROR".to_string(),
        })?;

    Ok(HuggingFaceModel {
        id: json["id"].as_str().unwrap_or("").to_string(),
        author: json["author"].as_str().unwrap_or("").to_string(),
        downloads: json["downloads"].as_i64().unwrap_or(0),
        likes: json["likes"].as_i64().unwrap_or(0),
        tags: json["tags"].as_array()
            .map(|arr| arr.iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect())
            .unwrap_or_default(),
        model_index: json["model_index"].as_str().map(|s| s.to_string()),
        pipeline_tag: json["pipeline_tag"].as_str().map(|s| s.to_string()),
        library_name: json["library_name"].as_str().map(|s| s.to_string()),
        task: json["task"].as_str().map(|s| s.to_string()),
    })
}

