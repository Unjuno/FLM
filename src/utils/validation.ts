// FLM - バリデーションユーティリティ
// フロントエンドエージェント (FE) 実装
// FE-017-04: フォームバリデーションシステム実装

/**
 * バリデーション結果の型定義
 */
export interface ValidationResult {
  /** バリデーションが成功したか */
  isValid: boolean;
  /** エラーメッセージ */
  error?: string;
}

/**
 * バリデーションルールの型定義
 */
export type ValidationRule<T = unknown> = (value: T) => ValidationResult | Promise<ValidationResult>;

/**
 * 複数のバリデーションルールをチェックする関数
 */
export type Validator<T = unknown> = (value: T) => ValidationResult | Promise<ValidationResult>;

/**
 * バリデーションルールビルダー
 */
export class ValidationRuleBuilder<T = unknown> {
  private rules: ValidationRule<T>[] = [];

  /**
   * 必須チェックを追加
   */
  required(message?: string): this {
    this.rules.push((value) => {
      if (value === null || value === undefined || value === '') {
        return {
          isValid: false,
          error: message || 'この項目は必須です。',
        };
      }
      if (typeof value === 'string' && value.trim() === '') {
        return {
          isValid: false,
          error: message || 'この項目は必須です。',
        };
      }
      return { isValid: true };
    });
    return this;
  }

  /**
   * 最小長チェックを追加
   */
  minLength(min: number, message?: string): this {
    this.rules.push((value) => {
      if (typeof value === 'string' && value.length < min) {
        return {
          isValid: false,
          error: message || `最低${min}文字以上入力してください。`,
        };
      }
      return { isValid: true };
    });
    return this;
  }

  /**
   * 最大長チェックを追加
   */
  maxLength(max: number, message?: string): this {
    this.rules.push((value) => {
      if (typeof value === 'string' && value.length > max) {
        return {
          isValid: false,
          error: message || `${max}文字以下で入力してください。`,
        };
      }
      return { isValid: true };
    });
    return this;
  }

  /**
   * 最小値チェックを追加
   */
  min(min: number, message?: string): this {
    this.rules.push((value) => {
      const num = typeof value === 'number' ? value : Number(value);
      if (!isNaN(num) && num < min) {
        return {
          isValid: false,
          error: message || `最小値は${min}です。`,
        };
      }
      return { isValid: true };
    });
    return this;
  }

  /**
   * 最大値チェックを追加
   */
  max(max: number, message?: string): this {
    this.rules.push((value) => {
      const num = typeof value === 'number' ? value : Number(value);
      if (!isNaN(num) && num > max) {
        return {
          isValid: false,
          error: message || `最大値は${max}です。`,
        };
      }
      return { isValid: true };
    });
    return this;
  }

  /**
   * 正規表現チェックを追加
   */
  pattern(regex: RegExp, message?: string): this {
    this.rules.push((value) => {
      if (typeof value === 'string' && !regex.test(value)) {
        return {
          isValid: false,
          error: message || '正しい形式で入力してください。',
        };
      }
      return { isValid: true };
    });
    return this;
  }

  /**
   * カスタムルールを追加
   */
  custom(rule: ValidationRule<T>, message?: string): this {
    this.rules.push(async (value) => {
      const result = await rule(value);
      if (!result.isValid && message) {
        return {
          isValid: false,
          error: message,
        };
      }
      return result;
    });
    return this;
  }

  /**
   * バリデーション関数を構築
   */
  build(): Validator<T> {
    return async (value: T): Promise<ValidationResult> => {
      for (const rule of this.rules) {
        const result = await rule(value);
        if (!result.isValid) {
          return result;
        }
      }
      return { isValid: true };
    };
  }
}

/**
 * バリデーションルールビルダーを作成
 */
export function validate<T = unknown>(): ValidationRuleBuilder<T> {
  return new ValidationRuleBuilder<T>();
}

/**
 * よく使われるバリデーション関数
 */

/**
 * メールアドレスのバリデーション
 */
export const validateEmail = (value: string): ValidationResult => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!value || value.trim() === '') {
    return { isValid: false, error: 'メールアドレスを入力してください。' };
  }
  if (!emailRegex.test(value)) {
    return { isValid: false, error: '正しいメールアドレス形式で入力してください。' };
  }
  return { isValid: true };
};

/**
 * URLのバリデーション
 */
export const validateUrl = (value: string): ValidationResult => {
  if (!value || value.trim() === '') {
    return { isValid: false, error: 'URLを入力してください。' };
  }
  try {
    new URL(value);
    return { isValid: true };
  } catch {
    return { isValid: false, error: '正しいURL形式で入力してください。' };
  }
};

/**
 * 数値のバリデーション
 */
export const validateNumber = (value: string | number): ValidationResult => {
  if (value === null || value === undefined || value === '') {
    return { isValid: false, error: '数値を入力してください。' };
  }
  const num = typeof value === 'number' ? value : Number(value);
  if (isNaN(num)) {
    return { isValid: false, error: '数値を入力してください。' };
  }
  return { isValid: true };
};

/**
 * 整数のバリデーション
 */
export const validateInteger = (value: string | number): ValidationResult => {
  const numResult = validateNumber(value);
  if (!numResult.isValid) {
    return numResult;
  }
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(num)) {
    return { isValid: false, error: '整数を入力してください。' };
  }
  return { isValid: true };
};

/**
 * 正の数のバリデーション
 */
export const validatePositive = (value: string | number): ValidationResult => {
  const numResult = validateNumber(value);
  if (!numResult.isValid) {
    return numResult;
  }
  const num = typeof value === 'number' ? value : Number(value);
  if (num <= 0) {
    return { isValid: false, error: '正の数を入力してください。' };
  }
  return { isValid: true };
};

/**
 * パスワードの強度チェック
 */
export const validatePasswordStrength = (value: string): ValidationResult => {
  if (!value || value.length < 8) {
    return { isValid: false, error: 'パスワードは8文字以上である必要があります。' };
  }
  if (!/[A-Z]/.test(value)) {
    return { isValid: false, error: 'パスワードには大文字が含まれている必要があります。' };
  }
  if (!/[a-z]/.test(value)) {
    return { isValid: false, error: 'パスワードには小文字が含まれている必要があります。' };
  }
  if (!/[0-9]/.test(value)) {
    return { isValid: false, error: 'パスワードには数字が含まれている必要があります。' };
  }
  return { isValid: true };
};

/**
 * 日付のバリデーション
 */
export const validateDate = (value: string | Date): ValidationResult => {
  if (!value) {
    return { isValid: false, error: '日付を入力してください。' };
  }
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) {
    return { isValid: false, error: '正しい日付形式で入力してください。' };
  }
  return { isValid: true };
};

/**
 * 複数のバリデーション結果をまとめる
 */
export const combineValidationResults = (
  results: ValidationResult[]
): ValidationResult => {
  const errors = results.filter((r) => !r.isValid).map((r) => r.error).filter((e): e is string => !!e);
  if (errors.length > 0) {
    return {
      isValid: false,
      error: errors.join(' '),
    };
  }
  return { isValid: true };
};

