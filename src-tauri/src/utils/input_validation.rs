// 入力検証ユーティリティ
// 監査レポートの推奨事項に基づき、API名、モデル名、IPアドレスの検証を強化

use crate::utils::error::AppError;

/// API名の最小長
const API_NAME_MIN_LENGTH: usize = 1;
/// API名の最大長
const API_NAME_MAX_LENGTH: usize = 100;

/// モデル名の最小長
const MODEL_NAME_MIN_LENGTH: usize = 1;
/// モデル名の最大長
const MODEL_NAME_MAX_LENGTH: usize = 200;

/// API名を検証
/// 
/// 検証内容:
/// - 空でないこと
/// - 長さが1-100文字の範囲内であること
/// - 危険な特殊文字が含まれていないこと（SQLインジェクション対策）
pub fn validate_api_name(name: &str) -> Result<(), AppError> {
    let trimmed = name.trim();
    
    // 空チェック
    if trimmed.is_empty() {
        return Err(AppError::validation_error(
            "API名は空にできません"
        ));
    }
    
    // 長さチェック
    if trimmed.len() < API_NAME_MIN_LENGTH {
        return Err(AppError::validation_error(
            format!("API名は{}文字以上である必要があります", API_NAME_MIN_LENGTH)
        ));
    }
    
    if trimmed.len() > API_NAME_MAX_LENGTH {
        return Err(AppError::validation_error(
            format!("API名は{}文字以下である必要があります", API_NAME_MAX_LENGTH)
        ));
    }
    
    // 危険な特殊文字のチェック（SQLインジェクション対策）
    // ただし、一般的な文字（日本語、英数字、スペース、ハイフン、アンダースコア）は許可
    let dangerous_chars = [';', '\'', '"', '\\', '/', '<', '>', '&', '|', '`'];
    for char in dangerous_chars {
        if trimmed.contains(char) {
            return Err(AppError::validation_error(
                format!("API名に使用できない文字が含まれています: '{}'", char)
            ));
        }
    }
    
    Ok(())
}

/// モデル名を検証
/// 
/// 検証内容:
/// - 空でないこと
/// - 長さが1-200文字の範囲内であること
/// - 危険な特殊文字が含まれていないこと
pub fn validate_model_name(name: &str) -> Result<(), AppError> {
    let trimmed = name.trim();
    
    // 空チェック
    if trimmed.is_empty() {
        return Err(AppError::validation_error(
            "モデル名は空にできません"
        ));
    }
    
    // 長さチェック
    if trimmed.len() < MODEL_NAME_MIN_LENGTH {
        return Err(AppError::validation_error(
            format!("モデル名は{}文字以上である必要があります", MODEL_NAME_MIN_LENGTH)
        ));
    }
    
    if trimmed.len() > MODEL_NAME_MAX_LENGTH {
        return Err(AppError::validation_error(
            format!("モデル名は{}文字以下である必要があります", MODEL_NAME_MAX_LENGTH)
        ));
    }
    
    // 危険な特殊文字のチェック
    let dangerous_chars = [';', '\'', '"', '\\', '<', '>', '&', '|', '`'];
    for char in dangerous_chars {
        if trimmed.contains(char) {
            return Err(AppError::validation_error(
                format!("モデル名に使用できない文字が含まれています: '{}'", char)
            ));
        }
    }
    
    Ok(())
}

/// IPアドレスを検証
/// 
/// 検証内容:
/// - 有効なIPv4またはIPv6アドレスであること
/// - CIDR表記の場合は有効な形式であること
pub fn validate_ip_address(ip: &str) -> Result<(), AppError> {
    let trimmed = ip.trim();
    
    if trimmed.is_empty() {
        return Err(AppError::validation_error(
            "IPアドレスは空にできません"
        ));
    }
    
    // CIDR表記のチェック
    if trimmed.contains('/') {
        let parts: Vec<&str> = trimmed.split('/').collect();
        if parts.len() != 2 {
            return Err(AppError::validation_error(
                "無効なCIDR表記です。形式: IPアドレス/プレフィックス長（例: 192.168.1.0/24）"
            ));
        }
        
        // IPアドレスの検証
        parts[0].parse::<std::net::IpAddr>()
            .map_err(|_| AppError::validation_error(
                format!("無効なIPアドレス: {}", parts[0])
            ))?;
        
        // プレフィックス長の検証
        let prefix_len: u8 = parts[1].parse()
            .map_err(|_| AppError::validation_error(
                format!("無効なプレフィックス長: {}", parts[1])
            ))?;
        
        // IPv4の場合は0-32、IPv6の場合は0-128
        if prefix_len > 128 {
            return Err(AppError::validation_error(
                "プレフィックス長は0-128の範囲である必要があります"
            ));
        }
    } else {
        // 単一IPアドレスの検証
        trimmed.parse::<std::net::IpAddr>()
            .map_err(|_| AppError::validation_error(
                format!("無効なIPアドレス: {}", trimmed)
            ))?;
    }
    
    Ok(())
}

/// 文字列をサニタイズ（危険な文字をエスケープ）
/// 
/// 注意: この関数は基本的なサニタイズのみを行います。
/// SQLインジェクション対策はパラメータ化クエリを使用してください。
pub fn sanitize_string(input: &str) -> String {
    input
        .trim()
        .replace(';', "")
        .replace('\'', "")
        .replace('"', "")
        .replace('\\', "")
        .replace('<', "")
        .replace('>', "")
        .replace('&', "")
        .replace('|', "")
        .replace('`', "")
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_validate_api_name() {
        // 正常なケース
        assert!(validate_api_name("My API").is_ok());
        assert!(validate_api_name("テストAPI").is_ok());
        assert!(validate_api_name("API-123").is_ok());
        assert!(validate_api_name("API_123").is_ok());
        
        // エラーケース
        assert!(validate_api_name("").is_err());
        assert!(validate_api_name("   ").is_err());
        assert!(validate_api_name("; DROP TABLE").is_err());
        assert!(validate_api_name("API'name").is_err());
    }
    
    #[test]
    fn test_validate_model_name() {
        // 正常なケース
        assert!(validate_model_name("gpt-4").is_ok());
        assert!(validate_model_name("llama2-7b").is_ok());
        
        // エラーケース
        assert!(validate_model_name("").is_err());
        assert!(validate_model_name("; DROP TABLE").is_err());
    }
    
    #[test]
    fn test_validate_ip_address() {
        // 正常なケース
        assert!(validate_ip_address("192.168.1.1").is_ok());
        assert!(validate_ip_address("192.168.1.0/24").is_ok());
        assert!(validate_ip_address("::1").is_ok());
        assert!(validate_ip_address("2001:db8::/32").is_ok());
        
        // エラーケース
        assert!(validate_ip_address("").is_err());
        assert!(validate_ip_address("invalid").is_err());
        assert!(validate_ip_address("192.168.1.0/33").is_err());
        
        // エッジケース
        assert!(validate_ip_address("0.0.0.0").is_ok());
        assert!(validate_ip_address("255.255.255.255").is_ok());
        assert!(validate_ip_address("192.168.1.0/0").is_ok());
        assert!(validate_ip_address("192.168.1.0/32").is_ok());
        assert!(validate_ip_address("2001:db8::/0").is_ok());
        assert!(validate_ip_address("2001:db8::/128").is_ok());
        assert!(validate_ip_address("192.168.1.0/129").is_err()); // IPv4のプレフィックス長が範囲外
    }
    
    #[test]
    fn test_sanitize_string() {
        // 正常なケース
        assert_eq!(sanitize_string("test"), "test");
        assert_eq!(sanitize_string("  test  "), "test");
        assert_eq!(sanitize_string("test-api"), "test-api");
        assert_eq!(sanitize_string("test_api"), "test_api");
        
        // 危険な文字の削除
        assert_eq!(sanitize_string("test;DROP"), "testDROP");
        assert_eq!(sanitize_string("test'name"), "testname");
        assert_eq!(sanitize_string("test\"name"), "testname");
        assert_eq!(sanitize_string("test\\name"), "testname");
        assert_eq!(sanitize_string("test<name>"), "testname");
        assert_eq!(sanitize_string("test&name"), "testname");
        assert_eq!(sanitize_string("test|name"), "testname");
        assert_eq!(sanitize_string("test`name"), "testname");
        
        // 複数の危険な文字
        assert_eq!(sanitize_string("test;'\"\\<>"), "test");
        
        // 空文字列
        assert_eq!(sanitize_string(""), "");
        assert_eq!(sanitize_string("   "), "");
        
        // すべて危険な文字
        assert_eq!(sanitize_string(";'\"\\<>|&`"), "");
    }
    
    #[test]
    fn test_validate_api_name_edge_cases() {
        // 境界値テスト
        let min_name = "A".repeat(API_NAME_MIN_LENGTH);
        let max_name = "A".repeat(API_NAME_MAX_LENGTH);
        let too_long = "A".repeat(API_NAME_MAX_LENGTH + 1);
        
        assert!(validate_api_name(&min_name).is_ok());
        assert!(validate_api_name(&max_name).is_ok());
        assert!(validate_api_name(&too_long).is_err());
    }
    
    #[test]
    fn test_validate_model_name_edge_cases() {
        // 境界値テスト
        let min_name = "A".repeat(MODEL_NAME_MIN_LENGTH);
        let max_name = "A".repeat(MODEL_NAME_MAX_LENGTH);
        let too_long = "A".repeat(MODEL_NAME_MAX_LENGTH + 1);
        
        assert!(validate_model_name(&min_name).is_ok());
        assert!(validate_model_name(&max_name).is_ok());
        assert!(validate_model_name(&too_long).is_err());
    }
}

