// validation - バリデーションユーティリティのユニットテスト

import { describe, it, expect } from '@jest/globals';
import {
  validate,
  ValidationRuleBuilder,
  validateEmail,
  validateUrl,
  validateNumber,
  validateInteger,
  validatePositive,
  validatePasswordStrength,
  validateDate,
  combineValidationResults,
  ValidationResult,
} from '../../src/utils/validation';

describe('validation.ts', () => {
  describe('ValidationRuleBuilder', () => {
    describe('required', () => {
      it('必須チェックを追加する', async () => {
        const validator = validate<string>().required().build();

        const result1 = await validator('');
        expect(result1.isValid).toBe(false);
        expect(result1.error).toContain('必須');

        const result2 = await validator('value');
        expect(result2.isValid).toBe(true);
      });

      it('カスタムメッセージを指定できる', async () => {
        const validator = validate<string>()
          .required('カスタム必須メッセージ')
          .build();

        const result = await validator('');
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('カスタム必須メッセージ');
      });

      it('nullを無効と判定する', async () => {
        const validator = validate<string>().required().build();

        const result = await validator(null as unknown as string);
        expect(result.isValid).toBe(false);
      });

      it('undefinedを無効と判定する', async () => {
        const validator = validate<string>().required().build();

        const result = await validator(undefined as unknown as string);
        expect(result.isValid).toBe(false);
      });

      it('空白文字のみを無効と判定する', async () => {
        const validator = validate<string>().required().build();

        const result = await validator('   ');
        expect(result.isValid).toBe(false);
      });
    });

    describe('minLength', () => {
      it('最小長チェックを追加する', async () => {
        const validator = validate<string>().minLength(5).build();

        const result1 = await validator('1234');
        expect(result1.isValid).toBe(false);
        expect(result1.error).toContain('5文字');

        const result2 = await validator('12345');
        expect(result2.isValid).toBe(true);
      });

      it('カスタムメッセージを指定できる', async () => {
        const validator = validate<string>()
          .minLength(5, 'カスタム最小長メッセージ')
          .build();

        const result = await validator('1234');
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('カスタム最小長メッセージ');
      });
    });

    describe('maxLength', () => {
      it('最大長チェックを追加する', async () => {
        const validator = validate<string>().maxLength(5).build();

        const result1 = await validator('123456');
        expect(result1.isValid).toBe(false);
        expect(result1.error).toContain('5文字以下');

        const result2 = await validator('12345');
        expect(result2.isValid).toBe(true);
      });

      it('カスタムメッセージを指定できる', async () => {
        const validator = validate<string>()
          .maxLength(5, 'カスタム最大長メッセージ')
          .build();

        const result = await validator('123456');
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('カスタム最大長メッセージ');
      });
    });

    describe('min', () => {
      it('最小値チェックを追加する', async () => {
        const validator = validate<number>().min(10).build();

        const result1 = await validator(5);
        expect(result1.isValid).toBe(false);
        expect(result1.error).toContain('10');

        const result2 = await validator(10);
        expect(result2.isValid).toBe(true);

        const result3 = await validator(15);
        expect(result3.isValid).toBe(true);
      });

      it('文字列の数値を正しく処理する', async () => {
        const validator = validate<string>().min(10).build();

        const result1 = await validator('5');
        expect(result1.isValid).toBe(false);

        const result2 = await validator('15');
        expect(result2.isValid).toBe(true);
      });
    });

    describe('max', () => {
      it('最大値チェックを追加する', async () => {
        const validator = validate<number>().max(10).build();

        const result1 = await validator(15);
        expect(result1.isValid).toBe(false);
        expect(result1.error).toContain('10');

        const result2 = await validator(10);
        expect(result2.isValid).toBe(true);

        const result3 = await validator(5);
        expect(result3.isValid).toBe(true);
      });
    });

    describe('pattern', () => {
      it('正規表現チェックを追加する', async () => {
        const validator = validate<string>()
          .pattern(/^[A-Z]+$/)
          .build();

        const result1 = await validator('ABC');
        expect(result1.isValid).toBe(true);

        const result2 = await validator('abc');
        expect(result2.isValid).toBe(false);
      });

      it('カスタムメッセージを指定できる', async () => {
        const validator = validate<string>()
          .pattern(/^[A-Z]+$/, 'カスタムパターンメッセージ')
          .build();

        const result = await validator('abc');
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('カスタムパターンメッセージ');
      });
    });

    describe('custom', () => {
      it('カスタムルールを追加する', async () => {
        const customRule = async (value: string): Promise<ValidationResult> => {
          if (value === 'special') {
            return { isValid: true };
          }
          return { isValid: false, error: 'カスタムエラー' };
        };

        const validator = validate<string>().custom(customRule).build();

        const result1 = await validator('special');
        expect(result1.isValid).toBe(true);

        const result2 = await validator('other');
        expect(result2.isValid).toBe(false);
        expect(result2.error).toBe('カスタムエラー');
      });

      it('カスタムメッセージを指定できる', async () => {
        const customRule = async (value: string): Promise<ValidationResult> => {
          return { isValid: false };
        };

        const validator = validate<string>()
          .custom(customRule, 'カスタムメッセージ')
          .build();

        const result = await validator('test');
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('カスタムメッセージ');
      });
    });

    describe('複数ルールの組み合わせ', () => {
      it('複数のルールを組み合わせる', async () => {
        const validator = validate<string>()
          .required()
          .minLength(5)
          .maxLength(10)
          .build();

        const result1 = await validator('');
        expect(result1.isValid).toBe(false); // requiredエラー

        const result2 = await validator('1234');
        expect(result2.isValid).toBe(false); // minLengthエラー

        const result3 = await validator('12345678901');
        expect(result3.isValid).toBe(false); // maxLengthエラー

        const result4 = await validator('12345');
        expect(result4.isValid).toBe(true);
      });

      it('最初のエラーを返す', async () => {
        const validator = validate<string>()
          .required()
          .minLength(5)
          .maxLength(10)
          .build();

        const result = await validator('1234');
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('5文字'); // minLengthのエラー
      });
    });
  });

  describe('validateEmail関数', () => {
    it('有効なメールアドレスを検証する', () => {
      const result = validateEmail('test@example.com');
      expect(result.isValid).toBe(true);
    });

    it('無効なメールアドレスを検証する', () => {
      const result1 = validateEmail('invalid');
      expect(result1.isValid).toBe(false);

      const result2 = validateEmail('test@');
      expect(result2.isValid).toBe(false);

      const result3 = validateEmail('@example.com');
      expect(result3.isValid).toBe(false);
    });

    it('空文字列を無効と判定する', () => {
      const result = validateEmail('');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('メールアドレス');
    });

    it('空白文字のみを無効と判定する', () => {
      const result = validateEmail('   ');
      expect(result.isValid).toBe(false);
    });
  });

  describe('validateUrl関数', () => {
    it('有効なURLを検証する', () => {
      const result1 = validateUrl('https://example.com');
      expect(result1.isValid).toBe(true);

      const result2 = validateUrl('http://example.com');
      expect(result2.isValid).toBe(true);

      const result3 = validateUrl('https://example.com/path?query=value');
      expect(result3.isValid).toBe(true);
    });

    it('無効なURLを検証する', () => {
      const result = validateUrl('not-a-url');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('URL形式');
    });

    it('空文字列を無効と判定する', () => {
      const result = validateUrl('');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('URL');
    });
  });

  describe('validateNumber関数', () => {
    it('有効な数値を検証する', () => {
      const result1 = validateNumber(123);
      expect(result1.isValid).toBe(true);

      const result2 = validateNumber('123');
      expect(result2.isValid).toBe(true);

      const result3 = validateNumber(123.45);
      expect(result3.isValid).toBe(true);
    });

    it('無効な数値を検証する', () => {
      const result1 = validateNumber('not-a-number');
      expect(result1.isValid).toBe(false);

      const result2 = validateNumber('abc');
      expect(result2.isValid).toBe(false);
    });

    it('nullを無効と判定する', () => {
      const result = validateNumber(null as unknown as string | number);
      expect(result.isValid).toBe(false);
    });

    it('undefinedを無効と判定する', () => {
      const result = validateNumber(undefined as unknown as string | number);
      expect(result.isValid).toBe(false);
    });

    it('空文字列を無効と判定する', () => {
      const result = validateNumber('');
      expect(result.isValid).toBe(false);
    });
  });

  describe('validateInteger関数', () => {
    it('有効な整数を検証する', () => {
      const result1 = validateInteger(123);
      expect(result1.isValid).toBe(true);

      const result2 = validateInteger('123');
      expect(result2.isValid).toBe(true);
    });

    it('小数を無効と判定する', () => {
      const result1 = validateInteger(123.45);
      expect(result1.isValid).toBe(false);
      expect(result1.error).toContain('整数');

      const result2 = validateInteger('123.45');
      expect(result2.isValid).toBe(false);
    });

    it('無効な数値を無効と判定する', () => {
      const result = validateInteger('not-a-number');
      expect(result.isValid).toBe(false);
    });
  });

  describe('validatePositive関数', () => {
    it('正の数を検証する', () => {
      const result1 = validatePositive(123);
      expect(result1.isValid).toBe(true);

      const result2 = validatePositive('123');
      expect(result2.isValid).toBe(true);
    });

    it('0を無効と判定する', () => {
      const result = validatePositive(0);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('正の数');
    });

    it('負の数を無効と判定する', () => {
      const result = validatePositive(-10);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('正の数');
    });
  });

  describe('validatePasswordStrength関数', () => {
    it('強力なパスワードを検証する', () => {
      const result = validatePasswordStrength('Password123');
      expect(result.isValid).toBe(true);
    });

    it('8文字未満のパスワードを無効と判定する', () => {
      const result = validatePasswordStrength('Pass123');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('8文字以上');
    });

    it('大文字を含まないパスワードを無効と判定する', () => {
      const result = validatePasswordStrength('password123');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('大文字');
    });

    it('小文字を含まないパスワードを無効と判定する', () => {
      const result = validatePasswordStrength('PASSWORD123');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('小文字');
    });

    it('数字を含まないパスワードを無効と判定する', () => {
      const result = validatePasswordStrength('Password');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('数字');
    });
  });

  describe('validateDate関数', () => {
    it('有効な日付文字列を検証する', () => {
      const result1 = validateDate('2024-01-15');
      expect(result1.isValid).toBe(true);

      const result2 = validateDate('2024-01-15T10:30:00Z');
      expect(result2.isValid).toBe(true);

      const result3 = validateDate(new Date());
      expect(result3.isValid).toBe(true);
    });

    it('無効な日付を検証する', () => {
      const result = validateDate('invalid-date');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('日付形式');
    });

    it('nullを無効と判定する', () => {
      const result = validateDate(null as unknown as string | Date);
      expect(result.isValid).toBe(false);
    });
  });

  describe('combineValidationResults関数', () => {
    it('すべて有効な結果をまとめる', () => {
      const results: ValidationResult[] = [
        { isValid: true },
        { isValid: true },
        { isValid: true },
      ];

      const combined = combineValidationResults(results);
      expect(combined.isValid).toBe(true);
      expect(combined.error).toBeUndefined();
    });

    it('エラーがある結果をまとめる', () => {
      const results: ValidationResult[] = [
        { isValid: true },
        { isValid: false, error: 'エラー1' },
        { isValid: false, error: 'エラー2' },
      ];

      const combined = combineValidationResults(results);
      expect(combined.isValid).toBe(false);
      expect(combined.error).toBe('エラー1 エラー2');
    });

    it('エラーメッセージがない結果を除外する', () => {
      const results: ValidationResult[] = [
        { isValid: false },
        { isValid: false, error: 'エラー1' },
      ];

      const combined = combineValidationResults(results);
      expect(combined.isValid).toBe(false);
      expect(combined.error).toBe('エラー1');
    });

    it('空の配列を処理する', () => {
      const combined = combineValidationResults([]);
      expect(combined.isValid).toBe(true);
    });
  });
});
