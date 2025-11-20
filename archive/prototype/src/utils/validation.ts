// validation - フォームバリデーションシステム

/**
 * 翻訳関数の型定義
 */
type TranslateFunction = (
  key: string,
  params?: Record<string, string | number>
) => string;

/**
 * グローバルな翻訳関数（デフォルトは日本語）
 */
let globalTranslate: TranslateFunction | null = null;

/**
 * 翻訳関数を設定
 */
export function setValidationTranslateFunction(
  translate: TranslateFunction
): void {
  globalTranslate = translate;
}

/**
 * 翻訳関数を取得（設定されていない場合はデフォルトの日本語メッセージを返す）
 */
function t(key: string, params?: Record<string, string | number>): string {
  if (globalTranslate) {
    return globalTranslate(key, params);
  }
  // デフォルトの日本語メッセージ（フォールバック）
  return getDefaultMessage(key, params);
}

/**
 * デフォルトの日本語メッセージを取得
 */
function getDefaultMessage(
  key: string,
  params?: Record<string, string | number>
): string {
  const messages: Record<string, string> = {
    'errors.validation.required': 'この項目は必須です。',
    'errors.validation.minLength': `最低${params?.min || 0}文字以上入力してください。`,
    'errors.validation.maxLength': `${params?.max || 0}文字以下で入力してください。`,
    'errors.validation.min': `最小値は${params?.min || 0}です。`,
    'errors.validation.max': `最大値は${params?.max || 0}です。`,
    'errors.validation.pattern': '正しい形式で入力してください。',
    'errors.validation.emailRequired': 'メールアドレスを入力してください。',
    'errors.validation.emailInvalid':
      '正しいメールアドレス形式で入力してください。',
    'errors.validation.urlRequired': 'URLを入力してください。',
    'errors.validation.urlInvalid': '正しいURL形式で入力してください。',
    'errors.validation.numberRequired': '数値を入力してください。',
    'errors.validation.integerRequired': '整数を入力してください。',
    'errors.validation.positiveRequired': '正の数を入力してください。',
    'errors.validation.passwordMinLength':
      'パスワードは8文字以上である必要があります。',
    'errors.validation.passwordUppercase':
      'パスワードには大文字が含まれている必要があります。',
    'errors.validation.passwordLowercase':
      'パスワードには小文字が含まれている必要があります。',
    'errors.validation.passwordNumber':
      'パスワードには数字が含まれている必要があります。',
    'errors.validation.dateRequired': '日付を入力してください。',
    'errors.validation.dateInvalid': '正しい日付形式で入力してください。',
  };

  let message = messages[key] || key;
  if (params) {
    Object.entries(params).forEach(([paramKey, paramValue]) => {
      message = message.replace(`{{${paramKey}}}`, String(paramValue));
    });
  }
  return message;
}

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
export type ValidationRule<T = unknown> = (
  value: T
) => ValidationResult | Promise<ValidationResult>;

/**
 * 複数のバリデーションルールをチェックする関数
 */
export type Validator<T = unknown> = (
  value: T
) => ValidationResult | Promise<ValidationResult>;

/**
 * バリデーションルールビルダー
 */
export class ValidationRuleBuilder<T = unknown> {
  private rules: ValidationRule<T>[] = [];

  /**
   * 必須チェックを追加
   */
  required(message?: string): this {
    this.rules.push(value => {
      if (value === null || value === undefined || value === '') {
        return {
          isValid: false,
          error: message || t('errors.validation.required'),
        };
      }
      if (typeof value === 'string' && value.trim() === '') {
        return {
          isValid: false,
          error: message || t('errors.validation.required'),
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
    this.rules.push(value => {
      if (typeof value === 'string' && value.length < min) {
        return {
          isValid: false,
          error: message || t('errors.validation.minLength', { min }),
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
    this.rules.push(value => {
      if (typeof value === 'string' && value.length > max) {
        return {
          isValid: false,
          error: message || t('errors.validation.maxLength', { max }),
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
    this.rules.push(value => {
      const num = typeof value === 'number' ? value : Number(value);
      if (!isNaN(num) && num < min) {
        return {
          isValid: false,
          error: message || t('errors.validation.min', { min }),
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
    this.rules.push(value => {
      const num = typeof value === 'number' ? value : Number(value);
      if (!isNaN(num) && num > max) {
        return {
          isValid: false,
          error: message || t('errors.validation.max', { max }),
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
    this.rules.push(value => {
      if (typeof value === 'string' && !regex.test(value)) {
        return {
          isValid: false,
          error: message || t('errors.validation.pattern'),
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
    this.rules.push(async value => {
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
    return { isValid: false, error: t('errors.validation.emailRequired') };
  }
  if (!emailRegex.test(value)) {
    return {
      isValid: false,
      error: t('errors.validation.emailInvalid'),
    };
  }
  return { isValid: true };
};

/**
 * URLのバリデーション
 */
export const validateUrl = (value: string): ValidationResult => {
  if (!value || value.trim() === '') {
    return { isValid: false, error: t('errors.validation.urlRequired') };
  }
  try {
    new URL(value);
    return { isValid: true };
  } catch {
    return { isValid: false, error: t('errors.validation.urlInvalid') };
  }
};

/**
 * 数値のバリデーション
 */
export const validateNumber = (value: string | number): ValidationResult => {
  if (value === null || value === undefined || value === '') {
    return { isValid: false, error: t('errors.validation.numberRequired') };
  }
  const num = typeof value === 'number' ? value : Number(value);
  if (isNaN(num)) {
    return { isValid: false, error: t('errors.validation.numberRequired') };
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
    return { isValid: false, error: t('errors.validation.integerRequired') };
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
    return { isValid: false, error: t('errors.validation.positiveRequired') };
  }
  return { isValid: true };
};

/**
 * パスワードの強度チェック
 */
export const validatePasswordStrength = (value: string): ValidationResult => {
  if (!value || value.length < 8) {
    return {
      isValid: false,
      error: t('errors.validation.passwordMinLength'),
    };
  }
  if (!/[A-Z]/.test(value)) {
    return {
      isValid: false,
      error: t('errors.validation.passwordUppercase'),
    };
  }
  if (!/[a-z]/.test(value)) {
    return {
      isValid: false,
      error: t('errors.validation.passwordLowercase'),
    };
  }
  if (!/[0-9]/.test(value)) {
    return {
      isValid: false,
      error: t('errors.validation.passwordNumber'),
    };
  }
  return { isValid: true };
};

/**
 * 日付のバリデーション
 */
export const validateDate = (value: string | Date): ValidationResult => {
  if (!value) {
    return { isValid: false, error: t('errors.validation.dateRequired') };
  }
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) {
    return { isValid: false, error: t('errors.validation.dateInvalid') };
  }
  return { isValid: true };
};

/**
 * 複数のバリデーション結果をまとめる
 */
export const combineValidationResults = (
  results: ValidationResult[]
): ValidationResult => {
  const errors = results
    .filter(r => !r.isValid)
    .map(r => r.error)
    .filter((e): e is string => !!e);
  if (errors.length > 0) {
    return {
      isValid: false,
      error: errors.join(' '),
    };
  }
  return { isValid: true };
};
