//! Proxy domain model

use serde::{Deserialize, Serialize};

/// プロキシの動作モード
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ProxyMode {
    /// ローカルHTTP（開発用）
    LocalHttp,
    /// 自己署名証明書HTTPS（LAN用）
    DevSelfsigned,
    /// ACME自動証明書HTTPS（本番用）
    HttpsAcme,
    /// パッケージ版CA証明書HTTPS（配布用）
    PackagedCa,
}

/// TLS設定
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TlsConfig {
    /// 証明書ファイルパス
    pub cert_path: Option<String>,
    /// 秘密鍵ファイルパス
    pub key_path: Option<String>,
    /// ACMEドメイン
    pub acme_domain: Option<String>,
    /// ACME Email
    pub acme_email: Option<String>,
}

/// プロキシプロファイル
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProxyProfile {
    /// プロファイルID
    pub id: String,
    /// リスンポート
    pub port: u16,
    /// 動作モード
    pub mode: ProxyMode,
    /// TLS設定
    pub tls_config: Option<TlsConfig>,
    /// フォワード先エンジンベースURL
    pub forward_to: String,
    /// セキュリティポリシーID
    pub security_policy_id: String,
}
