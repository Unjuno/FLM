// Error Boundary Component

import React, { Component, type ReactNode } from 'react';
import { ErrorMessage } from './ErrorMessage';
import { logger } from '../../utils/logger';
import './ErrorBoundary.css';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

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

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    this.setState({
      errorInfo,
    });

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log error in development
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      logger.error('ErrorBoundary caught an error:', error, errorInfo);
    }
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const errorMessage =
        this.state.error?.message || '予期しないエラーが発生しました';
      const errorDetails = this.state.errorInfo?.componentStack
        ? `Component Stack:\n${this.state.errorInfo.componentStack}`
        : undefined;

      return (
        <div className="error-boundary">
          <ErrorMessage
            message={errorMessage}
            details={errorDetails}
            onDismiss={this.handleReset}
          />
          <div className="error-boundary-actions">
            <button className="button-primary" onClick={this.handleReset}>
              再試行
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
