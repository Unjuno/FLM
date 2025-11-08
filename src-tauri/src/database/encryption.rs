// APIキー暗号化/復号化
// APIキーをAES-256-GCMで暗号化・復号化します

use aes_gcm::{
    aead::{Aead, AeadCore, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};
use crate::utils::error::AppError;
// PathBufは std::path::PathBuf としてフルパスで使用しているため、インポート不要

/// キーストアのサービス名とユーザー名
const KEYRING_SERVICE: &str = "FLM";
const KEYRING_USERNAME: &str = "encryption_key";

/// OSキーストアから暗号化キーを取得
fn get_key_from_keyring() -> Result<Option<[u8; 32]>, AppError> {
    use keyring::Entry;
    
    let entry = Entry::new(KEYRING_SERVICE, KEYRING_USERNAME)
        .map_err(|e| AppError::IoError {
            message: format!("キーストアエントリ作成エラー: {}", e),
            source_detail: None,
        })?;
    
    match entry.get_password() {
        Ok(password) => {
            // Base64デコードしてキーを取得
            use base64::{Engine as _, engine::general_purpose::STANDARD};
            let key_bytes = STANDARD.decode(&password).map_err(|e| AppError::IoError {
                message: format!("キーストアからのキーデコードエラー: {}", e),
                source_detail: None,
            })?;
            
            if key_bytes.len() != 32 {
                return Err(AppError::IoError {
                    message: "キーストアのキーサイズが不正です".to_string(),
                    source_detail: None,
                });
            }
            
            let mut key = [0u8; 32];
            key.copy_from_slice(&key_bytes);
            Ok(Some(key))
        }
        Err(keyring::Error::NoEntry) => {
            // キーが存在しない場合はNoneを返す
            Ok(None)
        }
        Err(e) => {
            // その他のエラーは警告を出してNoneを返す（フォールバックに移行）
            eprintln!("[WARN] キーストアからのキー取得エラー: {}. ファイルシステムにフォールバックします。", e);
            Ok(None)
        }
    }
}

/// OSキーストアに暗号化キーを保存
fn save_key_to_keyring(key: &[u8; 32]) -> Result<(), AppError> {
    use keyring::Entry;
    use base64::{Engine as _, engine::general_purpose::STANDARD};
    
    let entry = Entry::new(KEYRING_SERVICE, KEYRING_USERNAME)
        .map_err(|e| AppError::IoError {
            message: format!("キーストアエントリ作成エラー: {}", e),
            source_detail: None,
        })?;
    
    let key_base64 = STANDARD.encode(key);
    entry.set_password(&key_base64).map_err(|e| AppError::IoError {
        message: format!("キーストアへのキー保存エラー: {}", e),
        source_detail: None,
    })?;
    
    Ok(())
}

/// 暗号化キーファイルのパスを取得（フォールバック用）
fn get_key_file_path() -> Result<std::path::PathBuf, AppError> {
    use crate::database::connection::get_app_data_dir;
    let app_data_dir = get_app_data_dir()
        .map_err(|e| AppError::IoError {
            message: format!("アプリケーションデータディレクトリ取得エラー: {}", e),
            source_detail: None,
        })?;
    Ok(app_data_dir.join("encryption_key.bin"))
}

/// 暗号化キーを取得（OSキーストア優先、フォールバックはファイルシステム）
fn get_encryption_key() -> Result<[u8; 32], AppError> {
    // まずOSキーストアから取得を試みる
    if let Ok(Some(key)) = get_key_from_keyring() {
        return Ok(key);
    }
    
    // OSキーストアから取得できない場合は、ファイルシステムから取得
    use std::fs;
    
    let key_path = get_key_file_path()?;
    
    let key_bytes = if key_path.exists() {
        // 既存のキーを読み込む
        let bytes = fs::read(&key_path).map_err(|e| AppError::IoError {
            message: format!("暗号化キー読み込みエラー: {}", e),
            source_detail: None,
        })?;
        
        if bytes.len() != 32 {
            return Err(AppError::IoError {
                message: "暗号化キーのサイズが不正です".to_string(),
                source_detail: None,
            });
        }
        
        let mut key = [0u8; 32];
        key.copy_from_slice(&bytes);
        
        // ⚠️ 警告: ファイルシステムから暗号化キーを読み込みました（セキュリティリスク）
        eprintln!("[WARN] セキュリティ警告: 暗号化キーがファイルシステムから読み込まれました。OSキーストアへの移行を試みます。");
        eprintln!("[WARN] セキュリティ推奨: OSキーストアが使用できない環境では、暗号化キーがファイルシステムに保存されるため、セキュリティリスクがあります。");
        
        // ファイルシステムから読み込んだキーをOSキーストアに移行（次回から使用）
        if save_key_to_keyring(&key).is_ok() {
            // 移行成功したら、ファイルを削除（オプション、セキュリティ向上のため）
            let _ = fs::remove_file(&key_path);
            eprintln!("[INFO] 暗号化キーをOSキーストアに移行しました。ファイルシステムのキーを削除しました。");
        } else {
            eprintln!("[WARN] OSキーストアへの移行に失敗しました。暗号化キーは引き続きファイルシステムに保存されています。");
        }
        
        key
    } else {
        // 新しいキーを生成
        let key = Aes256Gcm::generate_key(&mut OsRng);
        // GenericArrayを[u8; 32]に変換
        #[allow(deprecated)] // aes-gcm 0.10では非推奨だが、依存関係のバージョンアップは中長期改善項目
        let key_bytes: &[u8] = key.as_ref();
        
        let mut result = [0u8; 32];
        result.copy_from_slice(key_bytes);
        
        // まずOSキーストアに保存を試みる
        if save_key_to_keyring(&result).is_ok() {
            // OSキーストアへの保存が成功した場合は、ファイルシステムには保存しない
            return Ok(result);
        }
        
        // OSキーストアへの保存が失敗した場合は、ファイルシステムに保存（フォールバック）
        // ⚠️ 警告: セキュリティリスクがあるため、警告ログを出力
        eprintln!("[WARN] セキュリティ警告: OSキーストアへの保存に失敗しました。暗号化キーをファイルシステムに保存します（フォールバック）。");
        eprintln!("[WARN] セキュリティ推奨: OSキーストアが使用できない環境では、暗号化キーがファイルシステムに保存されるため、セキュリティリスクがあります。");
        eprintln!("[WARN] セキュリティ推奨: 可能であれば、OSキーストアが使用できる環境でアプリケーションを実行してください。");
        
        // 親ディレクトリが存在しない場合は作成
        if let Some(parent) = key_path.parent() {
            fs::create_dir_all(parent).map_err(|e| AppError::IoError {
                message: format!("ディレクトリ作成エラー: {}", e),
                source_detail: None,
            })?;
        }
        
        // キーを保存
        fs::write(&key_path, &key_bytes).map_err(|e| AppError::IoError {
            message: format!("暗号化キー保存エラー: {}", e),
            source_detail: None,
        })?;
        
        eprintln!("[INFO] 暗号化キーをファイルシステムに保存しました: {}", key_path.display());
        
        result
    };
    
    Ok(key_bytes)
}

/// APIキーを暗号化
pub fn encrypt_api_key(plaintext: &str) -> Result<String, AppError> {
    let key_bytes = get_encryption_key()?;
    let cipher = Aes256Gcm::new(&key_bytes.into());
    
    // Nonceを生成
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
    
    // 暗号化
    let ciphertext = cipher.encrypt(&nonce, plaintext.as_bytes().as_ref())
        .map_err(|e| AppError::IoError {
            message: format!("暗号化エラー: {}", e),
            source_detail: None,
        })?;
    
    // Nonceと暗号文を結合してBase64エンコード
    let nonce_bytes: &[u8] = nonce.as_ref();
    let mut combined = nonce_bytes.to_vec();
    combined.extend_from_slice(&ciphertext);
    
    use base64::{Engine as _, engine::general_purpose::STANDARD};
    Ok(STANDARD.encode(&combined))
}

/// OAuthトークンを暗号化（APIキーと同じ暗号化処理を使用）
#[allow(dead_code)] // 将来のOAuth実装で使用予定
pub fn encrypt_oauth_token(token: &str) -> Result<String, AppError> {
    encrypt_api_key(token)
}

/// OAuthトークンを復号化（APIキーと同じ復号化処理を使用）
#[allow(dead_code)] // 将来のOAuth実装で使用予定
pub fn decrypt_oauth_token(encrypted: &str) -> Result<String, AppError> {
    decrypt_api_key(encrypted)
}

/// APIキーを復号化
pub fn decrypt_api_key(encrypted: &str) -> Result<String, AppError> {
    let key_bytes = get_encryption_key()?;
    let cipher = Aes256Gcm::new(&key_bytes.into());
    
    // Base64デコード
    use base64::{Engine as _, engine::general_purpose::STANDARD};
    let combined = STANDARD.decode(encrypted).map_err(|e| AppError::IoError {
        message: format!("復号化エラー:  {}", e),
        
        source_detail: None,
})?;
    
    // Nonceと暗号文を分離
    if combined.len() < 12 {
        return Err(AppError::IoError {
            message: "復号化データが不正です".to_string(),
            source_detail: None,
        });
    }
    
    // Nonceを12バイトの配列から作成
    let nonce_bytes: [u8; 12] = combined[..12].try_into()
        .map_err(|_| AppError::IoError {
            message: "Nonceの長さが不正です".to_string(),
            source_detail: None,
        })?;
    #[allow(deprecated)] // aes-gcm 0.10では非推奨だが、依存関係のバージョンアップは中長期改善項目
    let nonce = Nonce::from_slice(&nonce_bytes);
    let ciphertext = &combined[12..];
    
    // 復号化
    let plaintext = cipher.decrypt(nonce, ciphertext.as_ref())
        .map_err(|e| AppError::IoError {
            message: format!("復号化エラー: {}", e),
            source_detail: None,
        })?;
    
    String::from_utf8(plaintext).map_err(|e| AppError::IoError {
        message: format!("UTF-8変換エラー: {}", e),
        source_detail: None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    
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


