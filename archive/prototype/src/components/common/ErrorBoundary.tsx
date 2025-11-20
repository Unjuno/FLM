// ErrorBoundary - エラーバウンダリコンポーネント

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ErrorMessage } from './ErrorMessage';
import { logger } from '../../utils/logger';
import { isDev } from '../../utils/env';
import './ErrorBoundary.css';

/**
 * Error Boundaryのプロパティ
 */
interface ErrorBoundaryProps {
  /** 子コンポーネント */
  children: ReactNode;
  /** フォールバックUI（オプション） */
  fallback?: ReactNode;
  /** エラーハンドラー（オプション） */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

/**
 * Error Boundaryの状態
 */
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * React Error Boundaryコンポーネント
 * 子コンポーネントツリーのJavaScriptエラーをキャッチし、
 * エラーログを記録し、フォールバックUIを表示します
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  /**
   * エラーが発生したときに呼ばれる
   */
  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // 次のレンダリングでフォールバックUIが表示されるように状態を更新
    return {
      hasError: true,
      error,
    };
  }

  /**
   * エラー情報を記録
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // エラーをログに記録
    this.logErrorToConsole(error, errorInfo);

    // エラー情報を状態に保存
    this.setState({
      error,
      errorInfo,
    });

    // カスタムエラーハンドラーがあれば呼び出す
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // 本番環境では、エラー追跡サービスに送信することも可能
    // 例: Sentry, LogRocket など
    if (!isDev()) {
      this.logErrorToExternalService(error, errorInfo);
    }
  }

  /**
   * コンソールにエラーを記録（開発環境のみ）
   */
  private logErrorToConsole(error: Error, errorInfo: ErrorInfo) {
    if (isDev()) {
      logger.error('ErrorBoundary caught an error', error, 'ErrorBoundary');
      logger.error('Error Info', errorInfo, 'ErrorBoundary');
      logger.debug(
        'Component Stack',
        errorInfo.componentStack,
        'ErrorBoundary'
      );
    }
  }

  /**
   * 外部サービスにエラーを送信（本番環境のみ）
   *
   * 注意: 現時点ではコンソールにのみ記録します。
   * 将来的にエラー追跡サービス（Sentry、LogRocket等）への統合を検討します。
   */
  private logErrorToExternalService(error: Error, errorInfo: ErrorInfo) {
    if (!isDev()) {
      logger.error(
        'Production Error',
        {
          message: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack,
          timestamp: new Date().toISOString(),
        },
        'ErrorBoundary'
      );
    }
  }

  /**
   * エラー状態をリセット
   */
  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  /**
   * ページを再読み込み
   */
  private handleReload = () => {
    window.location.reload();
  };

  /**
   * ホーム画面に戻る
   */
  private handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      // カスタムフォールバックUIが指定されている場合はそれを使用
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // デフォルトのエラーUIを表示
      const error = this.state.error;
      const isDevelopment = isDev();

      return (
        <div className="error-boundary">
          <div className="error-boundary-container">
            <div className="error-boundary-header">
              <img
                src="/logo.png"
                alt="FLM"
                className="error-boundary-logo"
                width="48"
                height="48"
                aria-hidden="true"
              />
              <div className="error-boundary-icon">!</div>
              <h1 className="error-boundary-title">エラーが発生しました</h1>
            </div>

            <div className="error-boundary-content">
              <ErrorMessage
                message={
                  error?.message ||
                  '予期しないエラーが発生しました。アプリケーションを再読み込みしてください。'
                }
                type="general"
                onRetry={this.handleReset}
                suggestion="問題が続く場合は、アプリケーションを再起動するか、ホーム画面に戻ってください。"
              />

              {isDevelopment && this.state.error && (
                <div className="error-boundary-details">
                  <details className="error-details">
                    <summary className="error-details-summary">
                      開発者向けエラー詳細（開発モードのみ表示）
                    </summary>
                    <div className="error-details-content">
                      <div className="error-details-section">
                        <h4>エラーメッセージ:</h4>
                        <pre className="error-stack">
                          {error?.message || 'エラーが発生しました'}
                        </pre>
                      </div>
                      {error?.stack && (
                        <div className="error-details-section">
                          <h4>スタックトレース:</h4>
                          <pre className="error-stack">{error.stack}</pre>
                        </div>
                      )}
                      {this.state.errorInfo?.componentStack && (
                        <div className="error-details-section">
                          <h4>コンポーネントスタック:</h4>
                          <pre className="error-stack">
                            {this.state.errorInfo.componentStack}
                          </pre>
                        </div>
                      )}
                    </div>
                  </details>
                </div>
              )}
            </div>

            <div className="error-boundary-actions">
              <button
                className="error-boundary-button primary"
                onClick={this.handleReset}
              >
                もう一度試す
              </button>
              <button
                className="error-boundary-button secondary"
                onClick={this.handleReload}
              >
                🔃 ページを再読み込み
              </button>
              <button
                className="error-boundary-button secondary"
                onClick={this.handleGoHome}
              >
                🏠 ホーム画面に戻る
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Error Boundary を簡単に使用するためのHOC（Higher-Order Component）
 *
 * @example
 * ```tsx
 * const SafeComponent = withErrorBoundary(MyComponent);
 * ```
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  return function WithErrorBoundaryComponent(props: P) {
    return (
      <ErrorBoundary {...errorBoundaryProps}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}
