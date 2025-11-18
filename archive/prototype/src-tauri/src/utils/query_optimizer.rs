// Query Optimizer Module
// データベースクエリ最適化: クエリパフォーマンス分析と最適化機能

use crate::database::connection::get_connection;
use crate::utils::error::AppError;
use serde::{Deserialize, Serialize};

/// クエリパフォーマンス分析結果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryAnalysisResult {
    pub query: String,
    pub execution_time_ms: f64,
    pub rows_affected: Option<u64>,
    pub indexes_used: Vec<String>,
    pub recommendations: Vec<String>,
}

/// クエリを分析して最適化提案を取得
pub fn analyze_query(query: &str) -> Result<QueryAnalysisResult, AppError> {
    let conn = get_connection().map_err(|e| AppError::DatabaseError {
        message: format!("データベース接続エラー: {}", e),
        source_detail: Some(format!("{:?}", e)),
    })?;

    // EXPLAIN QUERY PLANを使用してクエリを分析
    let explain_query = format!("EXPLAIN QUERY PLAN {}", query);

    let start_time = std::time::Instant::now();

    // クエリを実行（実際にはEXPLAIN QUERY PLANを実行）
    let mut stmt = conn
        .prepare(&explain_query)
        .map_err(|e| AppError::DatabaseError {
            message: format!("クエリ準備エラー: {}", e),
            source_detail: Some(format!("{:?}", e)),
        })?;

    let rows = stmt
        .query_map([], |row| {
            Ok(format!(
                "{}|{}|{}|{}",
                row.get::<_, i64>(0)?,
                row.get::<_, i64>(1)?,
                row.get::<_, i64>(2)?,
                row.get::<_, String>(3)?,
            ))
        })
        .map_err(|e| AppError::DatabaseError {
            message: format!("クエリ実行エラー: {}", e),
            source_detail: Some(format!("{:?}", e)),
        })?;

    let mut plan_lines = Vec::new();
    for row in rows {
        plan_lines.push(row.map_err(|e| AppError::DatabaseError {
            message: format!("行取得エラー: {}", e),
            source_detail: Some(format!("{:?}", e)),
        })?);
    }

    let execution_time = start_time.elapsed().as_secs_f64() * 1000.0; // ミリ秒

    // インデックス使用状況を分析
    let indexes_used = analyze_index_usage(&plan_lines);

    // 最適化提案を生成
    let recommendations = generate_recommendations(&query, &plan_lines, &indexes_used);

    Ok(QueryAnalysisResult {
        query: query.to_string(),
        execution_time_ms: execution_time,
        rows_affected: None, // 実際の実装では、影響を受けた行数を取得
        indexes_used,
        recommendations,
    })
}

/// インデックス使用状況を分析
fn analyze_index_usage(plan_lines: &[String]) -> Vec<String> {
    let mut indexes = Vec::new();

    for line in plan_lines {
        if line.contains("USING INDEX") {
            // インデックス名を抽出
            if let Some(start) = line.find("USING INDEX") {
                let rest = &line[start + 12..];
                if let Some(end) = rest.find(' ') {
                    indexes.push(rest[..end].to_string());
                } else {
                    indexes.push(rest.trim().to_string());
                }
            }
        }
    }

    indexes
}

/// 最適化提案を生成
fn generate_recommendations(
    query: &str,
    plan_lines: &[String],
    indexes_used: &[String],
) -> Vec<String> {
    let mut recommendations = Vec::new();

    // フルテーブルスキャンの検出
    let has_full_scan = plan_lines
        .iter()
        .any(|line| line.contains("SCAN TABLE") && !line.contains("USING INDEX"));

    if has_full_scan {
        recommendations.push(
            "フルテーブルスキャンが検出されました。適切なインデックスの追加を検討してください。"
                .to_string(),
        );
    }

    // インデックス未使用の検出
    if indexes_used.is_empty() && query.to_uppercase().contains("WHERE") {
        recommendations.push(
            "WHERE句で使用されている列にインデックスが存在しない可能性があります。".to_string(),
        );
    }

    // JOINの最適化提案
    if query.to_uppercase().contains("JOIN") {
        recommendations.push("JOINクエリが検出されました。JOIN条件にインデックスが設定されているか確認してください。".to_string());
    }

    // ORDER BYの最適化提案
    if query.to_uppercase().contains("ORDER BY") {
        recommendations.push("ORDER BY句が検出されました。ソート対象の列にインデックスが設定されているとパフォーマンスが向上します。".to_string());
    }

    recommendations
}

/// データベース全体のクエリ最適化を実行
pub fn optimize_database() -> Result<Vec<String>, AppError> {
    let conn = get_connection().map_err(|e| AppError::DatabaseError {
        message: format!("データベース接続エラー: {}", e),
        source_detail: Some(format!("{:?}", e)),
    })?;

    let mut optimizations = Vec::new();

    // ANALYZEを実行して統計情報を更新
    conn.execute("ANALYZE", [])
        .map_err(|e| AppError::DatabaseError {
            message: format!("ANALYZE実行エラー: {}", e),
            source_detail: Some(format!("{:?}", e)),
        })?;
    optimizations.push("統計情報を更新しました（ANALYZE実行）".to_string());

    // VACUUMを実行してデータベースを最適化
    conn.execute("VACUUM", [])
        .map_err(|e| AppError::DatabaseError {
            message: format!("VACUUM実行エラー: {}", e),
            source_detail: Some(format!("{:?}", e)),
        })?;
    optimizations.push("データベースを最適化しました（VACUUM実行）".to_string());

    // インデックスの再構築（SQLiteでは個別に実行）
    // 実際の実装では、各テーブルのインデックスを再構築

    Ok(optimizations)
}

/// クエリパフォーマンスを測定
pub fn measure_query_performance(
    query: &str,
    iterations: u32,
) -> Result<QueryPerformanceMetrics, AppError> {
    let mut times = Vec::new();

    for _ in 0..iterations {
        let start_time = std::time::Instant::now();

        let conn = get_connection().map_err(|e| AppError::DatabaseError {
            message: format!("データベース接続エラー: {}", e),
            source_detail: Some(format!("{:?}", e)),
        })?;

        conn.execute(query, [])
            .map_err(|e| AppError::DatabaseError {
                message: format!("クエリ実行エラー: {}", e),
                source_detail: Some(format!("{:?}", e)),
            })?;

        let elapsed = start_time.elapsed().as_secs_f64() * 1000.0; // ミリ秒
        times.push(elapsed);
    }

    // NaNを除外してからソート（監査レポート推奨修正）
    times.retain(|&x| x.is_finite());

    // 有効なデータが存在しない場合はエラーを返す
    if times.is_empty() {
        return Err(AppError::ApiError {
            message: "有効なクエリ実行時間データが取得できませんでした。NaNまたは無限大の値のみが含まれています。".to_string(),
            code: "NO_VALID_DATA".to_string(),
            source_detail: None,
        });
    }

    times.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));

    let min_time = times.first().copied().unwrap_or(0.0);
    let max_time = times.last().copied().unwrap_or(0.0);
    let avg_time = times.iter().sum::<f64>() / times.len() as f64;
    let median_time = if times.len() % 2 == 0 {
        (times[times.len() / 2 - 1] + times[times.len() / 2]) / 2.0
    } else {
        times[times.len() / 2]
    };

    Ok(QueryPerformanceMetrics {
        query: query.to_string(),
        iterations,
        min_time_ms: min_time,
        max_time_ms: max_time,
        avg_time_ms: avg_time,
        median_time_ms: median_time,
    })
}

/// クエリパフォーマンスメトリクス
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryPerformanceMetrics {
    pub query: String,
    pub iterations: u32,
    pub min_time_ms: f64,
    pub max_time_ms: f64,
    pub avg_time_ms: f64,
    pub median_time_ms: f64,
}
