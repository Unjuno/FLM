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
        })?;
    
    for entry in whitelist {
        // CIDR表記のチェック（例: "192.168.1.0/24"）
        if entry.contains('/') {
            if match_cidr(&client_ip, entry)? {
                return Ok(true);
            }
        } else {
            // 単一IPアドレスのチェック
            let whitelist_ip: IpAddr = entry.parse()
                .map_err(|e| AppError::ApiError {
                    message: format!("ホワイトリストIPアドレス解析エラー: {}", e),
                    code: "INVALID_WHITELIST_IP".to_string(),
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
        });
    }
    
    let network_ip: IpAddr = parts[0].parse()
        .map_err(|e| AppError::ApiError {
            message: format!("CIDRネットワークIP解析エラー: {}", e),
            code: "INVALID_CIDR_IP".to_string(),
        })?;
    
    let prefix_len: u8 = parts[1].parse()
        .map_err(|e| AppError::ApiError {
            message: format!("CIDRプレフィックス長解析エラー: {}", e),
            code: "INVALID_CIDR_PREFIX".to_string(),
        })?;
    
    // 簡易実装：IPv4のみ対応
    // 実際の実装では、ipnetworkクレートなどを使用する方が確実
    match (ip, network_ip) {
        (IpAddr::V4(ip_v4), IpAddr::V4(net_v4)) => {
            let ip_u32 = u32::from_be_bytes(ip_v4.octets());
            let net_u32 = u32::from_be_bytes(net_v4.octets());
            let mask = if prefix_len > 32 {
                return Err(AppError::ApiError {
                    message: "IPv4のプレフィックス長は32以下である必要があります".to_string(),
                    code: "INVALID_PREFIX_LEN".to_string(),
                });
            } else {
                !((1u32 << (32 - prefix_len)) - 1)
            };
            
            Ok((ip_u32 & mask) == (net_u32 & mask))
        },
        (IpAddr::V6(_), IpAddr::V6(_)) => {
            // IPv6の実装は簡易版として常にfalseを返す
            // 実際の実装では、ipnetworkクレートなどを使用
            Ok(false)
        },
        _ => Ok(false),
    }
}

/// IPホワイトリストを検証
pub fn validate_whitelist(whitelist: &[String]) -> Result<(), AppError> {
    for entry in whitelist {
        if entry.contains('/') {
            // CIDR表記の検証
            let parts: Vec<&str> = entry.split('/').collect();
            if parts.len() != 2 {
                return Err(AppError::ApiError {
                    message: format!("無効なCIDR表記: {}", entry),
                    code: "INVALID_CIDR".to_string(),
                });
            }
            
            let _: IpAddr = parts[0].parse()
                .map_err(|e| AppError::ApiError {
                    message: format!("CIDRネットワークIP解析エラー: {}", e),
                    code: "INVALID_CIDR_IP".to_string(),
                })?;
            
            let prefix_len: u8 = parts[1].parse()
                .map_err(|e| AppError::ApiError {
                    message: format!("CIDRプレフィックス長解析エラー: {}", e),
                    code: "INVALID_CIDR_PREFIX".to_string(),
                })?;
            
            if prefix_len > 32 {
                return Err(AppError::ApiError {
                    message: "IPv4のプレフィックス長は32以下である必要があります".to_string(),
                    code: "INVALID_PREFIX_LEN".to_string(),
                });
            }
        } else {
            // 単一IPアドレスの検証
            let _: IpAddr = entry.parse()
                .map_err(|e| AppError::ApiError {
                    message: format!("IPアドレス解析エラー: {}", e),
                    code: "INVALID_IP".to_string(),
                })?;
        }
    }
    
    Ok(())
}

