// print - 印刷ユーティリティ

import { logger } from './logger';
import { TIMEOUT } from '../constants/config';

/**
 * 印刷オプション
 */
export interface PrintOptions {
  /** 印刷する要素のIDまたはセレクタ */
  targetElement?: string | HTMLElement;
  /** ページタイトル */
  title?: string;
  /** 印刷前に実行するコールバック */
  beforePrint?: () => void | Promise<void>;
  /** 印刷後に実行するコールバック */
  afterPrint?: () => void | Promise<void>;
  /** 印刷用CSSスタイル */
  styles?: string;
}

/**
 * 印刷処理の定数
 */
const PRINT_DELAY_MS = TIMEOUT.PRINT_DELAY;
const WINDOW_CLOSE_DELAY_MS = TIMEOUT.WINDOW_CLOSE_DELAY;
const DEFAULT_PAGE_MARGIN = '1cm';
const DEFAULT_FONT_SIZE = '12pt';
const DEFAULT_LINE_HEIGHT = 1.5;

/**
 * エラーメッセージ
 */
const ERROR_MESSAGES = {
  NO_ELEMENT: (selector: string) =>
    `印刷対象の要素が見つかりません: ${selector}`,
  POPUP_BLOCKED: () =>
    '印刷ウィンドウがブロックされました。ポップアップを許可してください。',
  PRINT_FAILED: () => '印刷処理に失敗しました。',
  CALLBACK_ERROR: (phase: string) =>
    `${phase}コールバックでエラーが発生しました`,
};

/**
 * デフォルト印刷スタイル
 */
const DEFAULT_PRINT_STYLES = `
  @media print {
    body {
      margin: ${DEFAULT_PAGE_MARGIN};
      font-size: ${DEFAULT_FONT_SIZE};
      line-height: ${DEFAULT_LINE_HEIGHT};
      color: #000;
      background: #fff;
    }
    
    /* 不要な要素を非表示 */
    .no-print,
    button,
    .sidebar,
    .header,
    .footer,
    nav {
      display: none !important;
    }
    
    /* ページ区切り */
    .page-break {
      page-break-after: always;
    }
    
    /* リンクのURL表示 */
    a[href]:after {
      content: " (" attr(href) ")";
    }
    
    /* テーブルの改ページ防止 */
    table {
      page-break-inside: avoid;
    }
  }
`;

/**
 * HTMLエレメントを取得
 * @param selector 要素のIDまたはセレクタ、またはHTMLElement
 * @returns HTMLElement
 */
const getElement = (selector: string | HTMLElement): HTMLElement | null => {
  if (typeof selector === 'string') {
    // IDで検索
    const element = document.getElementById(selector);
    if (element) return element;

    // セレクタで検索
    return document.querySelector(selector);
  }
  return selector;
};

/**
 * 印刷用スタイルを作成
 * @param customStyles カスタムスタイル
 * @returns スタイルタグのHTML文字列
 */
const createPrintStyles = (customStyles?: string): string => {
  const styles = customStyles || DEFAULT_PRINT_STYLES;
  return `<style>${styles}</style>`;
};

/**
 * 印刷ウィンドウのHTMLを作成
 * @param content 印刷するコンテンツのHTML
 * @param title ページタイトル
 * @param styles 印刷用スタイル
 * @returns 印刷ウィンドウのHTML
 */
const createPrintWindowHTML = (
  content: string,
  title?: string,
  styles?: string
): string => {
  const pageTitle = title || document.title;
  const printStyles = createPrintStyles(styles);

  return `
    <!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${pageTitle}</title>
      ${printStyles}
    </head>
    <body>
      ${content}
    </body>
    </html>
  `;
};

/**
 * コールバックを安全に実行
 * @param callback コールバック関数
 * @param phase 実行フェーズ（'印刷前' | '印刷後'）
 */
const safeExecuteCallback = async (
  callback?: () => void | Promise<void>,
  phase: string = '印刷'
): Promise<void> => {
  if (!callback) return;

  try {
    await Promise.resolve(callback());
  } catch (error) {
    logger.error(ERROR_MESSAGES.CALLBACK_ERROR(phase), error, 'print');
  }
};

/**
 * エラー処理とコールバック実行のヘルパー
 * @param printWindow 印刷ウィンドウ
 * @param afterPrint 印刷後コールバック
 */
const handleError = async (
  printWindow: Window | null,
  afterPrint?: () => void | Promise<void>
): Promise<void> => {
  if (printWindow) {
    try {
      printWindow.close();
    } catch (error) {
      logger.error('印刷ウィンドウのクローズに失敗しました', error, 'print');
    }
  }
  await safeExecuteCallback(afterPrint, '印刷後');
};

/**
 * 印刷を実行
 * @param options 印刷オプション
 */
export const print = async (options: PrintOptions = {}): Promise<void> => {
  const { targetElement, title, beforePrint, afterPrint, styles } = options;

  let printWindow: Window | null = null;

  try {
    // 印刷前コールバックを実行
    await safeExecuteCallback(beforePrint, '印刷前');

    // 印刷対象のコンテンツを取得
    let content: string;

    if (targetElement) {
      const element = getElement(targetElement);
      if (!element) {
        const selector =
          typeof targetElement === 'string' ? targetElement : 'Unknown';
        logger.error(ERROR_MESSAGES.NO_ELEMENT(selector), '', 'print');
        throw new Error(ERROR_MESSAGES.NO_ELEMENT(selector));
      }
      content = element.innerHTML;
    } else {
      // 対象が指定されていない場合は、body全体を印刷
      content = document.body.innerHTML;
    }

    // 印刷ウィンドウを開く
    printWindow = window.open('', '_blank', 'width=800,height=600');

    if (!printWindow) {
      logger.error(ERROR_MESSAGES.POPUP_BLOCKED(), '', 'print');
      throw new Error(ERROR_MESSAGES.POPUP_BLOCKED());
    }

    // HTMLを書き込む
    const html = createPrintWindowHTML(content, title, styles);
    printWindow.document.write(html);
    printWindow.document.close();

    // スタイルの読み込みと画像の読み込みを待つ
    await new Promise<void>(resolve => {
      if (!printWindow) {
        resolve();
        return;
      }

      // JSDOM互換性: window.openがWindowを返さない場合のハンドリング
      if (typeof printWindow.addEventListener === 'function') {
        printWindow.addEventListener('load', () => {
          setTimeout(() => resolve(), PRINT_DELAY_MS);
        });
      } else {
        // JSDOM環境では即座に解決
        setTimeout(() => resolve(), PRINT_DELAY_MS);
      }
    });

    // 印刷ダイアログを表示
    printWindow.focus();
    printWindow.print();

    // 印刷ダイアログが閉じられるのを待つ
    setTimeout(() => {
      if (printWindow) {
        printWindow.close();
      }
      safeExecuteCallback(afterPrint, '印刷後');
    }, WINDOW_CLOSE_DELAY_MS);
  } catch (error) {
    logger.error(ERROR_MESSAGES.PRINT_FAILED(), error, 'print');
    await handleError(printWindow, afterPrint);
    throw error;
  }
};

/**
 * 現在のページを印刷
 */
export const printCurrentPage = async (): Promise<void> => {
  try {
    window.print();
  } catch (error) {
    logger.error(ERROR_MESSAGES.PRINT_FAILED(), error, 'print');
    throw error;
  }
};

/**
 * 指定された要素を印刷
 * @param elementId 要素のID
 * @param options 印刷オプション
 */
export const printElement = async (
  elementId: string,
  options: Omit<PrintOptions, 'targetElement'> = {}
): Promise<void> => {
  await print({ ...options, targetElement: elementId });
};

/**
 * 指定されたセレクタで要素を印刷
 * @param selector CSSセレクタまたは要素のID
 * @param title ページタイトル（オプション）
 * @param options 追加の印刷オプション
 */
export const printSelector = async (
  selector: string,
  title?: string,
  options: Omit<PrintOptions, 'targetElement' | 'title'> = {}
): Promise<void> => {
  await print({ ...options, targetElement: selector, title });
};
