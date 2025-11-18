/// API状態同期処理
///
/// アプリケーション起動時に、データベースに記録されているAPIの状態と
/// 実際のプロセス状態を同期します。

use crate::app::initialization::initialize_auto_backup;
use crate::app::runtime::spawn_async_task;
use crate::auth_proxy::check_proxy_running;
use crate::commands::api;
use crate::database::connection::get_connection;
use crate::database::models::ApiStatus;
use crate::database::repository::ApiRepository;
use crate::{debug_log, warn_log};
use chrono::Utc;

/// 起動時にAPIの状態を同期し、前回起動中だったAPIを自動起動
pub async fn sync_api_states_on_startup() {
    debug_log!("アプリケーション起動時: APIの状態を同期します...");

    // すべてのAPIを取得
    let apis = match api::list_apis().await {
        Ok(apis) => apis,
        Err(e) => {
            warn_log!("API一覧の取得に失敗しました: {}. 自動起動をスキップします。", e);
            // エラーが発生しても自動バックアップの初期化を試みる
            initialize_auto_backup().await;
            return;
        }
    };

    // 前回「running」だったAPIのIDを記録（状態を同期する前に記録）
    let previously_running_ids = collect_previously_running_api_ids(&apis);

    // データベースで「running」と記録されているAPIの実際の状態を確認・同期
    let synced_count = sync_running_api_states(&apis).await;

    // 前回起動中だったAPIを自動起動
    let (started_count, failed_count) = auto_start_previously_running_apis(&previously_running_ids).await;

    // 結果をログに記録
    log_sync_results(synced_count, started_count, failed_count, &previously_running_ids);

    // エンジンの自動起動
    auto_start_installed_engines().await;

    // 自動バックアップの初期化
    initialize_auto_backup().await;
}

/// 起動時のバックグラウンドタスクを開始
///
/// API状態の同期と自動起動をバックグラウンドで実行します。
/// この関数は起動をブロックせず、エラーが発生してもアプリケーションの起動には影響しません。
pub fn spawn_startup_task() {
    spawn_async_task(async {
        // API状態の同期と自動起動
        sync_api_states_on_startup().await;
    });
}

/// 前回起動中だったAPIのIDを収集
fn collect_previously_running_api_ids(apis: &[crate::commands::api::ApiInfo]) -> std::collections::HashSet<String> {
    let ids: std::collections::HashSet<String> = apis
        .iter()
        .filter(|api| api.status == "running")
        .map(|api| api.id.clone())
        .collect();

    if !ids.is_empty() {
        debug_log!("前回起動中だったAPI数: {}", ids.len());
    }

    ids
}

/// データベースで「running」と記録されているAPIの実際の状態を確認・同期
async fn sync_running_api_states(apis: &[crate::commands::api::ApiInfo]) -> usize {
    let mut synced_count = 0;

    for api_info in apis {
        if api_info.status != "running" {
            continue;
        }

        // プロキシプロセスが実際に起動しているか確認
        let is_actually_running = check_proxy_running(api_info.port as u16).await;

        if !is_actually_running {
            debug_log!(
                "API「{}」(ポート {}) はデータベースでは「running」ですが、実際には停止しています。状態を同期します...",
                api_info.name,
                api_info.port
            );

            match sync_api_status_to_stopped(&api_info.id).await {
                Ok(true) => {
                    debug_log!("✓ API「{}」の状態を「stopped」に更新しました", api_info.name);
                    synced_count += 1;
                }
                Ok(false) | Err(_) => {
                    warn_log!("✗ API「{}」の状態更新に失敗しました", api_info.name);
                }
            }
        }
    }

    synced_count
}

/// 前回起動中だったAPIを自動起動
///
/// 前回アプリケーション終了時に起動中だったAPIを自動的に再起動します。
///
/// # Arguments
/// * `previously_running_ids` - 前回起動中だったAPIのIDセット
///
/// # Returns
/// `(成功数, 失敗数)`のタプル
async fn auto_start_previously_running_apis(
    previously_running_ids: &std::collections::HashSet<String>,
) -> (usize, usize) {
    let mut started_count = 0;
    let mut failed_count = 0;

    // 再度API一覧を取得（状態が更新された可能性があるため）
    let updated_apis = match api::list_apis().await {
        Ok(apis) => apis,
        Err(e) => {
            warn_log!("更新後のAPI一覧の取得に失敗しました: {}", e);
            return (0, 0);
        }
    };

    // 前回「running」だったAPIのみを自動起動
    for api_info in updated_apis {
        // 前回「running」だったAPIで、現在「stopped」状態のものを起動
        if previously_running_ids.contains(&api_info.id) && api_info.status == "stopped" {
            debug_log!(
                "API「{}」は前回起動中でした。自動起動します...",
                api_info.name
            );

            match api::start_api(api_info.id.clone()).await {
                Ok(_) => {
                    debug_log!("✓ API「{}」の起動に成功しました", api_info.name);
                    started_count += 1;
                }
                Err(e) => {
                    warn_log!("✗ API「{}」の起動に失敗しました: {}", api_info.name, e);
                    failed_count += 1;
                }
            }
        }
    }

    (started_count, failed_count)
}

/// 同期結果をログに記録
fn log_sync_results(
    synced_count: usize,
    started_count: usize,
    failed_count: usize,
    previously_running_ids: &std::collections::HashSet<String>,
) {
    if synced_count > 0 {
        debug_log!(
            "API状態同期: {}件のAPIの状態を修正しました",
            synced_count
        );
    }

    if started_count > 0 || failed_count > 0 {
        debug_log!(
            "API自動起動完了: 成功={}件, 失敗={}件",
            started_count,
            failed_count
        );
    } else if !previously_running_ids.is_empty() {
        debug_log!("前回起動中だったAPIは既に起動中です");
    } else {
        debug_log!("起動すべき停止状態のAPIはありませんでした");
    }
}

/// インストールされているエンジンを自動起動
async fn auto_start_installed_engines() {
    use crate::engines::manager::EngineManager;
    use crate::engines::models::EngineConfig;
    use crate::{debug_log, warn_log};

    debug_log!("インストールされているエンジンの自動起動を開始します...");

    let manager = EngineManager::new();
    let engine_types = vec!["ollama", "lm_studio", "vllm", "llama_cpp"];

    let mut started_count = 0;
    let mut failed_count = 0;
    let mut skipped_count = 0;

    for engine_type in engine_types {
        // エンジンの検出（この結果は起動前の状態として保持される）
        let detection_result = match manager.detect_engine(engine_type).await {
            Ok(result) => result,
            Err(e) => {
                warn_log!("エンジン「{}」の検出に失敗しました: {}", engine_type, e);
                continue;
            }
        };

        // インストールされていない場合はスキップ
        if !detection_result.installed {
            debug_log!("エンジン「{}」はインストールされていません。スキップします。", engine_type);
            skipped_count += 1;
            continue;
        }

        // 既に起動している場合はスキップ
        if detection_result.running {
            debug_log!("エンジン「{}」は既に起動中です。スキップします。", engine_type);
            skipped_count += 1;
            continue;
        }

        // vLLMの場合は、デフォルトのモデル名を使用
        // 注意: vLLMは起動時にモデルが存在しない場合、自動的にHugging Faceからダウンロードします
        // GPT2は比較的小さいモデル（約500MB）で、初回起動時に自動ダウンロードされます
        let config: Option<EngineConfig> = if engine_type == "vllm" {
            debug_log!("vLLMのモデル名が設定されていません。デフォルトモデル名「gpt2」を使用して自動起動を試みます。vLLMが起動時に自動的にモデルをダウンロードします（初回のみ、約500MB）。");
            Some(EngineConfig {
                engine_type: engine_type.to_string(),
                base_url: None,
                executable_path: None,
                port: Some(8000),
                auto_detect: true,
                model_name: Some("gpt2".to_string()),
            })
        } else {
            None
        };

        // エンジンを起動
        if let Some(ref cfg) = config {
            debug_log!("エンジン「{}」を自動起動します（設定: モデル名={:?}, ポート={:?}）...", 
                engine_type, cfg.model_name, cfg.port);
        } else {
            debug_log!("エンジン「{}」を自動起動します...", engine_type);
        }
        match manager.start_engine(engine_type, config).await {
            Ok(_) => {
                debug_log!("✓ エンジン「{}」の自動起動に成功しました", engine_type);
                
                // vLLMの場合は、起動後に少し待機してから状態を再確認
                // 注意: 起動前の検出結果（detection_result）を保持し、起動後の検出結果と比較
                // これにより、起動前後の状態変化を追跡できる
                if engine_type == "vllm" {
                    debug_log!("vLLMの起動確認のため、3秒待機します...");
                    tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;
                    
                    // 起動状態を再確認（起動前の検出結果と比較）
                    // 注意: vLLMの起動確認は必要だが、他のエンジンでは不要なため、vLLMのみ実行
                    match manager.detect_engine(engine_type).await {
                        Ok(updated_result) => {
                            // 起動前後の状態を比較
                            if updated_result.running {
                                debug_log!("✓ vLLMが正常に起動し、認識されました（起動前: running=false → 起動後: running=true）");
                            } else {
                                warn_log!("⚠ vLLMは起動しましたが、まだ認識されていません。モデルのダウンロード中かもしれません（起動前: running=false → 起動後: running=false）");
                            }
                            // 注意: detection_resultはループ内で再使用されないため、更新は不要
                        }
                        Err(e) => {
                            warn_log!("vLLMの起動確認に失敗しました: {}", e);
                            // エラーでも起動は成功したのでカウント
                        }
                    }
                }
                
                started_count += 1;
            }
            Err(e) => {
                warn_log!("✗ エンジン「{}」の自動起動に失敗しました: {}", engine_type, e);
                failed_count += 1;
            }
        }
    }

    if started_count > 0 || failed_count > 0 {
        debug_log!(
            "エンジン自動起動完了: 成功={}件, 失敗={}件, スキップ={}件",
            started_count,
            failed_count,
            skipped_count
        );
    } else {
        debug_log!("自動起動すべきエンジンはありませんでした（スキップ: {}件）", skipped_count);
    }
}

/// APIの状態を「stopped」に更新
async fn sync_api_status_to_stopped(api_id: &str) -> Result<bool, String> {
    let api_id = api_id.to_string();
    tokio::task::spawn_blocking(move || {
        let conn = get_connection().map_err(|e| format!("データベース接続エラー: {}", e))?;
        let api_repo = ApiRepository::new(&conn);
        let mut api = api_repo
            .find_by_id(&api_id)
            .map_err(|e| format!("API取得エラー: {}", e))?;

        api.status = ApiStatus::Stopped;
        api.updated_at = Utc::now();

        api_repo
            .update(&api)
            .map_err(|e| format!("API更新エラー: {}", e))?;

        Ok(true)
    })
    .await
    .map_err(|e| format!("タスク実行エラー: {}", e))?
}
