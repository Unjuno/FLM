// llmTest - LLM実行テストユーティリティ

import { safeInvoke } from './tauri';
import { logger } from './logger';
import { extractErrorMessage } from './errorHandler';
import { API_ENDPOINTS, HTTP_HEADERS } from '../constants/config';

/**
 * エンドポイント文字列から実際のAPIリクエスト用のURLを抽出
 * 表示用の「または」を含む文字列から最初のURLを取得
 * 
 * @param endpoint エンドポイント文字列（例: "http://localhost:8083 または http://192.168.56.1:8083"）
 * @returns 実際のAPIリクエスト用のURL
 */
export function extractEndpointUrl(endpoint: string): string {
  if (!endpoint || typeof endpoint !== 'string') {
    logger.warn('エンドポイントが無効です', 'llmTest');
    return endpoint || '';
  }
  
  // 「または」で分割して最初のURLを取得
  const parts = endpoint.split(' または ');
  let firstUrl = parts[0]?.trim() || '';
  
  // 括弧内の説明文を除去（例: "(HTTP→HTTPS自動リダイレクト: ...)"）
  firstUrl = firstUrl.split(' (')[0].trim();
  
  // URLの形式をチェック（http://またはhttps://で始まる）
  if (firstUrl && (firstUrl.startsWith('http://') || firstUrl.startsWith('https://'))) {
    // HTTPSエンドポイントをそのまま使用（自己署名証明書でも動作するように設定）
    logger.debug(`エンドポイントを抽出: "${endpoint}" → "${firstUrl}"`, 'llmTest');
    return firstUrl;
  }
  
  // プロトコルが欠けている場合、ポート番号から推測して追加
  // 例: ":8082" または "localhost:8082" → "https://localhost:8082"
  if (firstUrl) {
    // ポート番号が含まれているかチェック
    const portMatch = firstUrl.match(/:(\d+)/);
    if (portMatch) {
      const port = parseInt(portMatch[1], 10);
      // ポート番号が8080以上の場合、HTTPSポート（port+1）の可能性がある
      // または、ポート番号が8081以上の場合、HTTPSポートの可能性が高い
      if (port >= 8080) {
        // ホスト名を抽出（ポート番号の前の部分）
        // ":8082" の場合はホスト名が空なので、localhostを使用
        let host = 'localhost';
        if (firstUrl.startsWith(':')) {
          // ":8082" の形式
          host = 'localhost';
        } else {
          const hostMatch = firstUrl.match(/^([^:]+):/);
          if (hostMatch && hostMatch[1]) {
            host = hostMatch[1];
          }
        }
        
        // HTTPSエンドポイントとして構築
        const httpsUrl = `https://${host}:${port}`;
        logger.debug(`エンドポイントを修正（プロトコル追加）: "${endpoint}" → "${httpsUrl}"`, 'llmTest');
        return httpsUrl;
      }
    }
    
    // ポート番号のみの場合（例: "8082"）
    if (firstUrl.match(/^\d+$/)) {
      const port = parseInt(firstUrl, 10);
      if (port >= 8080 && port <= 65535) {
        const httpsUrl = `https://localhost:${port}`;
        logger.debug(`エンドポイントを修正（プロトコルとホスト追加）: "${endpoint}" → "${httpsUrl}"`, 'llmTest');
        return httpsUrl;
      }
    }
    
    // localhostまたはIPアドレスのみの場合
    if (firstUrl.match(/^(localhost|\d+\.\d+\.\d+\.\d+)$/)) {
      // デフォルトのHTTPSポート（8081）を使用
      const httpsUrl = `https://${firstUrl}:8081`;
      logger.debug(`エンドポイントを修正（プロトコルとポート追加）: "${endpoint}" → "${httpsUrl}"`, 'llmTest');
      return httpsUrl;
    }
  }
  
  // URL形式でない場合はそのまま返す（エラーハンドリング）
  logger.warn(`エンドポイントの抽出に失敗しました。元の値をそのまま使用: "${endpoint}"`, 'llmTest');
  return endpoint;
}

/**
 * LLM APIテスト結果
 */
export interface LLMTestResult {
  success: boolean;
  responseTime: number;
  message: string;
  tokens?: number;
  error?: string;
}

/**
 * LLM APIテストオプション
 */
export interface LLMTestOptions {
  endpoint: string;
  apiKey?: string;
  modelName: string;
  message: string;
  timeout?: number;
}

/**
 * LLM APIにチャットリクエストを送信してテスト
 * 
 * @param options テストオプション
 * @returns テスト結果
 */
export async function testLLMExecution(
  options: LLMTestOptions
): Promise<LLMTestResult> {
  const { endpoint, apiKey, modelName, message, timeout = 30000 } = options;
  const startTime = Date.now();

  try {
    // エンドポイント文字列から実際のURLを抽出
    const actualEndpoint = extractEndpointUrl(endpoint);
    
    // エンドポイントが有効なURL形式か確認
    if (!actualEndpoint || (!actualEndpoint.startsWith('http://') && !actualEndpoint.startsWith('https://'))) {
      logger.error(`無効なエンドポイントURL: "${actualEndpoint}"`, 'llmTest');
      return {
        success: false,
        responseTime: 0,
        message: '',
        error: `無効なエンドポイントURL: "${actualEndpoint}"。正しいURL形式（http://またはhttps://で始まる）を指定してください。`,
      };
    }
    
    logger.info(`LLMテスト開始: ${actualEndpoint}`, 'llmTest');
    logger.info(`モデル: ${modelName}, メッセージ: ${message.substring(0, 50)}...`, 'llmTest');

    const headers: Record<string, string> = {
      [HTTP_HEADERS.CONTENT_TYPE]: HTTP_HEADERS.CONTENT_TYPE_JSON,
    };

    if (apiKey) {
      headers[HTTP_HEADERS.AUTHORIZATION] = `${HTTP_HEADERS.AUTHORIZATION_PREFIX}${apiKey}`;
    }

    // Tauri環境の場合はIPC経由でHTTPリクエストを送信（自己署名証明書の問題を回避）
    const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
    
    if (isTauri) {
      // IPC経由でHTTPリクエストを送信
      try {
        const response = await safeInvoke<{
          status: number;
          headers: Record<string, string>;
          body: string;
        }>('send_http_request', {
          options: {
            url: `${actualEndpoint}${API_ENDPOINTS.CHAT_COMPLETIONS}`,
            method: 'POST',
            headers,
            body: JSON.stringify({
              model: modelName,
              messages: [
                { role: 'user', content: message }
              ],
            }),
            timeout_secs: Math.floor(timeout / 1000),
          },
        });

        // レスポンスを処理
        if (response.status >= 200 && response.status < 300) {
          const data = JSON.parse(response.body);
          
          if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
            return {
              success: false,
              responseTime: Date.now() - startTime,
              message: '',
              error: 'APIレスポンスが無効です: choicesが存在しません',
            };
          }

          const firstChoice = data.choices[0];
          if (!firstChoice.message || !firstChoice.message.content) {
            return {
              success: false,
              responseTime: Date.now() - startTime,
              message: '',
              error: 'APIレスポンスが無効です: message.contentが存在しません',
            };
          }

          const assistantMessage = firstChoice.message.content;
          const tokens = data.usage?.total_tokens ?? undefined;
          const responseTime = Date.now() - startTime;

          logger.info(
            `LLMテスト成功: ${responseTime}ms, トークン数: ${tokens || '不明'}`,
            'llmTest'
          );

          return {
            success: true,
            responseTime,
            message: assistantMessage,
            tokens,
          };
        } else {
          // エラーレスポンス
          let errorMessage = `APIエラー: ${response.status}`;
          try {
            const errorData = JSON.parse(response.body);
            if (errorData.error?.message) {
              errorMessage = errorData.error.message;
            }
          } catch {
            // JSON解析に失敗した場合はステータスコードのみ
          }
          
          return {
            success: false,
            responseTime: Date.now() - startTime,
            message: '',
            error: errorMessage,
          };
        }
      } catch (ipcError) {
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        const errorMessage = ipcError instanceof Error ? ipcError.message : 'IPC経由のHTTPリクエストに失敗しました';
        logger.error('LLMテスト失敗（IPC経由）', ipcError instanceof Error ? ipcError : new Error(String(ipcError)), 'llmTest');
        
        return {
          success: false,
          responseTime,
          message: '',
          error: errorMessage,
        };
      }
    }

    // ブラウザ環境の場合は通常のfetchを使用
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(
        `${actualEndpoint}${API_ENDPOINTS.CHAT_COMPLETIONS}`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: modelName,
            messages: [
              { role: 'user', content: message }
            ],
          }),
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(
          `LLMテスト失敗: ${response.status} ${response.statusText}`,
          new Error(errorText),
          'llmTest'
        );
        return {
          success: false,
          responseTime,
          message: '',
          error: `APIエラー: ${response.status} ${response.statusText}`,
        };
      }

      const data = await response.json();

      // レスポンスの構造を安全にチェック
      if (!data || !Array.isArray(data.choices) || data.choices.length === 0) {
        logger.error('LLMテスト失敗: 無効なレスポンス', new Error('choicesが存在しません'), 'llmTest');
        return {
          success: false,
          responseTime,
          message: '',
          error: 'APIレスポンスが無効です: choicesが空または存在しません',
        };
      }

      const firstChoice = data.choices[0];
      if (
        !firstChoice ||
        !firstChoice.message ||
        typeof firstChoice.message.content !== 'string'
      ) {
        logger.error('LLMテスト失敗: 無効なレスポンス', new Error('message.contentが存在しません'), 'llmTest');
        return {
          success: false,
          responseTime,
          message: '',
          error: 'APIレスポンスが無効です: message.contentが存在しません',
        };
      }

      const assistantMessage = firstChoice.message.content;
      const tokens = data.usage?.total_tokens ?? undefined;

      logger.info(
        `LLMテスト成功: ${responseTime}ms, トークン数: ${tokens || '不明'}`,
        'llmTest'
      );

      return {
        success: true,
        responseTime,
        message: assistantMessage,
        tokens,
      };
    } catch (fetchError) {
      clearTimeout(timeoutId);
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        logger.error('LLMテスト失敗: タイムアウト', fetchError, 'llmTest');
        return {
          success: false,
          responseTime,
          message: '',
          error: `タイムアウト: ${timeout}ms以内に応答がありませんでした`,
        };
      }

      throw fetchError;
    }
  } catch (err) {
    const endTime = Date.now();
    const responseTime = endTime - startTime;

    const errorMessage = err instanceof Error ? err.message : 'APIへのリクエストに失敗しました';
    logger.error('LLMテスト失敗', err instanceof Error ? err : new Error(extractErrorMessage(err)), 'llmTest');

    // 接続エラーの詳細なメッセージ
    let detailedError = errorMessage;
    if (
      errorMessage.includes('ERR_CONNECTION_REFUSED') ||
      errorMessage.includes('CONNECTION_REFUSED') ||
      errorMessage.includes('Failed to fetch') ||
      (errorMessage.includes('fetch') && errorMessage.includes('refused'))
    ) {
      detailedError =
        'APIサーバーに接続できません（接続が拒否されました）。\n' +
        '以下の点を確認してください：\n' +
        '1. APIが起動しているか確認してください（API一覧画面でステータスを確認）\n' +
        '2. プロキシサーバーが正常に起動しているか確認してください\n' +
        '3. ポート番号が正しいか確認してください（HTTPSポートは通常、HTTPポート+1です）\n' +
        '4. ファイアウォールがポートをブロックしていないか確認してください';
    } else if (errorMessage.includes('fetch')) {
      detailedError = 'APIサーバーに接続できません。APIが起動しているか確認してください。';
    } else if (errorMessage.includes('CORS')) {
      detailedError = 'CORSエラーが発生しました。APIの設定を確認してください。';
    } else if (
      errorMessage.includes('CERT_AUTHORITY_INVALID') ||
      errorMessage.includes('certificate') ||
      errorMessage.includes('ERR_CERT')
    ) {
      // 自己署名証明書のエラーの場合、詳細な説明を提供
      detailedError =
        '自己署名証明書の検証エラーが発生しました。\n' +
        'これは正常な動作です（FLMは自動生成された自己署名証明書を使用します）。\n' +
        'ブラウザのセキュリティ警告を無視して接続を続行してください。\n' +
        'または、Tauriアプリケーション内でテストを実行してください（証明書検証を自動的にスキップします）。';
    }

    return {
      success: false,
      responseTime,
      message: '',
      error: detailedError,
    };
  }
}

/**
 * 複数のメッセージでLLM APIをテスト
 * 
 * @param options テストオプション
 * @param messages テストメッセージの配列
 * @returns テスト結果の配列
 */
export async function testLLMWithMultipleMessages(
  options: Omit<LLMTestOptions, 'message'>,
  messages: string[]
): Promise<LLMTestResult[]> {
  const results: LLMTestResult[] = [];

  for (const message of messages) {
    const result = await testLLMExecution({
      ...options,
      message,
    });
    results.push(result);

    // 次のリクエストまで少し待機（レート制限対策）
    if (results.length < messages.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return results;
}

/**
 * API情報を取得してLLMテストを実行
 * 
 * @param apiId API ID
 * @param message テストメッセージ
 * @returns テスト結果
 */
export async function testLLMByApiId(
  apiId: string,
  message: string
): Promise<LLMTestResult> {
  try {
    // API詳細を取得
    const apiDetails = await safeInvoke<{
      endpoint: string;
      model_name: string;
      api_key: string | null;
      status: string;
      timeout_secs?: number | null;
    }>('get_api_details', { apiId: apiId });

    if (apiDetails.status !== 'running') {
      // APIが起動していない場合、自動起動を試みる
      try {
        logger.info('APIが起動していないため、自動起動を試みます', 'llmTest');
        await safeInvoke('start_api', { apiId: apiId });
        
        // 起動を待機（最大10秒）
        let retries = 0;
        const maxRetries = 20; // 0.5秒 × 20 = 10秒
        while (retries < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 500));
          const updatedDetails = await safeInvoke<{
            status: string;
          }>('get_api_details', { apiId: apiId });
          
          if (updatedDetails.status === 'running') {
            logger.info('APIの自動起動に成功しました', 'llmTest');
            // 起動が確認できたので、API詳細を再取得
            const runningApiDetails = await safeInvoke<{
              endpoint: string;
              model_name: string;
              api_key: string | null;
              status: string;
              timeout_secs?: number | null;
            }>('get_api_details', { apiId: apiId });
            
            // 起動したAPIでテストを実行
            return await testLLMExecution({
              endpoint: runningApiDetails.endpoint,
              apiKey: runningApiDetails.api_key || undefined,
              modelName: runningApiDetails.model_name,
              message,
              timeout: runningApiDetails.timeout_secs 
                ? runningApiDetails.timeout_secs * 1000 
                : undefined,
            });
          }
          retries++;
        }
        
        // 起動に失敗した場合
        return {
          success: false,
          responseTime: 0,
          message: '',
          error: 'APIの自動起動に失敗しました。API一覧画面から手動で起動してください。',
        };
      } catch (startError) {
        logger.error('APIの自動起動中にエラーが発生しました', startError instanceof Error ? startError : new Error(String(startError)), 'llmTest');
        return {
          success: false,
          responseTime: 0,
          message: '',
          error: 'APIが起動していません。API一覧画面から手動で起動してから再度お試しください。',
        };
      }
    }

    // タイムアウト設定を取得（API個別設定またはグローバル設定）
    let timeout: number | undefined = undefined;
    if (apiDetails.timeout_secs) {
      timeout = apiDetails.timeout_secs * 1000;
    } else {
      // グローバル設定を取得
      try {
        const appSettings = await safeInvoke<{
          default_api_timeout_secs?: number | null;
        }>('get_app_settings');
        timeout = (appSettings.default_api_timeout_secs ?? 30) * 1000;
      } catch {
        timeout = 30000; // デフォルト: 30秒
      }
    }

    return await testLLMExecution({
      endpoint: apiDetails.endpoint,
      apiKey: apiDetails.api_key || undefined,
      modelName: apiDetails.model_name,
      message,
      timeout,
    });
  } catch (err) {
    logger.error('API情報の取得に失敗', err instanceof Error ? err : new Error(extractErrorMessage(err)), 'llmTest');
    return {
      success: false,
      responseTime: 0,
      message: '',
      error: err instanceof Error ? err.message : 'API情報の取得に失敗しました',
    };
  }
}

