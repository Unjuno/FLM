// パフォーマンス監視コマンド
// バックエンドエージェント実装（F007）

use serde::{Deserialize, Serialize};
use crate::database::models::PerformanceMetric;
use crate::database::repository::PerformanceMetricRepository;
use crate::database::connection::get_connection;
use chrono::Utc;

/// パフォーマンスメトリクス記録リクエスト
#[derive(Debug, Serialize, Deserialize)]
pub struct RecordPerformanceMetricRequest {
    pub api_id: String,
    pub metric_type: String,
    pub value: f64,
}

/// パフォーマンスメトリクス記録コマンド
#[tauri::command]
pub async fn record_performance_metric(request: RecordPerformanceMetricRequest) -> Result<(), String> {
    // バリデーション
    let valid_types = ["request_count", "avg_response_time", "error_rate", "cpu_usage", "memory_usage"];
    if !valid_types.contains(&request.metric_type.as_str()) {
        return Err(format!(
            "無効なメトリクスタイプです。有効なタイプ: {}",
            valid_types.join(", ")
        ));
    }
    
    let conn = get_connection().map_err(|_| {
        "データの保存に失敗しました。アプリを再起動して再度お試しください。".to_string()
    })?;
    
    let metric_repo = PerformanceMetricRepository::new(&conn);
    
    let metric = PerformanceMetric {
        id: 0, // AUTOINCREMENTのため0
        api_id: request.api_id,
        metric_type: request.metric_type,
        value: request.value,
        timestamp: Utc::now(),
    };
    
    metric_repo.create(&metric).map_err(|_| {
        "パフォーマンスメトリクスの保存に失敗しました。アプリを再起動して再度お試しください。".to_string()
    })?;
    
    Ok(())
}

/// パフォーマンスメトリクス取得リクエスト
#[derive(Debug, Serialize, Deserialize)]
pub struct GetPerformanceMetricsRequest {
    pub api_id: String,
    pub metric_type: Option<String>,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
}

/// パフォーマンスメトリクス情報（フロントエンド用）
#[derive(Debug, Serialize, Deserialize)]
pub struct PerformanceMetricInfo {
    pub id: i64,
    pub api_id: String,
    pub metric_type: String,
    pub value: f64,
    pub timestamp: String,
}

/// パフォーマンスメトリクス取得コマンド
#[tauri::command]
pub async fn get_performance_metrics(request: GetPerformanceMetricsRequest) -> Result<Vec<PerformanceMetricInfo>, String> {
    let conn = get_connection().map_err(|_| {
        "データの読み込みに失敗しました。アプリを再起動して再度お試しください。".to_string()
    })?;
    
    let metric_repo = PerformanceMetricRepository::new(&conn);
    
    let metrics = if let Some(metric_type) = &request.metric_type {
        metric_repo.find_by_api_id_and_type(&request.api_id, metric_type, None).map_err(|_| {
            "指定されたメトリクスを取得できませんでした。アプリを再起動して再度お試しください。".to_string()
        })?
    } else {
        metric_repo.find_by_api_id(&request.api_id, None).map_err(|_| {
            "指定されたAPIのメトリクスを取得できませんでした。アプリを再起動して再度お試しください。".to_string()
        })?
    };
    
    // 日時範囲でデータベースクエリから取得
    let filtered_metrics = if request.start_date.is_some() || request.end_date.is_some() {
        metric_repo.find_by_api_id_and_range(
            &request.api_id,
            request.start_date.as_deref(),
            request.end_date.as_deref(),
            request.metric_type.as_deref(),
        ).map_err(|_| {
            "指定された範囲のメトリクスを取得できませんでした。アプリを再起動して再度お試しください。".to_string()
        })?
    } else {
        metrics
    };
    
    let result: Vec<PerformanceMetricInfo> = filtered_metrics.into_iter().map(|metric| {
        PerformanceMetricInfo {
            id: metric.id,
            api_id: metric.api_id,
            metric_type: metric.metric_type,
            value: metric.value,
            timestamp: metric.timestamp.to_rfc3339(),
        }
    }).collect();
    
    Ok(result)
}

/// パフォーマンスサマリー取得リクエスト
#[derive(Debug, Serialize, Deserialize)]
pub struct GetPerformanceSummaryRequest {
    pub api_id: String,
    pub period: String, // "1h", "24h", "7d"
}

/// パフォーマンスサマリー情報
#[derive(Debug, Serialize, Deserialize)]
pub struct PerformanceSummary {
    pub avg_response_time: f64,
    pub max_response_time: f64,
    pub min_response_time: f64,
    pub request_count: i64,
    pub error_rate: f64,
    pub avg_cpu_usage: f64,
    pub avg_memory_usage: f64,
}

/// パフォーマンスサマリー取得コマンド
#[tauri::command]
pub async fn get_performance_summary(request: GetPerformanceSummaryRequest) -> Result<PerformanceSummary, String> {
    // 期間を計算
    let duration = match request.period.as_str() {
        "1h" => chrono::Duration::hours(1),
        "24h" => chrono::Duration::hours(24),
        "7d" => chrono::Duration::days(7),
        _ => return Err("無効な期間です。有効な期間: 1h, 24h, 7d".to_string()),
    };
    
    let start_date = (Utc::now() - duration).to_rfc3339();
    
    let conn = get_connection().map_err(|_| {
        "データの読み込みに失敗しました。アプリを再起動して再度お試しください。".to_string()
    })?;
    
    let metric_repo = PerformanceMetricRepository::new(&conn);
    
    // 各メトリクスタイプのデータを取得（期間範囲でフィルタリング）
    let response_time_metrics = metric_repo.find_by_api_id_and_range(&request.api_id, Some(&start_date), None, Some("avg_response_time"))
        .map_err(|_| "レスポンス時間メトリクスの取得に失敗しました".to_string())?;
    
    let request_count_metrics = metric_repo.find_by_api_id_and_range(&request.api_id, Some(&start_date), None, Some("request_count"))
        .map_err(|_| "リクエスト数メトリクスの取得に失敗しました".to_string())?;
    
    let error_rate_metrics = metric_repo.find_by_api_id_and_range(&request.api_id, Some(&start_date), None, Some("error_rate"))
        .map_err(|_| "エラー率メトリクスの取得に失敗しました".to_string())?;
    
    let cpu_metrics = metric_repo.find_by_api_id_and_range(&request.api_id, Some(&start_date), None, Some("cpu_usage"))
        .map_err(|_| "CPU使用率メトリクスの取得に失敗しました".to_string())?;
    
    let memory_metrics = metric_repo.find_by_api_id_and_range(&request.api_id, Some(&start_date), None, Some("memory_usage"))
        .map_err(|_| "メモリ使用量メトリクスの取得に失敗しました".to_string())?;
    
    // 期間で既にフィルタリング済みなのでそのまま使用
    let filtered_response_time = response_time_metrics;
    let filtered_request_count = request_count_metrics;
    let filtered_error_rate = error_rate_metrics;
    let filtered_cpu = cpu_metrics;
    let filtered_memory = memory_metrics;
    
    // 統計を計算
    let avg_response_time = if !filtered_response_time.is_empty() {
        let len = filtered_response_time.len() as f64;
        filtered_response_time.iter().map(|m| m.value).sum::<f64>() / len
    } else {
        0.0
    };
    
    let max_response_time = filtered_response_time.iter()
        .map(|m| m.value)
        .fold(0.0, f64::max);
    
    let min_response_time = if !filtered_response_time.is_empty() {
        filtered_response_time.iter()
            .map(|m| m.value)
            .fold(f64::INFINITY, f64::min)
    } else {
        0.0
    };
    
    let request_count: i64 = filtered_request_count.iter()
        .map(|m| m.value as i64)
        .sum();
    
    let error_rate = if !filtered_error_rate.is_empty() {
        let len = filtered_error_rate.len() as f64;
        filtered_error_rate.iter().map(|m| m.value).sum::<f64>() / len
    } else {
        0.0
    };
    
    let avg_cpu_usage = if !filtered_cpu.is_empty() {
        let len = filtered_cpu.len() as f64;
        filtered_cpu.iter().map(|m| m.value).sum::<f64>() / len
    } else {
        0.0
    };
    
    let avg_memory_usage = if !filtered_memory.is_empty() {
        let len = filtered_memory.len() as f64;
        filtered_memory.iter().map(|m| m.value).sum::<f64>() / len
    } else {
        0.0
    };
    
    Ok(PerformanceSummary {
        avg_response_time,
        max_response_time,
        min_response_time,
        request_count,
        error_rate,
        avg_cpu_usage,
        avg_memory_usage,
    })
}

