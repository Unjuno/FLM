// apiStatusConverter - APIステータス変換ユーティリティ

import type { ApiStatus } from './apiStatus';

/**
 * 文字列のステータスを型安全なステータスに変換
 *
 * @param status 文字列のステータス
 * @returns 型安全なステータス
 */
export function convertApiStatus(status: string): ApiStatus {
  if (status === 'running') {
    return 'running';
  }
  if (status === 'preparing') {
    return 'preparing';
  }
  if (status === 'stopped') {
    return 'stopped';
  }
  return 'error';
}

/**
 * APIステータスの配列をRecordに変換
 *
 * @param apis API情報の配列
 * @returns API IDをキーとしたステータスのRecord
 */
export function convertApiStatusesToRecord(
  apis: Array<{ id: string; status: string }>
): Record<string, ApiStatus> {
  if (apis.length === 0) {
    return {};
  }

  const statuses: Record<string, ApiStatus> = {};
  for (const api of apis) {
    statuses[api.id] = convertApiStatus(api.status);
  }
  return statuses;
}

/**
 * 2つのステータスRecordが等しいかどうかを比較
 * パフォーマンス最適化のため、浅い比較を使用
 *
 * @param prev 前のステータスRecord
 * @param next 次のステータスRecord
 * @returns 等しい場合はtrue、異なる場合はfalse
 */
export function areStatusRecordsEqual(
  prev: Record<string, ApiStatus>,
  next: Record<string, ApiStatus>
): boolean {
  const prevKeys = Object.keys(prev);
  const nextKeys = Object.keys(next);

  // キーの数が異なる場合は等しくない
  if (prevKeys.length !== nextKeys.length) {
    return false;
  }

  // すべてのキーが存在し、値が等しいかチェック
  return prevKeys.every(key => prev[key] === next[key]);
}

