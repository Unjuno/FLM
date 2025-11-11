// ポート番号自動検出コマンド

use serde::{Deserialize, Serialize};
use std::net::TcpListener;

use crate::database::{
    connection::get_connection,
    repository::api_repository::ApiRepository,
    models::ApiStatus,
};

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

#[derive(Debug, Serialize)]
pub struct PortConflictResolution {
    pub api_id: String,
    pub api_name: String,
    pub old_port: u16,
    pub new_port: u16,
    pub reason: String,
}

/// ポート番号が使用可能かどうかをチェック
pub fn is_port_available(port: u16) -> bool {
    // TcpListenerを使ってポートが使用可能かチェック
    if let Ok(listener) = TcpListener::bind(format!("127.0.0.1:{}", port)) {
        drop(listener);
        true
    } else {
        false
    }
}

/// APIポートペアが使用可能かどうかをチェック
pub fn is_api_port_pair_available(port: u16) -> bool {
    if !is_port_available(port) {
        return false;
    }

    match port.checked_add(1) {
        Some(https_port) => is_port_available(https_port),
        None => false,
    }
}

/// 使用可能なポート番号を検出
#[tauri::command]
pub async fn find_available_port(start_port: Option<u16>) -> Result<PortDetectionResult, String> {
    let start = start_port.unwrap_or(8080);
    let mut recommended_port = start;
    let mut alternative_ports = Vec::new();
    
    // 開始ポートから順に検索（最大100ポートまで）
    let mut found = false;
    let max_ports_to_check = 100;
    let end_port = (start as u32 + max_ports_to_check).min(65535) as u16;
    
    for port in start..end_port {
        if is_api_port_pair_available(port) {
            if !found {
                recommended_port = port;
                found = true;
            } else if alternative_ports.len() < 5 {
                alternative_ports.push(port);
            }
            
            // 推奨ポートと代替ポートが十分見つかった場合は終了
            if found && alternative_ports.len() >= 5 {
                break;
            }
        }
    }
    
    // 使用可能なポートが見つからなかった場合
    if !found {
        // 別の範囲から検索（8000から）
        for port in 8000..9000 {
            if is_api_port_pair_available(port) {
                recommended_port = port;
                found = true;
                
                // 追加の代替ポートを検索
                let mut alt_port = match port.checked_add(1) {
                    Some(next) => next,
                    None => break,
                };
                while alt_port <= u16::MAX {
                    if is_api_port_pair_available(alt_port) {
                        alternative_ports.push(alt_port);
                        if alternative_ports.len() >= 5 {
                            break;
                        }
                    }
                    alt_port = match alt_port.checked_add(1) {
                        Some(next) => next,
                        None => break,
                    };
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
    eprintln!("ポート {} の使用可能性をチェック中...", port);

    let https_port = match port.checked_add(1) {
        Some(value) => value,
        None => {
            eprintln!("✗ ポート {} はHTTPSペアを確保できないため使用できません", port);
            return Ok(false);
        }
    };

    let available = is_api_port_pair_available(port);
    if available {
        eprintln!("✓ ポートペア {} / {} は使用可能です", port, https_port);
    } else {
        eprintln!("✗ ポートペア {} / {} は使用できません", port, https_port);
    }

    Ok(available)
}

/// 停止中APIのポート競合を自動修正
#[tauri::command]
pub async fn resolve_port_conflicts() -> Result<Vec<PortConflictResolution>, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;
    let apis = ApiRepository::find_all(&conn).map_err(|e| e.to_string())?;
    let mut resolutions = Vec::new();

    for api in apis {
        let port = api.port as u16;

        if is_api_port_pair_available(port) {
            continue;
        }

        if api.status == ApiStatus::Running {
            continue;
        }

        let mut candidate = match port.checked_add(1) {
            Some(next) => next,
            None => continue,
        };
        let mut replacement = None;

        for _ in 0..100 {
            if candidate == 0 {
                break;
            }
            if is_api_port_pair_available(candidate) {
                replacement = Some(candidate);
                break;
            }
            candidate = match candidate.checked_add(1) {
                Some(next) => next,
                None => break,
            };
        }

        let new_port = match replacement {
            Some(port) => port,
            None => continue,
        };

        ApiRepository::update_port(&conn, &api.id, new_port).map_err(|e| e.to_string())?;

        resolutions.push(PortConflictResolution {
            api_id: api.id,
            api_name: api.name,
            old_port: port,
            new_port,
            reason: "別プロセスがポートを使用していたため自動的に変更しました".to_string(),
        });
    }

    Ok(resolutions)
}

#[cfg(test)]
mod tests {
    use super::*;
    
    /// ポート番号の使用可能性チェックテスト
    #[test]
    fn test_is_port_available() {
        // 使用可能なポート（通常は使用されていないポート）をテスト
        // 注意: テスト環境によっては失敗する可能性がある
        let test_port = 9999;
        // ポートが使用可能かどうかをチェック（実際のテストでは環境依存）
        let _ = is_port_available(test_port);
        // テストは成功（エラーが発生しないことを確認）
    }
    
    /// ポート番号の境界値テスト
    #[test]
    fn test_port_boundaries() {
        // 最小ポート番号（1）
        let _ = is_port_available(1);
        
        // 最大ポート番号（65535）
        let _ = is_port_available(65535);
        
        // テストは成功（エラーが発生しないことを確認）
    }
    
    /// ポート検出結果の構造体テスト
    #[test]
    fn test_port_detection_result() {
        let result = PortDetectionResult {
            recommended_port: 8080,
            is_available: true,
            alternative_ports: vec![8081, 8082, 8083],
        };
        
        assert_eq!(result.recommended_port, 8080);
        assert!(result.is_available);
        assert_eq!(result.alternative_ports.len(), 3);
    }
    
    /// ポート競合解決結果の構造体テスト
    #[test]
    fn test_port_conflict_resolution() {
        let resolution = PortConflictResolution {
            api_id: "test-api-id".to_string(),
            api_name: "Test API".to_string(),
            old_port: 8080,
            new_port: 8081,
            reason: "テスト用".to_string(),
        };
        
        assert_eq!(resolution.api_id, "test-api-id");
        assert_eq!(resolution.api_name, "Test API");
        assert_eq!(resolution.old_port, 8080);
        assert_eq!(resolution.new_port, 8081);
    }
}



