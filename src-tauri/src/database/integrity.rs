// Database Integrity Check
// データベース整合性チェック機能
// 
// フェーズ4: データベースエージェント (DB) 実装
// データベースの整合性をチェックし、問題を検出・修正する機能

use rusqlite::{Connection, params};
use crate::database::{DatabaseError, get_connection};
use crate::database::repository::{ApiRepository, ApiKeyRepository, ModelCatalogRepository, InstalledModelRepository};

/// データ整合性チェック結果
#[derive(Debug, Clone)]
pub struct IntegrityCheckResult {
    /// チェック項目名
    pub check_name: String,
    /// チェック結果（true: 問題なし、false: 問題あり）
    pub is_valid: bool,
    /// エラーメッセージ
    pub message: String,
    /// 問題が見つかった場合の詳細情報
    pub issues: Vec<String>,
}

/// データ整合性チェック結果のサマリー
#[derive(Debug, Clone)]
pub struct IntegrityCheckSummary {
    /// 全てのチェック結果
    pub checks: Vec<IntegrityCheckResult>,
    /// 全体の結果（true: 全て問題なし、false: 問題あり）
    pub is_valid: bool,
    /// 問題の総数
    pub total_issues: usize,
}

/// データベース整合性チェックを実行
pub fn check_integrity() -> Result<IntegrityCheckSummary, DatabaseError> {
    let conn = get_connection()?;
    let mut checks = Vec::new();
    let mut total_issues = 0;
    
    // APIとAPIキーの整合性チェック
    let api_key_check = check_api_key_integrity(&conn)?;
    if !api_key_check.is_valid {
        total_issues += api_key_check.issues.len();
    }
    checks.push(api_key_check);
    
    // モデルカタログとインストール済みモデルの整合性チェック
    let model_check = check_model_integrity(&conn)?;
    if !model_check.is_valid {
        total_issues += model_check.issues.len();
    }
    checks.push(model_check);
    
    // データベーススキーマの整合性チェック
    let schema_check = check_schema_integrity(&conn)?;
    if !schema_check.is_valid {
        total_issues += schema_check.issues.len();
    }
    checks.push(schema_check);
    
    let is_valid = total_issues == 0;
    
    Ok(IntegrityCheckSummary {
        checks,
        is_valid,
        total_issues,
    })
}

/// APIとAPIキーの整合性チェック
/// - APIが削除されているのにAPIキーが残っている（orphaned API keys）
/// - 認証が有効なAPIにAPIキーがない
fn check_api_key_integrity(conn: &Connection) -> Result<IntegrityCheckResult, DatabaseError> {
    let mut issues = Vec::new();
    
    let api_repo = ApiRepository::new(conn);
    let key_repo = ApiKeyRepository::new(conn);
    
    // 全てのAPIを取得
    let apis = api_repo.find_all()?;
    
    // 認証が有効なAPIにAPIキーがあるかチェック
    for api in &apis {
        if api.enable_auth {
            match key_repo.find_by_api_id(&api.id) {
                Ok(None) => {
                    issues.push(format!(
                        "API '{}' (ID: {}) は認証が有効ですが、APIキーが存在しません",
                        api.name, api.id
                    ));
                }
                Ok(Some(_)) => {
                    // 正常：認証が有効でAPIキーが存在
                }
                Err(e) => {
                    return Err(e);
                }
            }
        }
    }
    
    // 全てのAPIキーを取得
    let api_keys = key_repo.find_all()?;
    
    // 存在しないAPIに関連付けられたAPIキーをチェック（orphaned keys）
    for api_key in &api_keys {
        match api_repo.find_by_id(&api_key.api_id) {
            Err(DatabaseError::NotFound(_)) => {
                issues.push(format!(
                    "APIキー (ID: {}) は存在しないAPI (API ID: {}) に関連付けられています",
                    api_key.id, api_key.api_id
                ));
            }
            Ok(_) => {
                // 正常：APIが存在する
            }
            Err(e) => {
                return Err(e);
            }
        }
    }
    
    let is_valid = issues.is_empty();
    let message = if is_valid {
        "APIとAPIキーの整合性に問題はありません".to_string()
    } else {
        format!("{}件の整合性問題が見つかりました", issues.len())
    };
    
    Ok(IntegrityCheckResult {
        check_name: "APIキー整合性チェック".to_string(),
        is_valid,
        message,
        issues,
    })
}

/// モデルカタログとインストール済みモデルの整合性チェック
/// - インストール済みモデルがカタログに存在するか
/// - データベースとOllamaの実際の状態の不整合（これは外部API呼び出しが必要なので、基本的なチェックのみ）
fn check_model_integrity(conn: &Connection) -> Result<IntegrityCheckResult, DatabaseError> {
    let mut issues = Vec::new();
    
    let model_catalog_repo = ModelCatalogRepository::new(conn);
    let installed_model_repo = InstalledModelRepository::new(conn);
    
    // 全てのインストール済みモデルを取得
    let installed_models = installed_model_repo.find_all()?;
    
    // インストール済みモデルがカタログに存在するかチェック
    let catalog_models = model_catalog_repo.find_all()?;
    let catalog_model_names: std::collections::HashSet<String> = catalog_models
        .iter()
        .map(|m| m.name.clone())
        .collect();
    
    for installed_model in &installed_models {
        if !catalog_model_names.contains(&installed_model.name) {
            // カタログに存在しないが、インストール済みとして記録されている
            // これは必ずしも問題ではない（Ollamaから直接インストールされた可能性）
            // 警告のみ（正常な動作の可能性が高い）
            issues.push(format!(
                "インストール済みモデル '{}' がカタログに存在しません（警告: Ollamaから直接インストールされたモデルの可能性があります。これは正常な動作です）",
                installed_model.name
            ));
        }
    }
    
    // 重複チェック（同じ名前のインストール済みモデルが複数存在しないか）
    let mut seen_names: std::collections::HashSet<String> = std::collections::HashSet::new();
    for installed_model in &installed_models {
        if seen_names.contains(&installed_model.name) {
            issues.push(format!(
                "インストール済みモデル '{}' が重複して登録されています",
                installed_model.name
            ));
        } else {
            seen_names.insert(installed_model.name.clone());
        }
    }
    
    let is_valid = issues.is_empty();
    let message = if is_valid {
        "モデルデータの整合性に問題はありません".to_string()
    } else {
        format!("{}件の整合性問題が見つかりました", issues.len())
    };
    
    Ok(IntegrityCheckResult {
        check_name: "モデル整合性チェック".to_string(),
        is_valid,
        message,
        issues,
    })
}

/// データベーススキーマの整合性チェック
/// - 必要なテーブルが存在するか
/// - テーブル構造が正しいか（カラムの存在）
fn check_schema_integrity(conn: &Connection) -> Result<IntegrityCheckResult, DatabaseError> {
    let mut issues = Vec::new();
    
    // 必要なテーブルリスト
    let required_tables = vec![
        "apis",
        "api_keys",
        "models_catalog",
        "installed_models",
        "user_settings",
    ];
    
    // 各テーブルの存在をチェック
    for table_name in &required_tables {
        let table_exists = conn.query_row::<bool, _, _>(
            "SELECT COUNT(*) > 0 FROM sqlite_master WHERE type='table' AND name=?1",
            params![table_name],
            |row| Ok(row.get::<_, i32>(0)? > 0),
        );
        
        match table_exists {
            Ok(true) => {
                // テーブルが存在する
            }
            Ok(false) => {
                issues.push(format!("必要なテーブル '{}' が存在しません", table_name));
            }
            Err(e) => {
                return Err(DatabaseError::QueryFailed(format!(
                    "テーブル '{}' の存在確認中にエラーが発生しました: {}",
                    table_name, e
                )));
            }
        }
    }
    
    // 各テーブルの必須カラムをチェック
    let table_columns = vec![
        ("apis", vec!["id", "name", "model", "port", "enable_auth", "status", "created_at", "updated_at"]),
        ("api_keys", vec!["id", "api_id", "key_hash", "encrypted_key", "created_at", "updated_at"]),
        ("models_catalog", vec!["name", "description", "size", "parameters", "created_at", "updated_at"]),
        ("installed_models", vec!["name", "size", "parameters", "installed_at", "last_used_at", "usage_count"]),
    ];
    
    for (table_name, required_columns) in &table_columns {
        for column_name in required_columns {
            let column_exists = conn.query_row::<bool, _, _>(
                "SELECT COUNT(*) > 0 FROM pragma_table_info(?1) WHERE name=?2",
                params![table_name, column_name],
                |row| Ok(row.get::<_, i32>(0)? > 0),
            );
            
            match column_exists {
                Ok(true) => {
                    // カラムが存在する
                }
                Ok(false) => {
                    issues.push(format!(
                        "テーブル '{}' に必要なカラム '{}' が存在しません",
                        table_name, column_name
                    ));
                }
                Err(e) => {
                    return Err(DatabaseError::QueryFailed(format!(
                        "テーブル '{}' のカラム '{}' の存在確認中にエラーが発生しました: {}",
                        table_name, column_name, e
                    )));
                }
            }
        }
    }
    
    let is_valid = issues.is_empty();
    let message = if is_valid {
        "データベーススキーマの整合性に問題はありません".to_string()
    } else {
        format!("{}件の整合性問題が見つかりました", issues.len())
    };
    
    Ok(IntegrityCheckResult {
        check_name: "スキーマ整合性チェック".to_string(),
        is_valid,
        message,
        issues,
    })
}

/// 整合性問題を自動修正
/// 注意：安全に修正できる問題のみを修正します
pub fn fix_integrity_issues() -> Result<IntegrityCheckSummary, DatabaseError> {
    let conn = get_connection()?;
    
    // APIとAPIキーの整合性を修正
    let key_repo = ApiKeyRepository::new(&conn);
    let api_repo = ApiRepository::new(&conn);
    
    // 全てのAPIキーを取得
    let api_keys = key_repo.find_all()?;
    
    // 存在しないAPIに関連付けられたAPIキーを削除（orphaned keys）
    for api_key in &api_keys {
        match api_repo.find_by_id(&api_key.api_id) {
            Err(DatabaseError::NotFound(_)) => {
                // APIが存在しないので、APIキーを削除
                key_repo.delete_by_api_id(&api_key.api_id)?;
            }
            Ok(_) => {
                // 正常：APIが存在する
            }
            Err(e) => {
                return Err(e);
            }
        }
    }
    
    // 再度整合性チェックを実行
    let summary = check_integrity()?;
    
    Ok(summary)
}

