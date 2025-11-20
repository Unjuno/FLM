// About - Aboutページ

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { safeInvoke } from '../utils/tauri';
import { Breadcrumb, BreadcrumbItem } from '../components/common/Breadcrumb';
import { SkeletonLoader } from '../components/common/SkeletonLoader';
import { useGlobalKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useI18n } from '../contexts/I18nContext';
import { logger } from '../utils/logger';
import './About.css';

/**
 * アプリケーション情報
 */
interface AppInfo {
  name: string;
  version: string;
  description: string;
}

/**
 * Aboutページコンポーネント
 * アプリケーションの情報、ライセンス、依存ライブラリなどを表示します
 */
export const About: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // グローバルキーボードショートカットを有効化
  useGlobalKeyboardShortcuts();

  // パンくずリストの項目
  const breadcrumbItems: BreadcrumbItem[] = useMemo(
    () => [
      { label: t('header.home') || 'ホーム', path: '/' },
      { label: 'このアプリについて' },
    ],
    [t]
  );

  // アプリケーション情報を取得
  useEffect(() => {
    const loadAppInfo = async () => {
      try {
        const info = await safeInvoke<AppInfo>('get_app_info');
        setAppInfo(info);
      } catch (err) {
        logger.error('アプリケーション情報の取得に失敗しました', err, 'About');
      } finally {
        setLoading(false);
      }
    };

    loadAppInfo();
  }, []);

  // 主要な依存ライブラリ
  const dependencies = [
    { name: 'React', version: '19.1.0', description: 'UIライブラリ' },
    { name: 'TypeScript', version: '5.x', description: '型安全なJavaScript' },
    {
      name: 'Tauri',
      version: '2.x',
      description: 'デスクトップアプリケーションフレームワーク',
    },
    {
      name: 'React Router',
      version: '7.9.5',
      description: 'ルーティングライブラリ',
    },
    {
      name: 'Recharts',
      version: '2.15.4',
      description: 'グラフ描画ライブラリ',
    },
    { name: 'SQLite', version: '3.x', description: 'データベースエンジン' },
    {
      name: 'Rust',
      version: '1.x',
      description: 'バックエンドプログラミング言語',
    },
    { name: 'Ollama', description: 'ローカルLLM実行エンジン' },
  ];

  if (loading) {
    return (
      <div className="about-page">
        <div className="about-container">
          <Breadcrumb items={breadcrumbItems} />
          <header className="about-header">
            <SkeletonLoader type="title" width="200px" />
          </header>
          <div className="about-content">
            <SkeletonLoader type="card" count={1} />
            <SkeletonLoader type="paragraph" count={3} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="about-page">
      <div className="about-container">
        <Breadcrumb items={breadcrumbItems} />
        <header className="about-header">
          <button className="about-back-button" onClick={() => navigate('/')}>
            ← ホームに戻る
          </button>
          <h1 className="about-title">アプリケーション情報</h1>
        </header>

        <div className="about-content">
          {/* アプリケーション情報セクション */}
          <section className="about-section">
            <h2 className="about-section-title">アプリケーション情報</h2>
            <div className="about-info-card">
              <img
                src="/logo.png"
                alt="FLM"
                className="about-logo"
                width="64"
                height="64"
                aria-hidden="true"
              />
              <div className="about-info">
                <h3 className="about-app-name">{appInfo?.name || 'FLM'}</h3>
                <p className="about-app-version">
                  バージョン {appInfo?.version || '1.0.0'}
                </p>
                <p className="about-app-description">
                  {appInfo?.description || 'Local LLM API Management Tool'}
                </p>
              </div>
            </div>
          </section>

          {/* 説明セクション */}
          <section className="about-section">
            <h2 className="about-section-title">アプリケーションについて</h2>
            <div className="about-text-content">
              <p>
                FLM（Local LLM API
                Manager）は、技術知識がなくても、コードを書かずに、
                ローカルLLMのAPIを作成・利用できるデスクトップアプリケーションです。
              </p>
              <p>
                非開発者が5分以内でローカルLLM
                APIを作成し、利用できることを目標としています。
              </p>
            </div>
          </section>

          {/* ライセンス情報セクション */}
          <section className="about-section">
            <h2 className="about-section-title">ライセンス</h2>
            <div className="about-text-content">
              <p>
                このソフトウェアはMITライセンスの下で提供されています。
                詳細については、プロジェクトのリポジトリを参照してください。
              </p>
            </div>
          </section>

          {/* 開発者情報セクション */}
          <section className="about-section">
            <h2 className="about-section-title">開発者情報</h2>
            <div className="about-text-content">
              <p>
                このアプリケーションは、オープンソースコミュニティによって開発・維持されています。
              </p>
              <p>
                バグ報告や機能要望は、GitHubのイシュートラッカーをご利用ください。
              </p>
            </div>
          </section>

          {/* 依存ライブラリセクション */}
          <section className="about-section">
            <h2 className="about-section-title">主要な依存ライブラリ</h2>
            <div className="about-dependencies">
              <div className="about-dependency-grid">
                {dependencies.map((dep, index) => (
                  <div key={index} className="about-dependency-item">
                    <div className="about-dependency-name">{dep.name}</div>
                    {dep.version && (
                      <div className="about-dependency-version">
                        {dep.version}
                      </div>
                    )}
                    {dep.description && (
                      <div className="about-dependency-description">
                        {dep.description}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* リンクセクション */}
          <section className="about-section">
            <h2 className="about-section-title">リンク</h2>
            <div className="about-links">
              <button
                className="about-link-button"
                onClick={() => navigate('/help')}
                type="button"
              >
                📖 ヘルプ・FAQ
              </button>
              <button
                className="about-link-button"
                onClick={() => navigate('/settings')}
                type="button"
              >
                ⚙️ 設定
              </button>
              <button
                className="about-link-button"
                onClick={() => navigate('/privacy')}
                type="button"
              >
                🔒 プライバシーポリシー
              </button>
              <button
                className="about-link-button"
                onClick={() => navigate('/terms')}
                type="button"
              >
                📄 利用規約
              </button>
              <div className="about-link-note">
                <p>
                  更新履歴や詳細な情報については、プロジェクトのリポジトリを参照してください。
                </p>
              </div>
            </div>
          </section>

          {/* フッター */}
          <footer className="about-footer">
            <p className="about-footer-text">
              © {new Date().getFullYear()} FLM Project. All rights reserved.
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
};
