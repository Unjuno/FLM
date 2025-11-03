// Textarea - 統一されたテキストエリアコンポーネント

import React, { forwardRef, useMemo } from 'react';
import './Textarea.css';

/**
 * Textareaコンポーネントのプロパティ
 */
export interface TextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'size'> {
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
  /** 必須マーカー表示 */
  required?: boolean;
  /** リサイズ可能 */
  resizable?: boolean;
}

/**
 * Textareaコンポーネント
 * 統一されたマルチライン入力コンポーネント
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      error,
      helpText,
      success,
      size = 'medium',
      fullWidth = false,
      required,
      resizable = true,
      disabled,
      readOnly,
      className = '',
      id,
      ...props
    },
    ref
  ) => {
    // IDの生成
    const textareaId = useMemo(() => {
      return id || `textarea-${Math.random().toString(36).substring(2, 9)}`;
    }, [id]);

    // エラーID
    const errorId = useMemo(() => `${textareaId}-error`, [textareaId]);

    // ヘルプID
    const helpId = useMemo(() => `${textareaId}-help`, [textareaId]);

    // className を安全に結合
    const textareaClassName = useMemo(() => {
      const classes = ['form-textarea', `form-textarea-${size}`];
      if (error) {
        classes.push('form-textarea-error');
      }
      if (success) {
        classes.push('form-textarea-success');
      }
      if (disabled) {
        classes.push('form-textarea-disabled');
      }
      if (readOnly) {
        classes.push('form-textarea-readonly');
      }
      if (!resizable) {
        classes.push('form-textarea-no-resize');
      }
      if (className.trim()) {
        classes.push(className.trim());
      }
      return classes.join(' ');
    }, [size, error, success, disabled, readOnly, resizable, className]);

    const wrapperClassName = useMemo(() => {
      const classes = ['form-textarea-wrapper'];
      if (fullWidth) {
        classes.push('form-textarea-wrapper-full-width');
      }
      return classes.join(' ');
    }, [fullWidth]);

    return (
      <div className={wrapperClassName}>
        {label && (
          <label htmlFor={textareaId} className="form-textarea-label">
            {label}
            {required && <span className="form-textarea-required" aria-label="必須">*</span>}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={textareaClassName}
          disabled={disabled}
          readOnly={readOnly}
            {...(error && { 'aria-invalid': 'true' })}
            aria-describedby={error ? errorId : helpText ? helpId : undefined}
            {...(required && { 'aria-required': 'true' })}
          {...props}
        />
        {error && (
          <div id={errorId} className="form-textarea-error-message" role="alert">
            {error}
          </div>
        )}
        {!error && helpText && (
          <div id={helpId} className="form-textarea-help-text">
            {helpText}
          </div>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

