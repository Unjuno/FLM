// エラーハンドリングユーティリティ
// アプリケーション全体で使用するエラー型を定義します。
// 監査レポートの推奨事項に基づき、エラーコードの統一システムを追加

use crate::utils::logging::{mask_env_var_value, mask_file_path};
use serde::{Deserialize, Serialize};
use thiserror::Error;

/// エラーコード（監査レポートの推奨事項に基づき追加）
/// エラーコードはUPPER_SNAKE_CASEを使用（意図的な設計）
#[allow(non_camel_case_types)]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum ErrorCode {
    // Ollama関連エラー (OLLAMA_*)
    OLLAMA_NOT_FOUND,
    OLLAMA_CONNECTION_FAILED,
    OLLAMA_START_FAILED,
    OLLAMA_GENERAL,

    // API関連エラー (API_*)
    API_PORT_IN_USE,
    API_PORT_INVALID,
    API_PORT_NOT_FOUND,
    API_AUTH_PROXY_START_FAILED,
    API_GENERAL,
    API_CONNECTION_ERROR,

    // モデル関連エラー (MODEL_*)
    MODEL_NOT_FOUND,
    MODEL_DOWNLOAD_FAILED,
    MODEL_INSTALL_FAILED,
    MODEL_GENERAL,

    // データベース関連エラー (DB_*)
    DB_CONNECTION_FAILED,
    DB_QUERY_FAILED,
    DB_NOT_FOUND,
    DB_GENERAL,

    // バリデーションエラー (VALIDATION_*)
    VALIDATION_INVALID_INPUT,
    VALIDATION_MISSING_FIELD,
    VALIDATION_OUT_OF_RANGE,
    VALIDATION_GENERAL,

    // IOエラー (IO_*)
    IO_FILE_NOT_FOUND,
    IO_PERMISSION_DENIED,
    IO_READ_FAILED,
    IO_WRITE_FAILED,
    IO_GENERAL,

    // プロセスエラー (PROCESS_*)
    PROCESS_NOT_FOUND,
    PROCESS_START_FAILED,
    PROCESS_STOP_FAILED,
    PROCESS_GENERAL,

    // 認証エラー (AUTH_*)
    AUTH_FAILED,
    AUTH_INVALID_TOKEN,
    AUTH_EXPIRED,
    AUTH_GENERAL,

    // 接続エラー (CONNECTION_*)
    CONNECTION_TIMEOUT,
    CONNECTION_REFUSED,
    CONNECTION_GENERAL,

    // 汎用エラー
    UNKNOWN_ERROR,
}

impl ErrorCode {
    /// エラーコードを文字列に変換
    pub fn as_str(&self) -> &'static str {
        match self {
            ErrorCode::OLLAMA_NOT_FOUND => "OLLAMA_NOT_FOUND",
            ErrorCode::OLLAMA_CONNECTION_FAILED => "OLLAMA_CONNECTION_FAILED",
            ErrorCode::OLLAMA_START_FAILED => "OLLAMA_START_FAILED",
            ErrorCode::OLLAMA_GENERAL => "OLLAMA_GENERAL",
            ErrorCode::API_PORT_IN_USE => "API_PORT_IN_USE",
            ErrorCode::API_PORT_INVALID => "API_PORT_INVALID",
            ErrorCode::API_PORT_NOT_FOUND => "API_PORT_NOT_FOUND",
            ErrorCode::API_AUTH_PROXY_START_FAILED => "API_AUTH_PROXY_START_FAILED",
            ErrorCode::API_GENERAL => "API_GENERAL",
            ErrorCode::API_CONNECTION_ERROR => "API_CONNECTION_ERROR",
            ErrorCode::MODEL_NOT_FOUND => "MODEL_NOT_FOUND",
            ErrorCode::MODEL_DOWNLOAD_FAILED => "MODEL_DOWNLOAD_FAILED",
            ErrorCode::MODEL_INSTALL_FAILED => "MODEL_INSTALL_FAILED",
            ErrorCode::MODEL_GENERAL => "MODEL_GENERAL",
            ErrorCode::DB_CONNECTION_FAILED => "DB_CONNECTION_FAILED",
            ErrorCode::DB_QUERY_FAILED => "DB_QUERY_FAILED",
            ErrorCode::DB_NOT_FOUND => "DB_NOT_FOUND",
            ErrorCode::DB_GENERAL => "DB_GENERAL",
            ErrorCode::VALIDATION_INVALID_INPUT => "VALIDATION_INVALID_INPUT",
            ErrorCode::VALIDATION_MISSING_FIELD => "VALIDATION_MISSING_FIELD",
            ErrorCode::VALIDATION_OUT_OF_RANGE => "VALIDATION_OUT_OF_RANGE",
            ErrorCode::VALIDATION_GENERAL => "VALIDATION_GENERAL",
            ErrorCode::IO_FILE_NOT_FOUND => "IO_FILE_NOT_FOUND",
            ErrorCode::IO_PERMISSION_DENIED => "IO_PERMISSION_DENIED",
            ErrorCode::IO_READ_FAILED => "IO_READ_FAILED",
            ErrorCode::IO_WRITE_FAILED => "IO_WRITE_FAILED",
            ErrorCode::IO_GENERAL => "IO_GENERAL",
            ErrorCode::PROCESS_NOT_FOUND => "PROCESS_NOT_FOUND",
            ErrorCode::PROCESS_START_FAILED => "PROCESS_START_FAILED",
            ErrorCode::PROCESS_STOP_FAILED => "PROCESS_STOP_FAILED",
            ErrorCode::PROCESS_GENERAL => "PROCESS_GENERAL",
            ErrorCode::AUTH_FAILED => "AUTH_FAILED",
            ErrorCode::AUTH_INVALID_TOKEN => "AUTH_INVALID_TOKEN",
            ErrorCode::AUTH_EXPIRED => "AUTH_EXPIRED",
            ErrorCode::AUTH_GENERAL => "AUTH_GENERAL",
            ErrorCode::CONNECTION_TIMEOUT => "CONNECTION_TIMEOUT",
            ErrorCode::CONNECTION_REFUSED => "CONNECTION_REFUSED",
            ErrorCode::CONNECTION_GENERAL => "CONNECTION_GENERAL",
            ErrorCode::UNKNOWN_ERROR => "UNKNOWN_ERROR",
        }
    }
}

/// アプリケーションエラー型
#[derive(Debug, Serialize, Deserialize, Error)]
pub enum AppError {
    /// Ollama関連のエラー
    #[error("Ollamaの操作中にエラーが発生しました: {message}")]
    OllamaError {
        message: String,
        #[serde(skip)]
        source_detail: Option<String>,
    },
    /// API関連のエラー
    #[error("APIの操作中にエラーが発生しました: {message} (コード: {code})")]
    ApiError {
        message: String,
        code: String,
        #[serde(skip)]
        source_detail: Option<String>,
    },
    /// モデル関連のエラー
    #[error("モデルの操作中にエラーが発生しました: {message}")]
    ModelError {
        message: String,
        #[serde(skip)]
        source_detail: Option<String>,
    },
    /// データベース関連のエラー
    #[error("データベースの操作中にエラーが発生しました: {message}")]
    DatabaseError {
        message: String,
        #[serde(skip)]
        source_detail: Option<String>,
    },
    /// バリデーションエラー
    #[error("入力データの検証に失敗しました: {message}")]
    ValidationError {
        message: String,
        #[serde(skip)]
        source_detail: Option<String>,
    },
    /// IOエラー
    #[error("ファイルの操作中にエラーが発生しました: {message}")]
    IoError {
        message: String,
        #[serde(skip)]
        source_detail: Option<String>,
    },
    /// プロセスエラー
    #[error("プロセスの操作中にエラーが発生しました: {message}")]
    ProcessError {
        message: String,
        #[serde(skip)]
        source_detail: Option<String>,
    },
    /// 認証関連のエラー
    #[error("認証プロキシの操作中にエラーが発生しました: {message}")]
    AuthError {
        message: String,
        #[serde(skip)]
        source_detail: Option<String>,
    },
    /// 接続エラー（API接続失敗など）
    #[error("接続エラーが発生しました: {message}")]
    ConnectionError {
        message: String,
        #[serde(skip)]
        source_detail: Option<String>,
    },
}

impl AppError {
    /// エラーメッセージから機密情報をマスク処理（プライバシー保護）
    fn mask_sensitive_info(message: &str) -> String {
        let mut masked = mask_file_path(message);

        // 環境変数のパターンを検出してマスク
        // 例: "FLM_DATA_DIR=C:\Users\username\..." -> "FLM_DATA_DIR=***"
        if let Ok(env_pattern) = regex::Regex::new(r"([A-Z_][A-Z0-9_]*)=([^\s]+)") {
            masked = env_pattern
                .replace_all(&masked, |caps: &regex::Captures| {
                    let var_name = &caps[1];
                    let var_value = &caps[2];
                    format!("{}={}", var_name, mask_env_var_value(var_value))
                })
                .to_string();
        }

        // APIキー、パスワード、トークンなどの機密情報パターンをマスク
        let sensitive_patterns = vec![
            // APIキー関連
            (
                r"(?i)(api[_-]?key|apikey)\s*[:=]\s*([^\s]+)",
                r"$1=***MASKED***",
            ),
            // パスワード関連
            (
                r"(?i)(password|passwd|pwd|pass)\s*[:=]\s*([^\s]+)",
                r"$1=***MASKED***",
            ),
            // トークン関連
            (
                r"(?i)(token|bearer|jwt|access_token|refresh_token)\s*[:=]\s*([^\s]+)",
                r"$1=***MASKED***",
            ),
            // シークレット関連
            (
                r"(?i)(secret|private_key|public_key)\s*[:=]\s*([^\s]+)",
                r"$1=***MASKED***",
            ),
            // 認証情報
            (
                r"(?i)(authorization|auth)\s*[:=]\s*([^\s]+)",
                r"$1=***MASKED***",
            ),
        ];

        for (pattern, replacement) in sensitive_patterns {
            if let Ok(re) = regex::Regex::new(pattern) {
                masked = re.replace_all(&masked, replacement).to_string();
            }
        }

        masked
    }

    /// エラーメッセージをマスク処理して返す（プライバシー保護）
    pub fn with_masked_message(mut self) -> Self {
        match &mut self {
            AppError::OllamaError { message, .. } => {
                *message = Self::mask_sensitive_info(message);
            }
            AppError::ApiError { message, .. } => {
                *message = Self::mask_sensitive_info(message);
            }
            AppError::ModelError { message, .. } => {
                *message = Self::mask_sensitive_info(message);
            }
            AppError::DatabaseError { message, .. } => {
                *message = Self::mask_sensitive_info(message);
            }
            AppError::ValidationError { message, .. } => {
                *message = Self::mask_sensitive_info(message);
            }
            AppError::IoError { message, .. } => {
                *message = Self::mask_sensitive_info(message);
            }
            AppError::ProcessError { message, .. } => {
                *message = Self::mask_sensitive_info(message);
            }
            AppError::AuthError { message, .. } => {
                *message = Self::mask_sensitive_info(message);
            }
            AppError::ConnectionError { message, .. } => {
                *message = Self::mask_sensitive_info(message);
            }
        }
        self
    }

    /// エラーの原因を設定
    pub fn with_source(mut self, source: impl Into<String>) -> Self {
        match &mut self {
            AppError::OllamaError {
                source_detail: s, ..
            } => *s = Some(source.into()),
            AppError::ApiError {
                source_detail: s, ..
            } => *s = Some(source.into()),
            AppError::ModelError {
                source_detail: s, ..
            } => *s = Some(source.into()),
            AppError::DatabaseError {
                source_detail: s, ..
            } => *s = Some(source.into()),
            AppError::ValidationError {
                source_detail: s, ..
            } => *s = Some(source.into()),
            AppError::IoError {
                source_detail: s, ..
            } => *s = Some(source.into()),
            AppError::ProcessError {
                source_detail: s, ..
            } => *s = Some(source.into()),
            AppError::AuthError {
                source_detail: s, ..
            } => *s = Some(source.into()),
            AppError::ConnectionError {
                source_detail: s, ..
            } => *s = Some(source.into()),
        }
        self
    }

    /// 接続エラーかどうかを判定
    pub fn is_connection_error(&self) -> bool {
        matches!(self, AppError::ConnectionError { .. })
            || matches!(self, AppError::ApiError { code, .. } if code == "CONNECTION_ERROR")
    }

    /// DatabaseErrorを簡単に作成するヘルパー関数
    pub fn database_error(message: impl Into<String>) -> Self {
        AppError::DatabaseError {
            message: message.into(),
            source_detail: None,
        }
    }

    /// ApiErrorを簡単に作成するヘルパー関数
    pub fn api_error(message: impl Into<String>, code: impl Into<String>) -> Self {
        AppError::ApiError {
            message: message.into(),
            code: code.into(),
            source_detail: None,
        }
    }

    /// IoErrorを簡単に作成するヘルパー関数
    pub fn io_error(message: impl Into<String>) -> Self {
        AppError::IoError {
            message: message.into(),
            source_detail: None,
        }
    }

    /// OllamaErrorを簡単に作成するヘルパー関数
    pub fn ollama_error(message: impl Into<String>) -> Self {
        AppError::OllamaError {
            message: message.into(),
            source_detail: None,
        }
    }

    /// ModelErrorを簡単に作成するヘルパー関数
    pub fn model_error(message: impl Into<String>) -> Self {
        AppError::ModelError {
            message: message.into(),
            source_detail: None,
        }
    }

    /// ValidationErrorを簡単に作成するヘルパー関数
    pub fn validation_error(message: impl Into<String>) -> Self {
        AppError::ValidationError {
            message: message.into(),
            source_detail: None,
        }
    }

    /// ProcessErrorを簡単に作成するヘルパー関数
    pub fn process_error(message: impl Into<String>) -> Self {
        AppError::ProcessError {
            message: message.into(),
            source_detail: None,
        }
    }

    /// AuthErrorを簡単に作成するヘルパー関数
    pub fn auth_error(message: impl Into<String>) -> Self {
        AppError::AuthError {
            message: message.into(),
            source_detail: None,
        }
    }

    /// ConnectionErrorを簡単に作成するヘルパー関数
    pub fn connection_error(message: impl Into<String>) -> Self {
        AppError::ConnectionError {
            message: message.into(),
            source_detail: None,
        }
    }

    /// エラーコードを取得（監査レポートの推奨事項に基づき追加）
    pub fn error_code(&self) -> ErrorCode {
        match self {
            AppError::OllamaError { message, .. } => {
                let msg_lower = message.to_lowercase();
                if msg_lower.contains("not found") || msg_lower.contains("見つかりません") {
                    ErrorCode::OLLAMA_NOT_FOUND
                } else if msg_lower.contains("connection") || msg_lower.contains("接続") {
                    ErrorCode::OLLAMA_CONNECTION_FAILED
                } else if msg_lower.contains("start") || msg_lower.contains("起動") {
                    ErrorCode::OLLAMA_START_FAILED
                } else {
                    ErrorCode::OLLAMA_GENERAL
                }
            }
            AppError::ApiError { code, .. } => {
                // 既存のコード文字列からErrorCodeを推測
                match code.as_str() {
                    "PORT_IN_USE" | "API_PORT_IN_USE" => ErrorCode::API_PORT_IN_USE,
                    "PORT_INVALID" | "API_PORT_INVALID" => ErrorCode::API_PORT_INVALID,
                    "PORT_NOT_FOUND" | "API_PORT_NOT_FOUND" => ErrorCode::API_PORT_NOT_FOUND,
                    "AUTH_PROXY_START_FAILED" | "API_AUTH_PROXY_START_FAILED" => {
                        ErrorCode::API_AUTH_PROXY_START_FAILED
                    }
                    "CONNECTION_ERROR" | "API_CONNECTION_ERROR" => ErrorCode::API_CONNECTION_ERROR,
                    _ => ErrorCode::API_GENERAL,
                }
            }
            AppError::ModelError { message, .. } => {
                let msg_lower = message.to_lowercase();
                if msg_lower.contains("not found") || msg_lower.contains("見つかりません") {
                    ErrorCode::MODEL_NOT_FOUND
                } else if msg_lower.contains("download") || msg_lower.contains("ダウンロード")
                {
                    ErrorCode::MODEL_DOWNLOAD_FAILED
                } else if msg_lower.contains("install") || msg_lower.contains("インストール")
                {
                    ErrorCode::MODEL_INSTALL_FAILED
                } else {
                    ErrorCode::MODEL_GENERAL
                }
            }
            AppError::DatabaseError { message, .. } => {
                let msg_lower = message.to_lowercase();
                if msg_lower.contains("connection") || msg_lower.contains("接続") {
                    ErrorCode::DB_CONNECTION_FAILED
                } else if msg_lower.contains("query") || msg_lower.contains("クエリ") {
                    ErrorCode::DB_QUERY_FAILED
                } else if msg_lower.contains("not found") || msg_lower.contains("見つかりません")
                {
                    ErrorCode::DB_NOT_FOUND
                } else {
                    ErrorCode::DB_GENERAL
                }
            }
            AppError::ValidationError { .. } => ErrorCode::VALIDATION_GENERAL,
            AppError::IoError { message, .. } => {
                let msg_lower = message.to_lowercase();
                if msg_lower.contains("not found") || msg_lower.contains("見つかりません") {
                    ErrorCode::IO_FILE_NOT_FOUND
                } else if msg_lower.contains("permission") || msg_lower.contains("権限") {
                    ErrorCode::IO_PERMISSION_DENIED
                } else if msg_lower.contains("read") || msg_lower.contains("読み込み") {
                    ErrorCode::IO_READ_FAILED
                } else if msg_lower.contains("write") || msg_lower.contains("書き込み") {
                    ErrorCode::IO_WRITE_FAILED
                } else {
                    ErrorCode::IO_GENERAL
                }
            }
            AppError::ProcessError { message, .. } => {
                let msg_lower = message.to_lowercase();
                if msg_lower.contains("not found") || msg_lower.contains("見つかりません") {
                    ErrorCode::PROCESS_NOT_FOUND
                } else if msg_lower.contains("start") || msg_lower.contains("起動") {
                    ErrorCode::PROCESS_START_FAILED
                } else if msg_lower.contains("stop") || msg_lower.contains("停止") {
                    ErrorCode::PROCESS_STOP_FAILED
                } else {
                    ErrorCode::PROCESS_GENERAL
                }
            }
            AppError::AuthError { message, .. } => {
                let msg_lower = message.to_lowercase();
                if msg_lower.contains("invalid") || msg_lower.contains("無効") {
                    ErrorCode::AUTH_INVALID_TOKEN
                } else if msg_lower.contains("expired") || msg_lower.contains("期限切れ") {
                    ErrorCode::AUTH_EXPIRED
                } else if msg_lower.contains("failed") || msg_lower.contains("失敗") {
                    ErrorCode::AUTH_FAILED
                } else {
                    ErrorCode::AUTH_GENERAL
                }
            }
            AppError::ConnectionError { message, .. } => {
                let msg_lower = message.to_lowercase();
                if msg_lower.contains("timeout") || msg_lower.contains("タイムアウト") {
                    ErrorCode::CONNECTION_TIMEOUT
                } else if msg_lower.contains("refused") || msg_lower.contains("拒否") {
                    ErrorCode::CONNECTION_REFUSED
                } else {
                    ErrorCode::CONNECTION_GENERAL
                }
            }
        }
    }

    /// エラーコードを文字列として取得
    pub fn error_code_str(&self) -> &'static str {
        self.error_code().as_str()
    }
}

impl From<AppError> for String {
    fn from(error: AppError) -> Self {
        error.to_string()
    }
}

// thiserrorが自動的にstd::error::Errorを実装するため、手動実装は不要

impl From<rusqlite::Error> for AppError {
    fn from(err: rusqlite::Error) -> Self {
        AppError::DatabaseError {
            message: err.to_string(),
            source_detail: Some(format!("{:?}", err)),
        }
        .with_masked_message()
    }
}

impl From<std::io::Error> for AppError {
    fn from(err: std::io::Error) -> Self {
        AppError::IoError {
            message: err.to_string(),
            source_detail: Some(format!("{:?}", err)),
        }
        .with_masked_message()
    }
}

impl From<reqwest::Error> for AppError {
    fn from(err: reqwest::Error) -> Self {
        if err.is_connect() || err.is_timeout() {
            AppError::ConnectionError {
                message: format!("ネットワーク接続エラー: {}", err),
                source_detail: Some(format!("{:?}", err)),
            }
            .with_masked_message()
        } else {
            AppError::ApiError {
                message: format!("HTTPリクエストエラー: {}", err),
                code: "HTTP_ERROR".to_string(),
                source_detail: Some(format!("{:?}", err)),
            }
            .with_masked_message()
        }
    }
}

impl Clone for AppError {
    fn clone(&self) -> Self {
        match self {
            AppError::OllamaError {
                message,
                source_detail,
            } => AppError::OllamaError {
                message: message.clone(),
                source_detail: source_detail.clone(),
            },
            AppError::ApiError {
                message,
                code,
                source_detail,
            } => AppError::ApiError {
                message: message.clone(),
                code: code.clone(),
                source_detail: source_detail.clone(),
            },
            AppError::ModelError {
                message,
                source_detail,
            } => AppError::ModelError {
                message: message.clone(),
                source_detail: source_detail.clone(),
            },
            AppError::DatabaseError {
                message,
                source_detail,
            } => AppError::DatabaseError {
                message: message.clone(),
                source_detail: source_detail.clone(),
            },
            AppError::ValidationError {
                message,
                source_detail,
            } => AppError::ValidationError {
                message: message.clone(),
                source_detail: source_detail.clone(),
            },
            AppError::IoError {
                message,
                source_detail,
            } => AppError::IoError {
                message: message.clone(),
                source_detail: source_detail.clone(),
            },
            AppError::ProcessError {
                message,
                source_detail,
            } => AppError::ProcessError {
                message: message.clone(),
                source_detail: source_detail.clone(),
            },
            AppError::AuthError {
                message,
                source_detail,
            } => AppError::AuthError {
                message: message.clone(),
                source_detail: source_detail.clone(),
            },
            AppError::ConnectionError {
                message,
                source_detail,
            } => AppError::ConnectionError {
                message: message.clone(),
                source_detail: source_detail.clone(),
            },
        }
    }
}
