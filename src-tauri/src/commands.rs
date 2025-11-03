// FLM - Tauri IPCコマンド定義
// このモジュールは、フロントエンドから呼び出されるIPCコマンドを定義します。

pub mod ollama;
pub mod api;
pub mod database;
pub mod performance;
pub mod settings;
pub mod alerts;
pub mod backup;
pub mod engine;
pub mod system;
pub mod port;
pub mod suggestions;

// use crate::utils::error::AppError; // 未使用のためコメントアウト
// pub use api::*; // 未使用のためコメントアウト

/// 基本的なテストコマンド（greetコマンド）
/// フロントエンドから渡された名前を使用して挨拶メッセージを返す
#[tauri::command]
pub fn greet(name: &str) -> String {
    format!("こんにちは、{}さん！FLMへようこそ！", name)
}

// 基本的なテストコマンド（将来の拡張用に削除）
// ping関数は未使用のため削除

// 将来実装するコマンドのプレースホルダー
// これらのコマンドは、フェーズ2以降で実装されます。

// Ollama関連コマンドは commands/ollama.rs に実装されています

// API関連コマンド（フェーズ3で実装）
// #[tauri::command]
// pub fn api_create(config: ApiCreateConfig) -> Result<ApiConfig, AppError> { ... }

// モデル関連コマンド（フェーズ3で実装）
// #[tauri::command]
// pub fn model_list(filter: ModelFilter) -> Result<Vec<ModelInfo>, AppError> { ... }
