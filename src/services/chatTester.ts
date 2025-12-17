// Chat Tester services

import { safeInvoke } from '../utils/tauri';
import { logger } from '../utils/logger';

// API endpoint paths
const API_ENDPOINTS = {
  MODELS: '/v1/models',
  CHAT_COMPLETIONS: '/v1/chat/completions',
} as const;

// FLM model ID prefix
const FLM_PREFIX = 'flm-';

/**
 * Validate and safely join URL with path
 * why: 外部由来のURLを安全に結合するため、URLインジェクションを防ぐ
 * alt: URLクラスを直接使用（より厳密だが、相対パスを許可しない）
 * evidence: セキュリティベストプラクティス
 */
function validateAndJoinUrl(base: string, path: string): string {
  try {
    const baseUrl = new URL(base);

    // why: pathが絶対URLか相対パスかを判定し、適切に処理するため
    // alt: 常に相対パスを要求（柔軟性が失われる）
    // evidence: セキュリティと柔軟性のバランス

    let pathUrl: URL;
    // why: 大文字小文字を区別せずに絶対URLを判定するため
    // alt: 小文字のみをチェック（大文字のURLが検出されない）
    // evidence: URLは大文字小文字を区別しないが、セキュリティのため明示的にチェック
    const pathLower = path.toLowerCase();
    const isAbsoluteUrl =
      pathLower.startsWith('http://') || pathLower.startsWith('https://');

    // why: プロトコル相対URL（//evil.com）を防ぐため
    // alt: プロトコル相対URLを許可（セキュリティリスク）
    // evidence: プロトコル相対URLはbaseのプロトコルを使用するため、セキュリティ上の問題
    if (path.startsWith('//')) {
      throw new Error('Invalid URL: protocol-relative URLs are not allowed');
    }

    if (isAbsoluteUrl) {
      // 絶対URLの場合
      pathUrl = new URL(path);
      // 同一オリジンのみ許可
      if (pathUrl.origin !== baseUrl.origin) {
        throw new Error('Invalid URL: origin mismatch');
      }
    } else {
      // 相対パスの場合、baseを基準に解決
      pathUrl = new URL(path, base);
      // 解決後のオリジンがbaseと同じであることを確認
      if (pathUrl.origin !== baseUrl.origin) {
        throw new Error('Invalid URL: origin mismatch');
      }
    }

    // プロトコルチェック（http/httpsのみ許可）
    if (pathUrl.protocol !== 'http:' && pathUrl.protocol !== 'https:') {
      throw new Error('Invalid URL: only http and https protocols are allowed');
    }

    return pathUrl.toString();
  } catch (err) {
    // why: URL解析エラーを統一的なエラーメッセージに変換するため
    // alt: 元のエラーを再スロー（呼び出し側で処理が複雑化）
    // evidence: 呼び出し側でURL検証エラーを統一して処理できる
    if (process.env.NODE_ENV === 'development' && err instanceof Error) {
      logger.warn('URL validation error:', err.message);
    }
    throw new Error(`Invalid proxy endpoint URL: ${base}`);
  }
}

/**
 * Determine protocol from mode
 * why: modeの形式が複数あるため、統一的な判定が必要
 * alt: バックエンドからprotocolを直接返す（非互換変更が必要）
 * evidence: 複数のフォールバックパスが存在
 */
function determineProtocol(
  mode: string | { [key: string]: unknown } | undefined
): 'https' | 'http' {
  if (!mode) {
    return 'http';
  }

  if (typeof mode === 'string') {
    const modeLower = mode.toLowerCase();
    // dev-self-signedとpackaged-caはhttpsを使用
    if (
      modeLower.includes('https') ||
      modeLower.includes('dev-self-signed') ||
      modeLower.includes('packaged-ca')
    ) {
      return 'https';
    }
    return 'http';
  }

  if (typeof mode === 'object') {
    // オブジェクト形式の場合、キー名で判定
    const modeKeys = Object.keys(mode);
    const httpsModes = new Set(['HttpsAcme', 'DevSelfSigned', 'PackagedCa']);
    return modeKeys.some(key => httpsModes.has(key)) ? 'https' : 'http';
  }

  return 'http';
}

/**
 * Type guard for ChatCompletionResponse
 * why: 実行時型チェックで安全性を向上させるため
 * alt: 型アサーションのみ使用（実行時エラーのリスク）
 * evidence: TypeScriptのベストプラクティス
 */
function isChatCompletionResponse(
  data: unknown
): data is ChatCompletionResponse {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const obj = data as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    typeof obj.object === 'string' &&
    typeof obj.created === 'number' &&
    typeof obj.model === 'string' &&
    Array.isArray(obj.choices)
  );
}

/**
 * Normalize proxy status result from various formats
 * why: バックエンドのレスポンス形式が複数あるため、正規化が必要
 * alt: バックエンドを統一する（非互換変更が必要）
 * evidence: 複数のフォールバックパスが存在
 */
function normalizeProxyStatusResult(result: unknown): {
  running: boolean;
  port?: number;
  mode?: string | { [key: string]: unknown };
  endpoints?: { localhost?: string };
} | null {
  if (!result || typeof result !== 'object') {
    return null;
  }

  // 形式1: { data: [{ running, port, mode, endpoints }] }
  if (
    'data' in result &&
    Array.isArray(result.data) &&
    result.data.length > 0
  ) {
    return result.data[0];
  }

  // 形式2: { running, port, mode, endpoints }
  if ('running' in result) {
    return result as {
      running: boolean;
      port?: number;
      mode?: string | { [key: string]: unknown };
      endpoints?: { localhost?: string };
    };
  }

  return null;
}

// Model from /v1/models endpoint
export interface ChatModel {
  id: string; // OpenAI-compatible ID
  flmUri: string; // flm://engine/model format
  displayName: string;
}

// Chat completion request
export interface ChatCompletionRequest {
  model: string; // OpenAI-compatible ID
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
}

// Chat completion response
export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  request_id?: string; // Custom header from proxy
}

/**
 * Convert model data to ChatModel
 * why: モデル変換ロジックを分離してCognitive Complexityを削減
 * alt: インライン処理（複雑度が高くなる）
 * evidence: コードレビュー指摘
 */
function convertToChatModel(model: { id?: string }): ChatModel | null {
  const id = model.id || '';
  if (!id) {
    return null;
  }

  let flmUri = '';
  let displayName = id;

  if (id.startsWith(FLM_PREFIX)) {
    const parts = id.replace(FLM_PREFIX, '').split('-');
    if (parts.length >= 2) {
      flmUri = `flm://${parts[0]}/${parts.slice(1).join('-')}`;
      displayName = flmUri;
    } else {
      flmUri = id;
    }
  } else {
    flmUri = id;
  }

  return {
    id,
    flmUri,
    displayName,
  };
}

/**
 * Parse models from API response
 * why: データ処理ロジックを分離してCognitive Complexityを削減
 * alt: インライン処理（複雑度が高くなる）
 * evidence: コードレビュー指摘
 */
function parseModelsFromResponse(data: unknown): ChatModel[] {
  if (!data || typeof data !== 'object' || !('data' in data)) {
    return [];
  }

  const responseData = data as { data?: unknown };
  if (!Array.isArray(responseData.data)) {
    return [];
  }

  return responseData.data
    .map(model => convertToChatModel(model))
    .filter((model): model is ChatModel => model !== null);
}

// Fetch available models from proxy /v1/models endpoint
export async function fetchChatModels(
  proxyEndpoint: string
): Promise<ChatModel[]> {
  try {
    const response = await fetch(
      validateAndJoinUrl(proxyEndpoint, API_ENDPOINTS.MODELS),
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch models: HTTP ${response.status}`);
    }

    const data = await response.json();
    return parseModelsFromResponse(data);
  } catch (err) {
    throw new Error(
      err instanceof Error ? err.message : 'モデルリストの取得に失敗しました'
    );
  }
}

/**
 * Build request headers with optional API key
 * why: ヘッダー構築ロジックを分離してCognitive Complexityを削減
 * alt: インライン処理（複雑度が高くなる）
 * evidence: コードレビュー指摘
 */
function buildRequestHeaders(apiKey: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  return headers;
}

/**
 * Extract error message from failed response
 * why: エラーメッセージ抽出ロジックを分離してCognitive Complexityを削減
 * alt: インライン処理（複雑度が高くなる）
 * evidence: コードレビュー指摘
 */
async function extractErrorMessage(response: Response): Promise<string> {
  let errorMessage = `Chat completion failed: HTTP ${response.status}`;

  try {
    const errorBody = await response.text();
    // why: エラーレスポンスに機密情報が含まれる可能性があるため、開発環境のみ詳細を表示
    // alt: エラーボディを完全に非表示（デバッグが困難）
    // evidence: セキュリティベストプラクティス

    if (process.env.NODE_ENV === 'development' && errorBody) {
      // 開発環境では詳細を表示（最大500文字に制限）
      const truncatedBody =
        errorBody.length > 500
          ? errorBody.substring(0, 500) + '...'
          : errorBody;
      errorMessage += `\n詳細: ${truncatedBody}`;
    }
  } catch (parseError) {
    // why: エラーボディの読み取りに失敗した場合は無視（既にHTTPステータスコードでエラーを通知済み）
    // alt: エラーを再スロー（呼び出し側の処理が複雑化）
    // evidence: HTTPステータスコードとエラーメッセージで十分な情報を提供
    if (process.env.NODE_ENV === 'development' && parseError instanceof Error) {
      logger.warn('Failed to read error response body:', parseError.message);
    }
  }

  return errorMessage;
}

/**
 * Extract and attach request_id to response data
 * why: request_id抽出ロジックを分離してCognitive Complexityを削減
 * alt: インライン処理（複雑度が高くなる）
 * evidence: コードレビュー指摘
 */
function attachRequestId(
  data: ChatCompletionResponse,
  response: Response
): ChatCompletionResponse {
  // why: request_idを追加した新しいオブジェクトを返す（不変性を保つ）
  // alt: 元のオブジェクトを変更（副作用が発生）
  // evidence: 関数型プログラミングのベストプラクティス

  const requestId =
    response.headers.get('x-request-id') ||
    response.headers.get('X-Request-Id');

  if (requestId) {
    return {
      ...data,
      request_id: requestId,
    };
  }

  return data;
}

// Send chat completion request
export async function sendChatCompletion(
  proxyEndpoint: string,
  apiKey: string | null,
  request: ChatCompletionRequest
): Promise<ChatCompletionResponse> {
  try {
    const headers = buildRequestHeaders(apiKey);
    const response = await fetch(
      validateAndJoinUrl(proxyEndpoint, API_ENDPOINTS.CHAT_COMPLETIONS),
      {
        method: 'POST',
        headers,
        body: JSON.stringify(request),
      }
    );

    if (!response.ok) {
      const errorMessage = await extractErrorMessage(response);
      throw new Error(errorMessage);
    }

    const data = await response.json();
    if (!isChatCompletionResponse(data)) {
      throw new Error('Invalid response format from chat completion endpoint');
    }

    return attachRequestId(data, response);
  } catch (err) {
    throw new Error(
      err instanceof Error
        ? err.message
        : 'チャットリクエストの送信に失敗しました'
    );
  }
}

// Get proxy endpoint URL
export async function getProxyEndpoint(): Promise<string | null> {
  try {
    const result = await safeInvoke<{
      version?: string;
      data?: Array<{
        running: boolean;
        port?: number;
        mode?: string | { [key: string]: unknown };
        endpoints?: {
          localhost?: string;
        };
      }>;
    }>('ipc_proxy_status');

    const proxyStatus = normalizeProxyStatusResult(result);

    if (!proxyStatus?.running) {
      return null;
    }

    // Prefer localhost endpoint for testing
    if (proxyStatus.endpoints?.localhost) {
      return proxyStatus.endpoints.localhost;
    }

    // Fallback to constructing URL from port
    if (proxyStatus.port) {
      const protocol = determineProtocol(proxyStatus.mode);
      return `${protocol}://localhost:${proxyStatus.port}`;
    }

    return null;
  } catch (err) {
    // why: プロキシエンドポイント取得失敗時はnullを返し、呼び出し側で処理
    // alt: エラーを再スロー（呼び出し側のエラーハンドリングが複雑化）
    // evidence: 既存の使用パターンに合わせる
    if (process.env.NODE_ENV === 'development') {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      logger.warn(`Failed to get proxy endpoint: ${errorMessage}`);
    }
    return null;
  }
}
