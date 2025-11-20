// apiStatus - APIステータス関連のユーティリティ

/**
 * 翻訳関数の型定義
 */
export type TranslateFunction = (
  key: string,
  params?: Record<string, string | number>
) => string;

/**
 * APIステータスの型定義
 */
export type ApiStatus = 'running' | 'preparing' | 'stopped' | 'error';

/**
 * APIステータスに対応するテキストを取得する関数
 * @param status - APIステータス
 * @param t - 翻訳関数
 * @returns ステータスに対応するテキスト
 */
export function getStatusText(status: ApiStatus, t: TranslateFunction): string {
  switch (status) {
    case 'running':
      return t('apiList.status.running');
    case 'preparing':
      return t('apiList.status.preparing');
    case 'stopped':
      return t('apiList.status.stopped');
    case 'error':
      return t('apiList.status.error');
    default:
      return status;
  }
}
