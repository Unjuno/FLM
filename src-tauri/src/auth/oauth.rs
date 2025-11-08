// OAuth 2.0 Authentication Module
// OAuth 2.0認証機能

use crate::utils::error::AppError;
use serde::{Deserialize, Serialize};

/// OAuth 2.0設定
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OAuthConfig {
    pub client_id: String,
    pub client_secret: String,
    pub authorization_endpoint: String,
    pub token_endpoint: String,
    pub redirect_uri: String,
    pub scope: Vec<String>,
}

/// OAuth 2.0認証トークン
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OAuthToken {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub token_type: String,
    pub expires_in: Option<u64>,
    pub expires_at: Option<String>,
    pub scope: Option<Vec<String>>,
}

/// OAuth 2.0認証フローを開始
pub async fn start_oauth_flow(config: &OAuthConfig) -> Result<String, AppError> {
    // 認証URLを生成
    let state = uuid::Uuid::new_v4().to_string();
    let scope = config.scope.join(" ");
    
    let auth_url = format!(
        "{}?client_id={}&redirect_uri={}&response_type=code&scope={}&state={}",
        config.authorization_endpoint,
        encode_url(&config.client_id),
        encode_url(&config.redirect_uri),
        encode_url(&scope),
        state
    );
    
    Ok(auth_url)
}

/// URLエンコーディング（手動実装）
fn encode_url(s: &str) -> String {
    s.chars().map(|c| {
        match c {
            ' ' => "+".to_string(),
            c if c.is_alphanumeric() || ".-_".contains(c) => c.to_string(),
            _ => format!("%{:02X}", c as u8),
        }
    }).collect()
}

/// 認証コードをトークンに交換
pub async fn exchange_code_for_token(
    config: &OAuthConfig,
    code: &str,
) -> Result<OAuthToken, AppError> {
    let client = crate::utils::http_client::create_http_client()?;
    
    let params = [
        ("grant_type", "authorization_code"),
        ("code", code),
        ("redirect_uri", &config.redirect_uri),
        ("client_id", &config.client_id),
        ("client_secret", &config.client_secret),
    ];
    
    let response = client
        .post(&config.token_endpoint)
        .form(&params)
        .send()
        .await
        .map_err(|e| AppError::ApiError {
            message: format!("トークン交換リクエストエラー: {}", e),
            code: "TOKEN_EXCHANGE_ERROR".to_string(),
            source_detail: None,
        })?;
    
    let status = response.status();
    if !status.is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err(AppError::ApiError {
            message: format!("トークン交換エラー: HTTP {} - {}", status, error_text),
            code: status.as_str().to_string(),
            source_detail: None,
        });
    }
    
    let token_data: serde_json::Value = response.json().await
        .map_err(|e| AppError::ApiError {
            message: format!("JSON解析エラー: {}", e),
            code: "JSON_ERROR".to_string(),
            source_detail: None,
        })?;
    
    let expires_in = token_data["expires_in"].as_u64();
    let expires_at = if let Some(expires_in_sec) = expires_in {
        use chrono::{Utc, Duration};
        Some((Utc::now() + Duration::seconds(expires_in_sec as i64)).to_rfc3339())
    } else {
        None
    };
    
    Ok(OAuthToken {
        access_token: token_data["access_token"]
            .as_str()
            .ok_or_else(|| AppError::ApiError {
                message: "access_tokenが見つかりません".to_string(),
                code: "MISSING_ACCESS_TOKEN".to_string(),
                source_detail: None,
            })?
            .to_string(),
        refresh_token: token_data["refresh_token"].as_str().map(|s| s.to_string()),
        token_type: token_data["token_type"].as_str().unwrap_or("Bearer").to_string(),
        expires_in,
        expires_at,
        scope: token_data["scope"].as_str().map(|s| {
            s.split(' ').map(|s| s.to_string()).collect()
        }),
    })
}

/// リフレッシュトークンを使用してアクセストークンを更新
pub async fn refresh_access_token(
    config: &OAuthConfig,
    refresh_token: &str,
) -> Result<OAuthToken, AppError> {
    let client = crate::utils::http_client::create_http_client()?;
    
    let params = [
        ("grant_type", "refresh_token"),
        ("refresh_token", refresh_token),
        ("client_id", &config.client_id),
        ("client_secret", &config.client_secret),
    ];
    
    let response = client
        .post(&config.token_endpoint)
        .form(&params)
        .send()
        .await
        .map_err(|e| AppError::ApiError {
            message: format!("トークン更新リクエストエラー: {}", e),
            code: "TOKEN_REFRESH_ERROR".to_string(),
            source_detail: None,
        })?;
    
    let status = response.status();
    if !status.is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err(AppError::ApiError {
            message: format!("トークン更新エラー: HTTP {} - {}", status, error_text),
            code: status.as_str().to_string(),
            source_detail: None,
        });
    }
    
    let token_data: serde_json::Value = response.json().await
        .map_err(|e| AppError::ApiError {
            message: format!("JSON解析エラー: {}", e),
            code: "JSON_ERROR".to_string(),
            source_detail: None,
        })?;
    
    let expires_in = token_data["expires_in"].as_u64();
    let expires_at = if let Some(expires_in_sec) = expires_in {
        use chrono::{Utc, Duration};
        Some((Utc::now() + Duration::seconds(expires_in_sec as i64)).to_rfc3339())
    } else {
        None
    };
    
    Ok(OAuthToken {
        access_token: token_data["access_token"]
            .as_str()
            .ok_or_else(|| AppError::ApiError {
                message: "access_tokenが見つかりません".to_string(),
                code: "MISSING_ACCESS_TOKEN".to_string(),
                source_detail: None,
            })?
            .to_string(),
        refresh_token: token_data["refresh_token"].as_str().map(|s| s.to_string()),
        token_type: token_data["token_type"].as_str().unwrap_or("Bearer").to_string(),
        expires_in,
        expires_at,
        scope: token_data["scope"].as_str().map(|s| {
            s.split(' ').map(|s| s.to_string()).collect()
        }),
    })
}



