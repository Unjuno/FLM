// print - 印刷ユーティリティ

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
import { TIMEOUT } from '../constants/config';

const PRINT_DELAY_MS = TIMEOUT.PRINT_DELAY;
const WINDOW_CLOSE_DELAY_MS = TIMEOUT.WINDOW_CLOSE_DELAY;
const DEFAULT_PAGE_MARGIN = '1cm';
const DEFAULT_FONT_SIZE = '12pt';
const DEFAULT_LINE_HEIGHT = 1.5;

/**
 * エラーメッセージ
 */
const ERROR_MESSAGES = {
  POPUP_BLOCKED:
    '印刷ウィンドウを開けませんでした。ポップアップブロッカーが有効になっている可能性があります。',
  ELEMENT_NOT_FOUND: '印刷対象の要素が見つかりませんでした。',
  WINDOW_LOAD_FAILED: '印刷ウィンドウの読み込みに失敗しました。',
  PRINT_FAILED: '印刷の実行中にエラーが発生しました。',
  CALLBACK_ERROR: (phase: 'before' | 'after') =>
    `印刷${phase === 'before' ? '前' : '後'}コールバックでエラーが発生しました:`,
} as const;

/**
 * デフォルトの印刷用CSSスタイル
 */
const DEFAULT_PRINT_STYLES = `
  @media print {
    @page {
      margin: ${DEFAULT_PAGE_MARGIN};
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
        'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
        sans-serif;
      font-size: ${DEFAULT_FONT_SIZE};
      line-height: ${DEFAULT_LINE_HEIGHT};
      color: #000;
      background: #fff;
    }
    /* 印刷時に非表示にする要素 */
    .no-print,
    button,
    .button,
    nav,
    header .header-actions,
    .print-hide {
      display: none !important;
    }
    /* 印刷時に表示する要素 */
    .print-only {
      display: block !important;
    }
    /* テーブルのスタイル */
    table {
      width: 100%;
      border-collapse: collapse;
      page-break-inside: auto;
    }
    tr {
      page-break-inside: avoid;
      page-break-after: auto;
    }
    thead {
      display: table-header-group;
    }
    tfoot {
      display: table-footer-group;
    }
    /* ページ区切り */
    .page-break {
      page-break-before: always;
    }
    /* リンク */
    a {
      color: #000;
      text-decoration: none;
    }
    a[href^="http"]:after {
      content: " (" attr(href) ")";
      font-size: 0.8em;
      color: #666;
    }
  }
`;

/**
 * HTML文字列をエスケープしてXSS攻撃を防ぐ
 * @param str エスケープする文字列
 * @returns エスケープされた文字列
 */
const escapeHtml = (str: string): string => {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return str.replace(/[&<>"']/g, char => map[char] || char);
};

/**
 * 要素を取得する（型安全）
 * @param targetElement セレクタ文字列またはHTMLElement
 * @returns 取得した要素またはnull
 */
const getTargetElement = (
  targetElement?: string | HTMLElement
): HTMLElement | null => {
  if (typeof targetElement === 'string') {
    return document.querySelector<HTMLElement>(targetElement);
  }
  if (targetElement instanceof HTMLElement) {
    return targetElement;
  }
  return document.body;
};

/**
 * コールバック関数を安全に実行する
 * @param callback 実行するコールバック関数
 * @param phase コールバックのフェーズ（エラーメッセージ用）
 */
const safeExecuteCallback = async (
  callback: () => void | Promise<void>,
  phase: 'before' | 'after'
): Promise<void> => {
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
      logger.error('印刷ウィンドウの閉鎖中にエラーが発生しました', error, 'print');
    }
  }
  if (afterPrint) {
    await safeExecuteCallback(afterPrint, 'after');
  }
};

/**
 * 印刷用HTMLテンプレートを生成
 * @param title ページタイトル
 * @param content 印刷コンテンツ（innerHTMLから取得されたHTML文字列）
 * @param styles 追加CSSスタイル
 * @returns 完全なHTML文字列
 *
 * 注意: contentは既存のDOM要素のinnerHTMLから取得されるため、
 * 信頼されたソースからのコンテンツのみが渡されることを前提としています。
 * 外部入力や信頼できないデータが含まれる可能性がある場合は、
 * 事前にサニタイゼーションが必要です。
 */
const generatePrintHTML = (
  title: string,
  content: string,
  styles: string
): string => {
  const escapedTitle = escapeHtml(title);
  const escapedStyles = escapeHtml(styles);
  const currentYear = new Date().getFullYear();
  const printDate = new Date().toLocaleString('ja-JP');

  // contentはDOM要素のinnerHTMLから取得されるため、そのまま使用
  // ただし、将来外部入力が含まれる可能性がある場合は、サニタイゼーションが必要

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <title>${escapedTitle}</title>
    <style>
      ${escapedStyles}
${DEFAULT_PRINT_STYLES.trim()}
    </style>
  </head>
  <body>
    <div class="print-header">
      <h1>${escapedTitle}</h1>
      <p class="print-date">印刷日時: ${printDate}</p>
    </div>
    ${content}
    <div class="print-footer">
      <p>© ${currentYear} FLM Project. All rights reserved.</p>
    </div>
  </body>
</html>`;
};

/**
 * 指定された要素を印刷します
 * @param options 印刷オプション
 */
export const printElement = async (
  options: PrintOptions = {}
): Promise<void> => {
  const {
    targetElement,
    title = document.title,
    beforePrint,
    afterPrint,
    styles = '',
  } = options;

  // 印刷前のコールバックを実行
  if (beforePrint) {
    await safeExecuteCallback(beforePrint, 'before');
    // エラーが発生しても処理を続行（コールバック内でエラーが記録される）
  }

  // 新しいウィンドウを作成
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    logger.error(ERROR_MESSAGES.POPUP_BLOCKED, null, 'print');
    // alert()を削除: エラーはコンソールに出力し、呼び出し元で適切に処理される
    await handleError(null, afterPrint);
    return;
  }

  // 読み込み失敗時のエラーハンドリングを先に設定
  printWindow.onerror = async () => {
    logger.error(ERROR_MESSAGES.WINDOW_LOAD_FAILED, null, 'print');
    // alert()を削除: エラーはコンソールに出力し、呼び出し元で適切に処理される
    await handleError(printWindow, afterPrint);
  };

  // 印刷対象の要素を取得
  const elementToPrint = getTargetElement(targetElement);
  if (!elementToPrint) {
    logger.error(ERROR_MESSAGES.ELEMENT_NOT_FOUND, null, 'print');
    // alert()を削除: エラーはコンソールに出力し、呼び出し元で適切に処理される
    await handleError(printWindow, afterPrint);
    return;
  }

  // 印刷用HTMLを作成
  const printContent = elementToPrint.innerHTML;
  const printHTML = generatePrintHTML(title, printContent, styles);

  try {
    // 印刷ウィンドウにコンテンツを書き込み
    printWindow.document.write(printHTML);
    printWindow.document.close();

    // 印刷ウィンドウが読み込まれたら印刷を実行
    printWindow.onload = () => {
      setTimeout(async () => {
        try {
          printWindow.print();

          // 印刷後、ウィンドウを閉じる
          setTimeout(async () => {
            try {
              printWindow.close();
            } catch (error) {
              logger.error('印刷ウィンドウの閉鎖中にエラーが発生しました', error, 'print');
            }
            if (afterPrint) {
              await safeExecuteCallback(afterPrint, 'after');
            }
          }, WINDOW_CLOSE_DELAY_MS);
        } catch (error) {
          logger.error(ERROR_MESSAGES.PRINT_FAILED, error, 'print');
          await handleError(printWindow, afterPrint);
        }
      }, PRINT_DELAY_MS);
    };
  } catch (error) {
    logger.error('印刷処理中にエラーが発生しました', error, 'print');
    await handleError(printWindow, afterPrint);
  }
};

/**
 * 現在のページを印刷します
 * @param title ページタイトル（オプション）
 */
export const printPage = async (title?: string): Promise<void> => {
  await printElement({
    title: title || document.title,
    beforePrint: () => {
      // 印刷前にページの状態を保存
      document.body.classList.add('printing');
    },
    afterPrint: () => {
      // 印刷後にページの状態を復元
      document.body.classList.remove('printing');
    },
  });
};

/**
 * 指定されたセレクタの要素を印刷します
 * @param selector 要素のセレクタ
 * @param title ページタイトル（オプション）
 */
export const printSelector = async (
  selector: string,
  title?: string
): Promise<void> => {
  await printElement({
    targetElement: selector,
    title: title || document.title,
  });
};
