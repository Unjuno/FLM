// FLM - ユーティリティモジュール
// 共通のユーティリティ関数を定義します。

pub mod error;

use std::path::PathBuf;

/// アプリケーションデータディレクトリのパスを取得
/// 
/// OS別のパス:
/// - Windows: `%APPDATA%\flm`
/// - macOS: `~/Library/Application Support/flm`
/// - Linux: `~/.config/flm`
/// 
/// 注意: 現在は`database::connection::get_app_data_dir()`が使用されています。
/// この関数は将来の使用のために保持されています。
#[allow(dead_code)] // 将来の使用のために保持
pub fn app_data_dir() -> Result<PathBuf, std::io::Error> {
    let mut path = dirs::home_dir()
        .ok_or_else(|| std::io::Error::new(
            std::io::ErrorKind::NotFound,
            "ホームディレクトリが見つかりません"
        ))?;
    
    #[cfg(target_os = "windows")]
    {
        if let Some(app_data) = std::env::var_os("APPDATA") {
            path = PathBuf::from(app_data);
        }
        path.push("flm");
    }
    
    #[cfg(target_os = "macos")]
    {
        path.push("Library");
        path.push("Application Support");
        path.push("flm");
    }
    
    #[cfg(target_os = "linux")]
    {
        path.push(".config");
        path.push("flm");
    }
    
    // ディレクトリが存在しない場合は作成
    std::fs::create_dir_all(&path)?;
    
    Ok(path)
}
