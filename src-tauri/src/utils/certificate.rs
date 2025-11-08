// SSL Certificate Management
// HTTPS用の自己署名証明書を生成・管理します
// 注意: 現在はNode.js側で証明書生成を行っているため、このファイルは将来の拡張用です

use crate::database::connection::get_app_data_dir;
use crate::utils::error::AppError;
use std::path::PathBuf;

/// 証明書ディレクトリのパスを取得
pub fn get_cert_dir() -> Result<PathBuf, AppError> {
    let app_data_dir = get_app_data_dir().map_err(|e| AppError::IoError {
        message: format!("アプリケーションデータディレクトリの取得に失敗しました: {}", e),
        source_detail: None,
    })?;
    
    Ok(app_data_dir.join("certificates"))
}

/// 証明書ファイルのパスを取得
pub fn get_cert_file_path(api_id: &str) -> Result<PathBuf, AppError> {
    let cert_dir = get_cert_dir()?;
    Ok(cert_dir.join(format!("{}.pem", api_id)))
}

/// 証明書が存在するかチェック
pub fn certificate_exists(api_id: &str) -> bool {
    match get_cert_file_path(api_id) {
        Ok(path) => path.exists(),
        Err(_) => false,
    }
}

/// 秘密鍵ファイルのパスを取得
pub fn get_key_file_path(api_id: &str) -> Result<PathBuf, AppError> {
    let cert_dir = get_cert_dir()?;
    Ok(cert_dir.join(format!("{}.key", api_id)))
}
