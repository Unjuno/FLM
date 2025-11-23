// pdfExport - PDFエクスポートユーティリティ

import { print, type PrintOptions } from './print';
import { logger } from './logger';

/**
 * PDFエクスポートオプション
 * 注意: 現在はブラウザの印刷機能を使用するため、一部のオプション（pageSize, orientation, margins）は
 * 将来的なPDFライブラリ統合時に使用されます。
 */
export interface PdfExportOptions {
  /** タイトル */
  title?: string;
  /** ファイル名（拡張子なし） */
  filename?: string;
  /** 印刷する要素のIDまたはセレクタ */
  targetElement?: string | HTMLElement;
  /** ページサイズ（デフォルト: 'a4'）- 将来の実装で使用 */
  pageSize?: 'a4' | 'letter' | 'a3';
  /** 向き（デフォルト: 'portrait'）- 将来の実装で使用 */
  orientation?: 'portrait' | 'landscape';
  /** マージン（mm）- 将来の実装で使用 */
  margins?: {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  };
}

/**
 * デフォルト値
 */
const DEFAULT_VALUES = {
  LOGS_TITLE: 'APIログ一覧',
  LOGS_FILENAME: 'api-logs',
  PERFORMANCE_REPORT_TITLE: 'パフォーマンスレポート',
  PERFORMANCE_REPORT_FILENAME: 'performance-report',
  LOGS_SELECTOR: '.api-logs-content',
  PERFORMANCE_SELECTOR: '.performance-dashboard-content',
} as const;

/**
 * エラーメッセージ
 */
const ERROR_MESSAGES = {
  ELEMENT_NOT_FOUND: 'PDFエクスポート対象の要素が見つかりませんでした。',
  EXPORT_FAILED: 'PDFエクスポート中にエラーが発生しました。',
  NO_LOG_DATA: 'エクスポートするログデータがありません。',
} as const;

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
 * タイトルを取得（フォールバック処理付き）
 * @param title タイトル（最優先）
 * @param filename ファイル名（第2優先）
 * @returns 決定されたタイトル
 */
const getTitle = (title?: string, filename?: string): string => {
  return title ?? filename ?? document.title;
};

/**
 * PDFエクスポート用CSSクラス名
 */
const PDF_EXPORT_CLASS = 'pdf-export-active';

/**
 * PDFエクスポート前後のスタイル管理
 * @param element 対象要素
 * @param isActive アクティブ状態
 */
const togglePdfExportClass = (
  element: HTMLElement,
  isActive: boolean
): void => {
  element.classList.toggle(PDF_EXPORT_CLASS, isActive);
};

/**
 * 指定された要素をPDFとしてエクスポートします
 *
 * **現在の実装**: ブラウザの印刷機能を使用してPDFとして保存できます。
 * ユーザーがブラウザの印刷ダイアログで「PDFに保存」を選択することでPDFを生成します。
 *
 * **将来の実装予定**:
 * - jsPDF等のライブラリを使用した直接的なPDF生成
 * - `pageSize`、`orientation`、`margins`オプションの完全対応
 * - プログラムによるPDFファイルの直接生成とダウンロード
 *
 * @param options PDFエクスポートオプション
 * @throws Error 要素が見つからない場合、またはエクスポートに失敗した場合
 */
export const exportToPdf = async (
  options: PdfExportOptions = {}
): Promise<void> => {
  const {
    targetElement,
    title,
    filename,
    // 将来的な実装で使用: pageSize, orientation, margins
  } = options;

  try {
    const element = getTargetElement(targetElement);
    if (!element) {
      throw new Error(ERROR_MESSAGES.ELEMENT_NOT_FOUND);
    }

    // 印刷機能を使用してPDFとしてエクスポート
    // ユーザーがブラウザの印刷ダイアログで「PDFに保存」を選択できる
    const printOptions: PrintOptions = {
      targetElement: element,
      title: getTitle(title, filename),
      beforePrint: () => {
        togglePdfExportClass(element, true);
      },
      afterPrint: () => {
        togglePdfExportClass(element, false);
      },
    };

    await print(printOptions);
  } catch (error) {
    logger.error(
      ERROR_MESSAGES.EXPORT_FAILED,
      error instanceof Error ? error : new Error(String(error)),
      'pdfExport'
    );
    const errorMessage =
      error instanceof Error ? error.message : ERROR_MESSAGES.EXPORT_FAILED;
    throw new Error(errorMessage);
  }
};

/**
 * ログデータの型定義
 */
export interface LogData {
  id: string;
  api_id: string;
  method: string;
  path: string;
  response_status: number | null;
  response_time_ms: number | null;
  created_at: string;
}

/**
 * ログ一覧をPDFとしてエクスポートします
 *
 * **現在の実装**: ブラウザの印刷機能を使用して、画面上のログ一覧をPDFとして保存できます。
 *
 * **将来の実装予定**:
 * - `logData`パラメータを使用してデータから直接PDFを生成
 * - PDFライブラリ（jsPDF等）を使用した実装
 * - ログデータが空の場合の適切なエラーハンドリング
 * - カスタムフォーマットでのPDF生成
 *
 * @param logData ログデータ（将来の実装で使用予定）
 * @param options エクスポートオプション
 */
export const exportLogsToPdf = async (
  _logData: LogData[], // 将来の実装で使用予定
  options: Omit<PdfExportOptions, 'targetElement'> = {}
): Promise<void> => {
  // 将来の実装: logDataを使用してPDFを生成
  // 現在はブラウザの印刷機能を使用して画面上のログ一覧をPDFとして保存
  // 注意: ログデータが空の場合でも処理を続行（将来的にPDFライブラリを使用する際に実装）

  await exportToPdf({
    ...options,
    targetElement: DEFAULT_VALUES.LOGS_SELECTOR,
    title: options.title ?? DEFAULT_VALUES.LOGS_TITLE,
    filename: options.filename ?? DEFAULT_VALUES.LOGS_FILENAME,
  });
};

/**
 * パフォーマンスレポートデータの型定義
 */
export interface PerformanceReportData {
  apiName: string;
  period: string;
  summary: Record<string, unknown>;
}

/**
 * パフォーマンスレポートのタイトルを生成
 */
const generateReportTitle = (apiName?: string): string => {
  const baseTitle =
    DEFAULT_VALUES.PERFORMANCE_REPORT_TITLE || 'パフォーマンスレポート';
  return apiName ? `${baseTitle} - ${apiName}` : baseTitle;
};

/**
 * パフォーマンスレポートをPDFとしてエクスポートします
 *
 * **現在の実装**: ブラウザの印刷機能を使用して、画面上のパフォーマンスレポートをPDFとして保存できます。
 * `reportData.apiName`のみを使用してタイトルを生成します。
 *
 * **将来の実装予定**:
 * - `reportData`の全データを使用してPDFを生成
 * - PDFライブラリ（jsPDF等）を使用した実装
 * - グラフやチャートを含む詳細なレポート生成
 * - カスタムフォーマットでのPDF生成
 *
 * @param reportData レポートデータ
 * @param options エクスポートオプション
 */
export const exportPerformanceReportToPdf = async (
  reportData: PerformanceReportData,
  options: Omit<PdfExportOptions, 'targetElement'> = {}
): Promise<void> => {
  // 将来の実装: reportDataを使用してPDFを生成
  // 現在はブラウザの印刷機能を使用して画面上のパフォーマンスレポートをPDFとして保存
  const reportTitle = generateReportTitle(reportData.apiName);

  await exportToPdf({
    ...options,
    targetElement: DEFAULT_VALUES.PERFORMANCE_SELECTOR,
    title: options.title ?? reportTitle,
    filename: options.filename ?? DEFAULT_VALUES.PERFORMANCE_REPORT_FILENAME,
  });
};
