// Tauri IPCコマンド定義
// フロントエンドから呼び出されるIPCコマンドを定義します

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

/// 基本的なテストコマンド（greetコマンド）
/// フロントエンドから渡された名前を使用して挨拶メッセージを返す
#[tauri::command]
pub fn greet(name: &str) -> String {
    format!("こんにちは、{}さん！FLMへようこそ！", name)
}
