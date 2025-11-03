// Database Module

pub mod schema;
pub mod repository;
pub mod connection;
pub mod migrations;
pub mod encryption;
pub mod integrity;

pub mod models;

/// データベースエラー型
#[derive(Debug)]
pub enum DatabaseError {
    #[allow(dead_code)] // Display実装で使用されるが、フィールドは直接参照されない
    ConnectionFailed(String),
    #[allow(dead_code)] // Display実装で使用されるが、フィールドは直接参照されない
    QueryFailed(String),
    #[allow(dead_code)] // Display実装で使用されるが、フィールドは直接参照されない
    MigrationFailed(String),
    NotFound(String),
    #[allow(dead_code)] // 将来の使用のために保持
    InvalidData(String),
}

impl std::fmt::Display for DatabaseError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            DatabaseError::ConnectionFailed(_) => write!(f, "データの読み込み・保存に失敗しました。アプリを再起動して再度お試しください。"),
            DatabaseError::QueryFailed(_) => write!(f, "データの操作に失敗しました。アプリを再起動して再度お試しください。"),
            DatabaseError::MigrationFailed(_) => write!(f, "データベースの更新に失敗しました。アプリを再起動して再度お試しください。"),
            DatabaseError::NotFound(msg) => write!(f, "お探しのデータが見つかりませんでした: {}", msg),
            DatabaseError::InvalidData(msg) => write!(f, "データの形式が正しくありません: {}", msg),
        }
    }
}

impl std::error::Error for DatabaseError {}

impl From<rusqlite::Error> for DatabaseError {
    fn from(err: rusqlite::Error) -> Self {
        DatabaseError::QueryFailed(err.to_string())
    }
}

impl From<std::io::Error> for DatabaseError {
    fn from(err: std::io::Error) -> Self {
        DatabaseError::ConnectionFailed(err.to_string())
    }
}

/// データベース接続を取得
pub use connection::get_connection;

/// データベースを初期化
/// スキーマを作成し、マイグレーションを実行します
pub fn init_database() -> Result<(), DatabaseError> {
    let mut conn = connection::get_connection()?;
    
    // スキーマの作成
    schema::create_schema(&conn)?;
    
    // マイグレーションの実行
    migrations::run_migrations(&mut conn)?;
    
    Ok(())
}