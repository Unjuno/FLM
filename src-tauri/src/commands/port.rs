// ポート番号自動検出コマンド

use serde::{Deserialize, Serialize};
use std::net::TcpListener;

/// ポート番号検出結果
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PortDetectionResult {
    /// 推奨ポート番号
    pub recommended_port: u16,
    /// ポート番号が使用可能かどうか
    pub is_available: bool,
    /// 代替ポート番号のリスト
    pub alternative_ports: Vec<u16>,
}

/// ポート番号が使用可能かどうかをチェック
fn is_port_available(port: u16) -> bool {
    // TcpListenerを使ってポートが使用可能かチェック
    if let Ok(listener) = TcpListener::bind(format!("127.0.0.1:{}", port)) {
        drop(listener);
        true
    } else {
        false
    }
}

/// 使用可能なポート番号を検出
#[tauri::command]
pub async fn find_available_port(start_port: Option<u16>) -> Result<PortDetectionResult, String> {
    let start = start_port.unwrap_or(8080);
    let mut recommended_port = start;
    let mut alternative_ports = Vec::new();
    
    // 開始ポートから順に検索（最大100ポートまで）
    let mut checked = 0;
    let mut found = false;
    
    for port in start..(start + 100).min(65535) {
        
        if is_port_available(port) {
            if !found {
                recommended_port = port;
                found = true;
            } else if alternative_ports.len() < 5 {
                alternative_ports.push(port);
            }
            
            if found && alternative_ports.len() >= 5 {
                break;
            }
        }
        
        checked += 1;
        if checked >= 100 {
            break;
        }
    }
    
    // 使用可能なポートが見つからなかった場合
    if !found {
        // 別の範囲から検索（8000から）
        for port in 8000..9000 {
            if is_port_available(port) {
                recommended_port = port;
                found = true;
                
                // 追加の代替ポートを検索
                for alt_port in (port + 1)..(port + 6).min(65535) {
                    if is_port_available(alt_port) {
                        alternative_ports.push(alt_port);
                        if alternative_ports.len() >= 5 {
                            break;
                        }
                    }
                }
                break;
            }
        }
    }
    
    // それでも見つからない場合はエラー
    if !found {
        return Err("使用可能なポート番号が見つかりませんでした。".to_string());
    }
    
    Ok(PortDetectionResult {
        recommended_port,
        is_available: true,
        alternative_ports,
    })
}

/// 指定されたポート番号が使用可能かどうかをチェック
#[tauri::command]
pub async fn check_port_availability(port: u16) -> Result<bool, String> {
    Ok(is_port_available(port))
}

