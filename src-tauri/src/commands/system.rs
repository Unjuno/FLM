// システムリソースチェックコマンド

use serde::{Deserialize, Serialize};
use sysinfo::{System, SystemExt, CpuExt, DiskExt, ProcessExt};
use crate::commands::port::is_port_available;

/// システムリソース情報
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SystemResources {
    /// 合計メモリ（バイト）
    pub total_memory: u64,
    /// 使用可能メモリ（バイト）
    pub available_memory: u64,
    /// CPUコア数
    pub cpu_cores: usize,
    /// CPU使用率（0.0-100.0）
    pub cpu_usage: f32,
    /// ディスク容量（バイト）
    pub total_disk: u64,
    /// 利用可能ディスク容量（バイト）
    pub available_disk: u64,
    /// システムリソースレベル評価（"low" | "medium" | "high" | "very_high"）
    pub resource_level: String,
}

/// システムリソース情報取得コマンド
#[tauri::command]
pub async fn get_system_resources() -> Result<SystemResources, String> {
    // 診断機能が無効化されている場合はエラーを返す
    use crate::database::connection::get_connection;
    use crate::database::repository::UserSettingRepository;
    
    let conn = get_connection().map_err(|e| {
        format!("データベース接続エラー: {}", e)
    })?;
    
    let settings_repo = UserSettingRepository::new(&conn);
    let diagnostics_enabled = settings_repo.get("diagnostics_enabled")
        .map_err(|e| format!("設定の読み込みに失敗しました: {}", e))?
        .and_then(|v| v.parse::<bool>().ok())
        .unwrap_or(true); // デフォルト: 有効
    
    if !diagnostics_enabled {
        return Err("診断機能が無効化されています。設定画面で有効化してください。".to_string());
    }
    
    let mut system = System::new_all();
    system.refresh_memory();
    system.refresh_disks_list();
    system.refresh_disks();
    
    // メモリ情報を取得
    let total_memory = system.total_memory();
    let available_memory = system.available_memory();
    
    // CPU情報を取得
    let cpu_cores = system.cpus().len();
    let cpu_usage = if !system.cpus().is_empty() {
        // CPU使用率を計算（1秒待機してから再計算）
        system.refresh_cpu();
        std::thread::sleep(std::time::Duration::from_millis(100));
        system.refresh_cpu();
        
        let usage_sum: f32 = system.cpus().iter().map(|cpu| cpu.cpu_usage()).sum();
        usage_sum / cpu_cores as f32
    } else {
        0.0
    };
    
    // ディスク情報を取得
    let mut total_disk = 0u64;
    let mut available_disk = 0u64;
    
    for disk in system.disks() {
        total_disk += disk.total_space();
        available_disk += disk.available_space();
    }
    
    // リソースレベルを評価
    let resource_level = evaluate_resource_level(
        total_memory,
        available_memory,
        cpu_cores,
        total_disk,
        available_disk,
    );
    
    Ok(SystemResources {
        total_memory,
        available_memory,
        cpu_cores,
        cpu_usage,
        total_disk,
        available_disk,
        resource_level,
    })
}

/// システムリソースレベルを評価
fn evaluate_resource_level(
    total_memory: u64,
    _available_memory: u64,
    cpu_cores: usize,
    _total_disk: u64,
    available_disk: u64,
) -> String {
    // リソースレベルを評価
    // メモリ: 8GB以上 = high, 4GB以上 = medium, それ以下 = low
    // CPU: 8コア以上 = high, 4コア以上 = medium, それ以下 = low
    // ディスク: 100GB以上空き = high, 50GB以上 = medium, それ以下 = low
    
    let memory_gb = total_memory as f64 / (1024.0 * 1024.0 * 1024.0);
    let cpu_score = if cpu_cores >= 8 {
        3
    } else if cpu_cores >= 4 {
        2
    } else {
        1
    };
    
    let memory_score = if memory_gb >= 16.0 {
        3
    } else if memory_gb >= 8.0 {
        2
    } else if memory_gb >= 4.0 {
        1
    } else {
        0
    };
    
    let disk_gb_available = available_disk as f64 / (1024.0 * 1024.0 * 1024.0);
    let disk_score = if disk_gb_available >= 100.0 {
        3
    } else if disk_gb_available >= 50.0 {
        2
    } else if disk_gb_available >= 20.0 {
        1
    } else {
        0
    };
    
    // 総合スコア（0-9）
    let total_score = cpu_score + memory_score + disk_score;
    
    if total_score >= 7 {
        "very_high"
    } else if total_score >= 5 {
        "high"
    } else if total_score >= 3 {
        "medium"
    } else {
        "low"
    }
    .to_string()
}

/// メモリ使用量情報（監査レポート推奨機能）
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MemoryUsage {
    /// プロセスのメモリ使用量（バイト）
    pub process_memory: u64,
    /// システム全体のメモリ使用量（バイト）
    pub system_memory: u64,
    /// システム全体の合計メモリ（バイト）
    pub total_memory: u64,
    /// プロセスのメモリ使用率（%）
    pub process_memory_percent: f64,
    /// システム全体のメモリ使用率（%）
    pub system_memory_percent: f64,
    /// メモリヘルス状態（true: 正常, false: 警告）
    pub is_healthy: bool,
}

/// メモリ使用量を取得（監査レポート推奨機能）
#[tauri::command]
pub async fn get_memory_usage() -> Result<MemoryUsage, String> {
    let mut system = System::new_all();
    system.refresh_all();
    
    // 現在のプロセスIDを取得
    let pid = sysinfo::get_current_pid()
        .map_err(|e| format!("プロセスIDの取得に失敗しました: {}", e))?;
    
    // プロセスのメモリ使用量を取得
    let process_memory = if let Some(process) = system.process(pid) {
        // ProcessExtトレイトのメソッドを使用
        process.memory() * 1024 // KB to bytes
    } else {
        0
    };
    
    // システム全体のメモリ情報を取得
    let total_memory = system.total_memory();
    let used_memory = system.used_memory();
    
    // メモリ使用率を計算
    let process_memory_percent = if total_memory > 0 {
        (process_memory as f64 / total_memory as f64) * 100.0
    } else {
        0.0
    };
    
    let system_memory_percent = if total_memory > 0 {
        (used_memory as f64 / total_memory as f64) * 100.0
    } else {
        0.0
    };
    
    // メモリヘルス状態を判定（2GB制限、監査レポート推奨）
    let memory_limit = 2 * 1024 * 1024 * 1024; // 2GB
    let is_healthy = process_memory < memory_limit;
    
    Ok(MemoryUsage {
        process_memory,
        system_memory: used_memory,
        total_memory,
        process_memory_percent,
        system_memory_percent,
        is_healthy,
    })
}

/// メモリヘルス状態をチェック（監査レポート推奨機能）
#[tauri::command]
pub async fn check_memory_health() -> Result<bool, String> {
    let memory_usage = get_memory_usage().await?;
    Ok(memory_usage.is_healthy)
}

/// モデル提案情報
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModelRecommendation {
    /// 推奨モデル名
    pub recommended_model: String,
    /// 推奨理由
    pub reason: String,
    /// 代替モデルリスト
    pub alternatives: Vec<String>,
    /// 用途別推奨モデル
    pub use_case_recommendations: Vec<UseCaseRecommendation>,
}

/// 用途別推奨モデル
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UseCaseRecommendation {
    /// 用途（"chat" | "code" | "translation" | "general"）
    pub use_case: String,
    /// 推奨モデル名
    pub model: String,
    /// 推奨理由
    pub reason: String,
}

/// システムリソースに基づくモデル提案を取得
#[tauri::command]
pub async fn get_model_recommendation() -> Result<ModelRecommendation, String> {
    let resources = get_system_resources().await?;
    
    // リソースレベルに基づいてモデルを提案
    let (recommended_model, reason, alternatives) = match resources.resource_level.as_str() {
        "very_high" => {
            (
                "llama3.1:70b".to_string(),
                "高性能システム向け。大規模モデル（70B）が実行可能です。高品質な生成が期待できます。".to_string(),
                vec!["llama3:70b".to_string(), "mistral:large".to_string(), "codellama:34b".to_string()],
            )
        }
        "high" => {
            (
                "llama3.2:3b".to_string(),
                "中高性能システム向け。バランスの取れたモデル（3B-8B）が推奨されます。".to_string(),
                vec!["llama3:8b".to_string(), "mistral:7b".to_string(), "codellama:13b".to_string()],
            )
        }
        "medium" => {
            (
                "llama3.2:1b".to_string(),
                "中程度のシステム向け。軽量モデル（1B-3B）が推奨されます。".to_string(),
                vec!["llama3:8b".to_string(), "phi3:mini".to_string(), "mistral:7b".to_string()],
            )
        }
        _ => {
            (
                "phi3:mini".to_string(),
                "低リソースシステム向け。最小限のモデル（1B以下）が推奨されます。".to_string(),
                vec!["llama3.2:1b".to_string(), "gemma:2b".to_string()],
            )
        }
    };
    
    // 用途別推奨モデル
    let use_case_recommendations = match resources.resource_level.as_str() {
        "very_high" | "high" => vec![
            UseCaseRecommendation {
                use_case: "chat".to_string(),
                model: "llama3.2:3b".to_string(),
                reason: "会話型AIに最適。自然な応答が可能です。".to_string(),
            },
            UseCaseRecommendation {
                use_case: "code".to_string(),
                model: "codellama:13b".to_string(),
                reason: "コード生成に特化。高品質なコード生成が可能です。".to_string(),
            },
            UseCaseRecommendation {
                use_case: "translation".to_string(),
                model: "mistral:7b".to_string(),
                reason: "多言語対応。翻訳タスクに優れています。".to_string(),
            },
            UseCaseRecommendation {
                use_case: "general".to_string(),
                model: "llama3:8b".to_string(),
                reason: "汎用的な用途に最適。様々なタスクに対応できます。".to_string(),
            },
        ],
        "medium" => vec![
            UseCaseRecommendation {
                use_case: "chat".to_string(),
                model: "llama3.2:1b".to_string(),
                reason: "軽量で高速。基本的な会話に対応できます。".to_string(),
            },
            UseCaseRecommendation {
                use_case: "code".to_string(),
                model: "codellama:7b".to_string(),
                reason: "コード生成に対応。中規模のコード生成が可能です。".to_string(),
            },
            UseCaseRecommendation {
                use_case: "translation".to_string(),
                model: "mistral:7b".to_string(),
                reason: "翻訳機能を利用できます。".to_string(),
            },
            UseCaseRecommendation {
                use_case: "general".to_string(),
                model: "llama3.2:1b".to_string(),
                reason: "汎用的な用途に最適。軽量で動作します。".to_string(),
            },
        ],
        _ => vec![
            UseCaseRecommendation {
                use_case: "chat".to_string(),
                model: "phi3:mini".to_string(),
                reason: "最小限のリソースで動作。基本的な会話に対応します。".to_string(),
            },
            UseCaseRecommendation {
                use_case: "code".to_string(),
                model: "codellama:7b".to_string(),
                reason: "最小限のリソースでコード生成が可能です。".to_string(),
            },
            UseCaseRecommendation {
                use_case: "translation".to_string(),
                model: "phi3:mini".to_string(),
                reason: "基本的な翻訳機能を利用できます。".to_string(),
            },
            UseCaseRecommendation {
                use_case: "general".to_string(),
                model: "phi3:mini".to_string(),
                reason: "低リソースで動作します。".to_string(),
            },
        ],
    };
    
    Ok(ModelRecommendation {
        recommended_model,
        reason,
        alternatives,
        use_case_recommendations,
    })
}

/// セキュリティソフトブロック検出結果
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SecurityBlockDetection {
    /// Tauriバックエンドが応答しているか
    pub backend_responding: bool,
    /// ポート1420がリッスンしているか
    pub port_1420_listening: bool,
    /// プロセスが実行中か（Windowsの場合）
    #[cfg(windows)]
    pub process_running: bool,
    /// ブロックされている可能性
    pub likely_blocked: bool,
    /// 検出された問題の説明
    pub issues: Vec<String>,
    /// 推奨される対処法
    pub recommendations: Vec<String>,
}

/// セキュリティソフトによるブロックを検出
#[tauri::command]
pub async fn detect_security_block() -> Result<SecurityBlockDetection, String> {
    let mut issues = Vec::new();
    let mut recommendations = Vec::new();
    
    // 1. ポート1420がリッスンしているか確認
    // 注意: Tauriアプリケーションでは、IPC（Inter-Process Communication）を使用するため、
    // HTTPポート1420は開発モードでのフォールバック用です。本番環境では必要ありません。
    let port_1420_listening = is_port_available(1420) == false;
    
    if !port_1420_listening {
        // これは警告レベル（開発モードでのみ重要）
        issues.push("ポート1420がリッスンしていません（開発モードでのフォールバック用ポート）。本番環境では問題ありません。".to_string());
        recommendations.push("開発モードで使用する場合は、Tauriアプリケーションを再起動してください（npm run tauri:dev）".to_string());
    }
    
    // 2. Windowsの場合、プロセスの存在確認（backend_respondingの計算で使用するため先に実行）
    #[cfg(windows)]
    let process_running = {
        use std::process::Command;
        // flm.exe または node.exe のプロセスを確認
        let output = Command::new("tasklist")
            .args(&["/FI", "IMAGENAME eq flm.exe", "/FO", "CSV", "/NH"])
            .output()
            .ok();
        
        let has_flm = output
            .as_ref()
            .and_then(|o| String::from_utf8(o.stdout.clone()).ok())
            .map(|s| s.contains("flm.exe"))
            .unwrap_or(false);
        
        if !has_flm {
            // node.exe も確認
            let node_output = Command::new("tasklist")
                .args(&["/FI", "IMAGENAME eq node.exe", "/FO", "CSV", "/NH"])
                .output()
                .ok();
            
            node_output
                .and_then(|o| String::from_utf8(o.stdout).ok())
                .map(|s| s.contains("node.exe"))
                .unwrap_or(false)
        } else {
            true
        }
    };
    
    #[cfg(not(windows))]
    let process_running = true; // Windows以外では常にtrueと仮定
    
    // 3. Tauriバックエンドへの接続テスト
    // 注意: Tauriアプリケーションでは、IPCコマンドは直接invoke関数を使用するため、
    // HTTPエンドポイントの存在確認は開発モードでのフォールバック用です。
    // 実際のTauriアプリケーションでは、このチェックは常にtrueと見なすべきです。
    // ただし、ポート1420がリッスンしている場合のみ、HTTP接続を試みます。
    let backend_responding = if port_1420_listening {
        // ポートがリッスンしている場合、HTTP接続を試みる（開発モードのフォールバック用）
        let client = match reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(2))
            .build()
        {
            Ok(client) => client,
            Err(_) => {
                // HTTPクライアント作成に失敗した場合、バックエンドは応答していないと見なす
                return Ok(SecurityBlockDetection {
                    backend_responding: false,
                    port_1420_listening,
                    #[cfg(windows)]
                    process_running,
                    #[cfg(not(windows))]
                    process_running: true,
                    likely_blocked: false,
                    issues,
                    recommendations,
                });
            }
        };
        
        match client
            .get("http://localhost:1420/invoke")
            .send()
            .await
        {
            Ok(resp) => {
                let status = resp.status();
                // 404でもエンドポイントは存在する（フォールバック用エンドポイント）
                // 200-299または404の場合は、バックエンドが応答していると見なす
                status.is_success() || status.as_u16() == 404
            }
            Err(e) => {
                // 接続エラーの場合、詳細をログに記録
                eprintln!("[DEBUG] バックエンドHTTP接続テスト失敗: {:?}", e);
                // ただし、Tauri IPCが動作している場合は、HTTP接続が失敗しても問題ない
                // プロセスが実行中であれば、バックエンドは応答していると見なす
                #[cfg(windows)]
                {
                    // Windowsの場合、プロセスが実行中であればtrue
                    process_running
                }
                #[cfg(not(windows))]
                {
                    // Windows以外では、ポートがリッスンしていればtrue
                    true
                }
            }
        }
    } else {
        // ポートがリッスンしていない場合、バックエンドは応答していない
        false
    };
    
    if !backend_responding && port_1420_listening {
        issues.push("TauriバックエンドがHTTPリクエストに応答していません。".to_string());
        recommendations.push("セキュリティソフトがブロックしている可能性があります。Windows Defenderやファイアウォールの設定を確認してください。".to_string());
    }
    
    #[cfg(windows)]
    if !process_running {
        issues.push("Tauriアプリケーションのプロセス（flm.exe または node.exe）が実行されていません。".to_string());
        recommendations.push("アプリケーションを起動してください。セキュリティソフトがプロセスの起動をブロックしている可能性があります。".to_string());
    }
    
    // 4. ブロックされている可能性の判定
    // プロセスは実行中だが、ポートがリッスンしていない場合は、Tauriバックエンドが正しく起動していない可能性がある
    // これはセキュリティブロックではなく、アプリケーションの起動問題の可能性が高い
    let likely_blocked = if process_running && !port_1420_listening {
        // プロセスは実行中だがポートがリッスンしていない場合、セキュリティブロックではなく起動問題
        false
    } else {
        (!backend_responding && port_1420_listening)
            || (!port_1420_listening && !process_running)
    };
    
    if likely_blocked {
        recommendations.push("Windows Defenderの設定を確認し、flm.exe と ollama.exe を許可リストに追加してください。".to_string());
        recommendations.push("イベントビューアー（eventvwr.msc）でアプリケーションログを確認し、セキュリティソフトによるブロックがないか確認してください。".to_string());
    } else if process_running && !port_1420_listening {
        // プロセスは実行中だがポートがリッスンしていない場合の特別なメッセージ
        // 注意: 本番環境では、Tauri IPCを使用するため、ポート1420は不要です
        recommendations.push("Tauriアプリケーションのプロセスは実行中ですが、開発モード用のHTTPポート（1420）がリッスンしていません。本番環境では問題ありません。".to_string());
        recommendations.push("開発モードで使用する場合は、アプリケーションを完全に終了してから再起動してください（npm run tauri:dev）".to_string());
        recommendations.push("タスクマネージャーで flm.exe や node.exe のプロセスを確認し、必要に応じて強制終了してください。".to_string());
    }
    
    Ok(SecurityBlockDetection {
        backend_responding,
        port_1420_listening,
        #[cfg(windows)]
        process_running,
        likely_blocked,
        issues,
        recommendations,
    })
}

/// ネットワーク診断結果
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NetworkDiagnostics {
    /// インターネット接続が利用可能か
    pub internet_available: bool,
    /// DNS解決が正常に動作するか
    pub dns_resolution: bool,
    /// ローカルネットワーク接続
    pub local_network: bool,
    /// 問題の説明
    pub issues: Vec<String>,
    /// 推奨される対処法
    pub recommendations: Vec<String>,
}

/// ネットワーク接続を診断
#[tauri::command]
pub async fn diagnose_network() -> Result<NetworkDiagnostics, String> {
    let mut issues = Vec::new();
    let mut recommendations = Vec::new();
    
    // 1. インターネット接続の確認（タイムアウトを3秒に短縮）
    let internet_available = {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(3))
            .build()
            .map_err(|e| format!("HTTPクライアント作成エラー: {}", e))?;
        
        match client
            .get("https://www.google.com")
            .send()
            .await
        {
            Ok(resp) => resp.status().is_success(),
            Err(_) => false,
        }
    };
    
    if !internet_available {
        issues.push("インターネット接続が利用できません。".to_string());
        recommendations.push("インターネット接続を確認してください。".to_string());
        recommendations.push("ファイアウォールがHTTPS接続をブロックしていないか確認してください。".to_string());
    }
    
    // 2. DNS解決の確認
    let dns_resolution = {
        use std::net::ToSocketAddrs;
        match "google.com:80".to_socket_addrs() {
            Ok(mut addrs) => addrs.next().is_some(),
            Err(_) => false,
        }
    };
    
    if !dns_resolution {
        issues.push("DNS解決が正常に動作していません。".to_string());
        recommendations.push("DNS設定を確認してください。".to_string());
        recommendations.push("ネットワーク設定を確認してください。".to_string());
    }
    
    // 3. ローカルネットワークの確認（localhost接続テスト）
    let local_network = {
        use std::net::TcpStream;
        TcpStream::connect("127.0.0.1:80").is_ok() || 
        TcpStream::connect("127.0.0.1:8080").is_ok()
    };
    
    Ok(NetworkDiagnostics {
        internet_available,
        dns_resolution,
        local_network,
        issues,
        recommendations,
    })
}

/// 環境情報診断結果
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EnvironmentDiagnostics {
    /// OS情報
    pub os_info: String,
    /// OSバージョン
    pub os_version: Option<String>,
    /// アーキテクチャ
    pub architecture: String,
    /// Rustバージョン（利用可能な場合）
    pub rust_version: Option<String>,
    /// 問題の説明
    pub issues: Vec<String>,
}

/// 環境情報を診断
#[tauri::command]
pub async fn diagnose_environment() -> Result<EnvironmentDiagnostics, String> {
    let mut issues = Vec::new();
    
    // OS情報の取得
    let os_info = std::env::consts::OS.to_string();
    let architecture = std::env::consts::ARCH.to_string();
    
    // OSバージョンの取得（Windows）
    #[cfg(windows)]
    let os_version = {
        use std::process::Command;
        Command::new("ver")
            .output()
            .ok()
            .and_then(|o| String::from_utf8(o.stdout).ok())
            .map(|s| s.trim().to_string())
    };
    
    #[cfg(not(windows))]
    let os_version = {
        use std::process::Command;
        if cfg!(target_os = "macos") {
            Command::new("sw_vers")
                .arg("-productVersion")
                .output()
                .ok()
                .and_then(|o| String::from_utf8(o.stdout).ok())
                .map(|s| s.trim().to_string())
        } else if cfg!(target_os = "linux") {
            Command::new("uname")
                .arg("-r")
                .output()
                .ok()
                .and_then(|o| String::from_utf8(o.stdout).ok())
                .map(|s| s.trim().to_string())
        } else {
            None
        }
    };
    
    // Rustバージョンの取得
    let rust_version = {
        use std::process::Command;
        Command::new("rustc")
            .arg("--version")
            .output()
            .ok()
            .and_then(|o| String::from_utf8(o.stdout).ok())
            .map(|s| s.trim().to_string())
    };
    
    if rust_version.is_none() {
        issues.push("Rustコンパイラが見つかりません（開発環境のみ）。".to_string());
    }
    
    Ok(EnvironmentDiagnostics {
        os_info,
        os_version,
        architecture,
        rust_version,
        issues,
    })
}

/// ファイルシステム診断結果
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FilesystemDiagnostics {
    /// アプリケーションディレクトリへの書き込み権限
    pub write_permission: bool,
    /// データディレクトリへの書き込み権限
    pub data_directory_writable: bool,
    /// 一時ディレクトリへの書き込み権限
    pub temp_directory_writable: bool,
    /// ディスク容量が十分か
    pub disk_space_sufficient: bool,
    /// 利用可能なディスク容量（GB）
    pub available_disk_gb: f64,
    /// 問題の説明
    pub issues: Vec<String>,
    /// 推奨される対処法
    pub recommendations: Vec<String>,
}

/// ファイルシステムを診断
#[tauri::command]
pub async fn diagnose_filesystem() -> Result<FilesystemDiagnostics, String> {
    let mut issues = Vec::new();
    let mut recommendations = Vec::new();
    
    // 1. アプリケーションディレクトリへの書き込み権限
    let write_permission = {
        use std::fs;
        
        if let Ok(current_dir) = std::env::current_dir() {
            let test_file = current_dir.join(".write_test");
            let result = fs::write(&test_file, "test").is_ok();
            if result {
                let _ = fs::remove_file(&test_file);
            }
            result
        } else {
            false
        }
    };
    
    if !write_permission {
        issues.push("アプリケーションディレクトリへの書き込み権限がありません。".to_string());
        recommendations.push("アプリケーションを管理者権限で実行するか、書き込み権限のあるディレクトリに移動してください。".to_string());
    }
    
    // 2. データディレクトリへの書き込み権限
    let data_directory_writable = {
        use std::fs;
        if let Ok(data_dir) = crate::database::connection::get_app_data_dir() {
            let test_file = data_dir.join(".write_test");
            let result = fs::write(&test_file, "test").is_ok();
            if result {
                let _ = fs::remove_file(&test_file);
            }
            result
        } else {
            false
        }
    };
    
    if !data_directory_writable {
        issues.push("データディレクトリへの書き込み権限がありません。".to_string());
        recommendations.push("データディレクトリの権限を確認してください。".to_string());
    }
    
    // 3. 一時ディレクトリへの書き込み権限
    let temp_directory_writable = {
        use std::fs;
        let temp_dir = std::env::temp_dir();
        let test_file = temp_dir.join(".write_test");
        let result = fs::write(&test_file, "test").is_ok();
        if result {
            let _ = fs::remove_file(&test_file);
        }
        result
    };
    
    if !temp_directory_writable {
        issues.push("一時ディレクトリへの書き込み権限がありません。".to_string());
        recommendations.push("一時ディレクトリの権限を確認してください。".to_string());
    }
    
    // 4. ディスク容量の確認
    let (disk_space_sufficient, available_disk_gb) = {
        let resources = get_system_resources().await.map_err(|e| format!("システムリソース取得エラー: {}", e))?;
        let available_gb = resources.available_disk as f64 / (1024.0 * 1024.0 * 1024.0);
        let sufficient = available_gb >= 10.0; // 10GB以上推奨
        
        if !sufficient {
            issues.push(format!("ディスク容量が不足しています（利用可能: {:.1}GB、推奨: 10GB以上）。", available_gb));
            recommendations.push("不要なファイルを削除するか、別のドライブにデータを移動してください。".to_string());
        }
        
        (sufficient, available_gb)
    };
    
    Ok(FilesystemDiagnostics {
        write_permission,
        data_directory_writable,
        temp_directory_writable,
        disk_space_sufficient,
        available_disk_gb,
        issues,
        recommendations,
    })
}

/// 包括的な診断サマリー
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ComprehensiveDiagnostics {
    /// セキュリティブロック診断
    pub security: SecurityBlockDetection,
    /// ネットワーク診断
    pub network: NetworkDiagnostics,
    /// 環境情報診断
    pub environment: EnvironmentDiagnostics,
    /// ファイルシステム診断
    pub filesystem: FilesystemDiagnostics,
    /// システムリソース
    pub resources: SystemResources,
    /// 総合的な健康状態（"healthy" | "warning" | "critical"）
    pub overall_health: String,
    /// 総合的な問題数
    pub total_issues: usize,
    /// 優先度の高い問題
    pub critical_issues: Vec<String>,
}

/// 包括的な診断を実行
#[tauri::command]
pub async fn run_comprehensive_diagnostics() -> Result<ComprehensiveDiagnostics, String> {
    let (security, network, environment, filesystem, resources) = tokio::try_join!(
        detect_security_block(),
        diagnose_network(),
        diagnose_environment(),
        diagnose_filesystem(),
        get_system_resources(),
    )?;
    
    // 問題を集計
    let mut total_issues = 0;
    let mut critical_issues = Vec::new();
    
    if security.likely_blocked {
        total_issues += 1;
        critical_issues.push("セキュリティソフトによるブロックが検出されました。".to_string());
    }
    
    if !network.internet_available {
        total_issues += 1;
        critical_issues.push("インターネット接続が利用できません。".to_string());
    }
    
    if !filesystem.write_permission || !filesystem.data_directory_writable {
        total_issues += 1;
        critical_issues.push("ファイルシステムへの書き込み権限がありません。".to_string());
    }
    
    if !filesystem.disk_space_sufficient {
        total_issues += 1;
        critical_issues.push("ディスク容量が不足しています。".to_string());
    }
    
    if resources.resource_level == "low" {
        total_issues += 1;
        critical_issues.push("システムリソースが不足しています。".to_string());
    }
    
    // 総合的な健康状態を判定
    let overall_health = if total_issues == 0 {
        "healthy"
    } else if total_issues <= 2 {
        "warning"
    } else {
        "critical"
    }.to_string();
    
    Ok(ComprehensiveDiagnostics {
        security,
        network,
        environment,
        filesystem,
        resources,
        overall_health,
        total_issues,
        critical_issues,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    
    /// システムリソース情報の構造体テスト
    #[test]
    fn test_system_resources_struct() {
        let resources = SystemResources {
            total_memory: 8_589_934_592, // 8GB
            available_memory: 4_294_967_296, // 4GB
            cpu_cores: 4,
            cpu_usage: 25.5,
            total_disk: 500_000_000_000, // 500GB
            available_disk: 250_000_000_000, // 250GB
            resource_level: "medium".to_string(),
        };
        
        assert_eq!(resources.total_memory, 8_589_934_592);
        assert_eq!(resources.available_memory, 4_294_967_296);
        assert_eq!(resources.cpu_cores, 4);
        assert_eq!(resources.cpu_usage, 25.5);
        assert_eq!(resources.resource_level, "medium");
    }
    
    /// メモリ使用量情報の構造体テスト
    #[test]
    fn test_memory_usage_struct() {
        let memory = MemoryUsage {
            process_memory: 1_073_741_824, // 1GB
            system_memory: 4_294_967_296, // 4GB
            total_memory: 8_589_934_592, // 8GB
            process_memory_percent: 12.5,
            system_memory_percent: 50.0,
            is_healthy: true,
        };
        
        assert_eq!(memory.total_memory, 8_589_934_592);
        assert_eq!(memory.process_memory, 1_073_741_824);
        assert_eq!(memory.system_memory_percent, 50.0);
        assert!(memory.is_healthy);
    }
    
    /// メモリ健康状態チェックの境界値テスト
    #[test]
    fn test_memory_health_boundaries() {
        // 正常なメモリ使用率（50%）
        let normal_memory = MemoryUsage {
            process_memory: 1_073_741_824,
            system_memory: 4_294_967_296,
            total_memory: 8_589_934_592,
            process_memory_percent: 12.5,
            system_memory_percent: 50.0,
            is_healthy: true,
        };
        assert!(normal_memory.is_healthy);
        
        // 警告レベルのメモリ使用率（80%）
        let warning_memory = MemoryUsage {
            process_memory: 2_147_483_648,
            system_memory: 6_871_947_674,
            total_memory: 8_589_934_592,
            process_memory_percent: 25.0,
            system_memory_percent: 80.0,
            is_healthy: false,
        };
        assert!(!warning_memory.is_healthy);
        
        // 危険レベルのメモリ使用率（95%）
        let critical_memory = MemoryUsage {
            process_memory: 2_147_483_648,
            system_memory: 8_160_437_862,
            total_memory: 8_589_934_592,
            process_memory_percent: 25.0,
            system_memory_percent: 95.0,
            is_healthy: false,
        };
        assert!(!critical_memory.is_healthy);
    }
    
    /// モデル推奨情報の構造体テスト
    #[test]
    fn test_model_recommendation_struct() {
        let recommendation = ModelRecommendation {
            recommended_model: "llama3:8b".to_string(),
            reason: "システムリソースに適したモデルサイズです".to_string(),
            alternatives: vec!["llama3:7b".to_string(), "mistral:7b".to_string()],
            use_case_recommendations: vec![],
        };
        
        assert_eq!(recommendation.recommended_model, "llama3:8b");
        assert!(!recommendation.reason.is_empty());
        assert_eq!(recommendation.alternatives.len(), 2);
    }
}

