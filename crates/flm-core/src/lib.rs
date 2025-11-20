//! # FLM Core
//!
//! FLM (Flexible LLM Manager) の Domain 層実装。
//! ビジネスロジックと抽象ポートを提供し、CLI / UI / Proxy から共通利用される。
//!
//! ## Architecture
//!
//! - **Domain**: 純粋なビジネスロジック（エンジン検出、モデル管理、API設定）
//! - **Ports**: 抽象化されたインターフェース（Repository, HTTP, Proxy等のtrait）
//! - **Use Cases**: アプリケーションロジック（認証、プロキシ、ログ管理）
//!
//! ## Modules
//!
//! - `domain`: ドメインモデル（Engine, Model, ProxyProfile, SecurityPolicy等）
//! - `ports`: 抽象ポート定義（Repository trait, HTTP trait等）
//! - `use_cases`: ユースケース実装（エンジン検出、モデル一覧取得、プロキシ起動等）

pub mod domain;
pub mod ports;
pub mod use_cases;
pub mod error;

pub use error::{FLMError, Result};

/// FLM Core のバージョン
pub const VERSION: &str = env!("CARGO_PKG_VERSION");
