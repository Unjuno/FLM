// Engine Management Commands
// エンジン管理のIPCコマンド

use crate::engines::{EngineManager, EngineDetectionResult, EngineConfig, EngineConfigData, EngineDownloadProgress, EngineUpdateCheck};
use crate::engines::installer::{install_lm_studio, install_vllm, install_llama_cpp};
use crate::engines::updater::{check_lm_studio_update, check_vllm_update, check_llama_cpp_update, update_lm_studio, update_vllm, update_llama_cpp};
use crate::database::connection::get_connection;
use rusqlite::params;
use uuid::Uuid;
use chrono::Utc;
use tauri::{AppHandle, Emitter};

/// グローバルエンジンマネージャーインスタンス（シンプルな実装）
fn get_engine_manager() -> EngineManager {
    EngineManager::new()
}

/// 利用可能なエンジン一覧を取得
#[tauri::command]
pub async fn get_available_engines() -> Result<Vec<String>, String> {
    let manager = get_engine_manager();
    Ok(manager.get_available_engine_types())
}

/// 特定のエンジンを検出
#[tauri::command]
pub async fn detect_engine(engine_type: String) -> Result<EngineDetectionResult, String> {
    eprintln!("[DEBUG] detect_engineコマンド呼び出し: engine_type={}", engine_type);
    let manager = get_engine_manager();
    match manager.detect_engine(&engine_type).await {
        Ok(result) => {
            eprintln!("[DEBUG] detect_engine成功: installed={}, running={}, message={:?}", 
                result.installed, result.running, result.message);
            Ok(result)
        },
        Err(e) => {
            eprintln!("[ERROR] detect_engine失敗: engine_type={}, error={}", engine_type, e);
            // エラーが発生した場合でも、エンジンがインストールされていないことを示す結果を返す
            // これにより、フロントエンドで適切なエラーメッセージを表示できる
            Err(format!("エンジン検出エラー ({}): {}", engine_type, e))
        }
    }
}

/// すべてのエンジンを検出
#[tauri::command]
pub async fn detect_all_engines() -> Result<Vec<EngineDetectionResult>, String> {
    let manager = get_engine_manager();
    Ok(manager.detect_all_engines().await)
}

/// エンジンを起動
#[tauri::command]
#[allow(non_snake_case)] // Tauri v2のフロントエンドとの互換性のためcamelCaseを使用
pub async fn start_engine(
    engineType: String,
    config: Option<EngineConfig>
) -> Result<u32, String> {
    let engine_type = engineType;
    let manager = get_engine_manager();
    manager.start_engine(&engine_type, config).await
        .map_err(|e| format!("{}", e))
}

/// エンジンを停止
#[tauri::command]
pub async fn stop_engine(engine_type: String) -> Result<(), String> {
    let manager = get_engine_manager();
    manager.stop_engine(&engine_type).await
        .map_err(|e| format!("{}", e))
}

/// エンジン設定を保存
#[tauri::command]
pub async fn save_engine_config(config: EngineConfigData) -> Result<String, String> {
    let conn = get_connection()
        .map_err(|e| format!("データベース接続エラー: {}", e))?;
    
    let now = Utc::now().to_rfc3339();
    let id = if config.id.is_empty() {
        Uuid::new_v4().to_string()
    } else {
        config.id.clone()
    };
    
    conn.execute(
        r#"
        INSERT OR REPLACE INTO engine_configs 
        (id, engine_type, name, base_url, auto_detect, executable_path, is_default, created_at, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 
                COALESCE((SELECT created_at FROM engine_configs WHERE id = ?1), ?8),
                ?8)
        "#,
        params![
            id,
            config.engine_type,
            config.name,
            config.base_url,
            if config.auto_detect { 1 } else { 0 },
            config.executable_path,
            if config.is_default { 1 } else { 0 },
            now,
        ],
    )
    .map_err(|e| format!("データベース保存エラー: {}", e))?;
    
    // デフォルトエンジンを設定する場合、他のエンジンのis_defaultを0に設定
    if config.is_default {
        conn.execute(
            "UPDATE engine_configs SET is_default = 0 WHERE engine_type = ?1 AND id != ?2",
            params![config.engine_type, id],
        )
        .map_err(|e| format!("デフォルトエンジン設定エラー: {}", e))?;
    }
    
    Ok(id)
}

/// エンジン設定一覧を取得
#[tauri::command]
pub async fn get_engine_configs(engine_type: Option<String>) -> Result<Vec<EngineConfigData>, String> {
    let conn = get_connection()
        .map_err(|e| format!("データベース接続エラー: {}", e))?;
    
    let query = if engine_type.is_some() {
        "SELECT id, engine_type, name, base_url, auto_detect, executable_path, is_default, created_at, updated_at FROM engine_configs WHERE engine_type = ?1 ORDER BY is_default DESC, created_at DESC"
    } else {
        "SELECT id, engine_type, name, base_url, auto_detect, executable_path, is_default, created_at, updated_at FROM engine_configs ORDER BY is_default DESC, created_at DESC"
    };
    
    let mut stmt = conn.prepare(query)
        .map_err(|e| format!("クエリ準備エラー: {}", e))?;
    
    let mut configs = Vec::new();
    
    if let Some(et) = engine_type.as_ref() {
        let rows = stmt.query_map(params![et], |row| {
            Ok(EngineConfigData {
                id: row.get(0)?,
                engine_type: row.get(1)?,
                name: row.get(2)?,
                base_url: row.get(3)?,
                auto_detect: row.get::<_, i32>(4)? != 0,
                executable_path: row.get(5)?,
                is_default: row.get::<_, i32>(6)? != 0,
            })
        })
        .map_err(|e| format!("クエリ実行エラー: {}", e))?;
        
        for row in rows {
            configs.push(row.map_err(|e| format!("行読み込みエラー: {}", e))?);
        }
    } else {
        let rows = stmt.query_map([], |row| {
            Ok(EngineConfigData {
                id: row.get(0)?,
                engine_type: row.get(1)?,
                name: row.get(2)?,
                base_url: row.get(3)?,
                auto_detect: row.get::<_, i32>(4)? != 0,
                executable_path: row.get(5)?,
                is_default: row.get::<_, i32>(6)? != 0,
            })
        })
        .map_err(|e| format!("クエリ実行エラー: {}", e))?;
        
        for row in rows {
            configs.push(row.map_err(|e| format!("行読み込みエラー: {}", e))?);
        }
    }
    
    Ok(configs)
}

/// エンジン設定を削除
#[tauri::command]
pub async fn delete_engine_config(config_id: String) -> Result<(), String> {
    let conn = get_connection()
        .map_err(|e| format!("データベース接続エラー: {}", e))?;
    
    conn.execute(
        "DELETE FROM engine_configs WHERE id = ?1",
        params![config_id],
    )
    .map_err(|e| format!("削除エラー: {}", e))?;
    
    Ok(())
}

/// エンジンからモデル一覧を取得
#[tauri::command]
pub async fn get_engine_models(engine_type: String) -> Result<Vec<crate::engines::ModelInfo>, String> {
    let manager = get_engine_manager();
    manager.get_engine_models(&engine_type).await
        .map_err(|e| format!("{}", e))
}

/// エンジンをインストール
#[tauri::command]
#[allow(non_snake_case)] // Tauri v2のフロントエンドとの互換性のためcamelCaseを使用
pub async fn install_engine(
    app_handle: AppHandle,
    engineType: String
) -> Result<String, String> {
    let engine_type = engineType;
    
    // インストール前に、既にインストールされているかチェック
    let manager = get_engine_manager();
    match manager.detect_engine(&engine_type).await {
        Ok(detection_result) => {
            if detection_result.installed {
                return Err(format!(
                    "{}は既にインストールされています。パス: {}",
                    match engine_type.as_str() {
                        "lm_studio" => "LM Studio",
                        "vllm" => "vLLM",
                        "llama_cpp" => "llama.cpp",
                        _ => &engine_type,
                    },
                    detection_result.path.as_ref()
                        .map(|p| p.as_str())
                        .unwrap_or("不明")
                ));
            }
        },
        Err(e) => {
            // 検出エラーは無視してインストールを続行（エンジンが存在しない可能性があるため）
            eprintln!("[WARN] エンジン検出エラー（インストールを続行）: {}", e);
        }
    }
    
    // 進捗をイベントで送信するコールバック
    let progress_callback = |progress: EngineDownloadProgress| -> Result<(), crate::utils::error::AppError> {
        if let Err(e) = app_handle.emit("engine_install_progress", &progress) {
            eprintln!("[WARN] エンジンインストール進捗イベントの送信に失敗しました: {}", e);
        }
        Ok(())
    };
    
    match engine_type.as_str() {
        "lm_studio" => {
            install_lm_studio(progress_callback).await
                .map_err(|e| format!("LM Studioのインストールに失敗しました: {}", e))
        },
        "vllm" => {
            install_vllm(progress_callback).await
                .map_err(|e| format!("vLLMのインストールに失敗しました: {}", e))
        },
        "llama_cpp" => {
            install_llama_cpp(progress_callback).await
                .map_err(|e| format!("llama.cppのインストールに失敗しました: {}", e))
        },
        "ollama" => {
            // Ollamaは別のコマンド（download_ollama）を使用
            Err("Ollamaのインストールには「Ollamaセットアップ」機能を使用してください。".to_string())
        },
        _ => {
            Err(format!("不明なエンジンタイプ: {}", engine_type))
        }
    }
}

/// エンジンのアップデート確認
#[tauri::command]
pub async fn check_engine_update(engine_type: String) -> Result<EngineUpdateCheck, String> {
    match engine_type.as_str() {
        "lm_studio" => {
            check_lm_studio_update().await
                .map_err(|e| format!("LM Studioのアップデート確認に失敗しました: {}", e))
        },
        "vllm" => {
            check_vllm_update().await
                .map_err(|e| format!("vLLMのアップデート確認に失敗しました: {}", e))
        },
        "llama_cpp" => {
            check_llama_cpp_update().await
                .map_err(|e| format!("llama.cppのアップデート確認に失敗しました: {}", e))
        },
        "ollama" => {
            // Ollamaは別のコマンド（check_ollama_update）を使用
            Err("Ollamaのアップデート確認には専用のコマンドを使用してください。".to_string())
        },
        _ => {
            Err(format!("不明なエンジンタイプ: {}", engine_type))
        }
    }
}

/// エンジンをアップデート
#[tauri::command]
pub async fn update_engine(
    app_handle: AppHandle,
    engine_type: String
) -> Result<String, String> {
    // 進捗をイベントで送信するコールバック
    let progress_callback = |progress: EngineDownloadProgress| -> Result<(), crate::utils::error::AppError> {
        if let Err(e) = app_handle.emit("engine_update_progress", &progress) {
            eprintln!("[WARN] エンジン更新進捗イベントの送信に失敗しました: {}", e);
        }
        Ok(())
    };
    
    match engine_type.as_str() {
        "lm_studio" => {
            update_lm_studio(progress_callback).await
                .map_err(|e| format!("LM Studioのアップデートに失敗しました: {}", e))
        },
        "vllm" => {
            update_vllm(progress_callback).await
                .map_err(|e| format!("vLLMのアップデートに失敗しました: {}", e))
        },
        "llama_cpp" => {
            update_llama_cpp(progress_callback).await
                .map_err(|e| format!("llama.cppのアップデートに失敗しました: {}", e))
        },
        "ollama" => {
            // Ollamaは別のコマンド（update_ollama）を使用
            Err("Ollamaのアップデートには専用のコマンドを使用してください。".to_string())
        },
        _ => {
            Err(format!("不明なエンジンタイプ: {}", engine_type))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    /// 利用可能なエンジン一覧の取得テスト
    #[test]
    fn test_get_available_engines() {
        let manager = get_engine_manager();
        let engines = manager.get_available_engine_types();
        
        // 少なくともollamaが含まれていることを確認
        assert!(engines.contains(&"ollama".to_string()));
        
        // エンジンリストが空でないことを確認
        assert!(!engines.is_empty());
    }
    
    /// エンジンタイプの検証テスト
    #[test]
    fn test_engine_type_validation() {
        let valid_engines = vec!["ollama", "lm_studio", "vllm", "llama_cpp"];
        
        for engine_type in valid_engines {
            // エンジンタイプが有効な形式であることを確認
            assert!(!engine_type.is_empty());
            assert!(engine_type.len() <= 50); // 合理的な長さ制限
        }
    }
    
    /// EngineConfigDataの検証テスト
    #[test]
    fn test_engine_config_data_validation() {
        let config = EngineConfigData {
            id: "test-id".to_string(),
            engine_type: "ollama".to_string(),
            name: "Test Engine".to_string(),
            base_url: "http://localhost:11434".to_string(),
            auto_detect: true,
            executable_path: None,
            is_default: false,
        };
        
        assert_eq!(config.id, "test-id");
        assert_eq!(config.engine_type, "ollama");
        assert_eq!(config.name, "Test Engine");
        assert_eq!(config.auto_detect, true);
        assert_eq!(config.is_default, false);
    }
}

