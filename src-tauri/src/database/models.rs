// Database Models Module
// データモデル定義

use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

/// API設定情報
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Api {
    pub id: String,
    pub name: String,
    pub model: String,
    pub port: i32,
    pub enable_auth: bool,
    pub status: ApiStatus,
    pub engine_type: Option<String>, // エンジンタイプ（'ollama', 'lm_studio', 'vllm', 'llama_cpp'など）
    pub engine_config: Option<String>, // エンジン固有設定（JSON形式）
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// APIステータス
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum ApiStatus {
    Running,
    Stopped,
    Error,
}

impl ApiStatus {
    pub fn as_str(&self) -> &str {
        match self {
            ApiStatus::Running => "running",
            ApiStatus::Stopped => "stopped",
            ApiStatus::Error => "error",
        }
    }
    
    pub fn from_str(s: &str) -> Self {
        match s {
            "running" => ApiStatus::Running,
            "stopped" => ApiStatus::Stopped,
            "error" => ApiStatus::Error,
            _ => ApiStatus::Stopped,
        }
    }
}

/// APIキー情報
#[derive(Debug, Clone)]
pub struct ApiKey {
    pub id: String,
    pub api_id: String,
    pub key_hash: String,
    pub encrypted_key: Vec<u8>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// モデルカタログ情報
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelCatalog {
    pub name: String,
    pub description: Option<String>,
    pub size: Option<i64>,
    pub parameters: Option<i64>,
    pub category: Option<String>,
    pub recommended: bool,
    pub author: Option<String>,
    pub license: Option<String>,
    pub tags: Option<String>, // JSON配列文字列
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// インストール済みモデル情報
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstalledModel {
    pub name: String,
    pub size: i64,
    pub parameters: Option<i64>,
    pub installed_at: DateTime<Utc>,
    pub last_used_at: Option<DateTime<Utc>>,
    pub usage_count: i32,
}

/// ユーザー設定
#[derive(Debug, Clone)]
#[allow(dead_code)] // 将来使用予定
pub struct UserSetting {
    pub key: String,
    pub value: String,
    pub updated_at: DateTime<Utc>,
}

/// マイグレーション履歴
#[derive(Debug, Clone)]
#[allow(dead_code)] // 将来使用予定（管理機能で使用）
pub struct Migration {
    pub version: i32,
    pub name: String,
    pub applied_at: DateTime<Utc>,
}

/// リクエストログ情報（F006の基盤）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RequestLog {
    pub id: String,
    pub api_id: String,
    pub method: String,
    pub path: String,
    pub request_body: Option<String>,
    pub response_status: Option<i32>,
    pub response_time_ms: Option<i32>,
    pub error_message: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// パフォーマンスメトリクス情報（F007の基盤）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceMetric {
    pub id: i64,
    pub api_id: String,
    pub metric_type: String,
    pub value: f64,
    pub timestamp: DateTime<Utc>,
}

/// アラート履歴情報（F012の基盤）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlertHistory {
    pub id: String,
    pub api_id: String,
    pub alert_type: String,
    pub current_value: f64,
    pub threshold: f64,
    pub message: String,
    pub timestamp: DateTime<Utc>,
    pub resolved_at: Option<DateTime<Utc>>,
}

/// APIセキュリティ設定情報
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiSecuritySettings {
    pub api_id: String,
    pub ip_whitelist: Option<String>, // JSON配列形式
    pub rate_limit_enabled: bool,
    pub rate_limit_requests: i32,
    pub rate_limit_window_seconds: i32,
    pub key_rotation_enabled: bool,
    pub key_rotation_interval_days: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// レート制限追跡情報
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RateLimitTracking {
    pub id: String,
    pub api_id: String,
    pub identifier: String, // APIキーハッシュまたはIPアドレス
    pub request_count: i32,
    pub window_start: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
}