// FLM - Terms of Service Page
// フロントエンドエージェント (FE) 実装
// FE-018-04: 利用規約ページ実装

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useGlobalKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import './TermsOfService.css';

/**
 * 利用規約ページコンポーネント
 * アプリケーションの利用規約を表示します
 */
export const TermsOfService: React.FC = () => {
  const navigate = useNavigate();

  // グローバルキーボードショートカットを有効化
  useGlobalKeyboardShortcuts();

  return (
    <div className="terms-of-service-page">
      <div className="terms-of-service-container">
        <header className="terms-of-service-header">
          <button 
            className="terms-of-service-back-button" 
            onClick={() => navigate('/')}
            aria-label="ホームに戻る"
          >
            ← ホームに戻る
          </button>
          <h1 className="terms-of-service-title">利用規約</h1>
          <p className="terms-of-service-updated-date">
            最終更新日: {new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </header>

        <div className="terms-of-service-content">
          {/* イントロダクション */}
          <section className="terms-of-service-section">
            <h2 className="terms-of-service-section-title">1. はじめに</h2>
            <div className="terms-of-service-text-content">
              <p>
                本利用規約は、FLM（Local LLM API Manager）アプリケーション（以下「本アプリケーション」）の利用に関する条件を定めるものです。
                本アプリケーションを利用することにより、お客様は本規約に同意したものとみなされます。
              </p>
            </div>
          </section>

          {/* 定義 */}
          <section className="terms-of-service-section">
            <h2 className="terms-of-service-section-title">2. 定義</h2>
            <div className="terms-of-service-text-content">
              <ul>
                <li>「本アプリケーション」とは、FLM（Local LLM API Manager）を指します。</li>
                <li>「ユーザー」とは、本アプリケーションを利用する個人または組織を指します。</li>
                <li>「サービス」とは、本アプリケーションが提供するすべての機能を指します。</li>
                <li>「データ」とは、本アプリケーションを通じて処理されるすべての情報を指します。</li>
              </ul>
            </div>
          </section>

          {/* 利用許諾 */}
          <section className="terms-of-service-section">
            <h2 className="terms-of-service-section-title">3. 利用許諾</h2>
            <div className="terms-of-service-text-content">
              <h3>3.1 ライセンス</h3>
              <p>
                本アプリケーションは、MITライセンスの下で提供されています。
                本ライセンスに従って、ユーザーは本アプリケーションを使用、複製、修正、配布することができます。
              </p>
              <h3>3.2 利用条件</h3>
              <p>
                ユーザーは、本アプリケーションを以下の条件で利用できます：
              </p>
              <ul>
                <li>ローカルデバイス上での使用</li>
                <li>個人利用および商業利用</li>
                <li>ソースコードの修正と配布</li>
              </ul>
            </div>
          </section>

          {/* 禁止事項 */}
          <section className="terms-of-service-section">
            <h2 className="terms-of-service-section-title">4. 禁止事項</h2>
            <div className="terms-of-service-text-content">
              <p>ユーザーは、本アプリケーションの利用において、以下の行為を禁止します：</p>
              <ul>
                <li>違法な目的での使用</li>
                <li>第三者の権利を侵害する行為</li>
                <li>悪意のあるコードやマルウェアの配布</li>
                <li>本アプリケーションのセキュリティを侵害する行為</li>
                <li>他のユーザーに迷惑をかける行為</li>
                <li>本アプリケーションの機能を無効化または改ざんする行為</li>
              </ul>
            </div>
          </section>

          {/* 免責事項 */}
          <section className="terms-of-service-section">
            <h2 className="terms-of-service-section-title">5. 免責事項</h2>
            <div className="terms-of-service-text-content">
              <h3>5.1 サービス提供の保証</h3>
              <p>
                本アプリケーションは「現状のまま」提供され、明示的または黙示的ないかなる保証も提供されません。
                開発者は、本アプリケーションの正確性、信頼性、完全性、適切性、特定目的への適合性について保証しません。
              </p>
              <h3>5.2 損害の免責</h3>
              <p>
                開発者は、本アプリケーションの使用または使用不能に起因する直接的、間接的、偶発的、特別、懲罰的、または結果的損害について、
                いかなる責任も負いません。これには、データの損失、利益の喪失、ビジネスの中断などが含まれますが、これに限定されません。
              </p>
            </div>
          </section>

          {/* 責任の制限 */}
          <section className="terms-of-service-section">
            <h2 className="terms-of-service-section-title">6. 責任の制限</h2>
            <div className="terms-of-service-text-content">
              <p>
                本アプリケーションは、ユーザーのローカルデバイス上で動作するデスクトップアプリケーションです。
                すべてのデータ処理はローカルで行われ、外部サーバーに送信されることはありません。
                したがって、ユーザーは自身のデータの管理と保護に責任を持ちます。
              </p>
            </div>
          </section>

          {/* 知的財産権 */}
          <section className="terms-of-service-section">
            <h2 className="terms-of-service-section-title">7. 知的財産権</h2>
            <div className="terms-of-service-text-content">
              <p>
                本アプリケーションのソースコードは、オープンソースとして公開されており、
                MITライセンスの下で利用可能です。
                ただし、本アプリケーションのロゴや商標などの特定の要素は、開発者に帰属します。
              </p>
            </div>
          </section>

          {/* データの所有権 */}
          <section className="terms-of-service-section">
            <h2 className="terms-of-service-section-title">8. データの所有権</h2>
            <div className="terms-of-service-text-content">
              <p>
                ユーザーが本アプリケーションを使用して作成または保存したすべてのデータは、
                ユーザーに帰属します。
                開発者は、ユーザーのデータに対するいかなる権利も主張しません。
              </p>
            </div>
          </section>

          {/* サービスの変更・終了 */}
          <section className="terms-of-service-section">
            <h2 className="terms-of-service-section-title">9. サービスの変更・終了</h2>
            <div className="terms-of-service-text-content">
              <p>
                開発者は、予告なく、本アプリケーションの機能を変更、追加、削除、または終了する権利を留保します。
                本アプリケーションは、開発者が提供するものであり、
                開発者は常に本アプリケーションの開発と維持を保証するものではありません。
              </p>
            </div>
          </section>

          {/* 規約の変更 */}
          <section className="terms-of-service-section">
            <h2 className="terms-of-service-section-title">10. 規約の変更</h2>
            <div className="terms-of-service-text-content">
              <p>
                開発者は、予告なく本規約を変更する権利を留保します。
                重要な変更がある場合は、アプリケーション内で通知します。
                変更後に本アプリケーションを継続して使用することにより、
                ユーザーは変更後の規約に同意したものとみなされます。
              </p>
            </div>
          </section>

          {/* 準拠法 */}
          <section className="terms-of-service-section">
            <h2 className="terms-of-service-section-title">11. 準拠法</h2>
            <div className="terms-of-service-text-content">
              <p>
                本規約は、日本法に準拠して解釈されます。
                本規約に関する紛争については、開発者の所在地を管轄する裁判所を第一審の専属的合意管轄とします。
              </p>
            </div>
          </section>

          {/* お問い合わせ */}
          <section className="terms-of-service-section">
            <h2 className="terms-of-service-section-title">12. お問い合わせ</h2>
            <div className="terms-of-service-text-content">
              <p>
                本規約に関するご質問やご意見がございましたら、
                プロジェクトのGitHubリポジトリのイシュートラッカーまでお問い合わせください。
              </p>
            </div>
          </section>

          {/* 印刷・PDFエクスポート */}
          <section className="terms-of-service-actions">
            <button
              className="terms-of-service-action-button"
              onClick={() => window.print()}
              type="button"
              aria-label="利用規約を印刷"
            >
              🖨️ 印刷
            </button>
          </section>
        </div>

        {/* フッター */}
        <footer className="terms-of-service-footer">
          <p className="terms-of-service-footer-text">
            © {new Date().getFullYear()} FLM Project. All rights reserved.
          </p>
        </footer>
      </div>
    </div>
  );
};

