// HTTP Request Commands
// IPC経由でHTTPリクエストを送信するコマンド
// 自己署名証明書を使用するプロキシサーバーへの接続に対応

use serde::{Deserialize, Serialize};

/// HTTPリクエストのオプション
#[derive(Debug, Serialize, Deserialize)]
pub struct HttpRequestOptions {
    /// リクエストURL
    pub url: String,
    /// HTTPメソッド（GET, POST, PUT, DELETEなど）
    pub method: String,
    /// リクエストヘッダー
    #[serde(default)]
    pub headers: std::collections::HashMap<String, String>,
    /// リクエストボディ（JSON文字列）
    #[serde(default)]
    pub body: Option<String>,
    /// タイムアウト（秒、デフォルト: 30）
    #[serde(default = "default_timeout")]
    pub timeout_secs: u64,
}

fn default_timeout() -> u64 {
    30
}

/// HTTPレスポンス
#[derive(Debug, Serialize, Deserialize)]
pub struct HttpResponse {
    /// ステータスコード
    pub status: u16,
    /// レスポンスヘッダー
    pub headers: std::collections::HashMap<String, String>,
    /// レスポンスボディ（文字列）
    pub body: String,
}

/// HTTPリクエストを送信するコマンド
/// 自己署名証明書を使用するプロキシサーバーへの接続に対応
#[tauri::command]
pub async fn send_http_request(options: HttpRequestOptions) -> Result<HttpResponse, String> {
    use crate::{debug_log, error_log};
    use std::time::Duration;

    debug_log!("HTTPリクエスト送信開始: {} {}", options.method, options.url);

    // カスタムタイムアウト設定でHTTPクライアントを作成（自己署名証明書を許可）
    // デフォルトは30秒、optionsで指定された場合はそれを使用
    let timeout_secs = options.timeout_secs;
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(timeout_secs))
        .connect_timeout(Duration::from_secs(10)) // 接続タイムアウトは10秒
        .danger_accept_invalid_certs(true) // 自己署名証明書を許可
        .build()
        .map_err(|e| {
            let error_msg = format!("HTTPクライアントの作成に失敗しました: {}", e);
            error_log!("{}", error_msg);
            error_msg
        })?;

    debug_log!("HTTPクライアント作成完了: タイムアウト={}秒", timeout_secs);

    // HTTPメソッドを大文字に変換
    let method = options.method.to_uppercase();

    // リクエストを構築
    let mut request_builder = match method.as_str() {
        "GET" => client.get(&options.url),
        "POST" => client.post(&options.url),
        "PUT" => client.put(&options.url),
        "DELETE" => client.delete(&options.url),
        "PATCH" => client.patch(&options.url),
        _ => {
            let error_msg = format!("サポートされていないHTTPメソッド: {}", method);
            error_log!("{}", error_msg);
            return Err(error_msg);
        }
    };

    // ヘッダーを設定
    for (key, value) in &options.headers {
        request_builder = request_builder.header(key, value);
        debug_log!(
            "  ヘッダー: {}: {}",
            key,
            if key.to_lowercase() == "authorization" {
                "***"
            } else {
                value
            }
        );
    }

    // ボディを設定
    if let Some(body) = &options.body {
        request_builder = request_builder.body(body.clone());
        debug_log!("  ボディサイズ: {} bytes", body.len());
    }

    // リクエストを送信
    let response = match request_builder.send().await {
        Ok(resp) => resp,
        Err(e) => {
            let error_msg = format!(
                "HTTPリクエストの送信に失敗しました: {} (URL: {})",
                e, options.url
            );
            error_log!("{}", error_msg);
            error_log!(
                "エラーの詳細: is_connect={}, is_timeout={}, is_request={}",
                e.is_connect(),
                e.is_timeout(),
                e.is_request()
            );

            // エラーの種類に応じて詳細なメッセージを提供
            let detailed_error = if e.is_connect() {
                // 接続エラーの場合、プロキシサーバーの状態を確認
                let url_str = &options.url;
                let https_port = if let Some(port_start) = url_str.rfind(':') {
                    if let Some(port_end) = url_str[port_start + 1..].find('/') {
                        url_str[port_start + 1..port_start + 1 + port_end]
                            .parse::<u16>()
                            .ok()
                    } else {
                        url_str[port_start + 1..].parse::<u16>().ok()
                    }
                } else {
                    None
                };

                let mut detailed_msg = format!(
                    "接続エラー: {} に接続できません（os error 10061: 接続が拒否されました）。\n\n",
                    options.url
                );

                if let Some(https_p) = https_port {
                    let http_port = https_p.saturating_sub(1);

                    detailed_msg.push_str(&format!("⚠️ プロキシサーバーに接続できません。\n\n"));
                    detailed_msg.push_str(&format!("対処方法:\n"));
                    detailed_msg.push_str(&format!(
                        "1. API一覧画面でAPIのステータスを確認してください\n"
                    ));
                    detailed_msg.push_str(&format!(
                        "2. APIが停止している場合は、APIを起動してください\n"
                    ));
                    detailed_msg.push_str(&format!(
                        "3. ポート {} (HTTP) と {} (HTTPS) が使用可能か確認してください\n",
                        http_port, https_p
                    ));
                    detailed_msg.push_str(&format!(
                        "4. ファイアウォールがポート {} をブロックしていないか確認してください\n",
                        https_p
                    ));
                    detailed_msg.push_str(&format!(
                        "5. 別のプロセスがポート {} を使用していないか確認してください\n",
                        https_p
                    ));

                    detailed_msg.push_str(&format!(
                        "\nポート情報: HTTP={}, HTTPS={}",
                        http_port, https_p
                    ));
                } else {
                    detailed_msg.push_str("プロキシサーバーが起動しているか確認してください。");
                }

                detailed_msg
            } else if e.is_timeout() {
                format!(
                    "タイムアウトエラー: {} へのリクエストがタイムアウトしました（タイムアウト: {}秒）。\nLLMエンジンの応答に時間がかかっている可能性があります。タイムアウト時間を延長するか、LLMエンジンの状態を確認してください。",
                    options.url, timeout_secs
                )
            } else {
                error_msg
            };

            return Err(detailed_error);
        }
    };

    // ステータスコードを取得
    let status = response.status().as_u16();
    debug_log!("HTTPレスポンス受信: ステータス={}", status);

    // レスポンスヘッダーを取得
    let mut headers = std::collections::HashMap::new();
    for (key, value) in response.headers() {
        if let Ok(value_str) = value.to_str() {
            headers.insert(key.to_string(), value_str.to_string());
        }
    }

    // レスポンスボディを取得
    let body = response.text().await.map_err(|e| {
        let error_msg = format!("レスポンスボディの読み取りに失敗しました: {}", e);
        error_log!("{}", error_msg);
        error_msg
    })?;

    debug_log!(
        "HTTPリクエスト成功: ステータス={}, ボディサイズ={} bytes",
        status,
        body.len()
    );

    Ok(HttpResponse {
        status,
        headers,
        body,
    })
}

/// プロキシサーバーの状態を確認するコマンド
#[tauri::command]
pub async fn check_proxy_health(port: u16) -> Result<ProxyHealthResponse, String> {
    use crate::auth_proxy::check_proxy_running;
    use crate::{debug_log, error_log};

    debug_log!("プロキシサーバーのヘルスチェック開始: ポート {}", port);

    // プロキシサーバーが起動しているか確認
    let is_running = check_proxy_running(port).await;

    if is_running {
        debug_log!("プロキシサーバーは正常に動作しています: ポート {}", port);
        Ok(ProxyHealthResponse {
            is_running: true,
            port,
            https_port: port + 1,
            message: format!(
                "プロキシサーバーは正常に動作しています (HTTP: {}, HTTPS: {})",
                port,
                port + 1
            ),
        })
    } else {
        let error_msg = format!(
            "プロキシサーバーに接続できません (HTTP: {}, HTTPS: {})。プロキシサーバーが起動しているか確認してください。",
            port, port + 1
        );
        error_log!("{}", error_msg);
        Ok(ProxyHealthResponse {
            is_running: false,
            port,
            https_port: port + 1,
            message: error_msg,
        })
    }
}

/// プロキシサーバーのヘルスチェックレスポンス
#[derive(Debug, Serialize, Deserialize)]
pub struct ProxyHealthResponse {
    /// プロキシサーバーが起動しているか
    pub is_running: bool,
    /// HTTPポート
    pub port: u16,
    /// HTTPSポート
    pub https_port: u16,
    /// メッセージ
    pub message: String,
}
