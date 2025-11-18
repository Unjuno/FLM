// request-queue - リクエストキュー管理システム
// 同時リクエストの制御とキュー管理を行います

import { Request, Response, NextFunction } from 'express';

/**
 * リクエストキュー管理クラス
 * 同時実行数を制御し、リクエストを順次処理します
 */
export class RequestQueue {
  private queue: Array<{
    requestHandler: () => Promise<void>;
    resolve: () => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout | null;
  }> = [];
  private processing: number = 0;
  private maxConcurrent: number;
  private defaultTimeout: number;
  private maxQueueSize: number;

  /**
   * コンストラクタ
   * @param maxConcurrent 最大同時実行数（デフォルト: 1）
   * @param defaultTimeout デフォルトタイムアウト（ミリ秒、デフォルト: 30000）
   * @param maxQueueSize 最大キューサイズ（デフォルト: 100）
   */
  constructor(
    maxConcurrent: number = 1,
    defaultTimeout: number = 30000,
    maxQueueSize: number = 100
  ) {
    this.maxConcurrent = maxConcurrent;
    this.defaultTimeout = defaultTimeout;
    this.maxQueueSize = maxQueueSize;
  }

  /**
   * リクエストをキューに追加
   * @param requestHandler リクエストハンドラ関数
   * @param timeout タイムアウト（ミリ秒、省略時はデフォルト値を使用）
   * @returns Promise<void>
   */
  async add(
    requestHandler: () => Promise<void>,
    timeout?: number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      // キューサイズ制限チェック
      if (this.queue.length >= this.maxQueueSize) {
        reject(
          new Error(`キューが満杯です。最大キューサイズ: ${this.maxQueueSize}`)
        );
        return;
      }

      const timeoutMs = timeout || this.defaultTimeout;
      let timeoutId: NodeJS.Timeout | null = null;

      // タイムアウト設定
      if (timeoutMs > 0) {
        timeoutId = setTimeout(() => {
          // タイムアウト時はキューから削除を試みる
          const index = this.queue.findIndex(
            item => item.timeout === timeoutId
          );
          if (index !== -1) {
            this.queue.splice(index, 1);
          }
          reject(new Error(`リクエストがタイムアウトしました: ${timeoutMs}ms`));
        }, timeoutMs);
      }

      this.queue.push({
        requestHandler,
        resolve,
        reject,
        timeout: timeoutId,
      });

      // キュー処理を開始
      this.process();
    });
  }

  /**
   * キューを処理
   * 同時実行数が上限に達していない場合、次のリクエストを処理します
   */
  private async process(): Promise<void> {
    // 同時実行数が上限に達している、またはキューが空の場合は処理しない
    if (this.processing >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    // キューからリクエストを取得
    const item = this.queue.shift();
    if (!item) {
      return;
    }

    // 処理中カウントを増やす
    this.processing++;

    try {
      // タイムアウトをクリア（処理開始時）
      if (item.timeout) {
        clearTimeout(item.timeout);
        item.timeout = null;
      }

      // リクエストハンドラを実行
      await item.requestHandler();
      item.resolve();
    } catch (error) {
      item.reject(error instanceof Error ? error : new Error(String(error)));
    } finally {
      // 処理中カウントを減らす
      this.processing--;
      // 次のリクエストを処理
      this.process();
    }
  }

  /**
   * 最大同時実行数を設定
   * @param max 最大同時実行数
   */
  setMaxConcurrent(max: number): void {
    if (max < 1) {
      throw new Error('最大同時実行数は1以上である必要があります');
    }
    this.maxConcurrent = max;
    // 設定変更後、待機中のリクエストがあれば処理を再開
    this.process();
  }

  /**
   * 現在のキューサイズを取得
   * @returns キューサイズ
   */
  getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * 現在の処理中リクエスト数を取得
   * @returns 処理中リクエスト数
   */
  getProcessingCount(): number {
    return this.processing;
  }

  /**
   * キューをクリア（すべての待機中のリクエストを拒否）
   */
  clear(): void {
    while (this.queue.length > 0) {
      const item = this.queue.shift();
      if (item) {
        if (item.timeout) {
          clearTimeout(item.timeout);
        }
        item.reject(new Error('キューがクリアされました'));
      }
    }
  }
}

// グローバルキューインスタンス（API IDごとに管理する場合は、Mapを使用）
// 環境変数から最大同時実行数を取得（デフォルト: 1）
const MAX_CONCURRENT_REQUESTS = parseInt(
  process.env.MAX_CONCURRENT_REQUESTS || '1',
  10
);

// 環境変数からタイムアウトを取得（デフォルト: 30000ms = 30秒）
const REQUEST_TIMEOUT = parseInt(process.env.REQUEST_TIMEOUT || '30000', 10);

// 環境変数から最大キューサイズを取得（デフォルト: 100）
const MAX_QUEUE_SIZE = parseInt(process.env.MAX_QUEUE_SIZE || '100', 10);

// グローバルキューインスタンス
export const globalRequestQueue = new RequestQueue(
  MAX_CONCURRENT_REQUESTS,
  REQUEST_TIMEOUT,
  MAX_QUEUE_SIZE
);

/**
 * リクエストキュー管理ミドルウェア
 * リクエストをキューに追加して順次処理します
 */
export function requestQueueMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // ヘルスチェックエンドポイントはキューに追加しない
  if (req.path === '/health') {
    next();
    return;
  }

  // リクエストをキューに追加
  globalRequestQueue
    .add(async () => {
      // Promiseを解決して、次のミドルウェアに進む
      return new Promise<void>((resolve, reject) => {
        // レスポンス終了時にPromiseを解決
        const originalEnd = res.end.bind(res);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        res.end = function (chunk?: any, encoding?: any) {
          const result = originalEnd(chunk, encoding);
          resolve();
          return result;
        };

        // エラーハンドラを設定
        res.on('error', (error: Error) => {
          reject(error);
        });

        // 次のミドルウェアを呼び出す
        next();
      });
    })
    .catch((error: Error) => {
      // キューエラー（タイムアウト、キュー満杯など）を処理
      if (!res.headersSent) {
        res.status(503).json({
          error: {
            message: error.message || 'リクエストキューエラーが発生しました',
            type: 'queue_error',
            code: 'request_queue_failed',
          },
        });
      }
    });
}
