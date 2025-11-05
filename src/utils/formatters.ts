// formatters - フォーマット関連のユーティリティ関数

import { FORMATTING, DATE_TIME_FORMAT, FORMAT_STRINGS } from '../constants/config';

/**
 * 日時フォーマットオプション
 */
export interface DateTimeFormatOptions {
  /** ロケール（デフォルト: DATE_TIME_FORMAT.DEFAULT_LOCALE） */
  locale?: string;
  /** 年を含める（デフォルト: DATE_TIME_FORMAT.DEFAULT_INCLUDE_YEAR） */
  includeYear?: boolean;
  /** 時を含める（デフォルト: DATE_TIME_FORMAT.DEFAULT_INCLUDE_TIME） */
  includeTime?: boolean;
  /** 秒を含める（デフォルト: DATE_TIME_FORMAT.DEFAULT_INCLUDE_SECONDS） */
  includeSeconds?: boolean;
}

/**
 * 日時をフォーマット
 * @param dateString 日時文字列（ISO形式またはその他の形式）
 * @param options フォーマットオプション
 * @returns フォーマットされた日時文字列
 */
export function formatDateTime(
  dateString: string,
  options: DateTimeFormatOptions = {}
): string {
  if (!dateString || dateString.trim() === '') {
    return FORMAT_STRINGS.UNKNOWN;
  }

  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return dateString;
    }

    const {
      locale = DATE_TIME_FORMAT.DEFAULT_LOCALE,
      includeYear = DATE_TIME_FORMAT.DEFAULT_INCLUDE_YEAR,
      includeTime = DATE_TIME_FORMAT.DEFAULT_INCLUDE_TIME,
      includeSeconds = DATE_TIME_FORMAT.DEFAULT_INCLUDE_SECONDS,
    } = options;

    const formatOptions: Intl.DateTimeFormatOptions = {
      month: DATE_TIME_FORMAT.MONTH_DAY_FORMAT,
      day: DATE_TIME_FORMAT.MONTH_DAY_FORMAT,
    };

    if (includeYear) {
      formatOptions.year = DATE_TIME_FORMAT.YEAR_FORMAT;
    }

    if (includeTime) {
      formatOptions.hour = DATE_TIME_FORMAT.TIME_FORMAT;
      formatOptions.minute = DATE_TIME_FORMAT.TIME_FORMAT;
      if (includeSeconds) {
        formatOptions.second = DATE_TIME_FORMAT.TIME_FORMAT;
      }
    }

    return date.toLocaleString(locale, formatOptions);
  } catch {
    return dateString;
  }
}

/**
 * 日付のみをフォーマット（時刻なし）
 * @param dateString 日時文字列
 * @param locale ロケール（デフォルト: 'ja-JP'）
 * @returns フォーマットされた日付文字列
 */
export function formatDate(dateString: string, locale: string = DATE_TIME_FORMAT.DEFAULT_LOCALE): string {
  if (!dateString || dateString.trim() === '') {
    return FORMAT_STRINGS.UNKNOWN;
  }

  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return FORMAT_STRINGS.UNKNOWN;
    }
    return date.toLocaleDateString(locale);
  } catch {
    return '不明';
  }
}

/**
 * 時刻のみをフォーマット（日付なし）
 * @param dateString 日時文字列
 * @param locale ロケール（デフォルト: 'ja-JP'）
 * @param includeSeconds 秒を含める（デフォルト: true）
 * @returns フォーマットされた時刻文字列
 */
export function formatTime(
  dateString: string,
  locale: string = DATE_TIME_FORMAT.DEFAULT_LOCALE,
  includeSeconds: boolean = DATE_TIME_FORMAT.DEFAULT_INCLUDE_SECONDS
): string {
  if (!dateString || dateString.trim() === '') {
    return FORMAT_STRINGS.UNKNOWN;
  }

  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return FORMAT_STRINGS.UNKNOWN;
    }

    const formatOptions: Intl.DateTimeFormatOptions = {
      hour: DATE_TIME_FORMAT.TIME_FORMAT,
      minute: DATE_TIME_FORMAT.TIME_FORMAT,
    };

    if (includeSeconds) {
      formatOptions.second = DATE_TIME_FORMAT.TIME_FORMAT;
    }

    return date.toLocaleTimeString(locale, formatOptions);
  } catch {
    return '不明';
  }
}

/**
 * 数値をフォーマット（カンマ区切りなど）
 * @param value 数値
 * @param locale ロケール（デフォルト: 'ja-JP'）
 * @param options 数値フォーマットオプション
 * @returns フォーマットされた数値文字列
 */
export function formatNumber(
  value: number,
  locale: string = DATE_TIME_FORMAT.DEFAULT_LOCALE,
  options?: Intl.NumberFormatOptions
): string {
  if (value === null || value === undefined || isNaN(value)) {
    return FORMAT_STRINGS.ZERO;
  }

  try {
    return new Intl.NumberFormat(locale, options).format(value);
  } catch {
    return String(value);
  }
}

/**
 * バイト数を人間が読める形式にフォーマット
 * @param bytes バイト数
 * @param decimals 小数点以下の桁数（デフォルト: 2）
 * @returns フォーマットされた文字列（例: "1.5 MB"）
 */
export function formatBytes(bytes: number, decimals: number = FORMATTING.DECIMAL_PLACES): string {
  if (bytes === 0) return '0 Bytes';

  const k = FORMATTING.BYTES_PER_KB;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * レスポンス時間をフォーマット（ミリ秒 → 読みやすい形式）
 * @param ms ミリ秒
 * @returns フォーマットされた文字列
 */
export function formatResponseTime(ms: number | null): string {
  if (ms === null || ms === undefined || isNaN(ms)) {
    return '-';
  }

  if (ms < FORMATTING.MS_PER_SECOND) {
    return `${Math.round(ms)}ms`;
  }

  if (ms < FORMATTING.MS_PER_SECOND * 60) {
    return `${(ms / FORMATTING.MS_PER_SECOND).toFixed(FORMATTING.DECIMAL_PLACES)}s`;
  }

  const minutes = Math.floor(ms / (FORMATTING.MS_PER_SECOND * 60));
  const seconds = Math.floor((ms % (FORMATTING.MS_PER_SECOND * 60)) / FORMATTING.MS_PER_SECOND);
  return `${minutes}m ${seconds}s`;
}

/**
 * レスポンス時間をミリ秒単位でフォーマット（常にミリ秒表示）
 * @param ms ミリ秒
 * @returns フォーマットされた文字列（例: "250.50ms"）
 */
export function formatResponseTimeMs(ms: number): string {
  if (typeof ms !== 'number' || isNaN(ms) || !isFinite(ms) || ms < 0) {
    return '0.00ms';
  }
  return `${ms.toFixed(FORMATTING.DECIMAL_PLACES)}ms`;
}

/**
 * エラー率をパーセンテージ形式でフォーマット
 * @param rate エラー率（0-100の範囲、パーセンテージ）
 * @returns フォーマットされた文字列（例: "2.50%"）
 */
export function formatErrorRate(rate: number): string {
  if (typeof rate !== 'number' || isNaN(rate) || !isFinite(rate) || rate < 0) {
    return '0.00%';
  }
  const clampedValue = Math.max(0, Math.min(100, rate));
  return `${clampedValue.toFixed(FORMATTING.DECIMAL_PLACES)}%`;
}

/**
 * JSON文字列をフォーマット（読みやすく）
 * @param jsonString JSON文字列
 * @param indent インデント（デフォルト: 2）
 * @returns フォーマットされたJSON文字列
 */
export function formatJSON(jsonString: string | null, indent: number = 2): string {
  if (!jsonString) return '';

  try {
    const parsed = JSON.parse(jsonString);
    return JSON.stringify(parsed, null, indent);
  } catch {
    return jsonString;
  }
}

