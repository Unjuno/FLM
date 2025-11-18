// HTTP Client Module
// 共通のHTTPクライアントビルダー関数を提供

use crate::utils::error::AppError;
use reqwest::Client;
use std::time::Duration;

/// デフォルトのタイムアウト設定
const DEFAULT_TIMEOUT_SECS: u64 = 30;
const DEFAULT_CONNECT_TIMEOUT_SECS: u64 = 10;

/// デフォルト設定でHTTPクライアントを作成
///
/// - タイムアウト: 30秒
/// - 接続タイムアウト: 10秒
pub fn create_http_client() -> Result<Client, AppError> {
    Client::builder()
        .timeout(Duration::from_secs(DEFAULT_TIMEOUT_SECS))
        .connect_timeout(Duration::from_secs(DEFAULT_CONNECT_TIMEOUT_SECS))
        .build()
        .map_err(|e| AppError::ApiError {
            message: format!("HTTPクライアント作成エラー: {}", e),
            code: "CLIENT_ERROR".to_string(),
            source_detail: None,
        })
}

/// カスタムタイムアウト設定でHTTPクライアントを作成
///
/// # Arguments
///
/// * `timeout_secs` - リクエストタイムアウト（秒）
/// * `connect_timeout_secs` - 接続タイムアウト（秒、デフォルト: 10秒）
pub fn create_http_client_with_timeout(
    timeout_secs: u64,
    connect_timeout_secs: Option<u64>,
) -> Result<Client, AppError> {
    let mut builder = Client::builder().timeout(Duration::from_secs(timeout_secs));

    if let Some(connect_timeout) = connect_timeout_secs {
        builder = builder.connect_timeout(Duration::from_secs(connect_timeout));
    } else {
        builder = builder.connect_timeout(Duration::from_secs(DEFAULT_CONNECT_TIMEOUT_SECS));
    }

    builder.build().map_err(|e| AppError::ApiError {
        message: format!("HTTPクライアント作成エラー: {}", e),
        code: "CLIENT_ERROR".to_string(),
        source_detail: None,
    })
}

/// 短いタイムアウト設定でHTTPクライアントを作成（ヘルスチェック用など）
///
/// - タイムアウト: 5秒
/// - 接続タイムアウト: 2秒
pub fn create_http_client_short_timeout() -> Result<Client, AppError> {
    Client::builder()
        .timeout(Duration::from_secs(5))
        .connect_timeout(Duration::from_secs(2))
        .build()
        .map_err(|e| AppError::ApiError {
            message: format!("HTTPクライアント作成エラー: {}", e),
            code: "CLIENT_ERROR".to_string(),
            source_detail: None,
        })
}

/// 長いタイムアウト設定でHTTPクライアントを作成（大きなファイルのダウンロード用など）
///
/// - タイムアウト: 300秒（5分）
/// - 接続タイムアウト: 30秒
pub fn create_http_client_long_timeout() -> Result<Client, AppError> {
    Client::builder()
        .timeout(Duration::from_secs(300))
        .connect_timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| AppError::ApiError {
            message: format!("HTTPクライアント作成エラー: {}", e),
            code: "CLIENT_ERROR".to_string(),
            source_detail: None,
        })
}

/// 自己署名証明書を許可するHTTPクライアントを作成（HTTPSヘルスチェック用）
///
/// - タイムアウト: 5秒
/// - 接続タイムアウト: 2秒
/// - 証明書検証: 無効（自己署名証明書を許可）
pub fn create_http_client_allow_insecure() -> Result<Client, AppError> {
    Client::builder()
        .timeout(Duration::from_secs(5))
        .connect_timeout(Duration::from_secs(2))
        .danger_accept_invalid_certs(true)
        .build()
        .map_err(|e| AppError::ApiError {
            message: format!("HTTPクライアント作成エラー: {}", e),
            code: "CLIENT_ERROR".to_string(),
            source_detail: None,
        })
}
