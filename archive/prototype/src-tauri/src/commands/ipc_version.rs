// IPC Version Management
// IPCコマンドのバージョン管理機能（SemVer対応）

use serde::{Deserialize, Serialize};

/// IPCコマンドのバージョン情報
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IpcVersionInfo {
    pub version: String,
    pub supported_versions: Vec<String>,
    pub deprecated_commands: Vec<String>,
}

/// セマンティックバージョン（SemVer）のパース結果
#[derive(Debug, Clone, PartialEq, Eq)]
struct SemVer {
    major: u32,
    minor: u32,
    patch: u32,
}

impl SemVer {
    /// 文字列からSemVerをパース
    fn parse(version: &str) -> Result<Self, String> {
        let parts: Vec<&str> = version.split('.').collect();
        if parts.len() != 3 {
            return Err(format!("無効なバージョン形式: {}", version));
        }

        let major = parts[0]
            .parse::<u32>()
            .map_err(|_| format!("無効なメジャーバージョン: {}", parts[0]))?;
        let minor = parts[1]
            .parse::<u32>()
            .map_err(|_| format!("無効なマイナーバージョン: {}", parts[1]))?;
        let patch = parts[2]
            .parse::<u32>()
            .map_err(|_| format!("無効なパッチバージョン: {}", parts[2]))?;

        Ok(SemVer {
            major,
            minor,
            patch,
        })
    }

    /// 互換性をチェック（メジャーバージョンが同じ場合は互換性あり）
    fn is_compatible_with(&self, other: &SemVer) -> bool {
        // メジャーバージョンが同じ場合は互換性あり
        // マイナーバージョンが大きい場合は後方互換性あり
        self.major == other.major && self.minor >= other.minor
    }
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

/// IPCコマンドの互換性をチェック（SemVer対応）
#[tauri::command]
pub async fn check_ipc_compatibility(
    client_version: String,
) -> Result<CompatibilityResult, String> {
    let server_version = "1.0.0".to_string();

    // SemVer形式でパース
    let server_semver = SemVer::parse(&server_version)
        .map_err(|e| format!("サーバーバージョンのパースエラー: {}", e))?;
    let client_semver = SemVer::parse(&client_version)
        .map_err(|e| format!("クライアントバージョンのパースエラー: {}", e))?;

    // 互換性チェック（メジャーバージョンが同じ場合は互換性あり）
    let compatible = server_semver.is_compatible_with(&client_semver);

    let compatibility_level = if server_semver.major != client_semver.major {
        "非互換（メジャーバージョンが異なります）"
    } else if server_semver.minor != client_semver.minor {
        "互換（マイナーバージョンが異なりますが、後方互換性があります）"
    } else if server_semver.patch != client_semver.patch {
        "完全互換（パッチバージョンのみ異なります）"
    } else {
        "完全一致"
    };

    let message = if compatible {
        format!("互換性があります（{}）", compatibility_level)
    } else {
        format!(
            "非互換: サーバー({}), クライアント({}) - {}",
            server_version, client_version, compatibility_level
        )
    };

    Ok(CompatibilityResult {
        compatible,
        server_version,
        client_version,
        message,
        compatibility_level: compatibility_level.to_string(),
    })
}

/// 互換性チェック結果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompatibilityResult {
    pub compatible: bool,
    pub server_version: String,
    pub client_version: String,
    pub message: String,
    pub compatibility_level: String,
}
