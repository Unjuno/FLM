// FLM - Checkboxコンポーネント
// フロントエンドエージェント (FE) 実装
// FE-017-03: 統一フォームコンポーネント実装

import React, { forwardRef, useMemo } from 'react';
import './Checkbox.css';

/**
 * Checkboxコンポーネントのプロパティ
 */
export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'type'> {
  /** ラベル */
  label?: string;
  /** エラーメッセージ */
  error?: string;
  /** ヘルプテキスト */
  helpText?: string;
  /** サイズ */
  size?: 'small' | 'medium' | 'large';
  /** フル幅 */
  fullWidth?: boolean;
  /** 必須マーカー表示 */
  required?: boolean;
}

/**
 * Checkboxコンポーネント
 * 統一されたチェックボックスコンポーネント
 */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  (
    {
      label,
      error,
      helpText,
      size = 'medium',
      fullWidth = false,
      required,
      disabled,
      className = '',
      id,
      ...props
    },
    ref
  ) => {
    // IDの生成
    const checkboxId = useMemo(() => {
      return id || `checkbox-${Math.random().toString(36).substring(2, 9)}`;
    }, [id]);

    // エラーID
    const errorId = useMemo(() => `${checkboxId}-error`, [checkboxId]);

    // ヘルプID
    const helpId = useMemo(() => `${checkboxId}-help`, [checkboxId]);

    // className を安全に結合
    const checkboxClassName = useMemo(() => {
      const classes = ['form-checkbox', `form-checkbox-${size}`];
      if (error) {
        classes.push('form-checkbox-error');
      }
      if (disabled) {
        classes.push('form-checkbox-disabled');
      }
      if (className.trim()) {
        classes.push(className.trim());
      }
      return classes.join(' ');
    }, [size, error, disabled, className]);

    const wrapperClassName = useMemo(() => {
      const classes = ['form-checkbox-wrapper'];
      if (fullWidth) {
        classes.push('form-checkbox-wrapper-full-width');
      }
      return classes.join(' ');
    }, [fullWidth]);

    return (
      <div className={wrapperClassName}>
        <div className="form-checkbox-container">
          <input
            ref={ref}
            type="checkbox"
            id={checkboxId}
            className={checkboxClassName}
            disabled={disabled}
            {...(error && { 'aria-invalid': 'true' })}
            aria-describedby={error ? errorId : helpText ? helpId : undefined}
            {...(required && { 'aria-required': 'true' })}
            {...props}
          />
          {label && (
            <label htmlFor={checkboxId} className="form-checkbox-label">
              {label}
              {required && <span className="form-checkbox-required" aria-label="必須">*</span>}
            </label>
          )}
        </div>
        {error && (
          <div id={errorId} className="form-checkbox-error-message" role="alert">
            {error}
          </div>
        )}
        {!error && helpText && (
          <div id={helpId} className="form-checkbox-help-text">
            {helpText}
          </div>
        )}
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';

