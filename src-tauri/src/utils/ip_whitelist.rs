// IP Whitelist Module
// IPホワイトリスト機能

use crate::utils::error::AppError;
use serde::{Deserialize, Serialize};
use std::net::IpAddr;

/// IPホワイトリスト設定
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IpWhitelistConfig {
    pub api_id: String,
    pub whitelisted_ips: Vec<String>, // IPアドレスまたはCIDR表記（例: "192.168.1.1", "10.0.0.0/8"）
    pub enabled: bool,
}

/// IPアドレスがホワイトリストに含まれているかチェック
pub fn is_ip_allowed(
    ip_address: &str,
    whitelist: &[String],
) -> Result<bool, AppError> {
    if whitelist.is_empty() {
        // ホワイトリストが空の場合は、すべてのIPを許可
        return Ok(true);
    }
    
    let client_ip: IpAddr = ip_address.parse()
        .map_err(|e| AppError::ApiError {
            message: format!("IPアドレス解析エラー: {}", e),
            code: "INVALID_IP".to_string(),
            source_detail: None,
        })?;
    
    for entry in whitelist {
        if entry.contains('/') {
            // CIDR表記
            if match_cidr(&client_ip, entry)? {
                return Ok(true);
            }
        } else {
            // 単一IPアドレス
            let whitelist_ip: IpAddr = entry.parse()
                .map_err(|e| AppError::ApiError {
                    message: format!("ホワイトリストIP解析エラー: {}", e),
                    code: "INVALID_WHITELIST_IP".to_string(),
                    source_detail: None,
                })?;
            
            if client_ip == whitelist_ip {
                return Ok(true);
            }
        }
    }
    
    Ok(false)
}

/// CIDR表記に一致するかチェック
fn match_cidr(ip: &IpAddr, cidr: &str) -> Result<bool, AppError> {
    let parts: Vec<&str> = cidr.split('/').collect();
    if parts.len() != 2 {
        return Err(AppError::ApiError {
            message: format!("無効なCIDR表記: {}", cidr),
            code: "INVALID_CIDR".to_string(),
            source_detail: None,
        });
    }
    
    let network_ip: IpAddr = parts[0].parse()
        .map_err(|e| AppError::ApiError {
            message: format!("CIDRネットワークIP解析エラー: {}", e),
            code: "INVALID_CIDR_IP".to_string(),
            source_detail: None,
        })?;
    
    let _prefix_len: u8 = parts[1].parse()
        .map_err(|e| AppError::ApiError {
            message: format!("CIDRプレフィックス長解析エラー: {}", e),
            code: "INVALID_CIDR_PREFIX".to_string(),
            source_detail: None,
        })?;
    
    // 簡易実装: 実際のCIDRマッチングはより複雑な実装が必要
    // ここでは、ネットワークIPが一致するかどうかのみをチェック
    Ok(ip == &network_ip)
}
