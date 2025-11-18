/// アプリケーション初期化・ライフサイクル管理モジュール
///
/// このモジュールは、アプリケーションの初期化、クリーンアップ、状態管理を担当します。

pub mod api_sync;
pub mod cleanup;
pub mod initialization;
pub mod runtime;
pub mod settings;

pub use api_sync::spawn_startup_task;
pub use cleanup::setup_cleanup_handler;
pub use initialization::initialize_application;
