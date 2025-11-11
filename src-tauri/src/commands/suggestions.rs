// 提案機能コマンド

use crate::commands::system::SystemResources;
use crate::database::connection::get_connection;
use crate::database::repository::ApiRepository;
use serde::{Deserialize, Serialize};

/// API名生成結果
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ApiNameSuggestion {
    /// 推奨API名
    pub suggested_name: String,
    /// 代替API名のリスト
    pub alternatives: Vec<String>,
    /// 元の名前が使用可能かどうか
    pub is_available: bool,
}

/// API名の自動生成と重複チェック
#[tauri::command]
pub async fn suggest_api_name(base_name: Option<String>) -> Result<ApiNameSuggestion, String> {
    let conn = get_connection().map_err(|_| {
        "データの読み込みに失敗しました。アプリを再起動して再度お試しください。".to_string()
    })?;

    let api_repo = ApiRepository::new(&conn);
    let base = base_name.unwrap_or_else(|| "LocalAI API".to_string());

    // まず、元の名前が使用可能かチェック
    let is_available = match api_repo.find_by_name(&base) {
        Ok(::std::option::Option::None) => true,
        Ok(Some(_)) => false,
        Err(_) => false,
    };

    let mut suggested_name = base.clone();
    let mut alternatives = Vec::new();

    if !is_available {
        // 重複している場合は、番号を追加
        let mut counter = 1;
        loop {
            let candidate = if base.contains(" (") && base.ends_with(")") {
                // 既に番号がついている場合
                let base_part = base.split(" (").next().unwrap_or(&base);
                format!("{} ({})", base_part, counter)
            } else {
                format!("{} ({})", base, counter)
            };

            match api_repo.find_by_name(&candidate) {
                Ok(::std::option::Option::None) => {
                    suggested_name = candidate.clone();
                    break;
                }
                Ok(Some(_)) => {
                    counter += 1;
                    if counter <= 5 {
                        alternatives.push(candidate);
                    }
                }
                Err(_) => {
                    // エラーが発生した場合は、候補として追加せずにスキップ
                    break;
                }
            }

            if counter > 100 {
                // 無限ループを防ぐ
                suggested_name = format!("{} ({})", base, chrono::Utc::now().timestamp());
                break;
            }
        }
    }

    // 代替名を生成（モデル名ベース、日時ベースなど）
    if alternatives.len() < 5 {
        let timestamp = chrono::Utc::now().format("%Y%m%d_%H%M%S").to_string();
        alternatives.push(format!("API {}", timestamp));

        let date = chrono::Utc::now().format("%Y-%m-%d").to_string();
        alternatives.push(format!("API {}", date));

        for i in 1..=3 {
            if alternatives.len() >= 5 {
                break;
            }
            let alt = format!("API {}", i);
            if let Ok(::std::option::Option::None) = api_repo.find_by_name(&alt) {
                alternatives.push(alt);
            }
        }
    }

    Ok(ApiNameSuggestion {
        suggested_name,
        alternatives,
        is_available,
    })
}

/// エラー自動修復提案
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ErrorFixSuggestion {
    /// エラータイプ
    pub error_type: String,
    /// エラーメッセージ
    pub error_message: String,
    /// 修復方法の説明
    pub fix_description: String,
    /// 自動修復可能かどうか
    pub can_auto_fix: bool,
    /// 修復コマンド（自動修復可能な場合）
    pub fix_action: Option<String>,
}

/// エラーの自動修復提案を取得
#[tauri::command]
pub async fn suggest_error_fix(error_message: String) -> Result<ErrorFixSuggestion, String> {
    let error_lower = error_message.to_lowercase();

    // ポートエラー
    if error_lower.contains("port") || error_lower.contains("ポート") {
        return Ok(ErrorFixSuggestion {
            error_type: "port_conflict".to_string(),
            error_message: error_message.clone(),
            fix_description:
                "ポート番号が既に使用されています。別のポート番号を自動検出して提案します。"
                    .to_string(),
            can_auto_fix: true,
            fix_action: Some("find_available_port".to_string()),
        });
    }

    // モデルが見つからないエラー
    if error_lower.contains("model")
        && (error_lower.contains("not found") || error_lower.contains("見つかりません"))
    {
        return Ok(ErrorFixSuggestion {
            error_type: "model_not_found".to_string(),
            error_message: error_message.clone(),
            fix_description:
                "指定されたモデルが見つかりません。モデル管理画面からダウンロードしてください。"
                    .to_string(),
            can_auto_fix: false,
            fix_action: None,
        });
    }

    // エンジンエラー
    if error_lower.contains("engine") || error_lower.contains("エンジン") {
        return Ok(ErrorFixSuggestion {
            error_type: "engine_error".to_string(),
            error_message: error_message.clone(),
            fix_description: "LLMエンジンの起動に失敗しました。エンジンの状態を確認してください。"
                .to_string(),
            can_auto_fix: false,
            fix_action: None,
        });
    }

    // 認証エラー
    if error_lower.contains("auth") || error_lower.contains("認証") {
        return Ok(ErrorFixSuggestion {
            error_type: "auth_error".to_string(),
            error_message: error_message.clone(),
            fix_description: "認証設定に問題があります。APIキーを再生成してみてください。"
                .to_string(),
            can_auto_fix: false,
            fix_action: None,
        });
    }

    // デフォルトのエラー提案
    Ok(ErrorFixSuggestion {
        error_type: "unknown".to_string(),
        error_message: error_message.clone(),
        fix_description:
            "エラーの詳細を確認してください。アプリケーションを再起動してみることをお勧めします。"
                .to_string(),
        can_auto_fix: false,
        fix_action: None,
    })
}

/// 用途タイプ
#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum UseCaseType {
    /// クリエイティブ用途（創作、ストーリー生成など）
    Creative,
    /// 実用的用途（コード生成、データ分析など）
    Practical,
    /// バランス型（デフォルト）
    Balanced,
    /// 対話型（チャットボットなど）
    Conversational,
}

/// モデルパラメータの推奨値
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModelParameterRecommendation {
    /// 推奨温度
    pub temperature: f64,
    /// 推奨Top-p
    pub top_p: f64,
    /// 推奨Top-k
    pub top_k: i32,
    /// 推奨最大トークン数
    pub max_tokens: i32,
    /// 推奨繰り返しペナルティ
    pub repeat_penalty: f64,
    /// 推奨メモリ設定
    pub memory: Option<MemoryRecommendation>,
    /// 説明
    pub description: String,
}

/// メモリ設定の推奨値
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MemoryRecommendation {
    /// 推奨コンテキストウィンドウサイズ
    pub context_window: Option<i32>,
    /// 推奨GPUレイヤー数
    pub num_gpu_layers: Option<i32>,
    /// 推奨バッチサイズ
    pub batch_size: Option<i32>,
    /// メモリマップドファイルを使用
    pub use_mmap: Option<bool>,
    /// メモリをロック
    pub use_mlock: Option<bool>,
    /// 低メモリモード
    pub low_mem: Option<bool>,
    /// 説明
    pub description: String,
}

/// モデルパラメータの最適化提案
#[tauri::command]
pub async fn suggest_model_parameters(
    use_case: Option<String>,
    model_name: Option<String>,
) -> Result<ModelParameterRecommendation, String> {
    use crate::commands::system::get_system_resources;

    // システムリソースを取得
    let resources = get_system_resources()
        .await
        .map_err(|e| format!("システムリソースの取得に失敗しました: {}", e))?;

    // 用途タイプを判定
    let use_case_type = match use_case.as_deref() {
        Some("creative") | Some("クリエイティブ") => UseCaseType::Creative,
        Some("practical") | Some("実用的") | Some("コード生成") => UseCaseType::Practical,
        Some("conversational") | Some("対話型") | Some("チャット") => {
            UseCaseType::Conversational
        }
        _ => UseCaseType::Balanced,
    };

    // 用途に応じた推奨値を設定
    let (temperature, top_p, top_k, max_tokens, repeat_penalty, description) = match use_case_type {
        UseCaseType::Creative => (
            0.9,  // 創造性重視
            0.95, // 多様な出力
            50,   // 多様な選択肢
            2048, // 長い出力
            1.15, // 繰り返しを許容
            "クリエイティブな用途向け：創造性と多様性を重視した設定です。".to_string(),
        ),
        UseCaseType::Practical => (
            0.3,  // 一貫性重視
            0.7,  // 確実性重視
            20,   // 限定的な選択肢
            1024, // 標準的な長さ
            1.2,  // 繰り返しを抑制
            "実用的な用途向け：正確性と一貫性を重視した設定です。".to_string(),
        ),
        UseCaseType::Conversational => (
            0.7, // バランス型
            0.9, // 自然な会話
            40,  // 標準的な選択肢
            512, // 短い応答
            1.1, // 標準的なペナルティ
            "対話型用途向け：自然な会話を重視した設定です。".to_string(),
        ),
        UseCaseType::Balanced => (
            0.7,  // デフォルト
            0.9,  // デフォルト
            40,   // デフォルト
            1024, // デフォルト
            1.1,  // デフォルト
            "バランス型：一般的な用途に適した設定です。".to_string(),
        ),
    };

    // システムリソースに基づくメモリ設定の推奨
    let memory = suggest_memory_settings(&resources, model_name.as_deref());

    Ok(ModelParameterRecommendation {
        temperature,
        top_p,
        top_k,
        max_tokens,
        repeat_penalty,
        memory: Some(memory),
        description,
    })
}

/// システムリソースに基づくメモリ設定の推奨
fn suggest_memory_settings(
    resources: &SystemResources,
    model_name: Option<&str>,
) -> MemoryRecommendation {
    let available_memory_gb = resources.available_memory as f64 / (1024.0 * 1024.0 * 1024.0);
    let total_memory_gb = resources.total_memory as f64 / (1024.0 * 1024.0 * 1024.0);

    // メモリ使用率
    let memory_usage_percent = if total_memory_gb > 0.0 {
        ((total_memory_gb - available_memory_gb) / total_memory_gb) * 100.0
    } else {
        0.0
    };

    // 低メモリ環境の判定（利用可能メモリが4GB未満、または使用率が80%以上）
    let is_low_memory = available_memory_gb < 4.0 || memory_usage_percent > 80.0;

    // モデルサイズに基づく推奨設定
    let model_size_gb = if let Some(name) = model_name {
        // モデル名からサイズを推定（例: llama3:8b → 約5GB）
        if name.contains("8b") || name.contains("8B") {
            5.0
        } else if name.contains("13b") || name.contains("13B") {
            8.0
        } else if name.contains("70b") || name.contains("70B") {
            40.0
        } else {
            3.0 // デフォルト推定
        }
    } else {
        5.0 // デフォルト推定
    };

    if is_low_memory || model_size_gb > available_memory_gb * 0.8 {
        // 低メモリ環境向け
        MemoryRecommendation {
            context_window: Some(2048), // 小さいコンテキスト
            num_gpu_layers: Some(0),    // CPUのみ
            batch_size: Some(256),      // 小さいバッチ
            use_mmap: Some(true),       // メモリマップ使用
            use_mlock: Some(false),     // メモリロックなし
            low_mem: Some(true),        // 低メモリモード
            description: format!(
                "低メモリ環境向け：利用可能メモリ {:.1}GB に最適化した設定です。",
                available_memory_gb
            ),
        }
    } else if available_memory_gb >= 16.0 && model_size_gb <= available_memory_gb * 0.5 {
        // 高メモリ環境向け
        MemoryRecommendation {
            context_window: Some(8192), // 大きいコンテキスト
            num_gpu_layers: Some(35),   // GPU活用
            batch_size: Some(1024),     // 大きいバッチ
            use_mmap: Some(true),       // メモリマップ使用
            use_mlock: Some(true),      // メモリロックあり（パフォーマンス向上）
            low_mem: Some(false),       // 低メモリモードなし
            description: format!(
                "高メモリ環境向け：利用可能メモリ {:.1}GB を活用した高性能設定です。",
                available_memory_gb
            ),
        }
    } else {
        // 標準環境向け
        MemoryRecommendation {
            context_window: Some(4096), // 標準コンテキスト
            num_gpu_layers: Some(20),   // 中程度のGPU活用
            batch_size: Some(512),      // 標準バッチ
            use_mmap: Some(true),       // メモリマップ使用
            use_mlock: Some(false),     // メモリロックなし
            low_mem: Some(false),       // 低メモリモードなし
            description: format!(
                "標準環境向け：利用可能メモリ {:.1}GB に適したバランス型設定です。",
                available_memory_gb
            ),
        }
    }
}
