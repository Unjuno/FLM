// FLM - HTTP Proxy Middleware
// 認証エージェント (AUTH) 実装
// express-http-proxy を使用したプロキシミドルウェア

import { Request, Response } from 'express';
import proxy from 'express-http-proxy';
import { ProxyOptions } from 'express-http-proxy/types';

interface ProxyConfig {
    transformRequest?: (req: Request) => Request;
    transformResponse?: (body: string) => string;
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
        userResHeaderDecorator: (headers: any, userReq: Request) => {
            // CORSヘッダーを追加
            headers['Access-Control-Allow-Origin'] = '*';
            headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
            headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
            return headers;
        },
        
        // リクエスト変換（設定されている場合）
        proxyReqOptDecorator: (proxyReqOpts: any, srcReq: Request) => {
            // Authorizationヘッダーを削除（Ollamaには送らない）
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
        userResDecorator: (proxyRes: Response, proxyResData: Buffer, userReq: Request, userRes: Response) => {
            const bodyString = proxyResData.toString('utf8');
            
            if (config?.transformResponse) {
                return config.transformResponse(bodyString);
            }
            
            return proxyResData;
        },
        
        // エラーハンドリング
        proxyErrorHandler: (err: Error, res: Response) => {
            console.error('プロキシエラー:', err);
            
            if (!res.headersSent) {
                res.status(502).json({
                    error: {
                        message: 'Ollamaサーバーへの接続に失敗しました。Ollamaが起動していることを確認してください。',
                        type: 'proxy_error',
                        code: 'ollama_connection_failed'
                    }
                });
            }
        },
        
        // タイムアウト設定（30秒）
        timeout: 30000,
        
        // リクエストログ（開発時のみ）
        ...(process.env.NODE_ENV === 'development' && {
            proxyReqPathResolver: (req: Request) => {
                console.log(`[PROXY] ${req.method} ${req.path} -> ${targetUrl}`);
                return req.path;
            }
        })
    } as ProxyOptions);
}

