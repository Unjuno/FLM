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
    pub model_index: Option<String>,  // model_index.jsonのパス
    pub pipeline_tag: Option<String>, // パイプラインタイプ（text-generation, conversational等）
    pub library_name: Option<String>, // ライブラリ名（transformers等）
    pub task: Option<String>,         // タスク（text-generation, question-answering等）
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
    let client = crate::utils::http_client::create_http_client()?;

    // Hugging Face APIで検索
    // URLエンコーディング（手動実装）
    let encoded_query: String = query
        .chars()
        .map(|c| match c {
            ' ' => "+".to_string(),
            c if c.is_alphanumeric() || ".-_".contains(c) => c.to_string(),
            _ => format!("%{:02X}", c as u8),
        })
        .collect();

    let url = format!(
        "https://huggingface.co/api/models?search={}&limit={}",
        encoded_query, limit
    );

    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| AppError::ApiError {
            message: format!("Hugging Face APIリクエストエラー: {}", e),
            code: "API_ERROR".to_string(),
            source_detail: None,
        })?;

    if !response.status().is_success() {
        return Err(AppError::ApiError {
            message: format!("Hugging Face APIエラー: {}", response.status()),
            code: response.status().as_str().to_string(),
            source_detail: None,
        });
    }

    let json: serde_json::Value = response.json().await.map_err(|e| AppError::ApiError {
        message: format!("JSON解析エラー: {}", e),
        code: "JSON_ERROR".to_string(),
        source_detail: None,
    })?;

    let models: Vec<HuggingFaceModel> = json
        .as_array()
        .unwrap_or(&vec![])
        .iter()
        .take(limit as usize)
        .map(|item| HuggingFaceModel {
            id: item["id"].as_str().unwrap_or("").to_string(),
            author: item["author"].as_str().unwrap_or("").to_string(),
            downloads: item["downloads"].as_i64().unwrap_or(0),
            likes: item["likes"].as_i64().unwrap_or(0),
            tags: item["tags"]
                .as_array()
                .map(|arr| {
                    arr.iter()
                        .filter_map(|v| v.as_str().map(|s| s.to_string()))
                        .collect()
                })
                .unwrap_or_default(),
            model_index: item["model_index"].as_str().map(|s| s.to_string()),
            pipeline_tag: item["pipeline_tag"].as_str().map(|s| s.to_string()),
            library_name: item["library_name"].as_str().map(|s| s.to_string()),
            task: item["task"].as_str().map(|s| s.to_string()),
        })
        .collect();

    Ok(HuggingFaceSearchResult {
        models,
        total: json.as_array().map(|arr| arr.len() as i64).unwrap_or(0),
    })
}

/// Hugging Faceモデル情報を取得
pub async fn get_huggingface_model_info(model_id: &str) -> Result<HuggingFaceModel, AppError> {
    let client = crate::utils::http_client::create_http_client()?;
    let url = format!("https://huggingface.co/api/models/{}", model_id);

    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| AppError::ApiError {
            message: format!("Hugging Face APIリクエストエラー: {}", e),
            code: "API_ERROR".to_string(),
            source_detail: None,
        })?;

    if !response.status().is_success() {
        return Err(AppError::ApiError {
            message: format!("Hugging Face APIエラー: {}", response.status()),
            code: response.status().as_str().to_string(),
            source_detail: None,
        });
    }

    let item: serde_json::Value = response.json().await.map_err(|e| AppError::ApiError {
        message: format!("JSON解析エラー: {}", e),
        code: "JSON_ERROR".to_string(),
        source_detail: None,
    })?;

    Ok(HuggingFaceModel {
        id: item["id"].as_str().unwrap_or("").to_string(),
        author: item["author"].as_str().unwrap_or("").to_string(),
        downloads: item["downloads"].as_i64().unwrap_or(0),
        likes: item["likes"].as_i64().unwrap_or(0),
        tags: item["tags"]
            .as_array()
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                    .collect()
            })
            .unwrap_or_default(),
        model_index: item["model_index"].as_str().map(|s| s.to_string()),
        pipeline_tag: item["pipeline_tag"].as_str().map(|s| s.to_string()),
        library_name: item["library_name"].as_str().map(|s| s.to_string()),
        task: item["task"].as_str().map(|s| s.to_string()),
    })
}
