//! Path utilities for OS-specific directories

use std::env;
use std::path::PathBuf;

/// Get the application data directory based on OS
///
/// Returns:
/// - Windows: `%LOCALAPPDATA%\FLM` (or `%USERPROFILE%\AppData\Local\FLM` as fallback)
/// - macOS: `~/Library/Application Support/FLM`
/// - Linux: `~/.local/share/FLM`
///
/// If `FLM_DATA_DIR` environment variable is set, it takes precedence.
pub fn get_app_data_dir() -> Result<PathBuf, String> {
    // Check for FLM_DATA_DIR environment variable first
    if let Ok(flm_data_dir) = env::var("FLM_DATA_DIR") {
        return Ok(PathBuf::from(flm_data_dir));
    }

    #[cfg(target_os = "windows")]
    {
        let app_data_dir = match env::var("LOCALAPPDATA") {
            Ok(path) => PathBuf::from(path).join("FLM"),
            Err(_) => {
                // Fallback to USERPROFILE
                match env::var("USERPROFILE") {
                    Ok(user_profile) => PathBuf::from(user_profile)
                        .join("AppData")
                        .join("Local")
                        .join("FLM"),
                    Err(_) => {
                        // Last resort: current directory
                        env::current_dir()
                            .map_err(|e| format!("Failed to get current directory: {e}"))?
                            .join(".flm_data")
                    }
                }
            }
        };
        Ok(app_data_dir)
    }

    #[cfg(target_os = "macos")]
    {
        let home = env::var("HOME")
            .map_err(|e| format!("Failed to get HOME environment variable: {e}"))?;
        Ok(PathBuf::from(home).join("Library/Application Support/FLM"))
    }

    #[cfg(target_os = "linux")]
    {
        let home = env::var("HOME")
            .map_err(|e| format!("Failed to get HOME environment variable: {e}"))?;
        Ok(PathBuf::from(home).join(".local/share/FLM"))
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        Err("Unsupported operating system".to_string())
    }
}

/// Get the default path for config.db
///
/// This function ensures that the parent directory exists before returning the path.
/// If the parent directory cannot be created, it falls back to a path in the current directory.
pub fn get_config_db_path() -> PathBuf {
    match get_app_data_dir() {
        Ok(dir) => {
            // Ensure parent directory exists
            if let Err(e) = std::fs::create_dir_all(&dir) {
                eprintln!("Warning: Failed to create app data directory {dir:?}: {e}. Using current directory.");
                return PathBuf::from("config.db");
            }
            dir.join("config.db")
        }
        Err(_) => PathBuf::from("config.db"),
    }
}

/// Get the default path for security.db
///
/// This function ensures that the parent directory exists before returning the path.
/// If the parent directory cannot be created, it falls back to a path in the current directory.
pub fn get_security_db_path() -> PathBuf {
    match get_app_data_dir() {
        Ok(dir) => {
            // Ensure parent directory exists
            if let Err(e) = std::fs::create_dir_all(&dir) {
                eprintln!("Warning: Failed to create app data directory {dir:?}: {e}. Using current directory.");
                return PathBuf::from("security.db");
            }
            dir.join("security.db")
        }
        Err(_) => PathBuf::from("security.db"),
    }
}
