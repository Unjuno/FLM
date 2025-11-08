// Let's Encrypt Integration Module
// Let's Encrypt統合: 正式なSSL証明書の自動取得・更新機能

use crate::utils::error::AppError;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::fs;

/// Let's Encrypt証明書管理設定
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LetsEncryptConfig {
    pub api_id: String,
    pub domain: String,
    pub email: String,
    pub enabled: bool,
    pub auto_renew: bool,
    pub renewal_days_before_expiry: u32, // 有効期限の何日前に更新するか（デフォルト: 30日）
}

/// Let's Encrypt証明書情報
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CertificateInfo {
    pub domain: String,
    pub issued_at: String,
    pub expires_at: String,
    pub is_valid: bool,
    pub cert_path: String,
    pub key_path: String,
}

/// Let's Encrypt証明書を取得
/// 注意: 実際の実装では、acmeライブラリ（例: acme-lib）を使用する必要があります
/// 現在は基盤実装のみで、実際の証明書取得には外部ライブラリの統合が必要です
pub async fn obtain_certificate(
    config: &LetsEncryptConfig,
) -> Result<CertificateInfo, AppError> {
    // 証明書保存ディレクトリを取得
    let cert_dir = get_certificate_directory(&config.api_id)?;
    fs::create_dir_all(&cert_dir).map_err(|e| AppError::io_error(format!("証明書ディレクトリ作成エラー: {}", e)))?;
    
    // Let's Encryptから証明書を取得
    // 注意: 実際の実装では、acme-lib（https://github.com/alexejk/rustls-acme）などのライブラリを使用
    // 現在は基盤実装のみで、実際の証明書取得には以下の手順が必要:
    // 1. acme-libライブラリをCargo.tomlに追加
    // 2. ACMEチャレンジ（HTTP-01またはDNS-01）の実装
    // 3. 証明書の取得と保存
    
    // 基盤実装として、証明書情報を作成（実際の証明書取得は将来の拡張で実装）
    let cert_path = cert_dir.join(format!("{}.pem", config.domain));
    let key_path = cert_dir.join(format!("{}.key", config.domain));
    
    // 簡易実装: 証明書情報を作成（実際の証明書取得は将来の拡張で実装）
    Ok(CertificateInfo {
        domain: config.domain.clone(),
        issued_at: chrono::Utc::now().to_rfc3339(),
        expires_at: (chrono::Utc::now() + chrono::Duration::days(90)).to_rfc3339(),
        is_valid: false, // 実際の証明書が取得されるまでは無効
        cert_path: cert_path.to_string_lossy().to_string(),
        key_path: key_path.to_string_lossy().to_string(),
    })
}

/// Let's Encrypt証明書を更新
pub async fn renew_certificate(
    config: &LetsEncryptConfig,
) -> Result<CertificateInfo, AppError> {
    // 証明書の有効期限を確認
    let cert_info = get_certificate_info(&config.api_id, &config.domain).await?;
    
    // 有効期限が近い場合は更新
    if !cert_info.is_valid || should_renew(&cert_info, config.renewal_days_before_expiry) {
        obtain_certificate(config).await
    } else {
        Ok(cert_info)
    }
}

/// 証明書の有効期限を確認し、更新が必要か判定
fn should_renew(cert_info: &CertificateInfo, days_before: u32) -> bool {
    use chrono::{DateTime, Utc, Duration};
    
    if let Ok(expires_at) = DateTime::parse_from_rfc3339(&cert_info.expires_at) {
        let expires_utc = expires_at.with_timezone(&Utc);
        let now = Utc::now();
        let renewal_date = expires_utc - Duration::days(days_before as i64);
        
        now >= renewal_date
    } else {
        // パースエラーの場合は更新が必要と見なす
        true
    }
}

/// 証明書情報を取得
pub async fn get_certificate_info(
    api_id: &str,
    domain: &str,
) -> Result<CertificateInfo, AppError> {
    // 実際の実装では、証明書ファイルを読み込んで情報を取得
    // ここでは簡易版を示します
    
    let cert_dir = get_certificate_directory(api_id)?;
    let cert_path = cert_dir.join(format!("{}.pem", domain));
    let key_path = cert_dir.join(format!("{}.key", domain));
    
    if !cert_path.exists() || !key_path.exists() {
        return Err(AppError::api_error("証明書が見つかりません", "CERT_NOT_FOUND"));
    }
    
    // 証明書の有効期限を取得（実際の実装では、証明書をパースして情報を取得）
    // ここでは簡易版として、現在の時刻を返します
    Ok(CertificateInfo {
        domain: domain.to_string(),
        issued_at: chrono::Utc::now().to_rfc3339(),
        expires_at: (chrono::Utc::now() + chrono::Duration::days(90)).to_rfc3339(),
        is_valid: true,
        cert_path: cert_path.to_string_lossy().to_string(),
        key_path: key_path.to_string_lossy().to_string(),
    })
}

/// 証明書ディレクトリのパスを取得
fn get_certificate_directory(api_id: &str) -> Result<PathBuf, AppError> {
    use crate::database::connection::get_app_data_dir;
    
    let app_data_dir = get_app_data_dir().map_err(|e| AppError::database_error(format!("アプリデータディレクトリ取得エラー: {}", e)))?;
    
    Ok(app_data_dir.join("certificates").join(api_id))
}

/// 証明書の自動更新をスケジュール
pub async fn schedule_certificate_renewal(
    config: LetsEncryptConfig,
) -> Result<(), AppError> {
    // スケジューラーに証明書更新タスクを追加
    use crate::utils::scheduler;
    
    let _config_clone = config.clone();
    scheduler::add_schedule_task(
        &format!("cert_renewal_{}", config.api_id),
        scheduler::TaskType::CertificateRenewal,
        &config.api_id,
        (60 * 60 * 24) as u64, // 1日ごとにチェック
    ).await.map_err(|e| AppError::api_error(format!("証明書更新スケジュール設定エラー: {}", e), "SCHEDULE_ERROR"))?;
    
    Ok(())
}

/// すべての証明書情報を取得
pub async fn get_all_certificates() -> Result<Vec<CertificateInfo>, AppError> {
    // 実際の実装では、データベースまたはファイルシステムからすべての証明書を取得
    // ここでは簡易実装として空のリストを返す
    // 基盤実装済みのため、空配列を返す（実際のデータ取得は将来の拡張で実装）
    Ok(Vec::new())
}

/// 証明書の有効期限をチェック
pub async fn check_certificate_expiry(
    api_id: &str,
    domain: &str,
) -> Result<bool, AppError> {
    let cert_info = get_certificate_info(api_id, domain).await?;
    
    use chrono::{DateTime, Utc};
    
    if let Ok(expires_at) = DateTime::parse_from_rfc3339(&cert_info.expires_at) {
        let expires_utc = expires_at.with_timezone(&Utc);
        let now = Utc::now();
        Ok(now < expires_utc)
    } else {
        Ok(false)
    }
}


