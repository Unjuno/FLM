// Model Search Commands
// 複数エンジン対応のモデル検索機能

use crate::engines::manager::EngineManager;
use serde::{Deserialize, Serialize};

/// Ollama Library APIから取得したモデル情報
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LibraryModelInfo {
    pub name: String,
    pub description: Option<String>,
    pub size: Option<u64>,
    pub parameters: Option<String>,
    pub category: Option<String>,
    pub recommended: bool,
    pub author: Option<String>,
    pub license: Option<String>,
    pub tags: Option<Vec<String>>,
    pub downloads: Option<u64>,
    pub updated_at: Option<String>,
}

/// 複数エンジン対応のモデル検索
#[tauri::command]
pub async fn search_models(
    engine_type: Option<String>,
    query: Option<String>,
    category: Option<String>,
    limit: Option<u32>,
) -> Result<Vec<LibraryModelInfo>, String> {
    let engine = engine_type.as_deref().unwrap_or("ollama");
    
    match engine {
        "ollama" => search_ollama_models(query, category, limit).await,
        "lm_studio" => search_lm_studio_models(query, category, limit).await,
        "vllm" => search_vllm_models(query, category, limit).await,
        "llama_cpp" => search_llama_cpp_models(query, category, limit).await,
        _ => Err(format!("不明なエンジンタイプ: {}", engine)),
    }
}

/// Ollama Library APIからモデルを検索（後方互換性のため残す）
#[tauri::command]
pub async fn search_ollama_library_models(
    query: Option<String>,
    category: Option<String>,
    limit: Option<u32>,
) -> Result<Vec<LibraryModelInfo>, String> {
    search_ollama_models(query, category, limit).await
}

/// Ollamaモデルを検索
async fn search_ollama_models(
    query: Option<String>,
    category: Option<String>,
    limit: Option<u32>,
) -> Result<Vec<LibraryModelInfo>, String> {
    // Ollama Library APIのエンドポイント
    // 注意: Ollama公式には公開APIがないため、ollama.com/libraryから情報を取得
    // または、ローカルのモデルカタログデータを使用
    // ここでは、ローカルのモデルカタログデータから検索する実装を提供
    
    // デフォルトのモデルカタログから取得
    let catalog_models = crate::utils::model_catalog_data::get_predefined_model_catalog();
    
    let mut results: Vec<LibraryModelInfo> = catalog_models
        .iter()
        .map(|m| {
            LibraryModelInfo {
                name: m.name.clone(),
                description: m.description.clone(),
                size: m.size.and_then(|s| if s >= 0 { Some(s as u64) } else { None }),
                parameters: m.parameters.map(|p| format!("{}B", p / 1_000_000_000)),
                category: m.category.clone(),
                recommended: m.recommended,
                author: m.author.clone(),
                license: m.license.clone(),
                tags: m.tags.as_ref().and_then(|t| {
                    serde_json::from_str::<Vec<String>>(t).ok()
                }),
                downloads: None,
                updated_at: Some(m.updated_at.to_rfc3339()),
            }
        })
        .collect();

    // クエリでフィルタリング
    if let Some(q) = query {
        let query_lower = q.to_lowercase();
        results.retain(|m| {
            m.name.to_lowercase().contains(&query_lower)
                || m.description.as_ref()
                    .map(|d| d.to_lowercase().contains(&query_lower))
                    .unwrap_or(false)
                || m.author.as_ref()
                    .map(|a| a.to_lowercase().contains(&query_lower))
                    .unwrap_or(false)
        });
    }

    // カテゴリでフィルタリング
    if let Some(cat) = category {
        if cat != "all" {
            results.retain(|m| {
                m.category.as_ref()
                    .map(|c| c == &cat)
                    .unwrap_or(false)
            });
        }
    }

    // ソート（推奨モデルを優先、その後名前順）
    results.sort_by(|a, b| {
        match (a.recommended, b.recommended) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.cmp(&b.name),
        }
    });

    // リミット適用
    if let Some(limit) = limit {
        results.truncate(limit as usize);
    }

    Ok(results)
}

/// LM Studioモデルを検索
async fn search_lm_studio_models(
    query: Option<String>,
    category: Option<String>,
    limit: Option<u32>,
) -> Result<Vec<LibraryModelInfo>, String> {
    // EngineManagerを使用してモデル一覧を取得
    let manager = EngineManager::new();
    match manager.get_engine_models("lm_studio").await {
        Ok(installed_models) => {
            let mut results: Vec<LibraryModelInfo> = installed_models
                .iter()
                .map(|m| {
                    LibraryModelInfo {
                        name: m.name.clone(),
                        description: Some(format!("LM Studioにインストール済み: {}", m.name)),
                        size: m.size,
                        parameters: m.parameter_size.clone(),
                        category: None,
                        recommended: false,
                        author: None,
                        license: None,
                        tags: None,
                        downloads: None,
                        updated_at: m.modified_at.clone(),
                    }
                })
                .collect();
            
            // クエリでフィルタリング
            if let Some(q) = query {
                let query_lower = q.to_lowercase();
                results.retain(|m| {
                    m.name.to_lowercase().contains(&query_lower)
                        || m.description.as_ref()
                            .map(|d| d.to_lowercase().contains(&query_lower))
                            .unwrap_or(false)
                });
            }
            
            // リミット適用
            if let Some(limit) = limit {
                results.truncate(limit as usize);
            }
            
            Ok(results)
        }
        Err(_) => {
            // LM Studioが実行されていない場合、カタログデータから検索
            // LM StudioもOllama形式のモデルをサポート
            search_ollama_models(query, category, limit).await
        }
    }
}

/// vLLMモデルを検索
async fn search_vllm_models(
    query: Option<String>,
    category: Option<String>,
    limit: Option<u32>,
) -> Result<Vec<LibraryModelInfo>, String> {
    // EngineManagerを使用してモデル一覧を取得
    let manager = EngineManager::new();
    match manager.get_engine_models("vllm").await {
        Ok(installed_models) => {
            let mut results: Vec<LibraryModelInfo> = installed_models
                .iter()
                .map(|m| {
                    LibraryModelInfo {
                        name: m.name.clone(),
                        description: Some(format!("vLLMで利用可能: {}", m.name)),
                        size: m.size,
                        parameters: m.parameter_size.clone(),
                        category: None,
                        recommended: false,
                        author: None,
                        license: None,
                        tags: None,
                        downloads: None,
                        updated_at: m.modified_at.clone(),
                    }
                })
                .collect();
            
            // クエリでフィルタリング
            if let Some(q) = query {
                let query_lower = q.to_lowercase();
                results.retain(|m| {
                    m.name.to_lowercase().contains(&query_lower)
                        || m.description.as_ref()
                            .map(|d| d.to_lowercase().contains(&query_lower))
                            .unwrap_or(false)
                });
            }
            
            // リミット適用
            if let Some(limit) = limit {
                results.truncate(limit as usize);
            }
            
            Ok(results)
        }
        Err(_) => {
            // vLLMが実行されていない場合、カタログデータから検索
            // vLLMもOllama形式のモデルをサポート
            search_ollama_models(query, category, limit).await
        }
    }
}

/// llama.cppモデルを検索
async fn search_llama_cpp_models(
    query: Option<String>,
    category: Option<String>,
    limit: Option<u32>,
) -> Result<Vec<LibraryModelInfo>, String> {
    // EngineManagerを使用してモデル一覧を取得
    let manager = EngineManager::new();
    match manager.get_engine_models("llama_cpp").await {
        Ok(installed_models) => {
            let mut results: Vec<LibraryModelInfo> = installed_models
                .iter()
                .map(|m| {
                    LibraryModelInfo {
                        name: m.name.clone(),
                        description: Some(format!("llama.cppで利用可能: {}", m.name)),
                        size: m.size,
                        parameters: m.parameter_size.clone(),
                        category: None,
                        recommended: false,
                        author: None,
                        license: None,
                        tags: None,
                        downloads: None,
                        updated_at: m.modified_at.clone(),
                    }
                })
                .collect();
            
            // クエリでフィルタリング
            if let Some(q) = query {
                let query_lower = q.to_lowercase();
                results.retain(|m| {
                    m.name.to_lowercase().contains(&query_lower)
                        || m.description.as_ref()
                            .map(|d| d.to_lowercase().contains(&query_lower))
                            .unwrap_or(false)
                });
            }
            
            // リミット適用
            if let Some(limit) = limit {
                results.truncate(limit as usize);
            }
            
            Ok(results)
        }
        Err(_) => {
            // llama.cppが実行されていない場合、カタログデータから検索
            // llama.cppもOllama形式のモデルをサポート
            search_ollama_models(query, category, limit).await
        }
    }
}

/// モデルの詳細情報を取得
#[tauri::command]
pub async fn get_model_details(
    _engine_type: Option<String>,
    model_name: String,
) -> Result<LibraryModelInfo, String> {
    // 現在はOllamaカタログから取得（将来的にエンジン別の詳細情報を取得可能にする）
    let catalog_models = crate::utils::model_catalog_data::get_predefined_model_catalog();
    
    catalog_models
        .iter()
        .find(|m| m.name == model_name)
        .map(|m| {
            Ok(LibraryModelInfo {
                name: m.name.clone(),
                description: m.description.clone(),
                size: m.size.and_then(|s| if s >= 0 { Some(s as u64) } else { None }),
                parameters: m.parameters.map(|p| format!("{}B", p / 1_000_000_000)),
                category: m.category.clone(),
                recommended: m.recommended,
                author: m.author.clone(),
                license: m.license.clone(),
                tags: m.tags.as_ref().and_then(|t| {
                    serde_json::from_str::<Vec<String>>(t).ok()
                }),
                downloads: None,
                updated_at: Some(m.updated_at.to_rfc3339()),
            })
        })
        .unwrap_or_else(|| {
            Err(format!("モデル「{}」が見つかりませんでした", model_name))
        })
}

