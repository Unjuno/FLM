// server - Express.jsベースの認証プロキシサーバー

import express, { Request, Response, NextFunction } from 'express';
import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
import cors from 'cors';
import { generateApiKey, validateApiKey } from './keygen.js';
import { createProxyMiddleware } from './proxy.js';
import { saveRequestLog, savePerformanceMetric, getAlertSettings, saveAlertHistory, getApiInfo } from './database.js';
import { ensureCertificateExists } from './certificate-generator.js';
import { FORMATTING } from '../../constants/config.js';

const app = express();

/**
 * ポート番号の範囲定数
 */
const PORT_MIN = 1024;
const PORT_MAX = 65535;
const PORT_DEFAULT = 8080;

/**
 * バックエンドサーバー設定
 */
const SERVER_CONFIG = {
    METRICS_FLUSH_INTERVAL: 60000, // 1分（メトリクスバッファのフラッシュ間隔）
    GRACEFUL_SHUTDOWN_TIMEOUT: 10000, // 10秒（グレースフルシャットダウンのタイムアウト）
    MAX_REQUEST_BODY_SIZE: 10240, // 10KB（リクエストボディの最大保存サイズ）
    METRICS_BUFFER_MAX_SIZE: 100, // メトリクスバッファの最大値数
} as const;

/**
 * 環境変数の検証とデフォルト値の設定
 */
function getValidatedPort(): number {
    const portStr = process.env.PORT || String(PORT_DEFAULT);
    const port = parseInt(portStr, 10);
    
    // ポート番号の妥当性チェック
    if (isNaN(port) || port < PORT_MIN || port > PORT_MAX) {
        if (process.env.NODE_ENV === 'development') {
            console.warn(`無効なポート番号: ${portStr}。デフォルト値${PORT_DEFAULT}を使用します。`);
        }
        return PORT_DEFAULT;
    }
    
    return port;
}

const PORT = getValidatedPort();

// エンジンベースURLを取得（ENGINE_BASE_URLを優先、なければOLLAMA_URL、デフォルト: Ollama）
const ENGINE_BASE_URL = process.env.ENGINE_BASE_URL || process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_URL = ENGINE_BASE_URL; // 後方互換性のため保持
const API_ID = process.env.API_ID || '';
const ENGINE_TYPE = process.env.ENGINE_TYPE || 'ollama'; // エンジンタイプ（デフォルト: ollama）

/**
 * エンジンタイプに応じたエンドポイントパスを取得
 * @param engineType エンジンタイプ（'ollama', 'lm_studio', 'vllm', 'llama_cpp'など）
 * @param path 元のパス（'/v1/chat/completions'など）
 * @returns エンジン別のエンドポイントパス
 */
function getEngineEndpointPath(engineType: string | null, path: string): string {
    const normalizedEngineType = engineType?.toLowerCase() || 'ollama';
    
    // OpenAI互換APIを使用するエンジン（LM Studio、vLLM、llama.cpp）
    if (normalizedEngineType === 'lm_studio' || normalizedEngineType === 'vllm' || normalizedEngineType === 'llama_cpp') {
        // OpenAI互換APIなので、そのまま使用
        return path;
    }
    
    // Ollamaの場合は、独自のエンドポイントに変換
    if (normalizedEngineType === 'ollama') {
        if (path === '/v1/chat/completions') {
            return '/api/chat';
        }
        if (path === '/v1/models') {
            return '/api/tags';
        }
    }
    
    // その他のパスはそのまま返す
    return path;
}

/**
 * エンジンタイプに応じたレスポンス変換が必要かチェック
 * @param engineType エンジンタイプ
 * @param path リクエストパス
 * @returns 変換が必要な場合true
 */
function needsResponseTransform(engineType: string | null, path: string): boolean {
    const normalizedEngineType = engineType?.toLowerCase() || 'ollama';
    
    // Ollamaの /api/tags → /v1/models の変換が必要
    if (normalizedEngineType === 'ollama' && path === '/v1/models') {
        return true;
    }
    
    // その他のエンジンはOpenAI互換APIなので変換不要
    return false;
}

/**
 * エンジンタイプに応じたエラーメッセージを取得
 * @param engineType エンジンタイプ
 * @returns エラーメッセージ
 */
function getEngineErrorMessage(engineType: string | null): string {
    const normalizedEngineType = engineType?.toLowerCase() || 'ollama';
    
    const engineNames: Record<string, string> = {
        'ollama': 'Ollama',
        'lm_studio': 'LM Studio',
        'vllm': 'vLLM',
        'llama_cpp': 'llama.cpp'
    };
    
    const engineName = engineNames[normalizedEngineType] || 'LLMエンジン';
    
    return `${engineName}サーバーへの接続に失敗しました。${engineName}が起動していることを確認してください。`;
}

/**
 * API_IDをサニタイズしてパストラバーサル攻撃を防ぐ
 */
function sanitizeApiId(apiId: string): string {
    // 危険な文字（.., /, \, :など）を削除
    return apiId.replace(/[./\\:]/g, '').replace(/[^a-zA-Z0-9_-]/g, '');
}

/**
 * 証明書ファイルのパスを取得
 */
function getCertificatePaths(): { certPath: string; keyPath: string } | null {
    // データディレクトリを取得（Rust側と一致させる）
    const dataDir = process.env.FLM_DATA_DIR || 
        (process.platform === 'win32' 
            ? path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'FLM')
            : process.platform === 'darwin'
            ? path.join(os.homedir(), 'Library', 'Application Support', 'FLM')
            : path.join(os.homedir(), '.local', 'share', 'FLM'));
    
    // API_IDをサニタイズしてパストラバーサル攻撃を防ぐ
    const sanitizedApiId = sanitizeApiId(API_ID);
    if (!sanitizedApiId || sanitizedApiId.length === 0) {
        return null;
    }
    
    const certDir = path.join(dataDir, 'certificates');
    const certPath = path.join(certDir, `${sanitizedApiId}.pem`);
    const keyPath = path.join(certDir, `${sanitizedApiId}.key`);
    
    if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
        return { certPath, keyPath };
    }
    
    return null;
}

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
            if (bodyStr.length <= SERVER_CONFIG.MAX_REQUEST_BODY_SIZE) {
                requestBody = bodyStr;
            }
        } catch (e) {
            // JSON変換エラーは無視
        }
    }
    
    // レスポンスの終了を監視
    const originalSend = res.send;
    res.send = function (body?: string | object | Buffer) {
        const responseTime = Date.now() - startTime;
        const status = res.statusCode;
        const errorMessage = status >= 400 ? `HTTP ${status}` : null;
        
        // ログ情報をコンソールに出力（開発用）
        if (apiId && process.env.NODE_ENV === 'development') {
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
                // 本番環境ではログ出力を制限
                if (process.env.NODE_ENV === 'development') {
                    console.error('[REQUEST_LOG] ログ保存エラー（非致命的）:', err);
                }
            });
            
            // パフォーマンスメトリクス収集（BE-007-04）
            // 非同期で実行（レスポンス送信をブロックしない）
            collectPerformanceMetrics(apiId, responseTime, status).catch((err) => {
                // エラーログのみ出力（リクエスト処理には影響しない）
                // 本番環境ではログ出力を制限
                if (process.env.NODE_ENV === 'development') {
                    console.error('[PERFORMANCE_METRIC] メトリクス収集エラー（非致命的）:', err);
                }
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

// CPU使用率計算用の前回のCPU使用時間とタイムスタンプ（API IDごとに保存）
interface CpuUsageState {
    lastCpuUsage: NodeJS.CpuUsage;
    lastTimestamp: number;
}

const cpuUsageStates: Map<string, CpuUsageState> = new Map();

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
        
        // CPU使用率を計算（時間間隔での差分を使用）
        let cpuUsagePercent = 0.0;
        const currentCpuUsage = process.cpuUsage?.() || { user: 0, system: 0 };
        const cpuStateKey = `${apiId}:cpu_state`;
        const cpuState = cpuUsageStates.get(cpuStateKey);
        
        if (cpuState) {
            // 前回からの差分を計算（初回はcpuStateがないため、CPU使用率は0%になる）
            const deltaTime = now - cpuState.lastTimestamp;
            const deltaUser = currentCpuUsage.user - cpuState.lastCpuUsage.user;
            const deltaSystem = currentCpuUsage.system - cpuState.lastCpuUsage.system;
            const deltaTotal = (deltaUser + deltaSystem) / FORMATTING.MICROSECONDS_PER_MS; // マイクロ秒をミリ秒に変換
            
            // CPU使用率（%）を計算: (CPU使用時間 / 経過時間) * 100
            // 注意: これは1コアあたりの使用率。マルチコアの場合は100%を超える可能性がある
            if (deltaTime > 0) {
                cpuUsagePercent = (deltaTotal / deltaTime) * FORMATTING.PERCENTAGE_MULTIPLIER;
                // 100%を超える場合は100%に制限（マルチコアシステムでの補正）
                // 実際には、マルチコアシステムでは100%を超えることが正常だが、
                // UI表示やアラートチェックの一貫性のために100%に制限
                cpuUsagePercent = Math.min(cpuUsagePercent, FORMATTING.PERCENTAGE_MULTIPLIER);
            }
        }
        // 注意: 初回リクエスト時はcpuStateがないため、cpuUsagePercent = 0.0 のまま
        // 2回目以降のリクエストからCPU使用率が正しく計算される
        
        // CPU状態を更新
        cpuUsageStates.set(cpuStateKey, {
            lastCpuUsage: currentCpuUsage,
            lastTimestamp: now,
        });
        
        // メモリ使用量と使用率を取得
        const memoryUsage = process.memoryUsage?.() || { heapUsed: 0, heapTotal: 0, external: 0, rss: 0 };
        // RSS（Resident Set Size）を使用: プロセスが実際に使用している物理メモリ
        const memoryUsageMB = memoryUsage.rss / FORMATTING.BYTES_PER_MB;
        
        // メモリ使用率（%）を計算: プロセスが使用しているメモリ / システム全体のメモリ * 100
        const totalMemoryMB = os.totalmem() / FORMATTING.BYTES_PER_MB; // システム全体のメモリ（MB）
        const memoryUsagePercent = totalMemoryMB > 0 ? (memoryUsageMB / totalMemoryMB) * FORMATTING.PERCENTAGE_MULTIPLIER : 0.0;
        
        // メトリクスをバッファに追加（個別に保存せず、メモリ内に蓄積）
        // CPU使用率（%）とメモリ使用率（%）を記録
        const metrics = [
            { type: 'avg_response_time', value: responseTime },
            { type: 'request_count', value: 1 },
            { type: 'error_rate', value: statusCode >= 400 ? 1 : 0 },
            { type: 'cpu_usage', value: cpuUsagePercent }, // CPU使用率（%）
            { type: 'memory_usage', value: memoryUsagePercent }, // メモリ使用率（%）
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
    const flushInterval = SERVER_CONFIG.METRICS_FLUSH_INTERVAL;
    
    // 1分以上経過したメトリクスバッファを処理
    const buffersToFlush: MetricBuffer[] = [];
    
    for (const [key, buffer] of metricBuffers.entries()) {
        // バッファが1分以上経過しているか、または値が一定数以上蓄積された場合
        if (now - buffer.timestamp >= flushInterval || buffer.values.length >= SERVER_CONFIG.METRICS_BUFFER_MAX_SIZE) {
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
                    // エラー率（%）
                    // buffer.valuesは各リクエストのエラー判定（0=正常, 1=エラー）を含む
                    // 平均値を計算して100倍することで、エラー率（%）を取得
                    const errorCount = buffer.values.reduce((sum, val) => sum + val, 0);
                    aggregatedValue = (errorCount / buffer.values.length) * FORMATTING.PERCENTAGE_MULTIPLIER;
                    break;
                case 'cpu_usage':
                    // CPU使用率（%）の平均値
                    aggregatedValue = buffer.values.reduce((sum, val) => sum + val, 0) / buffer.values.length;
                    break;
                case 'memory_usage':
                    // メモリ使用率（%）の平均値
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
            
            // アラートチェック（メトリクス保存後に実行）
            checkAlertThresholds(buffer.apiId, buffer.metricType, aggregatedValue).catch((err) => {
                console.error(`[ALERT_CHECK] アラートチェックエラー: ${buffer.metricType}:`, err);
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
}, SERVER_CONFIG.METRICS_FLUSH_INTERVAL);

/**
 * アラート閾値をチェックしてアラート履歴に保存
 * AUTH-012-01で実装
 * @param apiId API ID
 * @param metricType メトリクスタイプ
 * @param value メトリクス値
 */
async function checkAlertThresholds(
    apiId: string,
    metricType: string,
    value: number
): Promise<void> {
    try {
        // API固有設定を取得
        const apiSettings = await getAlertSettings(apiId);
        // グローバル設定を取得
        const globalSettings = await getAlertSettings(null);
        
        // 通知が無効の場合は早期リターン
        if (!(apiSettings.notifications_enabled ?? globalSettings.notifications_enabled ?? true)) {
            return;
        }
        
        // 閾値を取得（API固有設定を優先、なければグローバル設定）
        let threshold: number | null = null;
        let alertType: string | null = null;
        let message: string = '';
        
        switch (metricType) {
            case 'avg_response_time':
                threshold = apiSettings.response_time_threshold ?? globalSettings.response_time_threshold;
                alertType = 'response_time';
                if (threshold !== null && value > threshold) {
                    message = `平均レスポンス時間が閾値を超過しました: ${value.toFixed(FORMATTING.DECIMAL_PLACES)}ms (閾値: ${threshold.toFixed(FORMATTING.DECIMAL_PLACES)}ms)`;
                }
                break;
            case 'error_rate':
                threshold = apiSettings.error_rate_threshold ?? globalSettings.error_rate_threshold;
                alertType = 'error_rate';
                // エラー率はパーセンテージ（0-100）として計算されている（flushMetricsBufferで*100.0）
                // 閾値は小数（0.0-1.0、例: 0.1 = 10%）として保存されている
                // 比較のため、閾値をパーセンテージに変換（0.1 → 10%）
                const errorRatePercent = value; // 既にパーセンテージ（0-100）
                const thresholdPercent = threshold !== null ? threshold * FORMATTING.PERCENTAGE_MULTIPLIER : null; // 小数からパーセンテージに変換
                if (thresholdPercent !== null && errorRatePercent > thresholdPercent) {
                    message = `エラー率が閾値を超過しました: ${errorRatePercent.toFixed(FORMATTING.DECIMAL_PLACES)}% (閾値: ${thresholdPercent.toFixed(FORMATTING.DECIMAL_PLACES)}%)`;
                }
                break;
            case 'cpu_usage':
                threshold = apiSettings.cpu_usage_threshold ?? globalSettings.cpu_usage_threshold;
                alertType = 'cpu_usage';
                // CPU使用率（%）と閾値（%）を直接比較
                // valueは既にCPU使用率（%）として計算されている
                if (threshold !== null && value > threshold) {
                    message = `CPU使用率が閾値を超過しました: ${value.toFixed(FORMATTING.DECIMAL_PLACES)}% (閾値: ${threshold.toFixed(FORMATTING.DECIMAL_PLACES)}%)`;
                }
                break;
            case 'memory_usage':
                threshold = apiSettings.memory_usage_threshold ?? globalSettings.memory_usage_threshold;
                alertType = 'memory_usage';
                // メモリ使用率（%）と閾値（%）を直接比較
                // valueは既にメモリ使用率（%）として計算されている
                if (threshold !== null && value > threshold) {
                    message = `メモリ使用率が閾値を超過しました: ${value.toFixed(FORMATTING.DECIMAL_PLACES)}% (閾値: ${threshold.toFixed(FORMATTING.DECIMAL_PLACES)}%)`;
                }
                break;
        }
        
        // 閾値を超過している場合、アラート履歴に保存
        if (alertType && threshold !== null && message) {
            await saveAlertHistory({
                apiId,
                alertType,
                currentValue: value,
                threshold,
                message,
            }).catch((err) => {
                console.error('[ALERT_HISTORY] アラート履歴保存エラー:', err);
            });
        }
    } catch (err) {
        // エラーはコンソールに出力するが、リクエスト処理には影響しない
        console.error('[ALERT_CHECK] アラートチェックエラー:', err);
    }
}

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
// エンジンタイプに応じてエンドポイントを切り替え
if (ENGINE_TYPE === 'ollama') {
    // Ollama専用: /api/chat エンドポイントを使用
    app.post('/v1/chat/completions', requestLogMiddleware, authMiddleware, createProxyMiddleware(`${ENGINE_BASE_URL}/api/chat`));
    
    // GET /v1/models → Ollama /api/tags
    app.get('/v1/models', requestLogMiddleware, authMiddleware, createProxyMiddleware(`${ENGINE_BASE_URL}/api/tags`, {
        transformRequest: (req: Request) => {
            // Ollamaの /api/tags 形式に変換
            return req;
        },
        transformResponse: (body: string) => {
            // OpenAI形式に変換
            try {
                const tags = JSON.parse(body) as { models?: Array<{ name?: string; model?: string }> };
                const models = Array.isArray(tags.models) ? tags.models : [];
                return JSON.stringify({
                    object: 'list',
                    data: models.map((model) => ({
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
    app.post('/api/pull', requestLogMiddleware, authMiddleware, createProxyMiddleware(`${ENGINE_BASE_URL}/api/pull`));
    app.post('/api/delete', requestLogMiddleware, authMiddleware, createProxyMiddleware(`${ENGINE_BASE_URL}/api/delete`));
    app.get('/api/tags', requestLogMiddleware, authMiddleware, createProxyMiddleware(`${ENGINE_BASE_URL}/api/tags`));
} else {
    // その他のエンジン（LM Studio、vLLM、llama.cpp）: OpenAI互換APIを直接使用
    // これらのエンジンは /v1/chat/completions と /v1/models を直接提供
    app.post('/v1/chat/completions', requestLogMiddleware, authMiddleware, createProxyMiddleware(`${ENGINE_BASE_URL}/v1/chat/completions`));
    
    app.get('/v1/models', requestLogMiddleware, authMiddleware, createProxyMiddleware(`${ENGINE_BASE_URL}/v1/models`));
    
    // その他のエンジンではOllama専用エンドポイント（/api/pull等）は使用しない
    // 必要に応じて、エンジン固有のエンドポイントを追加可能
}

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

// サーバーインスタンスを保存（グレースフルシャットダウン用）
let httpServer: http.Server | null = null;
let httpsServer: https.Server | null = null;

// 🔒 セキュリティ: HTTPS必須（HTTPは使用不可）
// パスワード漏洩を防ぐため、HTTPモードは無効化されています
// 大衆向け: 証明書がない場合は自動生成（ユーザー操作不要）
async function ensureCertificateAndStartServer() {
    let certPaths = getCertificatePaths();
    
    // 証明書がない場合は自動生成
    if (!certPaths && API_ID && PORT) {
        if (process.env.NODE_ENV === 'development') {
            console.log('🔒 HTTPS証明書が見つかりません。自動生成します...');
        }
        try {
            const generated = await ensureCertificateExists(API_ID, PORT);
            certPaths = { certPath: generated.certPath, keyPath: generated.keyPath };
            if (process.env.NODE_ENV === 'development') {
                console.log('✅ HTTPS証明書の自動生成が完了しました');
            }
        } catch (error) {
            // セキュリティエラーは常に出力（重要）
            console.error('❌ セキュリティエラー: HTTPS証明書の自動生成に失敗しました。');
            console.error('HTTPは使用できません（パスワード漏洩のリスクがあります）。');
            if (process.env.NODE_ENV === 'development') {
                console.error('エラー:', error);
            }
            process.exit(1);
        }
    }
    
    if (!certPaths) {
        // セキュリティエラーは常に出力（重要）
        console.error('❌ セキュリティエラー: HTTPS証明書が見つかりません。');
        console.error('HTTPは使用できません（パスワード漏洩のリスクがあります）。');
        if (process.env.NODE_ENV === 'development') {
            console.error('API IDまたはポート番号が設定されていない可能性があります。');
        }
        process.exit(1);
    }
    
    return certPaths;
}

// 証明書を確保してからサーバーを起動
ensureCertificateAndStartServer().then((certPaths) => {
    startServers(certPaths);
}).catch((error) => {
    console.error('サーバー起動エラー:', error);
    process.exit(1);
});

function startServers(certPaths: { certPath: string; keyPath: string }) {
    // HTTPからHTTPSへのリダイレクト（常に有効）
    const httpApp = express();
    
    // HTTPリダイレクトサーバーにもセキュリティヘッダーを設定
    httpApp.use((req: Request, res: Response, next: NextFunction) => {
        // セキュリティヘッダーを設定（SECURITY_POLICY.mdで明記されている機能）
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('X-XSS-Protection', '1; mode=block');
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        next();
    });
    
    httpApp.use((req: Request, res: Response) => {
        const httpsPort = PORT + 1;
        res.redirect(301, `https://${req.hostname}:${httpsPort}${req.url}`);
    });

    httpServer = http.createServer(httpApp);
    httpServer.listen(PORT, '0.0.0.0', () => {
        console.log(`HTTPリダイレクトサーバーが起動しました: http://0.0.0.0:${PORT} → https://0.0.0.0:${PORT + 1}`);
    }).on('error', (err: NodeJS.ErrnoException) => {
        console.error(`HTTPリダイレクトサーバー起動エラー:`, err);
        if (err.code === 'EADDRINUSE') {
            console.error(`ポート ${PORT} は既に使用されています。別のポートを指定してください。`);
        }
    });

    // HTTPSサーバー起動（証明書が必須）
    try {
        const httpsOptions = {
            key: fs.readFileSync(certPaths.keyPath),
            cert: fs.readFileSync(certPaths.certPath),
        };
        
        httpsServer = https.createServer(httpsOptions, app);
        const httpsPort = PORT + 1;
        httpsServer.listen(httpsPort, '0.0.0.0', () => {
            console.log(`✅ HTTPS認証プロキシサーバーが起動しました: https://0.0.0.0:${httpsPort}`);
            console.log(`   ローカルアクセス: https://localhost:${httpsPort}`);
            console.log(`   外部アクセス: ネットワーク上の他のデバイスからもアクセス可能です`);
            console.log(`   ⚠️  自己署名証明書のため、ブラウザで警告が表示されます（正常です）`);
        }).on('error', (err: NodeJS.ErrnoException) => {
            console.error(`HTTPSサーバー起動エラー:`, err);
            if (err.code === 'EADDRINUSE') {
                console.error(`ポート ${httpsPort} は既に使用されています。別のポートを指定してください。`);
            }
        });
    } catch (err) {
        console.error('❌ 証明書の読み込みエラー:', err);
        console.error('HTTPは使用できません（セキュリティ上の理由）。');
        console.error('証明書を再生成してください。');
        process.exit(1);
    }

    // グレースフルシャットダウン
    const gracefulShutdown = (signal: string) => {
        console.log(`${signal}シグナルを受信しました。サーバーを終了します...`);
        
        const shutdown = () => {
            if (httpServer) {
                httpServer.close(() => {
                    console.log('HTTPサーバーを終了しました。');
                    process.exit(0);
                });
            } else if (httpsServer) {
                httpsServer.close(() => {
                    console.log('HTTPSサーバーを終了しました。');
                    process.exit(0);
                });
            } else {
                process.exit(0);
            }
        };
        
        // 既存の接続を待機してから終了（最大10秒）
        setTimeout(() => {
            console.error('強制終了: タイムアウト');
            process.exit(1);
        }, SERVER_CONFIG.GRACEFUL_SHUTDOWN_TIMEOUT);
        
        shutdown();
    };
    
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

export { app };

