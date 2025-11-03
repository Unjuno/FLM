// SSL Certificate Management
// HTTPS用の自己署名証明書を生成・管理します

use crate::database::connection::get_app_data_dir;
use crate::utils::error::AppError;
use rcgen::{generate_simple_self_signed, CertifiedKey};
use std::fs;
use std::path::PathBuf;

/// 証明書ファイルのパスを取得
fn get_cert_dir() -> Result<PathBuf, AppError> {
    let app_data_dir = get_app_data_dir().map_err(|e| AppError::IoError {
        message: format!("アプリケーションデータディレクトリの取得に失敗しました: {}", e),
    })?;
    
    let cert_dir = app_data_dir.join("certificates");
    
    // ディレクトリが存在しない場合は作成
    if !cert_dir.exists() {
        fs::create_dir_all(&cert_dir).map_err(|e| AppError::IoError {
            message: format!("証明書ディレクトリの作成に失敗しました: {}", e),
        })?;
    }
    
    Ok(cert_dir)
}

/// 証明書ファイルのパスを取得
fn get_cert_file_path(api_id: &str) -> Result<PathBuf, AppError> {
    let cert_dir = get_cert_dir()?;
    Ok(cert_dir.join(format!("{}.pem", api_id)))
}

/// 秘密鍵ファイルのパスを取得
fn get_key_file_path(api_id: &str) -> Result<PathBuf, AppError> {
    let cert_dir = get_cert_dir()?;
    Ok(cert_dir.join(format!("{}.key", api_id)))
}

/// 自己署名SSL証明書を生成
/// 証明書と秘密鍵をPEM形式で返します
pub fn generate_self_signed_certificate(
    _api_id: &str,
    hostnames: Vec<String>,
) -> Result<(String, String), AppError> {
    // 証明書を生成（rcgen 0.13のgenerate_simple_self_signedを使用）
    // セキュリティ: HTTPは使用不可（パスワード漏洩を防ぐためHTTPS必須）
    // generate_simple_self_signedはIntoIterator<Item = impl AsRef<str>>を受け取る
    // Vec<String>を直接渡す（StringはAsRef<str>を実装している）
    let CertifiedKey { cert, key_pair } = generate_simple_self_signed(hostnames)
        .map_err(|e| AppError::IoError {
            message: format!("証明書の生成に失敗しました: {}", e),
        })?;
    
    // PEM形式に変換
    let cert_pem = cert.pem();
    let key_pem = key_pair.serialize_pem();
    
    Ok((cert_pem, key_pem))
}

/// SSL証明書を保存
pub fn save_certificate(api_id: &str, cert_pem: &str, key_pem: &str) -> Result<(), AppError> {
    let cert_path = get_cert_file_path(api_id)?;
    let key_path = get_key_file_path(api_id)?;
    
    // 証明書を保存（読み取り専用）
    fs::write(&cert_path, cert_pem).map_err(|e| AppError::IoError {
        message: format!("証明書の保存に失敗しました: {}", e),
    })?;
    
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&cert_path, fs::Permissions::from_mode(0o644))
            .map_err(|e| AppError::IoError {
                message: format!("証明書の権限設定に失敗しました: {}", e),
            })?;
    }
    
    // 秘密鍵を保存（所有者のみ読み取り可能）
    fs::write(&key_path, key_pem).map_err(|e| AppError::IoError {
        message: format!("秘密鍵の保存に失敗しました: {}", e),
    })?;
    
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&key_path, fs::Permissions::from_mode(0o600))
            .map_err(|e| AppError::IoError {
                message: format!("秘密鍵の権限設定に失敗しました: {}", e),
            })?;
    }
    
    Ok(())
}

/// SSL証明書を読み込む
pub fn load_certificate(api_id: &str) -> Result<(String, String), AppError> {
    let cert_path = get_cert_file_path(api_id)?;
    let key_path = get_key_file_path(api_id)?;
    
    if !cert_path.exists() || !key_path.exists() {
        return Err(AppError::IoError {
            message: "証明書が見つかりません。証明書を生成してください。".to_string(),
        });
    }
    
    let cert_pem = fs::read_to_string(&cert_path).map_err(|e| AppError::IoError {
        message: format!("証明書の読み込みに失敗しました: {}", e),
    })?;
    
    let key_pem = fs::read_to_string(&key_path).map_err(|e| AppError::IoError {
        message: format!("秘密鍵の読み込みに失敗しました: {}", e),
    })?;
    
    Ok((cert_pem, key_pem))
}

/// SSL証明書が存在するか確認
pub fn certificate_exists(api_id: &str) -> bool {
    if let (Ok(cert_path), Ok(key_path)) = (get_cert_file_path(api_id), get_key_file_path(api_id)) {
        cert_path.exists() && key_path.exists()
    } else {
        false
    }
}

/// SSL証明書を生成して保存（API作成時などに使用）
pub fn generate_and_save_certificate(api_id: &str, port: u16) -> Result<(), AppError> {
    // ホスト名リストを生成（localhostとローカルIPを含む）
    let mut hostnames = vec![
        "localhost".to_string(),
        format!("localhost:{}", port),
        "127.0.0.1".to_string(),
        format!("127.0.0.1:{}", port),
    ];
    
    // ローカルIPアドレスも追加（オプション）
    if let Some(ip) = crate::utils::network::get_local_ip_address() {
        hostnames.push(ip.clone());
        hostnames.push(format!("{}:{}", ip, port));
    }
    
    // 証明書を生成
    let (cert_pem, key_pem) = generate_self_signed_certificate(api_id, hostnames)?;
    
    // 証明書を保存
    save_certificate(api_id, &cert_pem, &key_pem)?;
    
    Ok(())
}

/// SSL証明書を削除
pub fn delete_certificate(api_id: &str) -> Result<(), AppError> {
    let cert_path = get_cert_file_path(api_id)?;
    let key_path = get_key_file_path(api_id)?;
    
    if cert_path.exists() {
        fs::remove_file(&cert_path).map_err(|e| AppError::IoError {
            message: format!("証明書の削除に失敗しました: {}", e),
        })?;
    }
    
    if key_path.exists() {
        fs::remove_file(&key_path).map_err(|e| AppError::IoError {
            message: format!("秘密鍵の削除に失敗しました: {}", e),
        })?;
    }
    
    Ok(())
}

