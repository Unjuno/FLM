// clipboard - クリップボード操作ユーティリティ

import { logger } from './logger';
import { toError } from './errorHandler';

/**
 * クリップボードにテキストをコピーする
 * 
 * @param text コピーするテキスト
 * @returns 成功した場合はtrue、失敗した場合はfalse
 * @throws クリップボードへのアクセスが失敗した場合にエラーをスロー
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    // モダンブラウザのClipboard APIを優先的に使用
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text);
      return true;
    }

    // フォールバック: 古いブラウザ向けの方法
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '-9999px';
    textArea.setAttribute('readonly', '');
    document.body.appendChild(textArea);
    
    // iOS Safari対応
    if (navigator.userAgent.match(/ipad|iphone/i)) {
      const range = document.createRange();
      range.selectNodeContents(textArea);
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
      textArea.setSelectionRange(0, 999999);
    } else {
      textArea.select();
    }

    try {
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      
      if (!successful) {
        throw new Error('execCommand("copy")が失敗しました');
      }
      
      return true;
    } catch (err) {
      document.body.removeChild(textArea);
      throw err;
    }
  } catch (err) {
    logger.warn(
      'クリップボードへのコピーに失敗しました',
      'clipboard',
      toError(err)
    );
    throw err;
  }
}

/**
 * クリップボードにテキストをコピーし、成功時にコールバックを実行
 * 
 * @param text コピーするテキスト
 * @param onSuccess 成功時のコールバック（オプション）
 * @param onError エラー時のコールバック（オプション）
 */
export async function copyToClipboardWithCallback(
  text: string,
  onSuccess?: () => void,
  onError?: (error: Error) => void
): Promise<void> {
  try {
    await copyToClipboard(text);
    onSuccess?.();
  } catch (err) {
    const error = toError(err);
    onError?.(error);
  }
}

