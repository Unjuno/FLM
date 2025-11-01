// FLM - Database Access for Authentication Proxy
// 認証エージェント (AUTH) 実装
// 認証プロキシサーバーからデータベースにアクセスするモジュール

import sqlite3 from 'sqlite3';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

/**
 * データベースファイルのパスを取得
 * Rust側の実装（src-tauri/src/database/connection.rs）と一致させる
 */
function getDatabasePath(): string {
    // アプリケーションデータディレクトリを取得
    // Windows: %LOCALAPPDATA%\FLM
    // macOS: ~/Library/Application Support/FLM
    // Linux: ~/.local/share/FLM
    const dataDir = process.env.FLM_DATA_DIR || 
        (process.platform === 'win32' 
            ? path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'FLM')
            : process.platform === 'darwin'
            ? path.join(os.homedir(), 'Library', 'Application Support', 'FLM')
            : path.join(os.homedir(), '.local', 'share', 'FLM'));
    
    return path.join(dataDir, 'flm.db');
}

/**
 * データベース接続を取得（読み取り専用）
 * 接続プールを使用せず、必要な都度接続・クローズする
 */
function getDatabase(): Promise<sqlite3.Database> {
    return new Promise((resolve, reject) => {
        const dbPath = getDatabasePath();
        
        // データベースファイルの親ディレクトリが存在しない場合は作成
        const dbDir = path.dirname(dbPath);
        try {
            const fs = require('fs');
            if (!fs.existsSync(dbDir)) {
                fs.mkdirSync(dbDir, { recursive: true });
            }
        } catch (err: any) {
            console.warn('データベースディレクトリ作成エラー:', err);
        }
        
        const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
            if (err) {
                reject(err);
            } else {
                resolve(db);
            }
        });
    });
}

/**
 * データベース接続を取得（読み書き可能）
 * リクエストログ保存など、書き込み操作に使用
 */
function getDatabaseReadWrite(): Promise<sqlite3.Database> {
    return new Promise((resolve, reject) => {
        const dbPath = getDatabasePath();
        
        // データベースファイルの親ディレクトリが存在しない場合は作成
        const dbDir = path.dirname(dbPath);
        try {
            const fs = require('fs');
            if (!fs.existsSync(dbDir)) {
                fs.mkdirSync(dbDir, { recursive: true });
            }
        } catch (err: any) {
            console.warn('データベースディレクトリ作成エラー:', err);
        }
        
        const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
            if (err) {
                reject(err);
            } else {
                // 外部キー制約を有効化
                db.run('PRAGMA foreign_keys = ON');
                resolve(db);
            }
        });
    });
}

/**
 * APIキーのハッシュを取得
 * @param apiKeyHash APIキーのハッシュ値
 * @returns データベースに保存されているハッシュ値、存在しない場合はnull
 */
export async function getApiKeyHash(apiKeyHash: string): Promise<string | null> {
    const db = await getDatabase();
    
    return new Promise((resolve, reject) => {
        db.get(
            'SELECT key_hash FROM api_keys WHERE key_hash = ?',
            [apiKeyHash],
            (err, row: any) => {
                db.close();
                if (err) {
                    reject(err);
                } else if (row) {
                    resolve(row.key_hash);
                } else {
                    resolve(null);
                }
            }
        );
    });
}

/**
 * API IDでAPIキーのハッシュを取得
 * @param apiId API ID
 * @returns データベースに保存されているハッシュ値、存在しない場合はnull
 */
export async function getApiKeyHashByApiId(apiId: string): Promise<string | null> {
    const db = await getDatabase();
    
    return new Promise((resolve, reject) => {
        db.get(
            'SELECT key_hash FROM api_keys WHERE api_id = ?',
            [apiId],
            (err, row: any) => {
                db.close();
                if (err) {
                    reject(err);
                } else if (row) {
                    resolve(row.key_hash);
                } else {
                    resolve(null);
                }
            }
        );
    });
}

/**
 * リクエストログ保存インターフェース
 */
export interface SaveRequestLogParams {
    apiId: string;
    method: string;
    path: string;
    requestBody: string | null;
    responseStatus: number;
    responseTimeMs: number;
    errorMessage: string | null;
}

/**
 * リクエストログをデータベースに保存
 * F006の基盤機能として実装
 * @param params リクエストログ情報
 * @returns 保存成功時 true、失敗時 false（エラーはコンソールに出力）
 */
export async function saveRequestLog(params: SaveRequestLogParams): Promise<boolean> {
    const db = await getDatabaseReadWrite();
    const uuid = crypto.randomUUID();
    const now = new Date().toISOString();
    
    return new Promise((resolve) => {
        db.run(
            `INSERT INTO request_logs 
             (id, api_id, method, path, request_body, response_status, response_time_ms, error_message, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                uuid,
                params.apiId,
                params.method,
                params.path,
                params.requestBody,
                params.responseStatus,
                params.responseTimeMs,
                params.errorMessage,
                now
            ],
            (err: Error | null) => {
                db.close();
                if (err) {
                    // エラーはログに出力するが、リクエスト処理は続行する
                    console.error('[REQUEST_LOG] ログ保存エラー:', err);
                    resolve(false);
                } else {
                    resolve(true);
                }
            }
        );
    });
}

/**
 * パフォーマンスメトリクス保存インターフェース（BE-007-04）
 */
export interface SavePerformanceMetricParams {
    apiId: string;
    metricType: string;
    value: number;
}

/**
 * パフォーマンスメトリクスをデータベースに保存（BE-007-04）
 * F007の基盤機能として実装
 * @param params パフォーマンスメトリクス情報
 * @returns 保存成功時 true、失敗時 false（エラーはコンソールに出力）
 */
export async function savePerformanceMetric(params: SavePerformanceMetricParams): Promise<boolean> {
    const db = await getDatabaseReadWrite();
    const now = new Date().toISOString();
    
    return new Promise((resolve) => {
        db.run(
            `INSERT INTO performance_metrics 
             (api_id, metric_type, value, timestamp)
             VALUES (?, ?, ?, ?)`,
            [
                params.apiId,
                params.metricType,
                params.value,
                now
            ],
            (err: Error | null) => {
                db.close();
                if (err) {
                    // エラーはログに出力するが、リクエスト処理は続行する
                    console.error('[PERFORMANCE_METRIC] メトリクス保存エラー:', err);
                    resolve(false);
                } else {
                    resolve(true);
                }
            }
        );
    });
}

