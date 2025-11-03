// ErrorMessage - エラーメッセージコンポーネント

import React from 'react';
import './ErrorMessage.css';

/**
 * エラーメッセージの種類
 */
export type ErrorType = 
  | 'ollama'
  | 'api'
  | 'model'
  | 'database'
  | 'validation'
  | 'network'
  | 'permission'
  | 'general';

/**
 * エラーメッセージコンポーネントのプロパティ
 */
interface ErrorMessageProps {
  message: string;
  type?: ErrorType;
  onClose?: () => void;
  onRetry?: () => void;
  suggestion?: string;
}

/**
 * エラーメッセージコンポーネント
 * 非開発者向けにわかりやすいエラーメッセージを表示します
 */
export const ErrorMessage: React.FC<ErrorMessageProps> = ({
  message,
  type = 'general',
  onClose,
  onRetry,
  suggestion,
}) => {
  // エラーの種類に応じたアイコンとタイトルを取得
  const getErrorInfo = (errorType: ErrorType) => {
    switch (errorType) {
      case 'ollama':
        return {
          icon: '🤖',
          title: 'Ollamaのエラー',
          defaultSuggestion: 'Ollamaが正しくインストールされ、起動しているか確認してください。',
        };
      case 'api':
        return {
          icon: '🔌',
          title: 'APIのエラー',
          defaultSuggestion: 'ポート番号が既に使用されていないか、設定を確認してください。',
        };
      case 'model':
        return {
          icon: '📦',
          title: 'モデルのエラー',
          defaultSuggestion: 'モデルが正しくダウンロードされているか確認してください。',
        };
      case 'database':
        return {
          icon: '💾',
          title: 'データベースのエラー',
          defaultSuggestion: 'アプリケーションを再起動してみてください。',
        };
      case 'validation':
        return {
          icon: '✏️',
          title: '入力のエラー',
          defaultSuggestion: '入力内容を確認してください。',
        };
      case 'network':
        return {
          icon: '🌐',
          title: 'ネットワークのエラー',
          defaultSuggestion: 'インターネット接続を確認してください。',
        };
      case 'permission':
        return {
          icon: '🔒',
          title: '権限のエラー',
          defaultSuggestion: '必要な権限があるか確認してください。',
        };
      default:
        return {
          icon: '⚠️',
          title: 'エラー',
          defaultSuggestion: '問題が続く場合は、アプリケーションを再起動してみてください。',
        };
    }
  };

  const errorInfo = getErrorInfo(type);
  const displaySuggestion = suggestion || errorInfo.defaultSuggestion;

  // 技術的なメッセージを非開発者向けに変換
  const userFriendlyMessage = React.useMemo(() => {
    // よくある技術的なエラーメッセージを変換
    let friendlyMessage = message;

    // Ollama関連
    if (friendlyMessage.includes('Ollama') && friendlyMessage.includes('not found')) {
      friendlyMessage = 'Ollamaが見つかりませんでした。Ollamaをインストールしてから再度お試しください。';
    } else if (friendlyMessage.includes('Ollama') && friendlyMessage.includes('connection')) {
      friendlyMessage = 'Ollamaに接続できませんでした。Ollamaが起動しているか確認してください。';
    }
    
    // ポート関連
    if (friendlyMessage.includes('port') && friendlyMessage.includes('already')) {
      friendlyMessage = 'このポート番号は既に使用されています。別のポート番号を試してください。';
    } else if (friendlyMessage.includes('port') && friendlyMessage.includes('invalid')) {
      friendlyMessage = 'ポート番号は1024から65535の間の数字を入力してください。';
    }

    // データベース関連
    if (friendlyMessage.includes('database') && friendlyMessage.includes('locked')) {
      friendlyMessage = 'データベースが使用中です。しばらく待ってから再度お試しください。';
    }

    // ネットワーク関連
    if (friendlyMessage.includes('network') || friendlyMessage.includes('connection refused')) {
      friendlyMessage = 'ネットワーク接続に問題があります。インターネット接続を確認してください。';
    }

    return friendlyMessage;
  }, [message]);

  return (
    <div className={`error-message error-${type}`} role="alert" aria-live="assertive" aria-atomic="true">
      <div className="error-header">
        <span className="error-icon" aria-hidden="true">{errorInfo.icon}</span>
        <h3 className="error-title" id={`error-title-${type}`}>{errorInfo.title}</h3>
        {onClose && (
          <button 
            className="error-close-button" 
            onClick={onClose} 
            aria-label="エラーメッセージを閉じる"
            type="button"
          >
            <span aria-hidden="true">✕</span>
          </button>
        )}
      </div>
      <div className="error-content">
        <p className="error-text" aria-describedby={`error-title-${type}`}>{userFriendlyMessage}</p>
        {displaySuggestion && (
          <div className="error-suggestion" role="note">
            <span className="suggestion-icon" aria-hidden="true">💡</span>
            <span className="suggestion-text">{displaySuggestion}</span>
          </div>
        )}
      </div>
      {onRetry && (
        <div className="error-actions">
          <button 
            className="error-retry-button" 
            onClick={onRetry}
            aria-label="操作を再試行する"
            type="button"
          >
            <span aria-hidden="true">🔄</span> もう一度試す
          </button>
        </div>
      )}
    </div>
  );
};

