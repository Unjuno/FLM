// Logging Utility Module
// ログ出力のユーティリティ（プライバシー保護機能付き）

use lazy_static::lazy_static;
use regex::Regex;

// 正規表現パターンをコンパイル時に初期化（実行時のエラーチェック不要）
lazy_static! {
    static ref WINDOWS_USER_PATH_REGEX: Regex = Regex::new(r"(?i)(C:\\Users\\)[^\\]+")
        .expect("Windowsユーザーパス正規表現のコンパイルに失敗");
    static ref UNIX_HOME_PATH_REGEX: Regex = Regex::new(r"(/home/)[^/]+")
        .expect("Unixホームパス正規表現のコンパイルに失敗");
    static ref TILDE_PATH_REGEX: Regex = Regex::new(r"(~/)[^/]+")
        .expect("チルダパス正規表現のコンパイルに失敗");
}

/// ログレベル
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum LogLevel {
    Debug,
    Info,
    Warn,
    Error,
}

/// ファイルパスをマスク処理（プライバシー保護）
/// ユーザー名などの機密情報をマスクします
pub fn mask_file_path(path: &str) -> String {
    // Windowsパスのマスク処理
    if path.contains("\\") {
        // C:\Users\username\AppData -> C:\Users\***\AppData
        let masked = WINDOWS_USER_PATH_REGEX.replace_all(path, "$1***");
        return masked.to_string();
    }
    
    // Unix/Linux/macOSパスのマスク処理
    if path.starts_with('/') {
        // /home/username/.local -> /home/***/.local
        let masked = UNIX_HOME_PATH_REGEX.replace_all(path, "$1***");
        return masked.to_string();
    }
    
    // ~/username/.local -> ~/***/.local
    if path.starts_with("~/") {
        let masked = TILDE_PATH_REGEX.replace_all(path, "$1***");
        return masked.to_string();
    }
    
    // その他のパスはそのまま返す（マスクできない）
    path.to_string()
}

/// 環境変数の値をマスク処理（プライバシー保護）
pub fn mask_env_var_value(value: &str) -> String {
    // ファイルパスとして扱える場合はファイルパスのマスク処理を使用
    if value.contains("\\") || value.contains("/") || value.contains("~") {
        return mask_file_path(value);
    }
    
    // その他の環境変数の値はそのまま返す
    value.to_string()
}

/// ログを出力すべきかチェック
#[allow(unused_variables)] // levelはmatchで使用されているが、コンパイラが検出できない場合がある
pub fn should_log(level: LogLevel) -> bool {
    #[cfg(debug_assertions)]
    {
        // 開発環境ではすべてのログを出力
        return true;
    }
    
    #[cfg(not(debug_assertions))]
    {
        // 本番環境ではWarnとErrorのみ出力
        match level {
            LogLevel::Debug => false,
            LogLevel::Info => false,
            LogLevel::Warn => true,
            LogLevel::Error => true,
        }
    }
}

/// デバッグログを出力（開発環境でのみ）
#[macro_export]
macro_rules! debug_log {
    ($($arg:tt)*) => {
        #[cfg(debug_assertions)]
        {
            use $crate::utils::logging::mask_file_path;
            let message = format!($($arg)*);
            // ファイルパスをマスク処理
            let masked_message = mask_file_path(&message);
            eprintln!("[DEBUG] {}", masked_message);
        }
    };
}

/// 情報ログを出力（本番環境では出力しない）
#[macro_export]
macro_rules! info_log {
    ($($arg:tt)*) => {
        {
            let message = format!($($arg)*);
            let masked_message = $crate::utils::logging::mask_file_path(&message);
            if $crate::utils::logging::should_log($crate::utils::logging::LogLevel::Info) {
                eprintln!("[INFO] {}", masked_message);
            }
        }
    };
}

/// 警告ログを出力（常に出力）
#[macro_export]
macro_rules! warn_log {
    ($($arg:tt)*) => {
        {
            let message = format!($($arg)*);
            let masked_message = $crate::utils::logging::mask_file_path(&message);
            if $crate::utils::logging::should_log($crate::utils::logging::LogLevel::Warn) {
                eprintln!("[WARN] {}", masked_message);
            }
        }
    };
}

/// エラーログを出力（常に出力）
#[macro_export]
macro_rules! error_log {
    ($($arg:tt)*) => {
        {
            let message = format!($($arg)*);
            let masked_message = $crate::utils::logging::mask_file_path(&message);
            if $crate::utils::logging::should_log($crate::utils::logging::LogLevel::Error) {
                eprintln!("[ERROR] {}", masked_message);
            }
        }
    };
}

/// プロセスIDをログに出力（開発環境でのみ）
#[macro_export]
macro_rules! log_pid {
    ($pid:expr, $($arg:tt)*) => {
        #[cfg(debug_assertions)]
        {
            eprintln!($($arg)*, $pid);
        }
    };
}

