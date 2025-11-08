// formatters - フォーマッターユーティリティのユニットテスト

import { describe, it, expect } from '@jest/globals';
import {
  formatDateTime,
  formatDate,
  formatTime,
  formatNumber,
  formatBytes,
  formatResponseTime,
  formatResponseTimeMs,
  formatErrorRate,
  formatJSON,
  DateTimeFormatOptions,
} from '../../src/utils/formatters';

describe('formatters.ts', () => {
  const testDate = '2024-01-15T10:30:45.123Z';

  describe('formatDateTime関数', () => {
    it('日時をフォーマットする', () => {
      const result = formatDateTime(testDate);

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('空文字列を「不明」に変換する', () => {
      const result = formatDateTime('');

      expect(result).toBe('不明');
    });

    it('無効な日時文字列をそのまま返す', () => {
      const result = formatDateTime('invalid-date');

      expect(result).toBe('invalid-date');
    });

    it('年を含める/含めないオプションを設定できる', () => {
      const withYear = formatDateTime(testDate, { includeYear: true });
      const withoutYear = formatDateTime(testDate, { includeYear: false });

      expect(withYear).toBeDefined();
      expect(withoutYear).toBeDefined();
      // 年を含む場合と含まない場合で異なる結果になることを確認
      expect(withYear).not.toBe(withoutYear);
    });

    it('時刻を含める/含めないオプションを設定できる', () => {
      const withTime = formatDateTime(testDate, { includeTime: true });
      const withoutTime = formatDateTime(testDate, { includeTime: false });

      expect(withTime).toBeDefined();
      expect(withoutTime).toBeDefined();
    });

    it('秒を含める/含めないオプションを設定できる', () => {
      const withSeconds = formatDateTime(testDate, { includeSeconds: true });
      const withoutSeconds = formatDateTime(testDate, {
        includeSeconds: false,
      });

      expect(withSeconds).toBeDefined();
      expect(withoutSeconds).toBeDefined();
    });

    it('カスタムロケールを指定できる', () => {
      const result = formatDateTime(testDate, { locale: 'en-US' });

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('formatDate関数', () => {
    it('日付のみをフォーマットする', () => {
      const result = formatDate(testDate);

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('空文字列を「不明」に変換する', () => {
      const result = formatDate('');

      expect(result).toBe('不明');
    });

    it('無効な日付を「不明」に変換する', () => {
      const result = formatDate('invalid-date');

      expect(result).toBe('不明');
    });

    it('カスタムロケールを指定できる', () => {
      const result = formatDate(testDate, 'en-US');

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('formatTime関数', () => {
    it('時刻のみをフォーマットする', () => {
      const result = formatTime(testDate);

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('空文字列を「不明」に変換する', () => {
      const result = formatTime('');

      expect(result).toBe('不明');
    });

    it('無効な時刻を「不明」に変換する', () => {
      const result = formatTime('invalid-time');

      expect(result).toBe('不明');
    });

    it('秒を含める/含めないオプションを設定できる', () => {
      const withSeconds = formatTime(testDate, 'ja-JP', true);
      const withoutSeconds = formatTime(testDate, 'ja-JP', false);

      expect(withSeconds).toBeDefined();
      expect(withoutSeconds).toBeDefined();
    });
  });

  describe('formatNumber関数', () => {
    it('数値をフォーマットする', () => {
      const result = formatNumber(1234567.89);

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('カスタムロケールを指定できる', () => {
      const result = formatNumber(1234567.89, 'en-US');

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('数値フォーマットオプションを指定できる', () => {
      const result = formatNumber(1234.56, 'ja-JP', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('nullを「0」に変換する', () => {
      const result = formatNumber(null as unknown as number);

      expect(result).toBe('0');
    });

    it('undefinedを「0」に変換する', () => {
      const result = formatNumber(undefined as unknown as number);

      expect(result).toBe('0');
    });

    it('NaNを「0」に変換する', () => {
      const result = formatNumber(NaN);

      expect(result).toBe('0');
    });
  });

  describe('formatBytes関数', () => {
    it('バイト数をフォーマットする', () => {
      const result = formatBytes(1024);

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result).toContain('KB');
    });

    it('0バイトを「0 Bytes」として表示する', () => {
      const result = formatBytes(0);

      expect(result).toBe('0 Bytes');
    });

    it('KB単位でフォーマットする', () => {
      const result = formatBytes(2048);

      expect(result).toContain('KB');
    });

    it('MB単位でフォーマットする', () => {
      const result = formatBytes(1048576);

      expect(result).toContain('MB');
    });

    it('GB単位でフォーマットする', () => {
      const result = formatBytes(1073741824);

      expect(result).toContain('GB');
    });

    it('カスタム小数点以下桁数を指定できる', () => {
      const result = formatBytes(1024, 3);

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('formatResponseTime関数', () => {
    it('ミリ秒をフォーマットする', () => {
      const result = formatResponseTime(500);

      expect(result).toBe('500ms');
    });

    it('秒をフォーマットする', () => {
      const result = formatResponseTime(2500);

      expect(result).toContain('s');
    });

    it('分と秒をフォーマットする', () => {
      const result = formatResponseTime(125000);

      expect(result).toContain('m');
      expect(result).toContain('s');
    });

    it('nullを「-」として表示する', () => {
      const result = formatResponseTime(null);

      expect(result).toBe('-');
    });

    it('undefinedを「-」として表示する', () => {
      const result = formatResponseTime(undefined as unknown as number);

      expect(result).toBe('-');
    });

    it('NaNを「-」として表示する', () => {
      const result = formatResponseTime(NaN);

      expect(result).toBe('-');
    });
  });

  describe('formatResponseTimeMs関数', () => {
    it('ミリ秒を常にミリ秒単位でフォーマットする', () => {
      const result = formatResponseTimeMs(500);

      expect(result).toBe('500.00ms');
    });

    it('小数を含むミリ秒をフォーマットする', () => {
      const result = formatResponseTimeMs(123.456);

      expect(result).toBe('123.46ms');
    });

    it('無効な値を「0.00ms」として表示する', () => {
      const result1 = formatResponseTimeMs(NaN);
      const result2 = formatResponseTimeMs(Infinity);
      const result3 = formatResponseTimeMs(-1);

      expect(result1).toBe('0.00ms');
      expect(result2).toBe('0.00ms');
      expect(result3).toBe('0.00ms');
    });
  });

  describe('formatErrorRate関数', () => {
    it('エラー率をパーセンテージ形式でフォーマットする', () => {
      const result = formatErrorRate(5.5);

      expect(result).toBe('5.50%');
    });

    it('0%を正しくフォーマットする', () => {
      const result = formatErrorRate(0);

      expect(result).toBe('0.00%');
    });

    it('100%を正しくフォーマットする', () => {
      const result = formatErrorRate(100);

      expect(result).toBe('100.00%');
    });

    it('100%を超える値を100%にクランプする', () => {
      const result = formatErrorRate(150);

      expect(result).toBe('100.00%');
    });

    it('負の値を0%にクランプする', () => {
      const result = formatErrorRate(-10);

      expect(result).toBe('0.00%');
    });

    it('無効な値を「0.00%」として表示する', () => {
      const result1 = formatErrorRate(NaN);
      const result2 = formatErrorRate(Infinity);
      const result3 = formatErrorRate(-Infinity);

      expect(result1).toBe('0.00%');
      expect(result2).toBe('0.00%');
      expect(result3).toBe('0.00%');
    });
  });

  describe('formatJSON関数', () => {
    it('JSON文字列をフォーマットする', () => {
      const jsonString = '{"name":"test","value":123}';
      const result = formatJSON(jsonString);

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      // フォーマットされたJSONには改行が含まれる
      expect(result).toContain('\n');
    });

    it('カスタムインデントを指定できる', () => {
      const jsonString = '{"name":"test"}';
      const result = formatJSON(jsonString, 4);

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('無効なJSON文字列をそのまま返す', () => {
      const invalidJson = 'invalid json';
      const result = formatJSON(invalidJson);

      expect(result).toBe(invalidJson);
    });

    it('nullを空文字列として返す', () => {
      const result = formatJSON(null);

      expect(result).toBe('');
    });

    it('空文字列をそのまま返す', () => {
      const result = formatJSON('');

      expect(result).toBe('');
    });
  });
});
