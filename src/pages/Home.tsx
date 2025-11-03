// Home - ホーム画面

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tooltip } from '../components/common/Tooltip';
import { Onboarding, useOnboarding } from '../components/onboarding/Onboarding';
import { SystemCheck } from '../components/common/SystemCheck';
import { useGlobalKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { safeInvoke } from '../utils/tauri';
import './Home.css';

/**
 * ホーム画面
 * メインのナビゲーションハブとして機能します
 */
export const Home: React.FC = () => {
  const navigate = useNavigate();
  const { showOnboarding, handleOnboardingComplete, handleOnboardingSkip } = useOnboarding();
  const [showSystemCheck, setShowSystemCheck] = useState(false);
  
  // グローバルキーボードショートカットを有効化
  useGlobalKeyboardShortcuts();

  const handleCreateApi = () => {
    navigate('/api/create');
  };

  const handleViewApis = () => {
    navigate('/api/list');
  };

  const handleManageModels = () => {
    navigate('/models');
  };

  // クイック作成機能（推奨設定で作成）
  const handleQuickCreate = async () => {
    try {
      // システムチェック結果を取得して推奨モデルを決定
      const recommendation = await safeInvoke<{
        recommended_model: string;
        reason: string;
      }>('get_model_recommendation');
      
      // 推奨モデルを選択してAPI作成画面へ
      navigate('/api/create', {
        state: {
          quickCreate: true,
          recommendedModel: recommendation.recommended_model,
        },
      });
    } catch (err) {
      console.error('クイック作成エラー:', err);
      // エラー時は通常のAPI作成画面へ
      navigate('/api/create');
    }
  };

  // システムチェックでモデルが選択された時の処理
  const handleModelSelected = (modelName: string) => {
    navigate('/api/create', {
      state: {
        selectedModelName: modelName,
      },
    });
  };

  return (
    <div className="home-page">
      {showOnboarding && (
        <Onboarding
          onComplete={handleOnboardingComplete}
          onSkip={handleOnboardingSkip}
        />
      )}
      <div className="home-container">
        <header className="home-header">
          <h1>FLM - Local LLM API Manager</h1>
          <p className="home-subtitle" role="doc-subtitle">
            ローカルLLMのAPIを簡単に作成・管理できるツール
          </p>
        </header>

        <nav className="home-actions" aria-label="メインアクション">
          <Tooltip content="システムリソースをチェックして、最適なモデルを自動選択してAPIを作成します。クリック1回でAPI作成が完了します。" position="right">
            <button
              className="home-action-button quick-create"
              onClick={handleQuickCreate}
              aria-label="クイック作成。システムに最適な設定でAPIを作成します。"
            >
              <span className="button-text">
                <strong>⚡ 推奨設定で作成</strong>
                <small>システムに最適な設定で自動作成</small>
              </span>
            </button>
          </Tooltip>
          <Tooltip content="Webサイトの要件（カテゴリ、用途、リソース）を入力すると、最適なモデルを自動選定してAPIを作成します。" position="right">
            <button
              className="home-action-button web-service"
              onClick={() => navigate('/web-service/setup')}
              aria-label="Webサイトサービスセットアップ"
            >
              <span className="button-text">
                <strong>🌐 Webサイトサービス</strong>
                <small>要件から自動で最適なAPIを作成</small>
              </span>
            </button>
          </Tooltip>
          <Tooltip content="Ollama、LM Studio、vLLM、llama.cppなどのLLMエンジンから新しいAPIエンドポイントを作成します。作成後はOpenAI互換の形式で利用できます。" position="right">
            <button
              className="home-action-button primary"
              onClick={handleCreateApi}
              aria-label="新しいAPIを作成。複数のLLMエンジンから選択してAPIを作成します。"
            >
              <span className="button-text">
                <strong>新しいAPIを作成</strong>
                <small>複数のLLMエンジンから選択してAPIを作成</small>
              </span>
            </button>
          </Tooltip>

          <Tooltip content="作成済みのAPI一覧を表示し、起動・停止・削除などの操作ができます。" position="right">
            <button
              className="home-action-button"
              onClick={handleViewApis}
              aria-label="API一覧を表示。作成済みのAPIを表示・管理します。"
            >
              <span className="button-text">
                <strong>API一覧</strong>
                <small>作成済みのAPIを表示・管理します</small>
              </span>
            </button>
          </Tooltip>

          <Tooltip content="利用可能なLLMモデルを検索・ダウンロードできます。選択したエンジン（Ollama、LM Studio、vLLM、llama.cpp）に応じてモデルを管理できます。モデルサイズや用途に応じて適切なモデルを選択してください。" position="right">
            <button
              className="home-action-button"
              onClick={handleManageModels}
              aria-label="モデル管理。複数のLLMエンジンのモデルを検索・ダウンロードができます。"
            >
              <span className="button-text">
                <strong>モデル管理</strong>
                <small>複数のLLMエンジンのモデルを管理</small>
              </span>
            </button>
          </Tooltip>

          <Tooltip content="APIキーの一覧表示、再生成、削除などの管理操作ができます。セキュリティのため、APIキーは安全に保管してください。" position="right">
            <button
              className="home-action-button"
              onClick={() => navigate('/api/keys')}
              aria-label="APIキー管理。APIキーの一覧表示・管理ができます。"
            >
              <span className="button-text">
                <strong>APIキー管理</strong>
                <small>APIキーの一覧表示・管理</small>
              </span>
            </button>
          </Tooltip>

          <Tooltip content="APIへのリクエストログを表示・検索できます。日時範囲、ステータスコード、パスなどでフィルタリングできます。" position="right">
            <button
              className="home-action-button"
              onClick={() => navigate('/logs')}
              aria-label="APIログ。リクエストログの表示・検索ができます。"
            >
              <span className="button-text">
                <strong>APIログ</strong>
                <small>リクエストログの表示・検索</small>
              </span>
            </button>
          </Tooltip>

          <Tooltip content="APIのパフォーマンスメトリクス（レスポンス時間、リクエスト数、CPU/メモリ使用量、エラー率）をリアルタイムで監視できます。" position="right">
            <button
              className="home-action-button"
              onClick={() => navigate('/performance')}
              aria-label="パフォーマンス監視。APIのパフォーマンスメトリクスを監視できます。"
            >
              <span className="button-text">
                <strong>パフォーマンス監視</strong>
                <small>APIのパフォーマンスメトリクスを監視</small>
              </span>
            </button>
          </Tooltip>
        </nav>

        {/* システムチェックセクション */}
        <section className="home-system-check">
          <div className="system-check-toggle">
            <button
              className="toggle-button"
              onClick={() => setShowSystemCheck(!showSystemCheck)}
            >
              {showSystemCheck ? '▼ システム情報を隠す' : '▶ システム情報を表示'}
            </button>
          </div>
          {showSystemCheck && (
            <SystemCheck
              onModelSelected={handleModelSelected}
              showRecommendations={true}
            />
          )}
        </section>

        <section className="home-info" aria-labelledby="usage-heading">
          <h2 id="usage-heading">使い方</h2>
          <ol className="home-steps">
            <li>「新しいAPIを作成」をクリック</li>
            <li>使用するLLMエンジンを選択（Ollama、LM Studio、vLLM、llama.cpp）</li>
            <li>使用するモデルを選択</li>
            <li>設定を入力（API名、ポート番号、エンジン設定など）</li>
            <li>API作成完了後、エンドポイントURLとAPIキーを取得</li>
            <li>取得した情報を使ってAPIを利用</li>
          </ol>
        </section>
      </div>
    </div>
  );
};

