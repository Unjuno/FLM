// システムリソースチェックコマンド

use serde::{Deserialize, Serialize};
use sysinfo::{System, SystemExt, CpuExt, DiskExt};

/// システムリソース情報
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SystemResources {
    /// 合計メモリ（バイト）
    pub total_memory: u64,
    /// 使用可能メモリ（バイト）
    pub available_memory: u64,
    /// CPUコア数
    pub cpu_cores: usize,
    /// CPU使用率（0.0-100.0）
    pub cpu_usage: f32,
    /// ディスク容量（バイト）
    pub total_disk: u64,
    /// 利用可能ディスク容量（バイト）
    pub available_disk: u64,
    /// システムリソースレベル評価（"low" | "medium" | "high" | "very_high"）
    pub resource_level: String,
}

/// システムリソース情報取得コマンド
#[tauri::command]
pub async fn get_system_resources() -> Result<SystemResources, String> {
    let mut system = System::new_all();
    system.refresh_memory();
    system.refresh_disks_list();
    system.refresh_disks();
    
    // メモリ情報を取得
    let total_memory = system.total_memory();
    let available_memory = system.available_memory();
    
    // CPU情報を取得
    let cpu_cores = system.cpus().len();
    let cpu_usage = if !system.cpus().is_empty() {
        // CPU使用率を計算（1秒待機してから再計算）
        system.refresh_cpu();
        std::thread::sleep(std::time::Duration::from_millis(100));
        system.refresh_cpu();
        
        let usage_sum: f32 = system.cpus().iter().map(|cpu| cpu.cpu_usage()).sum();
        usage_sum / cpu_cores as f32
    } else {
        0.0
    };
    
    // ディスク情報を取得
    let mut total_disk = 0u64;
    let mut available_disk = 0u64;
    
    for disk in system.disks() {
        total_disk += disk.total_space();
        available_disk += disk.available_space();
    }
    
    // リソースレベルを評価
    let resource_level = evaluate_resource_level(
        total_memory,
        available_memory,
        cpu_cores,
        total_disk,
        available_disk,
    );
    
    Ok(SystemResources {
        total_memory,
        available_memory,
        cpu_cores,
        cpu_usage,
        total_disk,
        available_disk,
        resource_level,
    })
}

/// システムリソースレベルを評価
fn evaluate_resource_level(
    total_memory: u64,
    _available_memory: u64,
    cpu_cores: usize,
    _total_disk: u64,
    available_disk: u64,
) -> String {
    // リソースレベルを評価
    // メモリ: 8GB以上 = high, 4GB以上 = medium, それ以下 = low
    // CPU: 8コア以上 = high, 4コア以上 = medium, それ以下 = low
    // ディスク: 100GB以上空き = high, 50GB以上 = medium, それ以下 = low
    
    let memory_gb = total_memory as f64 / (1024.0 * 1024.0 * 1024.0);
    let cpu_score = if cpu_cores >= 8 {
        3
    } else if cpu_cores >= 4 {
        2
    } else {
        1
    };
    
    let memory_score = if memory_gb >= 16.0 {
        3
    } else if memory_gb >= 8.0 {
        2
    } else if memory_gb >= 4.0 {
        1
    } else {
        0
    };
    
    let disk_gb_available = available_disk as f64 / (1024.0 * 1024.0 * 1024.0);
    let disk_score = if disk_gb_available >= 100.0 {
        3
    } else if disk_gb_available >= 50.0 {
        2
    } else if disk_gb_available >= 20.0 {
        1
    } else {
        0
    };
    
    // 総合スコア（0-9）
    let total_score = cpu_score + memory_score + disk_score;
    
    if total_score >= 7 {
        "very_high"
    } else if total_score >= 5 {
        "high"
    } else if total_score >= 3 {
        "medium"
    } else {
        "low"
    }
    .to_string()
}

/// モデル提案情報
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModelRecommendation {
    /// 推奨モデル名
    pub recommended_model: String,
    /// 推奨理由
    pub reason: String,
    /// 代替モデルリスト
    pub alternatives: Vec<String>,
    /// 用途別推奨モデル
    pub use_case_recommendations: Vec<UseCaseRecommendation>,
}

/// 用途別推奨モデル
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UseCaseRecommendation {
    /// 用途（"chat" | "code" | "translation" | "general"）
    pub use_case: String,
    /// 推奨モデル名
    pub model: String,
    /// 推奨理由
    pub reason: String,
}

/// システムリソースに基づくモデル提案を取得
#[tauri::command]
pub async fn get_model_recommendation() -> Result<ModelRecommendation, String> {
    let resources = get_system_resources().await?;
    
    // リソースレベルに基づいてモデルを提案
    let (recommended_model, reason, alternatives) = match resources.resource_level.as_str() {
        "very_high" => {
            (
                "llama3.1:70b".to_string(),
                "高性能システム向け。大規模モデル（70B）が実行可能です。高品質な生成が期待できます。".to_string(),
                vec!["llama3:70b".to_string(), "mistral:large".to_string(), "codellama:34b".to_string()],
            )
        }
        "high" => {
            (
                "llama3.2:3b".to_string(),
                "中高性能システム向け。バランスの取れたモデル（3B-8B）が推奨されます。".to_string(),
                vec!["llama3:8b".to_string(), "mistral:7b".to_string(), "codellama:13b".to_string()],
            )
        }
        "medium" => {
            (
                "llama3.2:1b".to_string(),
                "中程度のシステム向け。軽量モデル（1B-3B）が推奨されます。".to_string(),
                vec!["llama3:8b".to_string(), "phi3:mini".to_string(), "mistral:7b".to_string()],
            )
        }
        _ => {
            (
                "phi3:mini".to_string(),
                "低リソースシステム向け。最小限のモデル（1B以下）が推奨されます。".to_string(),
                vec!["llama3.2:1b".to_string(), "gemma:2b".to_string()],
            )
        }
    };
    
    // 用途別推奨モデル
    let use_case_recommendations = match resources.resource_level.as_str() {
        "very_high" | "high" => vec![
            UseCaseRecommendation {
                use_case: "chat".to_string(),
                model: "llama3.2:3b".to_string(),
                reason: "会話型AIに最適。自然な応答が可能です。".to_string(),
            },
            UseCaseRecommendation {
                use_case: "code".to_string(),
                model: "codellama:13b".to_string(),
                reason: "コード生成に特化。高品質なコード生成が可能です。".to_string(),
            },
            UseCaseRecommendation {
                use_case: "translation".to_string(),
                model: "mistral:7b".to_string(),
                reason: "多言語対応。翻訳タスクに優れています。".to_string(),
            },
            UseCaseRecommendation {
                use_case: "general".to_string(),
                model: "llama3:8b".to_string(),
                reason: "汎用的な用途に最適。様々なタスクに対応できます。".to_string(),
            },
        ],
        "medium" => vec![
            UseCaseRecommendation {
                use_case: "chat".to_string(),
                model: "llama3.2:1b".to_string(),
                reason: "軽量で高速。基本的な会話に対応できます。".to_string(),
            },
            UseCaseRecommendation {
                use_case: "code".to_string(),
                model: "codellama:7b".to_string(),
                reason: "コード生成に対応。中規模のコード生成が可能です。".to_string(),
            },
            UseCaseRecommendation {
                use_case: "translation".to_string(),
                model: "mistral:7b".to_string(),
                reason: "翻訳機能を利用できます。".to_string(),
            },
            UseCaseRecommendation {
                use_case: "general".to_string(),
                model: "llama3.2:1b".to_string(),
                reason: "汎用的な用途に最適。軽量で動作します。".to_string(),
            },
        ],
        _ => vec![
            UseCaseRecommendation {
                use_case: "chat".to_string(),
                model: "phi3:mini".to_string(),
                reason: "最小限のリソースで動作。基本的な会話に対応します。".to_string(),
            },
            UseCaseRecommendation {
                use_case: "code".to_string(),
                model: "codellama:7b".to_string(),
                reason: "最小限のリソースでコード生成が可能です。".to_string(),
            },
            UseCaseRecommendation {
                use_case: "translation".to_string(),
                model: "phi3:mini".to_string(),
                reason: "基本的な翻訳機能を利用できます。".to_string(),
            },
            UseCaseRecommendation {
                use_case: "general".to_string(),
                model: "phi3:mini".to_string(),
                reason: "低リソースで動作します。".to_string(),
            },
        ],
    };
    
    Ok(ModelRecommendation {
        recommended_model,
        reason,
        alternatives,
        use_case_recommendations,
    })
}

