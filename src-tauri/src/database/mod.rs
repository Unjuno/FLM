// Database Module

pub mod schema;
pub mod repository;
pub mod connection;
pub mod migrations;
pub mod encryption;
pub mod integrity;

pub mod models;

use rusqlite::Connection;

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
/// 初回起動時にはモデルカタログを自動的に初期化します
/// 定期的に（7日以上経過時）モデルカタログを更新します
pub fn init_database() -> Result<(), DatabaseError> {
    #[cfg(debug_assertions)]
    eprintln!("=== データベース初期化プロセス開始 ===");
    
    // データベース接続の取得（詳細なエラー情報を出力）
    #[cfg(debug_assertions)]
    eprintln!("ステップ1: データベース接続を取得します...");
    let mut conn = match connection::get_connection() {
        Ok(conn) => {
            #[cfg(debug_assertions)]
            eprintln!("✓ データベース接続に成功しました");
            conn
        },
        Err(e) => {
            eprintln!("✗ データベース接続エラー: {:?}", e);
            #[cfg(debug_assertions)]
            eprintln!("[DEBUG] データベースパス: {:?}", connection::get_database_path());
            return Err(e);
        }
    };
    
    // スキーマの作成
    #[cfg(debug_assertions)]
    eprintln!("ステップ2: データベーススキーマを作成します...");
    if let Err(e) = schema::create_schema(&conn) {
        eprintln!("✗ スキーマ作成エラー: {:?}", e);
        eprintln!("エラー詳細: {}", e);
        return Err(e);
    } else {
        #[cfg(debug_assertions)]
        eprintln!("✓ データベーススキーマの作成が完了しました");
    }
    
    // マイグレーションの実行
    #[cfg(debug_assertions)]
    eprintln!("ステップ3: データベースマイグレーションを実行します...");
    if let Err(e) = migrations::run_migrations(&mut conn) {
        eprintln!("✗ マイグレーション実行エラー: {:?}", e);
        eprintln!("エラー詳細: {}", e);
        return Err(e);
    } else {
        #[cfg(debug_assertions)]
        eprintln!("✓ データベースマイグレーションが完了しました");
    }
    
    // モデルカタログの初期化（初回起動時のみ）
    #[cfg(debug_assertions)]
    eprintln!("ステップ4: モデルカタログを初期化します...");
    if let Err(e) = init_model_catalog_if_empty(&conn) {
        eprintln!("警告: モデルカタログ初期化エラー: {:?}", e);
        #[cfg(debug_assertions)]
        eprintln!("注意: モデルカタログの初期化に失敗しましたが、データベース初期化は継続します");
        // モデルカタログの初期化に失敗しても、データベース初期化は成功とする
        // （既存のデータベースを使用できるため）
    } else {
        #[cfg(debug_assertions)]
        eprintln!("✓ モデルカタログの初期化が完了しました");
    }
    
    // モデルカタログの定期更新（7日以上経過時）
    #[cfg(debug_assertions)]
    eprintln!("ステップ5: モデルカタログを更新します...");
    if let Err(e) = update_model_catalog_if_stale(&conn) {
        eprintln!("警告: モデルカタログ更新エラー: {:?}", e);
        #[cfg(debug_assertions)]
        eprintln!("注意: モデルカタログの更新に失敗しましたが、データベース初期化は継続します");
        // モデルカタログの更新に失敗しても、データベース初期化は成功とする
    } else {
        #[cfg(debug_assertions)]
        eprintln!("✓ モデルカタログの更新が完了しました");
    }
    
    #[cfg(debug_assertions)]
    eprintln!("=== データベース初期化プロセス完了 ===");
    Ok(())
}

/// モデルカタログが空の場合、事前定義されたモデル情報を投入
fn init_model_catalog_if_empty(conn: &Connection) -> Result<(), DatabaseError> {
    use repository::ModelCatalogRepository;
    use crate::utils::model_catalog_data::get_predefined_model_catalog;
    
    // モデルカタログが空かどうかを確認
    let catalog_repo = ModelCatalogRepository::new(conn);
    let existing_models = catalog_repo.find_all()
        .map_err(|e| DatabaseError::QueryFailed(format!("モデルカタログの確認に失敗しました: {}", e)))?;
    
    // 空の場合は事前定義されたモデル情報を投入
    if existing_models.is_empty() {
        let predefined_models = get_predefined_model_catalog();
        let model_count = predefined_models.len();
        for model in predefined_models {
            catalog_repo.upsert(&model)
                .map_err(|e| DatabaseError::QueryFailed(format!("モデルカタログの初期化に失敗しました ({}): {}", model.name, e)))?;
        }
        #[cfg(debug_assertions)]
        eprintln!("モデルカタログを初期化しました（{}件のモデルを追加）", model_count);
    }
    
    Ok(())
}

/// モデルカタログが古い場合（7日以上経過）、事前定義されたモデル情報で更新
/// 仕様書の「定期的な更新（日次または週次）」要件を満たす
fn update_model_catalog_if_stale(conn: &Connection) -> Result<(), DatabaseError> {
    use repository::ModelCatalogRepository;
    use crate::utils::model_catalog_data::get_predefined_model_catalog;
    use chrono::Utc;
    
    // モデルカタログの最終更新日を確認
    let catalog_repo = ModelCatalogRepository::new(conn);
    let existing_models = catalog_repo.find_all()
        .map_err(|e| DatabaseError::QueryFailed(format!("モデルカタログの確認に失敗しました: {}", e)))?;
    
    // モデルが存在する場合、最終更新日を確認
    if !existing_models.is_empty() {
        // 最も古い更新日を取得（最も最近更新されたモデルの日付）
        let latest_update = existing_models.iter()
            .map(|m| m.updated_at)
            .max()
            .unwrap_or_else(|| Utc::now());
        
        // 現在日時との差分を計算
        let days_since_update = (Utc::now() - latest_update).num_days();
        
        // 7日以上経過している場合は更新
        if days_since_update >= 7 {
            let predefined_models = get_predefined_model_catalog();
            let mut updated_count = 0;
            
            for model in predefined_models {
                match catalog_repo.upsert(&model) {
                    Ok(_) => updated_count += 1,
                    Err(e) => {
                        // エラーはログに記録するが、処理は続行
                        eprintln!("モデルカタログの更新エラー ({}): {}", model.name, e);
                    }
                }
            }
            
            if updated_count > 0 {
                eprintln!("モデルカタログを定期更新しました（{}件のモデルを更新、最終更新から{}日経過）", updated_count, days_since_update);
            }
        }
    }
    
    Ok(())
}
