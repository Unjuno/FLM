// FLM - Database Commands
// データベース関連のIPCコマンド
// 
// フェーズ4: データベースエージェント (DB) 実装

use serde::{Deserialize, Serialize};
use crate::database::integrity::{check_integrity, fix_integrity_issues};

/// データベース整合性チェック結果（フロントエンドに返す用）
#[derive(Debug, Serialize, Deserialize)]
pub struct IntegrityCheckResultResponse {
    pub check_name: String,
    pub is_valid: bool,
    pub message: String,
    pub issues: Vec<String>,
}

/// データベース整合性チェックサマリー（フロントエンドに返す用）
#[derive(Debug, Serialize, Deserialize)]
pub struct IntegrityCheckSummaryResponse {
    pub checks: Vec<IntegrityCheckResultResponse>,
    pub is_valid: bool,
    pub total_issues: usize,
}

/// データベース整合性チェックコマンド
/// データベースの整合性をチェックし、問題があれば報告します
#[tauri::command]
pub async fn check_database_integrity() -> Result<IntegrityCheckSummaryResponse, String> {
    let summary = check_integrity().map_err(|e| {
        format!("データベース整合性チェックエラー: {}", e)
    })?;
    
    let checks = summary.checks
        .into_iter()
        .map(|check| IntegrityCheckResultResponse {
            check_name: check.check_name,
            is_valid: check.is_valid,
            message: check.message,
            issues: check.issues,
        })
        .collect();
    
    Ok(IntegrityCheckSummaryResponse {
        checks,
        is_valid: summary.is_valid,
        total_issues: summary.total_issues,
    })
}

/// データベース整合性問題の自動修正コマンド
/// 安全に修正できる問題を自動的に修正します
#[tauri::command]
pub async fn fix_database_integrity() -> Result<IntegrityCheckSummaryResponse, String> {
    let summary = fix_integrity_issues().map_err(|e| {
        format!("データベース整合性修正エラー: {}", e)
    })?;
    
    let checks = summary.checks
        .into_iter()
        .map(|check| IntegrityCheckResultResponse {
            check_name: check.check_name,
            is_valid: check.is_valid,
            message: check.message,
            issues: check.issues,
        })
        .collect();
    
    Ok(IntegrityCheckSummaryResponse {
        checks,
        is_valid: summary.is_valid,
        total_issues: summary.total_issues,
    })
}

