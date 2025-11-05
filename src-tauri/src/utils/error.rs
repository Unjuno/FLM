// エラーハンドリングユーティリティ
// アプリケーション全体で使用するエラー型を定義します。

use serde::{Deserialize, Serialize};

/// アプリケーションエラー型
#[derive(Debug, Serialize, Deserialize)]
pub enum AppError {
    /// Ollama関連のエラー
    OllamaError { message: String },
    /// API関連のエラー
    ApiError { message: String, code: String },
    /// モデル関連のエラー
    ModelError { message: String },
    /// データベース関連のエラー
    DatabaseError { message: String },
    /// バリデーションエラー
    ValidationError { message: String },
    /// IOエラー
    IoError { message: String },
    /// プロセスエラー
    ProcessError { message: String },
    /// 認証関連のエラー
    AuthError { message: String },
}

impl From<AppError> for String {
    fn from(error: AppError) -> Self {
        match error {
            AppError::OllamaError { message } => {
                format!("Ollamaの操作中にエラーが発生しました: {}", message)
            }
            AppError::ApiError { message, .. } => {
                format!("APIの操作中にエラーが発生しました: {}", message)
            }
            AppError::ModelError { message } => {
                format!("モデルの操作中にエラーが発生しました: {}", message)
            }
            AppError::DatabaseError { message } => {
                format!("データベースの操作中にエラーが発生しました: {}", message)
            }
            AppError::ValidationError { message } => {
                format!("入力データの検証に失敗しました: {}", message)
            }
            AppError::IoError { message } => {
                format!("ファイルの操作中にエラーが発生しました: {}", message)
            }
            AppError::ProcessError { message } => {
                format!("プロセスの操作中にエラーが発生しました: {}", message)
            }
            AppError::AuthError { message } => {
                format!("認証プロキシの操作中にエラーが発生しました: {}", message)
            }
        }
    }
}

impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let message: String = self.clone().into();
        write!(f, "{}", message)
    }
}

impl std::error::Error for AppError {}

impl From<rusqlite::Error> for AppError {
    fn from(err: rusqlite::Error) -> Self {
        AppError::DatabaseError {
            message: err.to_string(),
        }
    }
}

impl From<std::io::Error> for AppError {
    fn from(err: std::io::Error) -> Self {
        AppError::IoError {
            message: err.to_string(),
        }
    }
}

impl Clone for AppError {
    fn clone(&self) -> Self {
        match self {
            AppError::OllamaError { message } => AppError::OllamaError {
                message: message.clone(),
            },
            AppError::ApiError { message, code } => AppError::ApiError {
                message: message.clone(),
                code: code.clone(),
            },
            AppError::ModelError { message } => AppError::ModelError {
                message: message.clone(),
            },
            AppError::DatabaseError { message } => AppError::DatabaseError {
                message: message.clone(),
            },
            AppError::ValidationError { message } => AppError::ValidationError {
                message: message.clone(),
            },
            AppError::IoError { message } => AppError::IoError {
                message: message.clone(),
            },
            AppError::ProcessError { message } => AppError::ProcessError {
                message: message.clone(),
            },
            AppError::AuthError { message } => AppError::AuthError {
                message: message.clone(),
            },
        }
    }
}
