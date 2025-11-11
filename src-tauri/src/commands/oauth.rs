// OAuth 2.0認証コマンド

use crate::auth::oauth::{OAuthConfig, OAuthToken, OAuthFlowStartResult, start_oauth_flow, exchange_code_for_token, refresh_access_token};
use crate::utils::error::AppError;
use serde::{Deserialize, Serialize};

/// OAuth設定（フロントエンドから受け取る形式）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OAuthConfigInput {
    pub client_id: String,
    pub client_secret: String,
    pub authorization_endpoint: String,
    pub token_endpoint: String,
    pub redirect_uri: String,
    pub scope: Vec<String>,
}

/// OAuthトークン（フロントエンドに返す形式）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OAuthTokenOutput {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub token_type: String,
    pub expires_in: Option<u64>,
    pub expires_at: Option<String>,
    pub scope: Option<Vec<String>>,
}

/// OAuth設定を内部形式に変換
fn convert_config(input: OAuthConfigInput) -> OAuthConfig {
    OAuthConfig {
        client_id: input.client_id,
        client_secret: input.client_secret,
        authorization_endpoint: input.authorization_endpoint,
        token_endpoint: input.token_endpoint,
        redirect_uri: input.redirect_uri,
        scope: input.scope,
    }
}

/// OAuthトークンを出力形式に変換
fn convert_token(token: OAuthToken) -> OAuthTokenOutput {
    OAuthTokenOutput {
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        token_type: token.token_type,
        expires_in: token.expires_in,
        expires_at: token.expires_at,
        scope: token.scope,
    }
}

/// OAuth 2.0認証フローを開始
/// 
/// 認証URLを生成し、ブラウザで開くためのURLとstateを返します。
/// 
/// # 引数
/// * `config` - OAuth設定情報
/// 
/// # 戻り値
/// * 認証URLとstateを含む結果
#[tauri::command]
pub async fn start_oauth_flow_command(
    config: OAuthConfigInput,
) -> Result<OAuthFlowStartResult, String> {
    let oauth_config = convert_config(config);
    
    start_oauth_flow(&oauth_config)
        .await
        .map_err(|e| match e {
            AppError::ApiError { message, .. } => message,
            _ => format!("OAuth認証フローの開始に失敗しました: {}", e),
        })
}

/// OAuth認証コードをトークンに交換
/// 
/// 認証フローで取得した認証コードをアクセストークンに交換します。
/// 
/// # 引数
/// * `config` - OAuth設定情報
/// * `code` - 認証コード
/// * `state` - ステート（セキュリティ用、CSRF対策）
/// 
/// # 戻り値
/// * OAuthトークン情報
#[tauri::command]
pub async fn exchange_oauth_code(
    config: OAuthConfigInput,
    code: String,
    state: String,
) -> Result<OAuthTokenOutput, String> {
    let oauth_config = convert_config(config);
    
    exchange_code_for_token(&oauth_config, &code, &state)
        .await
        .map(convert_token)
        .map_err(|e| match e {
            AppError::ApiError { message, .. } => message,
            _ => format!("トークン交換に失敗しました: {}", e),
        })
}

/// OAuthリフレッシュトークンでアクセストークンを更新
/// 
/// リフレッシュトークンを使用して新しいアクセストークンを取得します。
/// 
/// # 引数
/// * `config` - OAuth設定情報
/// * `refresh_token` - リフレッシュトークン
/// 
/// # 戻り値
/// * 新しいOAuthトークン情報
#[tauri::command]
pub async fn refresh_oauth_token(
    config: OAuthConfigInput,
    refresh_token: String,
) -> Result<OAuthTokenOutput, String> {
    let oauth_config = convert_config(config);
    
    refresh_access_token(&oauth_config, &refresh_token)
        .await
        .map(convert_token)
        .map_err(|e| match e {
            AppError::ApiError { message, .. } => message,
            _ => format!("トークンリフレッシュに失敗しました: {}", e),
        })
}


