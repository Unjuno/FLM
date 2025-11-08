// llmTest - LLM実行テストユーティリティ

import { safeInvoke } from './tauri';
import { logger } from './logger';
import { API_ENDPOINTS, HTTP_HEADERS } from '../constants/config';

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
    logger.info(`LLMテスト開始: ${endpoint}`, 'llmTest');
    logger.info(`モデル: ${modelName}, メッセージ: ${message.substring(0, 50)}...`, 'llmTest');

    const headers: Record<string, string> = {
      [HTTP_HEADERS.CONTENT_TYPE]: HTTP_HEADERS.CONTENT_TYPE_JSON,
    };

    if (apiKey) {
      headers[HTTP_HEADERS.AUTHORIZATION] = `${HTTP_HEADERS.AUTHORIZATION_PREFIX}${apiKey}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(
        `${endpoint}${API_ENDPOINTS.CHAT_COMPLETIONS}`,
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
    logger.error('LLMテスト失敗', err instanceof Error ? err : new Error(String(err)), 'llmTest');

    // 接続エラーの詳細なメッセージ
    let detailedError = errorMessage;
    if (errorMessage.includes('fetch')) {
      detailedError = 'APIサーバーに接続できません。APIが起動しているか確認してください。';
    } else if (errorMessage.includes('CORS')) {
      detailedError = 'CORSエラーが発生しました。APIの設定を確認してください。';
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
    }>('get_api_details', { api_id: apiId });

    if (apiDetails.status !== 'running') {
      return {
        success: false,
        responseTime: 0,
        message: '',
        error: 'APIが起動していません。APIを起動してから再度お試しください。',
      };
    }

    return await testLLMExecution({
      endpoint: apiDetails.endpoint,
      apiKey: apiDetails.api_key || undefined,
      modelName: apiDetails.model_name,
      message,
    });
  } catch (err) {
    logger.error('API情報の取得に失敗', err instanceof Error ? err : new Error(String(err)), 'llmTest');
    return {
      success: false,
      responseTime: 0,
      message: '',
      error: err instanceof Error ? err.message : 'API情報の取得に失敗しました',
    };
  }
}

