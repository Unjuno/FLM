//! Error types for FLM Core

use thiserror::Error;

/// FLM Core のエラー型
#[derive(Error, Debug)]
pub enum FLMError {
    /// エンジン検出エラー
    #[error("Engine detection failed: {0}")]
    EngineDetection(String),

    /// データベースエラー
    #[error("Database error: {0}")]
    Database(String),

    /// 暗号化エラー
    #[error("Encryption error: {0}")]
    Encryption(String),

    /// 設定エラー
    #[error("Configuration error: {0}")]
    Configuration(String),

    /// ネットワークエラー
    #[error("Network error: {0}")]
    Network(String),

    /// 認証エラー
    #[error("Authentication error: {0}")]
    Authentication(String),

    /// その他のエラー
    #[error(transparent)]
    Other(#[from] anyhow::Error),
}

/// FLM Core の Result 型
pub type Result<T> = std::result::Result<T, FLMError>;
