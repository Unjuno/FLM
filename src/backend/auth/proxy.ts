// proxy - express-http-proxyを使用したプロキシミドルウェア

import { Request, Response } from 'express';
import { IncomingMessage } from 'http';
import proxy from 'express-http-proxy';

interface ProxyConfig {
  transformRequest?: (req: Request) => Request;
  transformResponse?: (body: string) => string;
}

// ヘッダーの型定義（express-http-proxyの型定義と互換性を持つ）
type OutgoingHttpHeaders = Record<
  string,
  string | number | string[] | undefined
>;

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
      // CORSヘッダーを追加（環境変数で制御）
      const getAllowedOrigin = (): string => {
        const allowedOriginsEnv = process.env.ALLOWED_ORIGINS;
        const requestOrigin = userReq.headers.origin;
        
        if (allowedOriginsEnv) {
          // 環境変数で指定されたオリジンのリストから一致するものを返す
          const allowedOrigins = allowedOriginsEnv
            .split(',')
            .map(origin => origin.trim());
          
          if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
            return requestOrigin;
          }
          
          // 一致しない場合は空文字列（CORSエラー）
          return '';
        }
        
        // 環境変数が未設定の場合
        if (process.env.NODE_ENV === 'development') {
          // 開発環境ではリクエストのオリジンをそのまま返す
          // 注意: credentials: trueとワイルドカード（'*'）は併用できないため、
          // requestOriginがない場合は空文字列を返す（CORSエラー）
          return requestOrigin || '';
        }
        
        // 本番環境では空文字列（CORSエラー）- 明示的に設定することを推奨
        return '';
      };
      
      const allowedOrigin = getAllowedOrigin();
      if (allowedOrigin) {
        headers['Access-Control-Allow-Origin'] = allowedOrigin;
        headers['Access-Control-Allow-Methods'] =
          'GET, POST, PUT, DELETE, OPTIONS';
        headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
        // credentials: trueは、ワイルドカード（'*'）でない場合のみ設定可能
        // allowedOriginが空文字列でない場合のみ設定
        if (allowedOrigin !== '*') {
          headers['Access-Control-Allow-Credentials'] = 'true';
        }
      }
      
      return headers;
    },

    // リクエスト変換（設定されている場合）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    proxyReqOptDecorator: (proxyReqOpts: any, srcReq: Request) => {
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

    // エラーハンドリング
    proxyErrorHandler: (err: Error, res: Response) => {
      // バックエンド環境ではconsoleを使用（loggerはフロントエンド専用）
      if (process.env.NODE_ENV === 'development') {
        console.error('[PROXY ERROR]', err);
      }

      if (!res.headersSent) {
        // エラーメッセージは呼び出し側で設定されるため、ここでは汎用的なメッセージを使用
        res.status(502).json({
          error: {
            message:
              'LLMエンジンサーバーへの接続に失敗しました。エンジンが起動していることを確認してください。',
            type: 'proxy_error',
            code: 'engine_connection_failed',
          },
        });
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
