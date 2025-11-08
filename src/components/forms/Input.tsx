// Input - 統一された入力フィールドコンポーネント

import React, { forwardRef, useMemo } from 'react';
import './Input.css';

/**
 * Inputコンポーネントのプロパティ
 */
export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** ラベル */
  label?: string;
  /** エラーメッセージ */
  error?: string;
  /** ヘルプテキスト */
  helpText?: string;
  /** 成功状態 */
  success?: boolean;
  /** サイズ */
  size?: 'small' | 'medium' | 'large';
  /** フル幅 */
  fullWidth?: boolean;
  /** 左側のアイコン */
  leftIcon?: React.ReactNode;
  /** 右側のアイコン */
  rightIcon?: React.ReactNode;
  /** 必須マーカー表示 */
  required?: boolean;
}

/**
 * Inputコンポーネント
 * 統一されたテキスト入力コンポーネント
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helpText,
      success,
      size = 'medium',
      fullWidth = false,
      leftIcon,
      rightIcon,
      required,
      disabled,
      readOnly,
      className = '',
      id,
      ...props
    },
    ref
  ) => {
    // IDの生成
    const inputId = useMemo(() => {
      return id || `input-${Math.random().toString(36).substring(2, 9)}`;
    }, [id]);

    // エラーID
    const errorId = useMemo(() => `${inputId}-error`, [inputId]);

    // ヘルプID
    const helpId = useMemo(() => `${inputId}-help`, [inputId]);

    // className を安全に結合
    const inputClassName = useMemo(() => {
      const classes = ['form-input', `form-input-${size}`];
      if (error) {
        classes.push('form-input-error');
      }
      if (success) {
        classes.push('form-input-success');
      }
      if (disabled) {
        classes.push('form-input-disabled');
      }
      if (readOnly) {
        classes.push('form-input-readonly');
      }
      if (leftIcon) {
        classes.push('form-input-has-left-icon');
      }
      if (rightIcon) {
        classes.push('form-input-has-right-icon');
      }
      if (className.trim()) {
        classes.push(className.trim());
      }
      return classes.join(' ');
    }, [
      size,
      error,
      success,
      disabled,
      readOnly,
      leftIcon,
      rightIcon,
      className,
    ]);

    const wrapperClassName = useMemo(() => {
      const classes = ['form-input-wrapper'];
      if (fullWidth) {
        classes.push('form-input-wrapper-full-width');
      }
      return classes.join(' ');
    }, [fullWidth]);

    return (
      <div className={wrapperClassName}>
        {label && (
          <label htmlFor={inputId} className="form-input-label">
            {label}
            {required && (
              <span className="form-input-required" aria-label="必須">
                *
              </span>
            )}
          </label>
        )}
        <div className="form-input-container">
          {leftIcon && (
            <span className="form-input-icon form-input-icon-left">
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={inputClassName}
            disabled={disabled}
            readOnly={readOnly}
            {...(error && { 'aria-invalid': 'true' })}
            aria-describedby={error ? errorId : helpText ? helpId : undefined}
            {...(required && { 'aria-required': 'true' })}
            {...props}
          />
          {rightIcon && (
            <span className="form-input-icon form-input-icon-right">
              {rightIcon}
            </span>
          )}
        </div>
        {error && (
          <div id={errorId} className="form-input-error-message" role="alert">
            {error}
          </div>
        )}
        {!error && helpText && (
          <div id={helpId} className="form-input-help-text">
            {helpText}
          </div>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
