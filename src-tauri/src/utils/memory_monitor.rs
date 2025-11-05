// Memory Monitor Module
// メモリ監視機能: メモリリーク検出と監視機能

use crate::utils::error::AppError;
use serde::{Deserialize, Serialize};
use sysinfo::{System, SystemExt, ProcessExt, Pid};

/// メモリ使用状況
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryUsage {
    pub current_memory_bytes: u64,
    pub peak_memory_bytes: u64,
    pub memory_limit_bytes: u64,
    pub usage_percentage: f64,
    pub is_healthy: bool,
}

/// メモリ監視設定
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryMonitorConfig {
    pub warning_threshold_mb: u64,      // 警告閾値（MB）
    pub critical_threshold_mb: u64,      // クリティカル閾値（MB）
    pub memory_limit_mb: u64,            // メモリ制限（MB）
    pub check_interval_seconds: u64,      // チェック間隔（秒）
    pub enable_auto_cleanup: bool,       // 自動クリーンアップ有効化
}

impl Default for MemoryMonitorConfig {
    fn default() -> Self {
        MemoryMonitorConfig {
            warning_threshold_mb: 1024,      // 1GB
            critical_threshold_mb: 2048,     // 2GB
            memory_limit_mb: 4096,           // 4GB
            check_interval_seconds: 60,      // 1分ごと
            enable_auto_cleanup: true,
        }
    }
}

/// メモリ使用量を取得
pub fn get_memory_usage() -> Result<MemoryUsage, AppError> {
    let mut system = System::new();
    system.refresh_processes();
    
    let pid = Pid::from(std::process::id() as usize);
    
    if let Some(process) = system.process(pid) {
        let current_memory = process.memory(); // バイト単位
        let peak_memory = process.memory(); // 実際の実装では、ピークメモリを追跡する必要がある
        
        let config = MemoryMonitorConfig::default();
        let memory_limit = config.memory_limit_mb * 1024 * 1024;
        let usage_percentage = (current_memory as f64 / memory_limit as f64) * 100.0;
        
        let is_healthy = current_memory < memory_limit && 
                        current_memory < (config.warning_threshold_mb * 1024 * 1024);
        
        Ok(MemoryUsage {
            current_memory_bytes: current_memory,
            peak_memory_bytes: peak_memory,
            memory_limit_bytes: memory_limit,
            usage_percentage,
            is_healthy,
        })
    } else {
        Err(AppError::ApiError {
            message: "プロセス情報を取得できませんでした".to_string(),
            code: "PROCESS_NOT_FOUND".to_string(),
        })
    }
}

/// メモリヘルスチェック
pub fn check_memory_health(config: &MemoryMonitorConfig) -> Result<MemoryHealthResult, AppError> {
    let usage = get_memory_usage()?;
    
    let warning_threshold = config.warning_threshold_mb * 1024 * 1024;
    let critical_threshold = config.critical_threshold_mb * 1024 * 1024;
    
    let status = if usage.current_memory_bytes >= critical_threshold {
        MemoryHealthStatus::Critical
    } else if usage.current_memory_bytes >= warning_threshold {
        MemoryHealthStatus::Warning
    } else {
        MemoryHealthStatus::Healthy
    };
    
    let recommendation = get_memory_recommendation(&usage, config);
    Ok(MemoryHealthResult {
        usage,
        status,
        recommendation,
    })
}

/// メモリヘルスステータス
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MemoryHealthStatus {
    Healthy,
    Warning,
    Critical,
}

/// メモリヘルスチェック結果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryHealthResult {
    pub usage: MemoryUsage,
    pub status: MemoryHealthStatus,
    pub recommendation: String,
}

/// メモリ使用量に基づく推奨事項を取得
fn get_memory_recommendation(usage: &MemoryUsage, config: &MemoryMonitorConfig) -> String {
    if usage.current_memory_bytes >= config.critical_threshold_mb * 1024 * 1024 {
        "メモリ使用量がクリティカルレベルに達しています。不要なAPIを停止するか、アプリを再起動することを推奨します。".to_string()
    } else if usage.current_memory_bytes >= config.warning_threshold_mb * 1024 * 1024 {
        "メモリ使用量が警告レベルに達しています。使用していないAPIを停止することを推奨します。".to_string()
    } else {
        "メモリ使用量は正常範囲内です。".to_string()
    }
}

/// メモリリークを検出
pub fn detect_memory_leak(
    previous_usage: Option<&MemoryUsage>,
    current_usage: &MemoryUsage,
    time_elapsed_seconds: u64,
) -> Option<MemoryLeakAlert> {
    if let Some(prev) = previous_usage {
        let memory_increase = current_usage.current_memory_bytes.saturating_sub(prev.current_memory_bytes);
        let increase_per_second = memory_increase as f64 / time_elapsed_seconds as f64;
        
        // 1秒あたり10MB以上の増加はメモリリークの可能性がある
        if increase_per_second > 10.0 * 1024.0 * 1024.0 {
            return Some(MemoryLeakAlert {
                memory_increase_bytes: memory_increase,
                increase_rate_bytes_per_second: increase_per_second,
                severity: if increase_per_second > 50.0 * 1024.0 * 1024.0 {
                    "critical".to_string()
                } else {
                    "warning".to_string()
                },
                message: format!(
                    "メモリリークの可能性が検出されました。{}秒間に{}MBのメモリが増加しています。",
                    time_elapsed_seconds,
                    memory_increase / (1024 * 1024)
                ),
            });
        }
    }
    
    None
}

/// メモリリークアラート
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryLeakAlert {
    pub memory_increase_bytes: u64,
    pub increase_rate_bytes_per_second: f64,
    pub severity: String,
    pub message: String,
}

/// メモリ監視を開始
pub async fn start_memory_monitoring(
    config: MemoryMonitorConfig,
) -> Result<(), AppError> {
    let mut previous_usage: Option<MemoryUsage> = None;
    let mut start_time = std::time::SystemTime::now();
    
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(
            std::time::Duration::from_secs(config.check_interval_seconds)
        );
        
        loop {
            interval.tick().await;
            
            match get_memory_usage() {
                Ok(current_usage) => {
                    // メモリヘルスチェック
                    if let Ok(health) = check_memory_health(&config) {
                        match health.status {
                            MemoryHealthStatus::Critical | MemoryHealthStatus::Warning => {
                                eprintln!("⚠️ メモリ警告: {}", health.recommendation);
                            }
                            _ => {}
                        }
                    }
                    
                    // メモリリーク検出
                    let elapsed = start_time.elapsed().unwrap_or_default().as_secs();
                    if let Some(alert) = detect_memory_leak(previous_usage.as_ref(), &current_usage, elapsed) {
                        eprintln!("🚨 メモリリーク検出: {}", alert.message);
                    }
                    
                    previous_usage = Some(current_usage);
                    start_time = std::time::SystemTime::now();
                }
                Err(e) => {
                    eprintln!("メモリ監視エラー: {}", e);
                }
            }
        }
    });
    
    Ok(())
}

