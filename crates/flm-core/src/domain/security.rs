//! Security domain model

use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

/// APIキー
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiKey {
    /// APIキーID
    pub id: String,
    /// キーのハッシュ（平文は保存しない）
    pub key_hash: String,
    /// プレフィックス（表示用、例: "ak_abc..."）
    pub prefix: String,
    /// ラベル
    pub label: Option<String>,
    /// 作成日時
    pub created_at: DateTime<Utc>,
    /// 有効期限
    pub expires_at: Option<DateTime<Utc>>,
    /// 無効化フラグ
    pub revoked: bool,
}

/// IPホワイトリスト
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IpWhitelist {
    /// 許可するIPアドレス/CIDR（例: "192.168.1.0/24"）
    pub allowed_ips: Vec<String>,
}

/// セキュリティポリシー
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityPolicy {
    /// ポリシーID（Phase 1/2では "default" のみ）
    pub id: String,
    /// IPホワイトリスト
    pub ip_whitelist: Option<IpWhitelist>,
    /// CORS許可オリジン
    pub cors_origins: Vec<String>,
    /// レート制限（req/min）
    pub rate_limit: Option<u32>,
}
