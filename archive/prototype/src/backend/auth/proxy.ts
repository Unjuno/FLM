// proxy - express-http-proxyを使用したプロキシミドルウェア

import { Request, Response } from 'express';
import { IncomingMessage } from 'http';
import { RequestOptions } from 'http';
import proxy from 'express-http-proxy';
import { evaluateCorsOrigin } from './cors-utils.js';

interface ProxyConfig {
  transformRequest?: (req: Request) => Request;
  transformResponse?: (body: string) => string;
}

// ヘッダーの型定義（express-http-proxyの型定義と互換性を持つ）
type OutgoingHttpHeaders = Record<
  string,
  string | number | string[] | undefined
>;

// プロキシリクエストオプションの型定義
interface ProxyRequestOptions extends RequestOptions {
  headers?: OutgoingHttpHeaders;
  body?: string;
}

/**
 * プロキシミドルウェアを作成
 * @param targetUrl プロキシ先のURL
 * @param config 追加設定
 * @returns Expressミドルウェア
 */
export function createProxyMiddleware(targetUrl: string, config?: ProxyConfig) {
  return proxy(targetUrl, {
    // リクエストボディを転送
    parseReqBody: true,

    // リクエストヘッダーを転送（Authorizationヘッダーは除外）
    userResHeaderDecorator: (
      headers: OutgoingHttpHeaders,
      userReq: Request
    ): OutgoingHttpHeaders => {
      const originHeader = userReq.headers.origin;
      const decision = evaluateCorsOrigin(originHeader);
      if (decision.allowed) {
        if (decision.value) {
          headers['Access-Control-Allow-Origin'] = decision.value;
          headers['Access-Control-Allow-Credentials'] = 'true';
        } else if (originHeader) {
          headers['Access-Control-Allow-Origin'] = originHeader;
          headers['Access-Control-Allow-Credentials'] = 'true';
        }
        headers['Access-Control-Allow-Methods'] =
          'GET, POST, PUT, DELETE, OPTIONS';
        headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
      }

      return headers;
    },

    // リクエスト変換（設定されている場合）
    proxyReqOptDecorator: (
      proxyReqOpts: ProxyRequestOptions,
      srcReq: Request
    ): ProxyRequestOptions => {
      // Authorizationヘッダーを削除（LLMエンジンには認証情報を送らない）
      // 認証はプロキシサーバーで処理されるため、バックエンドエンジンには送信しない
      if (proxyReqOpts.headers) {
        delete proxyReqOpts.headers['authorization'];
        delete proxyReqOpts.headers['Authorization'];
      }

      // カスタム変換がある場合は適用
      if (config?.transformRequest) {
        const transformedReq = config.transformRequest(srcReq);
        // 変換されたリクエストの情報をプロキシリクエストに反映
        if (transformedReq.body) {
          proxyReqOpts.body = JSON.stringify(transformedReq.body);
        }
      }

      return proxyReqOpts;
    },

    // レスポンス変換（設定されている場合）
    userResDecorator: (
      proxyRes: IncomingMessage,
      proxyResData: Buffer,
      userReq: Request,
      userRes: Response
    ): string | Buffer => {
      const bodyString = proxyResData.toString('utf8');

      if (config?.transformResponse) {
        return config.transformResponse(bodyString);
      }

      return proxyResData;
    },

    // エラーハンドリング（プロキシが停止しないように改善）
    proxyErrorHandler: (err: Error, res: Response) => {
      // バックエンド環境ではconsoleを使用（loggerはフロントエンド専用）
      console.error('[PROXY ERROR] プロキシエラーが発生しました:', err.message);
      if (err.stack && process.env.NODE_ENV === 'development') {
        console.error('[PROXY ERROR] スタックトレース:', err.stack);
      }

      // レスポンスが既に送信されている場合は何もしない
      if (res.headersSent) {
        console.warn(
          '[PROXY ERROR] レスポンスは既に送信されています。エラーレスポンスを送信できません。'
        );
        return;
      }

      try {
        // エラーメッセージは呼び出し側で設定されるため、ここでは汎用的なメッセージを使用
        res.status(502).json({
          error: {
            message:
              'LLMエンジンサーバーへの接続に失敗しました。エンジンが起動していることを確認してください。',
            type: 'proxy_error',
            code: 'engine_connection_failed',
          },
        });
      } catch (responseError) {
        // レスポンス送信に失敗した場合でも、プロセスを終了させない
        console.error(
          '[PROXY ERROR] エラーレスポンスの送信に失敗しました:',
          responseError
        );
      }
    },

    // タイムアウト設定（30秒）
    timeout: 30000,

    // リクエストログ（開発時のみ）
    ...(process.env.NODE_ENV === 'development' && {
      proxyReqPathResolver: (req: Request): string => {
        console.log(`[PROXY] ${req.method} ${req.path} -> ${targetUrl}`);
        return req.path;
      },
    }),
  });
}
