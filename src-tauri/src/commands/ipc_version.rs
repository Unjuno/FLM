// IPC Version Management
// IPCコマンドのバージョン管理機能

use serde::{Deserialize, Serialize};

/// IPCコマンドのバージョン情報
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IpcVersionInfo {
    pub version: String,
    pub supported_versions: Vec<String>,
    pub deprecated_commands: Vec<String>,
}

/// IPCコマンドのバージョンを取得
#[tauri::command]
pub async fn get_ipc_version() -> Result<IpcVersionInfo, String> {
    Ok(IpcVersionInfo {
        version: "1.0.0".to_string(),
        supported_versions: vec!["1.0.0".to_string()],
        deprecated_commands: vec![],
    })
}

/// IPCコマンドの互換性をチェック
#[tauri::command]
pub async fn check_ipc_compatibility(
    client_version: String,
) -> Result<CompatibilityResult, String> {
    let server_version = "1.0.0".to_string();
    
    // バージョン比較（簡易実装）
    let compatible = client_version == server_version;
    
    let message = if compatible {
        "互換性があります".to_string()
    } else {
        format!(
            "バージョンの不一致: サーバー({}), クライアント({})",
            server_version, client_version
        )
    };
    
    Ok(CompatibilityResult {
        compatible,
        server_version,
        client_version,
        message,
    })
}

/// 互換性チェック結果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompatibilityResult {
    pub compatible: bool,
    pub server_version: String,
    pub client_version: String,
    pub message: String,
}

