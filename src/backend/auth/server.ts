// FLM - Authentication Proxy Server
// 認証エージェント (AUTH) 実装
// Express.jsベースの認証プロキシサーバー

import express, { Request, Response, NextFunction } from 'express';
import proxy from 'express-http-proxy';
import cors from 'cors';
import { generateApiKey, validateApiKey } from './keygen.js';
import { createProxyMiddleware } from './proxy.js';
import { saveRequestLog, savePerformanceMetric } from './database.js';

const app = express();
// Node.js環境でのみ実行されるため、型定義を確認
declare const process: { 
    env: { [key: string]: string | undefined }, 
    on?: (event: string, callback: () => void) => void, 
    exit?: (code: number) => void,
    cpuUsage?: () => { user: number; system: number },
    memoryUsage?: () => { heapUsed: number; heapTotal: number; external: number; rss: number }
};
const PORT = (typeof process !== 'undefined' && process.env ? process.env.PORT : undefined) || 8080;
const OLLAMA_URL = (typeof process !== 'undefined' && process.env ? process.env.OLLAMA_URL : undefined) || 'http://localhost:11434';

// CORS設定
app.use(cors());

// セキュリティヘッダーの設定
app.use((req: Request, res: Response, next: NextFunction) => {
    // MIMEタイプスニッフィングの防止
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // クリックジャッキング攻撃の防止
    res.setHeader('X-Frame-Options', 'DENY');
    // XSS攻撃の防止（古いブラウザ対応）
    res.setHeader('X-XSS-Protection', '1; mode=block');
    // リファラーポリシー
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
});

// JSONパーサー（リクエストサイズ制限）
app.use(express.json({ limit: '10mb' }));

// リクエストログ記録ミドルウェア（F006の基盤）
// リクエストログをデータベースに保存します
const requestLogMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const apiId = process.env.API_ID || ''; // 環境変数からAPI IDを取得
    const method = req.method;
    const path = req.path;
    
    // リクエストボディを取得（大きすぎる場合はnull）
    let requestBody: string | null = null;
    if (req.body && Object.keys(req.body).length > 0) {
        try {
            const bodyStr = JSON.stringify(req.body);
            // 10KB以下の場合のみ保存（大きいリクエストは省略）
            if (bodyStr.length <= 10240) {
                requestBody = bodyStr;
            }
        } catch (e) {
            // JSON変換エラーは無視
        }
    }
    
    // レスポンスの終了を監視
    const originalSend = res.send;
    res.send = function (body?: any) {
        const responseTime = Date.now() - startTime;
        const status = res.statusCode;
        const errorMessage = status >= 400 ? `HTTP ${status}` : null;
        
        // ログ情報をコンソールに出力（開発用）
        if (apiId) {
            console.log(`[LOG] ${method} ${path} - ${status} - ${responseTime}ms - API: ${apiId}`);
        }
        
        // リクエストログをデータベースに保存（非同期、エラーは無視してリクエスト処理は続行）
        if (apiId) {
            // データベース保存は非同期で実行（レスポンス送信をブロックしない）
            saveRequestLog({
                apiId,
                method,
                path,
                requestBody,
                responseStatus: status,
                responseTimeMs: responseTime,
                errorMessage
            }).catch((err) => {
                // エラーログのみ出力（リクエスト処理には影響しない）
                console.error('[REQUEST_LOG] ログ保存エラー（非致命的）:', err);
            });
            
            // パフォーマンスメトリクス収集（BE-007-04）
            // 非同期で実行（レスポンス送信をブロックしない）
            collectPerformanceMetrics(apiId, responseTime, status).catch((err) => {
                // エラーログのみ出力（リクエスト処理には影響しない）
                console.error('[PERFORMANCE_METRIC] メトリクス収集エラー（非致命的）:', err);
            });
        }
        
        return originalSend.call(this, body);
    };
    
    next();
};

/**
 * パフォーマンスメトリクス収集用の一時保存領域（メモリ内、1分間隔で集計）
 * AUTH-007-01で実装
 */
interface MetricBuffer {
    apiId: string;
    metricType: string;
    values: number[];
    timestamp: number;
}

// メトリクスバッファ（API ID + メトリクスタイプごとに保存）
const metricBuffers: Map<string, MetricBuffer> = new Map();

// メトリクスバッファのキーを生成
function getMetricBufferKey(apiId: string, metricType: string): string {
    return `${apiId}:${metricType}`;
}

/**
 * パフォーマンスメトリクス収集関数（AUTH-007-01）
 * リクエストごとのパフォーマンスメトリクスを収集してメモリ内に一時保存します
 * 1分間隔でバッチ送信されます
 */
async function collectPerformanceMetrics(
    apiId: string,
    responseTime: number,
    statusCode: number
): Promise<void> {
    try {
        const now = Date.now();
        
        // CPU使用率を取得（Node.jsプロセス）
        const cpuUsage = process.cpuUsage?.() || { user: 0, system: 0 };
        const cpuUsagePercent = (cpuUsage.user + cpuUsage.system) / 1000.0; // マイクロ秒をミリ秒に変換
        
        // メモリ使用量を取得
        const memoryUsage = process.memoryUsage?.() || { heapUsed: 0, heapTotal: 0, external: 0, rss: 0 };
        const memoryUsageMB = memoryUsage.heapUsed / (1024 * 1024);
        
        // メトリクスをバッファに追加（個別に保存せず、メモリ内に蓄積）
        const metrics = [
            { type: 'avg_response_time', value: responseTime },
            { type: 'request_count', value: 1 },
            { type: 'error_rate', value: statusCode >= 400 ? 1 : 0 },
            { type: 'cpu_usage', value: cpuUsagePercent },
            { type: 'memory_usage', value: memoryUsageMB },
        ];
        
        for (const metric of metrics) {
            const key = getMetricBufferKey(apiId, metric.type);
            const buffer = metricBuffers.get(key);
            
            if (buffer) {
                // 既存のバッファに値を追加
                buffer.values.push(metric.value);
            } else {
                // 新しいバッファを作成
                metricBuffers.set(key, {
                    apiId,
                    metricType: metric.type,
                    values: [metric.value],
                    timestamp: now,
                });
            }
        }
    } catch (err) {
        // エラーはコンソールに出力するが、リクエスト処理には影響しない
        console.error('[PERFORMANCE_METRIC] メトリクス収集エラー:', err);
    }
}

/**
 * メトリクスバッファを集計してデータベースに保存（1分間隔で実行）
 * AUTH-007-01で実装
 */
async function flushMetricsBuffer(): Promise<void> {
    const now = Date.now();
    const flushInterval = 60000; // 1分 = 60000ミリ秒
    
    // 1分以上経過したメトリクスバッファを処理
    const buffersToFlush: MetricBuffer[] = [];
    
    for (const [key, buffer] of metricBuffers.entries()) {
        // バッファが1分以上経過しているか、または値が一定数以上蓄積された場合
        if (now - buffer.timestamp >= flushInterval || buffer.values.length >= 100) {
            buffersToFlush.push(buffer);
            metricBuffers.delete(key);
        }
    }
    
    // バッファを集計してデータベースに保存
    for (const buffer of buffersToFlush) {
        try {
            let aggregatedValue: number;
            
            // メトリクスタイプに応じて集計方法を変更
            switch (buffer.metricType) {
                case 'avg_response_time':
                    // 平均レスポンス時間（平均値）
                    aggregatedValue = buffer.values.reduce((sum, val) => sum + val, 0) / buffer.values.length;
                    break;
                case 'request_count':
                    // リクエスト数（合計）
                    aggregatedValue = buffer.values.reduce((sum, val) => sum + val, 0);
                    break;
                case 'error_rate':
                    // エラー率（平均値を100倍してパーセンテージに）
                    aggregatedValue = (buffer.values.reduce((sum, val) => sum + val, 0) / buffer.values.length) * 100.0;
                    break;
                case 'cpu_usage':
                    // CPU使用率（平均値）
                    aggregatedValue = buffer.values.reduce((sum, val) => sum + val, 0) / buffer.values.length;
                    break;
                case 'memory_usage':
                    // メモリ使用量（平均値）
                    aggregatedValue = buffer.values.reduce((sum, val) => sum + val, 0) / buffer.values.length;
                    break;
                default:
                    // デフォルトは平均値
                    aggregatedValue = buffer.values.reduce((sum, val) => sum + val, 0) / buffer.values.length;
            }
            
            // データベースに保存（非同期、エラーは無視）
            await savePerformanceMetric({
                apiId: buffer.apiId,
                metricType: buffer.metricType,
                value: aggregatedValue,
            }).catch((err) => {
                console.error(`[PERFORMANCE_METRIC] メトリクス保存エラー: ${buffer.metricType}:`, err);
            });
        } catch (err) {
            console.error(`[PERFORMANCE_METRIC] メトリクス集計エラー: ${buffer.metricType}:`, err);
        }
    }
}

// 1分間隔でメトリクスバッファをフラッシュ（AUTH-007-01で実装）
setInterval(() => {
    flushMetricsBuffer().catch((err) => {
        console.error('[PERFORMANCE_METRIC] メトリクスバッファフラッシュエラー:', err);
    });
}, 60000); // 1分 = 60000ミリ秒

// リクエストログミドルウェアを適用（認証が必要なエンドポイントのみ）
// ヘルスチェックは除外

// 認証ミドルウェア
const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            error: {
                message: '認証が必要です。APIキーを指定してください。',
                type: 'authentication_error',
                code: 'missing_api_key'
            }
        });
    }
    
    const apiKey = authHeader.replace('Bearer ', '');
    
    // APIキーの検証（データベースから取得して検証）
    // 実装は後でデータベースエージェントと統合時に完成
    const isValid = await validateApiKey(apiKey);
    
    if (!isValid) {
        return res.status(401).json({
            error: {
                message: '無効なAPIキーです。',
                type: 'authentication_error',
                code: 'invalid_api_key'
            }
        });
    }
    
    next();
};

// ヘルスチェックエンドポイント（認証不要、ログ記録なし）
app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'flm-auth-proxy' });
});

// OpenAI互換APIエンドポイント（認証付き、ログ記録あり）
// POST /v1/chat/completions → Ollama /api/chat
app.post('/v1/chat/completions', requestLogMiddleware, authMiddleware, createProxyMiddleware(`${OLLAMA_URL}/api/chat`));

// GET /v1/models → Ollama /api/tags
app.get('/v1/models', requestLogMiddleware, authMiddleware, createProxyMiddleware(`${OLLAMA_URL}/api/tags`, {
    transformRequest: (req: Request) => {
        // Ollamaの /api/tags 形式に変換
        return req;
    },
    transformResponse: (body: string) => {
        // OpenAI形式に変換
        try {
            const tags = JSON.parse(body);
            const models = Array.isArray(tags.models) ? tags.models : [];
            return JSON.stringify({
                object: 'list',
                data: models.map((model: any) => ({
                    id: model.name || model.model || 'local-llm',
                    object: 'model',
                    created: Date.now(),
                    owned_by: 'local'
                }))
            });
        } catch (e) {
            return body;
        }
    }
}));

// Ollama API プロキシ（認証付き、ログ記録あり）
app.post('/api/pull', requestLogMiddleware, authMiddleware, createProxyMiddleware(`${OLLAMA_URL}/api/pull`));
app.post('/api/delete', requestLogMiddleware, authMiddleware, createProxyMiddleware(`${OLLAMA_URL}/api/delete`));
app.get('/api/tags', requestLogMiddleware, authMiddleware, createProxyMiddleware(`${OLLAMA_URL}/api/tags`));

// エラーハンドリング
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('エラーが発生しました:', err);
    res.status(500).json({
        error: {
            message: 'サーバー内部エラーが発生しました。',
            type: 'internal_error',
            code: 'server_error'
        }
    });
});

// サーバー起動
app.listen(PORT, () => {
    console.log(`認証プロキシサーバーが起動しました: http://localhost:${PORT}`);
});


// グレースフルシャットダウン
// Node.js環境でのみ実行されるため、型定義を確認
if (typeof process !== 'undefined' && process.on) {
    process.on('SIGTERM', () => {
        console.log('SIGTERMシグナルを受信しました。サーバーを終了します...');
        if (process.exit) {
            process.exit(0);
        }
    });
}

export { app };

