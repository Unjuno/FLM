// useApiConfigValidation - API設定のバリデーションフック

import { useMemo } from 'react';
import type { ApiConfig } from '../types/api';
import { PORT_RANGE, API_NAME } from '../constants/config';

/**
 * バリデーションエラー
 */
export interface ValidationErrors {
  [key: string]: string;
}

/**
 * バリデーション結果
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationErrors;
}

/**
 * API設定のバリデーション結果を返すフック
 */
export function useApiConfigValidation(config: ApiConfig): ValidationResult {
  return useMemo(() => {
    const errors: ValidationErrors = {};

    // API名のバリデーション
    const trimmedName = config.name.trim();
    if (!trimmedName) {
      errors.name = 'API名を入力してください';
    } else if (trimmedName.length < API_NAME.MIN_LENGTH) {
      errors.name = `API名は${API_NAME.MIN_LENGTH}文字以上で入力してください`;
    } else if (trimmedName.length > API_NAME.MAX_LENGTH) {
      errors.name = `API名は${API_NAME.MAX_LENGTH}文字以下で入力してください`;
    }

    // ポート番号のバリデーション
    if (config.port < PORT_RANGE.MIN || config.port > PORT_RANGE.MAX) {
      errors.port = `ポート番号は${PORT_RANGE.MIN}-${PORT_RANGE.MAX}の範囲で入力してください`;
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  }, [config.name, config.port]);
}

