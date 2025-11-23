// ErrorMessage - エラーメッセージコンポーネント

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PORT_RANGE } from '../../constants/config';
import { autoFixError, canAutoFix, AutoFixResult } from '../../utils/autoFix';
import { parseError } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';
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
  /** 元のエラーオブジェクト（自動修正用） */
  originalError?: unknown;
  /** 自動修正成功時のコールバック */
  onAutoFixSuccess?: (result: AutoFixResult) => void;
  /** 自動修正失敗時のコールバック */
  onAutoFixFailure?: (result: AutoFixResult) => void;
  /** 永続化オプション: trueの場合、手動で閉じるまで表示され続ける（デフォルト: false） */
  persistent?: boolean;
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
  originalError,
  onAutoFixSuccess,
  onAutoFixFailure,
  persistent: _persistent = false,
}) => {
  const navigate = useNavigate();
  const [isFixing, setIsFixing] = useState(false);
  const [fixResult, setFixResult] = useState<AutoFixResult | null>(null);

  // 自動修正可能かどうかを判定
  const canFix = originalError ? canAutoFix(originalError) : false;

  // 自動修正を実行
  const handleAutoFix = async () => {
    if (!originalError || isFixing) return;

    setIsFixing(true);
    setFixResult(null);

    try {
      const result = await autoFixError(originalError, {
        onFixAttempt: (_error, fixDescription) => {
          logger.info(`自動修正を試みます: ${fixDescription}`, 'ErrorMessage');
        },
        onFixSuccess: result => {
          logger.info(
            `自動修正が成功しました: ${result.fixDescription}`,
            'ErrorMessage'
          );
          setFixResult(result);
          if (onAutoFixSuccess) {
            onAutoFixSuccess(result);
          }
          // 自動修正成功後、元の操作を再試行
          if (onRetry) {
            setTimeout(() => {
              onRetry();
            }, 1000);
          }
        },
        onFixFailure: result => {
          logger.warn(
            `自動修正が失敗しました: ${result.fixDescription}`,
            'ErrorMessage'
          );
          setFixResult(result);
          if (onAutoFixFailure) {
            onAutoFixFailure(result);
          }
        },
      });

      setFixResult(result);
    } catch (error) {
      logger.error('自動修正中にエラーが発生しました', error, 'ErrorMessage');
      setFixResult({
        success: false,
        fixedError: parseError(error),
        fixDescription: '自動修正中にエラーが発生しました',
        remainingError: parseError(error),
      });
    } finally {
      setIsFixing(false);
    }
  };
  // エラーの種類に応じたアイコンとタイトルを取得
  const getErrorInfo = (errorType: ErrorType) => {
    switch (errorType) {
      case 'ollama':
        return {
          icon: '',
          title: 'Ollamaのエラー',
          defaultSuggestion:
            'Ollamaが正しくインストールされ、起動しているか確認してください。',
          detailedSteps: [
            '1. Ollamaがインストールされているか確認してください',
            '2. Ollamaサービスが起動しているか確認してください（タスクマネージャーまたはプロセス一覧で確認）',
            '3. ターミナルで「ollama serve」コマンドを実行してOllamaを起動してください',
            '4. それでも解決しない場合は、Ollamaを再インストールしてください',
          ],
        };
      case 'api':
        return {
          icon: '',
          title: 'APIのエラー',
          defaultSuggestion:
            'ポート番号が既に使用されていないか、設定を確認してください。',
          detailedSteps: [
            '1. 設定画面でポート番号を確認してください',
            '2. 別のアプリケーションが同じポートを使用していないか確認してください',
            '3. 「ポートを自動検出」機能を使用して空いているポートを探してください',
            '4. それでも解決しない場合は、別のポート番号（例: 11434, 11435）を手動で指定してください',
          ],
        };
      case 'model':
        return {
          icon: '',
          title: 'モデルのエラー',
          defaultSuggestion:
            'モデルが正しくダウンロードされているか確認してください。',
          detailedSteps: [
            '1. モデル管理画面でモデルがインストールされているか確認してください',
            '2. モデルがインストールされていない場合は、「モデルをダウンロード」ボタンからダウンロードしてください',
            '3. モデルのダウンロードが途中で中断された場合は、再度ダウンロードを試してください',
            '4. それでも解決しない場合は、モデルを削除して再ダウンロードしてください',
          ],
        };
      case 'database':
        return {
          icon: '',
          title: 'データベースのエラー',
          defaultSuggestion: 'アプリケーションを再起動してみてください。',
          detailedSteps: [
            '1. アプリケーションを完全に終了してください',
            '2. 数秒待ってからアプリケーションを再起動してください',
            '3. それでも解決しない場合は、アプリケーションの設定をリセットしてください（設定画面から）',
            '4. 問題が続く場合は、アプリケーションのログを確認してください',
          ],
        };
      case 'validation':
        return {
          icon: '',
          title: '入力のエラー',
          defaultSuggestion: '入力内容を確認してください。',
          detailedSteps: [
            '1. エラーメッセージに表示されている項目を確認してください',
            '2. 必須項目がすべて入力されているか確認してください',
            '3. 入力値が正しい形式か確認してください（例: ポート番号は数値、URLは正しい形式）',
            '4. 入力欄の横にある「？」アイコンをクリックして、正しい入力方法を確認してください',
          ],
        };
      case 'network':
        return {
          icon: '',
          title: 'ネットワークのエラー',
          defaultSuggestion: 'インターネット接続を確認してください。',
          detailedSteps: [
            '1. インターネット接続が正常か確認してください（ブラウザでWebサイトにアクセスできるか確認）',
            '2. ファイアウォールやセキュリティソフトが接続をブロックしていないか確認してください',
            '3. プロキシ設定が必要な場合は、設定画面でプロキシを設定してください',
            '4. それでも解決しない場合は、ネットワーク管理者に問い合わせてください',
          ],
        };
      case 'permission':
        return {
          icon: '',
          title: '権限のエラー',
          defaultSuggestion: '必要な権限があるか確認してください。',
          detailedSteps: [
            '1. アプリケーションを管理者権限で実行しているか確認してください',
            '2. ファイルやフォルダへのアクセス権限があるか確認してください',
            '3. セキュリティソフトがアプリケーションをブロックしていないか確認してください',
            '4. それでも解決しない場合は、システム管理者に問い合わせてください',
          ],
        };
      default:
        return {
          icon: '',
          title: 'エラー',
          defaultSuggestion:
            '問題が続く場合は、アプリケーションを再起動してみてください。',
          detailedSteps: [
            '1. アプリケーションを再起動してください',
            '2. エラーメッセージの内容を確認してください',
            '3. ヘルプページで同様のエラーがないか確認してください',
            '4. 問題が続く場合は、サポートに問い合わせてください',
          ],
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
    if (
      friendlyMessage.includes('Ollama') &&
      friendlyMessage.includes('not found')
    ) {
      friendlyMessage =
        'Ollamaが見つかりませんでした。Ollamaをインストールしてから再度お試しください。';
    } else if (
      friendlyMessage.includes('Ollama') &&
      friendlyMessage.includes('connection')
    ) {
      friendlyMessage =
        'Ollamaに接続できませんでした。Ollamaが起動しているか確認してください。';
    }

    // ポート関連
    if (
      friendlyMessage.includes('port') &&
      (friendlyMessage.includes('already') ||
        friendlyMessage.includes('使用中') ||
        friendlyMessage.includes('EADDRINUSE') ||
        friendlyMessage.toLowerCase().includes('eaddrinuse'))
    ) {
      friendlyMessage =
        'このポート番号は既に使用されています。自動的に代替ポートが検出されますが、別のポート番号を手動で指定することもできます。';
    } else if (
      friendlyMessage.includes('port') &&
      friendlyMessage.includes('invalid')
    ) {
      friendlyMessage = `ポート番号は${PORT_RANGE.MIN}から${PORT_RANGE.MAX}の間の数字を入力してください。`;
    } else if (
      friendlyMessage.includes('使用可能なポート') &&
      (friendlyMessage.includes('見つかりません') ||
        friendlyMessage.includes('not found'))
    ) {
      friendlyMessage =
        '使用可能なポート番号が見つかりませんでした。他のアプリケーションが多くのポートを使用している可能性があります。不要なアプリケーションを終了してから再度お試しください。';
    } else if (
      friendlyMessage.includes('アプリケーションが正しく起動していません')
    ) {
      friendlyMessage =
        'アプリケーションの起動に失敗しました。ポート番号が既に使用されている可能性があります。アプリケーションを再起動するか、設定を確認してください。';
    }

    // データベース関連
    if (
      friendlyMessage.includes('database') &&
      friendlyMessage.includes('locked')
    ) {
      friendlyMessage =
        'データベースが使用中です。しばらく待ってから再度お試しください。';
    }

    // ネットワーク関連
    if (
      friendlyMessage.includes('network') ||
      friendlyMessage.includes('connection refused')
    ) {
      friendlyMessage =
        'ネットワーク接続に問題があります。インターネット接続を確認してください。';
    }

    return friendlyMessage;
  }, [message]);

  return (
    <>
      <div className={`error-message error-${type}`}>
        <div className="error-header">
          <span className="error-icon" aria-hidden="true">
            {errorInfo.icon}
          </span>
          <h3 className="error-title" id={`error-title-${type}`}>
            {errorInfo.title}
          </h3>
          {onClose && (
            <button
              className="error-close-button"
              onClick={onClose}
              aria-label="エラーメッセージを閉じる"
              type="button"
            >
              <span aria-hidden="true">×</span>
            </button>
          )}
        </div>
        <div className="error-content" aria-live="polite" aria-atomic="false">
          <p className="error-text" aria-describedby={`error-title-${type}`}>
            {userFriendlyMessage}
          </p>
          {displaySuggestion && (
            <div className="error-suggestion">
              <span className="suggestion-icon" aria-hidden="true"></span>
              <span className="suggestion-text">{displaySuggestion}</span>
            </div>
          )}
        </div>
        <div className="error-actions">
          {canFix && (
            <button
              className="error-auto-fix-button"
              onClick={handleAutoFix}
              disabled={isFixing}
              aria-label="エラーを自動修正する"
              type="button"
            >
              {isFixing ? (
                <>
                  <span className="spinner" aria-hidden="true"></span> 修正中...
                </>
              ) : (
                <>自動修正</>
              )}
            </button>
          )}
          {onRetry && (
            <button
              className="error-retry-button"
              onClick={onRetry}
              aria-label="操作を再試行する"
              type="button"
            >
              もう一度試す
            </button>
          )}
          <button
            className="error-help-button"
            onClick={() => navigate(`/help?errorType=${type}`)}
            aria-label="ヘルプページを開く"
            type="button"
          >
            ヘルプを見る
          </button>
        </div>
        {fixResult && (
          <div
            className={`error-fix-result ${fixResult.success ? 'success' : 'failure'}`}
          >
            {fixResult.success ? (
              <div className="fix-success-message">
                <span aria-hidden="true"></span> {fixResult.fixDescription}
              </div>
            ) : (
              <div className="fix-failure-message">
                <span aria-hidden="true">×</span> {fixResult.fixDescription}
              </div>
            )}
          </div>
        )}
      </div>
      {errorInfo.detailedSteps && errorInfo.detailedSteps.length > 0 && (
        <div className="error-detailed-steps" aria-label="解決手順">
          <div className="steps-title">解決手順:</div>
          <ul className="steps-list">
            {errorInfo.detailedSteps.map((step, index) => (
              <li key={index} className="step-item">
                {step}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
};
