// APIキー暗号化/復号化
// APIキーをAES-256-GCMで暗号化・復号化します

use aes_gcm::{
    aead::{Aead, AeadCore, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};
use crate::utils::error::AppError;
// PathBufは std::path::PathBuf としてフルパスで使用しているため、インポート不要

/// 暗号化キーを取得（簡易実装、本番環境ではOSのキーストアを使用推奨）
fn get_encryption_key() -> Result<[u8; 32], AppError> {
    // 簡易実装: アプリケーションデータディレクトリからキーを読み込むか生成
    // 本番環境では、OSのキーストア（Windows Credential Manager、macOS Keychain等）を使用推奨
    
    use std::fs;
    
    let key_path = get_key_file_path()?;
    
    if key_path.exists() {
        // 既存のキーを読み込む
        let key_bytes = fs::read(&key_path).map_err(|e| AppError::IoError {
            message: format!("暗号化キー読み込みエラー: {}", e),
        })?;
        
        if key_bytes.len() == 32 {
            let mut key = [0u8; 32];
            key.copy_from_slice(&key_bytes);
            return Ok(key);
        }
    }
    
    // 新しいキーを生成
    let key = Aes256Gcm::generate_key(&mut OsRng);
    let key_bytes: [u8; 32] = key.into();
    
    // キーを保存
    if let Some(parent) = key_path.parent() {
        fs::create_dir_all(parent).map_err(|e| AppError::IoError {
            message: format!("ディレクトリ作成エラー: {}", e),
        })?;
    }
    
    fs::write(&key_path, &key_bytes).map_err(|e| AppError::IoError {
        message: format!("暗号化キー保存エラー: {}", e),
    })?;
    
    Ok(key_bytes)
}

/// キーファイルのパスを取得
fn get_key_file_path() -> Result<std::path::PathBuf, AppError> {
    #[cfg(target_os = "windows")]
    {
        let appdata = std::env::var("APPDATA")
            .map_err(|_| AppError::IoError {
                message: "APPDATA環境変数が見つかりません".to_string(),
            })?;
        Ok(std::path::PathBuf::from(appdata).join("FLM").join(".encryption_key"))
    }

    #[cfg(target_os = "macos")]
    {
        let home = std::env::var("HOME")
            .map_err(|_| AppError::IoError {
                message: "HOME環境変数が見つかりません".to_string(),
            })?;
        Ok(std::path::PathBuf::from(home)
            .join("Library")
            .join("Application Support")
            .join("FLM")
            .join(".encryption_key"))
    }

    #[cfg(target_os = "linux")]
    {
        let home = std::env::var("HOME")
            .map_err(|_| AppError::IoError {
                message: "HOME環境変数が見つかりません".to_string(),
            })?;
        Ok(std::path::PathBuf::from(home)
            .join(".local")
            .join("share")
            .join("FLM")
            .join(".encryption_key"))
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        Err(AppError::IoError {
            message: "サポートされていないOSです".to_string(),
        })
    }
}

/// APIキーを暗号化
pub fn encrypt_api_key(api_key: &str) -> Result<String, AppError> {
    let key_bytes = get_encryption_key()?;
    let cipher = Aes256Gcm::new(&key_bytes.into());
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
    
    let ciphertext = cipher
        .encrypt(&nonce, api_key.as_bytes())
        .map_err(|e| AppError::IoError {
            message: format!("暗号化エラー: {}", e),
        })?;
    
    // Nonceと暗号文を結合してBase64エンコード
    // 注意: as_slice()は非推奨だが、aes-gcm 0.10では必要なAPIです
    #[allow(deprecated)]
    let mut combined = nonce.as_slice().to_vec();
    combined.extend_from_slice(&ciphertext);
    
    use base64::{Engine as _, engine::general_purpose::STANDARD};
    Ok(STANDARD.encode(&combined))
}

/// APIキーを復号化
pub fn decrypt_api_key(encrypted: &str) -> Result<String, AppError> {
    let key_bytes = get_encryption_key()?;
    let cipher = Aes256Gcm::new(&key_bytes.into());
    
    // Base64デコード
    use base64::{Engine as _, engine::general_purpose::STANDARD};
    let combined = STANDARD.decode(encrypted).map_err(|e| AppError::IoError {
        message: format!("復号化エラー: {}", e),
    })?;
    
    if combined.len() < 12 {
        return Err(AppError::IoError {
            message: "暗号化データが不正です".to_string(),
        });
    }
    
    // Nonce（12バイト）と暗号文を分離
    // 注意: from_slice()は非推奨だが、aes-gcm 0.10では必要なAPIです
    #[allow(deprecated)]
    let nonce = Nonce::from_slice(&combined[..12]);
    let ciphertext = &combined[12..];
    
    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| AppError::IoError {
            message: format!("復号化エラー: {}", e),
        })?;
    
    String::from_utf8(plaintext).map_err(|e| AppError::IoError {
        message: format!("UTF-8変換エラー: {}", e),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_encrypt_and_decrypt_api_key() {
        let original_key = "test_api_key_12345678901234567890";
        
        // 暗号化
        let encrypted = encrypt_api_key(original_key)
            .expect("暗号化に失敗");
        
        assert_ne!(encrypted, original_key);
        assert!(!encrypted.is_empty());
        
        // 復号化
        let decrypted = decrypt_api_key(&encrypted)
            .expect("復号化に失敗");
        
        assert_eq!(decrypted, original_key);
    }
    
    #[test]
    fn test_encrypt_decrypt_consistency() {
        let test_keys = vec![
            "short_key",
            "this_is_a_very_long_api_key_that_exceeds_32_characters_and_tests_edge_cases",
            "特殊文字テスト🔐日本語",
            "1234567890",
        ];
        
        for key in test_keys {
            let encrypted = encrypt_api_key(key)
                .expect(&format!("暗号化に失敗: {}", key));
            
            let decrypted = decrypt_api_key(&encrypted)
                .expect(&format!("復号化に失敗: {}", key));
            
            assert_eq!(decrypted, key, "復号化後の値が一致しません: {}", key);
        }
    }
    
    #[test]
    fn test_invalid_decryption() {
        // 不正なBase64文字列
        let invalid_encrypted = "invalid_base64!!!";
        
        let result = decrypt_api_key(invalid_encrypted);
        assert!(result.is_err());
    }
    
    #[test]
    fn test_encryption_key_persistence() {
        // 同じキーで暗号化・復号化を複数回実行して、一貫性を確認
        let key = "persistent_test_key_12345";
        
        let encrypted1 = encrypt_api_key(key).expect("暗号化1に失敗");
        let encrypted2 = encrypt_api_key(key).expect("暗号化2に失敗");
        
        // Nonceが異なるため、暗号文は毎回異なる
        // ただし、復号化すると同じ元のキーが得られる
        let decrypted1 = decrypt_api_key(&encrypted1).expect("復号化1に失敗");
        let decrypted2 = decrypt_api_key(&encrypted2).expect("復号化2に失敗");
        
        assert_eq!(decrypted1, key);
        assert_eq!(decrypted2, key);
    }
}

