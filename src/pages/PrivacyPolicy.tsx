// FLM - Privacy Policy Page
// フロントエンドエージェント (FE) 実装
// FE-018-04: プライバシーポリシーページ実装

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useGlobalKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import './PrivacyPolicy.css';

/**
 * プライバシーポリシーページコンポーネント
 * アプリケーションのプライバシーポリシーを表示します
 */
export const PrivacyPolicy: React.FC = () => {
  const navigate = useNavigate();

  // グローバルキーボードショートカットを有効化
  useGlobalKeyboardShortcuts();

  return (
    <div className="privacy-policy-page">
      <div className="privacy-policy-container">
        <header className="privacy-policy-header">
          <button 
            className="privacy-policy-back-button" 
            onClick={() => navigate('/')}
            aria-label="ホームに戻る"
          >
            ← ホームに戻る
          </button>
          <h1 className="privacy-policy-title">プライバシーポリシー</h1>
          <p className="privacy-policy-updated-date">
            最終更新日: {new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </header>

        <div className="privacy-policy-content">
          {/* イントロダクション */}
          <section className="privacy-policy-section">
            <h2 className="privacy-policy-section-title">1. はじめに</h2>
            <div className="privacy-policy-text-content">
              <p>
                FLM（Local LLM API Manager）は、お客様のプライバシーを尊重します。
                このプライバシーポリシーは、当アプリケーションがどのように個人情報を収集、使用、保護するかを説明します。
              </p>
            </div>
          </section>

          {/* 収集する情報 */}
          <section className="privacy-policy-section">
            <h2 className="privacy-policy-section-title">2. 収集する情報</h2>
            <div className="privacy-policy-text-content">
              <h3>2.1 ローカルデータ</h3>
              <p>
                本アプリケーションは、すべてのデータをユーザーのローカルデバイスに保存します。
                以下の情報がローカルに保存される場合があります：
              </p>
              <ul>
                <li>API設定情報（エンドポイント、認証情報など）</li>
                <li>リクエストログとパフォーマンスメトリクス</li>
                <li>アプリケーション設定（テーマ、言語設定など）</li>
                <li>モデル管理情報</li>
              </ul>
              <h3>2.2 外部サービスへの送信</h3>
              <p>
                本アプリケーションは、ユーザーの許可なく、個人情報を外部サービスに送信しません。
                すべてのデータ処理は、ユーザーのローカルデバイス上で行われます。
              </p>
            </div>
          </section>

          {/* データの使用目的 */}
          <section className="privacy-policy-section">
            <h2 className="privacy-policy-section-title">3. データの使用目的</h2>
            <div className="privacy-policy-text-content">
              <p>収集したデータは、以下の目的でのみ使用されます：</p>
              <ul>
                <li>APIリクエストの処理とログ記録</li>
                <li>パフォーマンス監視と分析</li>
                <li>アプリケーション機能の提供</li>
                <li>ユーザー設定の保存と復元</li>
              </ul>
            </div>
          </section>

          {/* データの保護 */}
          <section className="privacy-policy-section">
            <h2 className="privacy-policy-section-title">4. データの保護</h2>
            <div className="privacy-policy-text-content">
              <p>
                本アプリケーションは、以下の方法でデータを保護します：
              </p>
              <ul>
                <li>APIキーなどの機密情報の暗号化保存</li>
                <li>ローカルデータベースへの安全な保存</li>
                <li>ネットワーク通信のセキュリティ（HTTPS使用時）</li>
                <li>不正アクセスの防止</li>
              </ul>
            </div>
          </section>

          {/* データの共有 */}
          <section className="privacy-policy-section">
            <h2 className="privacy-policy-section-title">5. データの共有</h2>
            <div className="privacy-policy-text-content">
              <p>
                本アプリケーションは、以下の場合を除き、ユーザーのデータを第三者と共有しません：
              </p>
              <ul>
                <li>ユーザーが明示的にエクスポート機能を使用した場合</li>
                <li>法的義務に基づく場合</li>
              </ul>
            </div>
          </section>

          {/* データの削除 */}
          <section className="privacy-policy-section">
            <h2 className="privacy-policy-section-title">6. データの削除</h2>
            <div className="privacy-policy-text-content">
              <p>
                ユーザーは、いつでも以下の方法でデータを削除できます：
              </p>
              <ul>
                <li>アプリケーション内の設定画面からログを削除</li>
                <li>アプリケーションのアンインストール</li>
                <li>データベースファイルの手動削除</li>
              </ul>
            </div>
          </section>

          {/* Cookieとトラッキング */}
          <section className="privacy-policy-section">
            <h2 className="privacy-policy-section-title">7. Cookieとトラッキング</h2>
            <div className="privacy-policy-text-content">
              <p>
                本アプリケーションは、Cookieやトラッキング技術を使用しません。
                すべてのデータはローカルデバイス上で処理されます。
              </p>
            </div>
          </section>

          {/* ユーザーの権利 */}
          <section className="privacy-policy-section">
            <h2 className="privacy-policy-section-title">8. ユーザーの権利</h2>
            <div className="privacy-policy-text-content">
              <p>ユーザーは以下の権利を有します：</p>
              <ul>
                <li>自分のデータにアクセスする権利</li>
                <li>データの修正・更新する権利</li>
                <li>データの削除を要求する権利</li>
                <li>データのエクスポートする権利</li>
              </ul>
            </div>
          </section>

          {/* ポリシーの変更 */}
          <section className="privacy-policy-section">
            <h2 className="privacy-policy-section-title">9. プライバシーポリシーの変更</h2>
            <div className="privacy-policy-text-content">
              <p>
                本プライバシーポリシーは、予告なく変更される場合があります。
                重要な変更がある場合は、アプリケーション内で通知します。
                定期的にこのページを確認することをお勧めします。
              </p>
            </div>
          </section>

          {/* お問い合わせ */}
          <section className="privacy-policy-section">
            <h2 className="privacy-policy-section-title">10. お問い合わせ</h2>
            <div className="privacy-policy-text-content">
              <p>
                プライバシーポリシーに関するご質問やご意見がございましたら、
                プロジェクトのGitHubリポジトリのイシュートラッカーまでお問い合わせください。
              </p>
            </div>
          </section>

          {/* 印刷・PDFエクスポート */}
          <section className="privacy-policy-actions">
            <button
              className="privacy-policy-action-button"
              onClick={() => window.print()}
              type="button"
              aria-label="プライバシーポリシーを印刷"
            >
              🖨️ 印刷
            </button>
          </section>
        </div>

        {/* フッター */}
        <footer className="privacy-policy-footer">
          <p className="privacy-policy-footer-text">
            © {new Date().getFullYear()} FLM Project. All rights reserved.
          </p>
        </footer>
      </div>
    </div>
  );
};

