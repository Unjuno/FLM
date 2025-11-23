// PrivacyPolicy - プライバシーポリシーページ

import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Breadcrumb, BreadcrumbItem } from '../components/common/Breadcrumb';
import { useI18n } from '../contexts/I18nContext';
import { useGlobalKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import './PrivacyPolicy.css';

/**
 * プライバシーポリシーページコンポーネント
 * アプリケーションのプライバシーポリシーを表示します
 */
export const PrivacyPolicy: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useI18n();

  // グローバルキーボードショートカットを有効化
  useGlobalKeyboardShortcuts();

  // パンくずリストの項目
  const breadcrumbItems: BreadcrumbItem[] = useMemo(
    () => [
      { label: t('header.home') || 'ホーム', path: '/' },
      { label: 'プライバシーポリシー' },
    ],
    [t]
  );

  return (
    <div className="privacy-policy-page">
      <div className="privacy-policy-container">
        <Breadcrumb items={breadcrumbItems} />
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
            最終更新日:{' '}
            {new Date().toLocaleDateString('ja-JP', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </header>

        <div className="privacy-policy-content">
          {/* イントロダクション */}
          <section className="privacy-policy-section">
            <h2 className="privacy-policy-section-title">1. はじめに</h2>
            <div className="privacy-policy-text-content">
              <p>
                FLM（Local LLM API
                Manager）は、お客様のプライバシーを尊重します。
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
                <li>
                  API設定情報（エンドポイント、認証情報、エンジン設定など）
                </li>
                <li>
                  APIキー（AES-256-GCMで暗号化して保存、OSキーストアを使用）
                </li>
                <li>
                  OAuthトークン（アクセストークン、リフレッシュトークン、AES-256-GCMで暗号化して保存）
                </li>
                <li>
                  リクエストログ（リクエストボディは設定で無効化可能、マスク処理あり）
                </li>
                <li>
                  パフォーマンスメトリクス（CPU/メモリ使用率、レスポンス時間など、設定で無効化可能）
                </li>
                <li>
                  監査ログ（API操作履歴、IPアドレスはハッシュ化または設定で除外可能、ユーザーエージェントは簡略化）
                </li>
                <li>アラート履歴</li>
                <li>
                  アプリケーション設定（テーマ、言語設定、ログ保持期間、診断機能の有効/無効、パフォーマンスメトリクス収集の有効/無効など）
                </li>
                <li>モデル管理情報（インストール済みモデル、使用回数など）</li>
                <li>
                  デバイスID（リモート同期機能使用時のみ、SHA-256でハッシュ化）
                </li>
                <li>
                  バックアップファイル（オプションで暗号化可能、パスワード保護）
                </li>
                <li>
                  環境変数（アプリケーションの動作に必要な設定、機密情報を含む場合あり）
                </li>
              </ul>

              <h3>2.2 メモリ内に一時保存されるデータ</h3>
              <p>
                以下の情報は、アプリケーションの実行中のみメモリ内に一時的に保存されます：
              </p>
              <ul>
                <li>キャッシュ（モデル一覧、API設定など）</li>
                <li>
                  診断情報（システム情報、30秒間のみ保持、診断機能が有効な場合のみ）
                </li>
                <li>レート制限情報（IPアドレスはハッシュ化）</li>
                <li>
                  パフォーマンスメトリクス（CPU/メモリ使用率、レスポンス時間、パフォーマンスメトリクス収集が有効な場合のみ）
                </li>
              </ul>

              <h3>2.3 システム情報の収集（診断機能）</h3>
              <p>
                診断機能が有効な場合、以下のシステム情報を収集します（設定画面で無効化可能）：
              </p>
              <ul>
                <li>OS情報（OS名、バージョン）</li>
                <li>CPU情報（コア数、使用率）</li>
                <li>メモリ情報（総容量、使用量）</li>
                <li>ディスク情報（総容量、使用量）</li>
                <li>ネットワーク情報（インターフェース、帯域幅）</li>
              </ul>
              <p>
                <strong>注意</strong>:
                診断機能はデフォルトで有効ですが、設定画面からいつでも無効化できます。
                診断情報は30秒間のみメモリ内に保持され、データベースには保存されません。
              </p>

              <h3>2.4 パフォーマンスメトリクスの収集</h3>
              <p>
                パフォーマンスメトリクス収集が有効な場合、以下の情報を収集します（設定画面で無効化可能）：
              </p>
              <ul>
                <li>APIレスポンス時間</li>
                <li>CPU使用率</li>
                <li>メモリ使用率</li>
                <li>リクエスト数</li>
                <li>エラー率</li>
              </ul>
              <p>
                <strong>注意</strong>:
                パフォーマンスメトリクス収集はデフォルトで有効ですが、設定画面からいつでも無効化できます。
                収集されたメトリクスはデータベースに保存され、ログ保持期間設定に従って自動削除されます。
              </p>

              <h3>2.5 IPアドレスの使用</h3>
              <p>本アプリケーションは、以下の目的でIPアドレスを使用します：</p>
              <ul>
                <li>
                  <strong>監査ログ</strong>:
                  操作履歴の記録（設定で無効化可能、デフォルトでハッシュ化）
                </li>
                <li>
                  <strong>レート制限</strong>:
                  不正アクセスの防止（ハッシュ化して使用）
                </li>
              </ul>
              <p>
                <strong>プライバシー保護</strong>:
                IPアドレスはSHA-256でハッシュ化され、最初の8バイト（16文字）のみが使用されます。
                設定画面から監査ログへのIPアドレスの保存を無効化できます。
              </p>

              <h3>2.6 ログ保持期間設定</h3>
              <p>本アプリケーションは、以下のログの保持期間を設定できます：</p>
              <ul>
                <li>
                  <strong>リクエストログ</strong>:
                  デフォルト30日（設定画面で変更可能、1日〜365日）
                </li>
                <li>
                  <strong>監査ログ</strong>:
                  デフォルト90日（設定画面で変更可能、1日〜365日）
                </li>
                <li>
                  <strong>パフォーマンスメトリクス</strong>:
                  リクエストログと同じ保持期間
                </li>
              </ul>
              <p>設定された保持期間を超えたログは自動的に削除されます。</p>

              <h3>2.7 ログのエクスポート/インポート機能</h3>
              <p>
                本アプリケーションは、ログのエクスポート/インポート機能を提供しています。
              </p>
              <ul>
                <li>
                  <strong>エクスポート形式</strong>: CSV、JSON
                </li>
                <li>
                  <strong>エクスポートされるデータ</strong>:
                  <ul>
                    <li>リクエストログ（フィルタリング可能）</li>
                    <li>
                      リクエストボディ（デフォルトで除外、オプションでマスク処理あり）
                    </li>
                    <li>エクスポート日時</li>
                  </ul>
                </li>
                <li>
                  <strong>暗号化オプション</strong>:
                  エクスポートファイルをパスワード保護（AES-256-GCM）
                </li>
                <li>
                  <strong>プライバシー保護</strong>:
                  エクスポート時に機密情報のマスク処理を実行
                </li>
              </ul>
              <p>
                エクスポートは、ユーザーが明示的に実行した場合にのみ実行されます。
              </p>

              <h3>2.8 バックアップ機能</h3>
              <p>
                本アプリケーションは、データのバックアップ機能を提供しています。
              </p>
              <ul>
                <li>
                  <strong>バックアップに含まれるデータ</strong>:
                  <ul>
                    <li>API設定情報（すべて）</li>
                    <li>APIキー（暗号化されたキーのみ）</li>
                    <li>インストール済みモデル情報</li>
                    <li>リクエストログ（最新1000件）</li>
                    <li>アラート履歴（最新1000件）</li>
                  </ul>
                </li>
                <li>
                  <strong>バックアップ形式</strong>: JSON
                </li>
                <li>
                  <strong>暗号化オプション</strong>:
                  バックアップファイルをパスワード保護（AES-256-GCM）
                </li>
                <li>
                  <strong>デフォルト暗号化設定</strong>:
                  設定画面でバックアップファイルをデフォルトで暗号化するオプションを有効化できます（プライバシー保護のため推奨）
                </li>
                <li>
                  <strong>保存場所</strong>: ユーザーが指定した場所
                </li>
              </ul>
              <p>
                バックアップは、ユーザーが明示的に実行した場合にのみ実行されます。
              </p>

              <h3>2.9 ウェブサイトでのダウンロード追跡</h3>
              <p>
                本アプリケーションのウェブサイト（https://flm.example.com）では、ダウンロード統計の収集を行います。
              </p>
              <ul>
                <li>
                  <strong>収集される情報</strong>:
                  <ul>
                    <li>OS情報（Windows、macOS、Linux）</li>
                    <li>ダウンロード日時</li>
                  </ul>
                </li>
                <li>
                  <strong>保存場所</strong>:
                  ブラウザのローカルストレージ（ユーザーのデバイスのみ）
                </li>
                <li>
                  <strong>追跡方式</strong>:
                  オプトイン方式（ユーザーの同意が必要）
                </li>
                <li>
                  <strong>外部送信</strong>:
                  データは外部サービスに送信されません（ローカルストレージのみ）
                </li>
                <li>
                  <strong>同意の管理</strong>:
                  ユーザーはいつでも同意を撤回できます（ブラウザのローカルストレージから削除）
                </li>
              </ul>
              <p>
                <strong>注意</strong>:
                ダウンロード追跡は、ユーザーが明示的に同意した場合にのみ実行されます。
                同意がない場合は、ダウンロード追跡は行われません。
              </p>

              <h3>2.13 外部サービスへの接続（オプション）</h3>
              <p>
                本アプリケーションは、以下の機能で外部サービスに接続する場合があります。
                <strong>
                  これらの接続は、あなたの明示的な同意なしには実行されません。
                </strong>
              </p>

              <h4>2.13.1 自動アップデートチェック（オプション）</h4>
              <ul>
                <li>
                  <strong>接続先</strong>: GitHub API (https://api.github.com)
                </li>
                <li>
                  <strong>送信情報</strong>: 現在のバージョン番号のみ
                </li>
                <li>
                  <strong>目的</strong>: 最新バージョンの確認
                </li>
                <li>
                  <strong>同意</strong>:
                  初回起動時に同意を求めます（設定画面でいつでも変更できます）
                </li>
                <li>
                  <strong>個人情報</strong>: 個人情報は送信されません
                </li>
              </ul>

              <h4>2.13.2 モデル検索機能（オプション）</h4>
              <ul>
                <li>
                  <strong>接続先</strong>: Hugging Face Hub API
                  (https://huggingface.co)
                </li>
                <li>
                  <strong>送信情報</strong>:
                  検索クエリのみ（ユーザーが明示的に実行した場合のみ）
                </li>
                <li>
                  <strong>目的</strong>: モデルの検索と取得
                </li>
                <li>
                  <strong>個人情報</strong>: 個人情報は送信されません
                </li>
              </ul>

              <h4>2.13.3 リモート同期機能（オプション）</h4>
              <ul>
                <li>
                  <strong>接続先</strong>: GitHub Gist API、Google Drive
                  API、Dropbox API（ユーザーが選択）
                </li>
                <li>
                  <strong>送信情報</strong>:
                  <ul>
                    <li>設定データ（APIキーは含まれない）</li>
                    <li>
                      デバイスID（SHA-256でハッシュ化、最初の8バイトのみ使用）
                    </li>
                    <li>同期日時</li>
                  </ul>
                </li>
                <li>
                  <strong>目的</strong>:
                  設定のバックアップと複数デバイス間での同期
                </li>
                <li>
                  <strong>同意</strong>:
                  ユーザーが明示的に有効化する必要があります（デフォルトで無効）
                </li>
                <li>
                  <strong>個人情報</strong>:
                  APIキーなどの機密情報は送信されません
                </li>
                <li>
                  <strong>プライバシー保護</strong>:
                  デバイスIDはハッシュ化され、元のデバイスIDを特定することはできません
                </li>
              </ul>

              <h4>2.13.4 APIテスト機能</h4>
              <ul>
                <li>
                  <strong>接続先</strong>: ユーザーが設定したAPIエンドポイント
                </li>
                <li>
                  <strong>送信情報</strong>:
                  テストリクエスト（ユーザーが明示的に実行した場合のみ）
                </li>
                <li>
                  <strong>目的</strong>: APIの動作確認
                </li>
                <li>
                  <strong>個人情報</strong>:
                  ユーザーが入力したデータのみが送信されます
                </li>
              </ul>

              <h3>2.12 API設定のエクスポート/インポート機能</h3>
              <p>
                本アプリケーションは、API設定のエクスポート/インポート機能を提供しています。
              </p>
              <ul>
                <li>
                  <strong>エクスポートされるデータ</strong>:
                  <ul>
                    <li>API設定情報（APIキーは含まれません）</li>
                    <li>エクスポート日時</li>
                  </ul>
                </li>
                <li>
                  <strong>エクスポート形式</strong>: JSON
                </li>
                <li>
                  <strong>保存場所</strong>: ユーザーが指定した場所
                </li>
                <li>
                  <strong>プライバシー保護</strong>:
                  APIキーなどの機密情報はエクスポートされません。エクスポートされるのは設定情報のみです。
                </li>
              </ul>
              <p>
                エクスポート/インポートは、ユーザーが明示的に実行した場合にのみ実行されます。
              </p>

              <h4>2.3.5 スケジューラー機能（オプション）</h4>
              <ul>
                <li>
                  <strong>機能</strong>:
                  定期的なタスクの実行（ログ削除、バックアップなど）
                </li>
                <li>
                  <strong>保存情報</strong>: スケジュール設定（ローカルのみ）
                </li>
                <li>
                  <strong>外部送信</strong>: なし
                </li>
                <li>
                  <strong>個人情報</strong>: 個人情報は含まれません
                </li>
              </ul>

              <h4>2.3.6 プラグインシステム（将来の機能）</h4>
              <ul>
                <li>
                  <strong>機能</strong>: サードパーティプラグインの実行
                </li>
                <li>
                  <strong>権限管理</strong>:
                  プラグインごとに権限を設定可能（将来実装予定）
                </li>
                <li>
                  <strong>データアクセス</strong>:
                  プラグインの権限に応じてデータアクセスを制限（将来実装予定）
                </li>
                <li>
                  <strong>個人情報</strong>:
                  プラグインは、ユーザーが明示的に許可したデータのみにアクセスできます
                </li>
              </ul>
            </div>
          </section>

          {/* データの使用目的 */}
          <section className="privacy-policy-section">
            <h2 className="privacy-policy-section-title">
              3. データの使用目的
            </h2>
            <div className="privacy-policy-text-content">
              <p>収集したデータは、以下の目的でのみ使用されます：</p>
              <ul>
                <li>APIリクエストの処理とログ記録</li>
                <li>
                  パフォーマンス監視と分析（パフォーマンスメトリクス収集が有効な場合のみ）
                </li>
                <li>アプリケーション機能の提供</li>
                <li>ユーザー設定の保存と復元</li>
                <li>不正アクセスの防止（レート制限、IPアドレスハッシュ化）</li>
                <li>システム診断（診断機能が有効な場合のみ）</li>
                <li>バックアップと復元</li>
                <li>
                  複数デバイス間での設定同期（リモート同期機能が有効な場合のみ）
                </li>
              </ul>
            </div>
          </section>

          {/* データの保護 */}
          <section className="privacy-policy-section">
            <h2 className="privacy-policy-section-title">4. データの保護</h2>
            <div className="privacy-policy-text-content">
              <p>本アプリケーションは、以下の方法でデータを保護します：</p>
              <ul>
                <li>APIキーの暗号化保存（AES-256-GCM、OSキーストアを使用）</li>
                <li>OAuthトークンの暗号化保存（AES-256-GCM）</li>
                <li>
                  IPアドレスのハッシュ化（監査ログ、レート制限、SHA-256の最初の8バイトを使用）
                </li>
                <li>
                  ユーザーエージェントの簡略化（監査ログ、ブラウザ名のみ、バージョン情報は除外）
                </li>
                <li>
                  デバイスIDのハッシュ化（リモート同期、SHA-256の最初の8バイトを使用）
                </li>
                <li>
                  バックアップファイルの暗号化オプション（パスワード保護）
                </li>
                <li>ローカルデータベースへの安全な保存</li>
                <li>ネットワーク通信のセキュリティ（HTTPS使用時）</li>
                <li>
                  エラーメッセージからの機密情報の除外（ファイルパス、環境変数、APIキーなどをマスク）
                </li>
                <li>
                  本番環境でのログレベル制御（開発環境では詳細、本番環境ではエラーのみ）
                </li>
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
              <p>ユーザーは、いつでも以下の方法でデータを削除できます：</p>
              <ul>
                <li>アプリケーション内の設定画面からログを削除</li>
                <li>
                  ログの自動削除機能（設定した保持期間を超えたログは自動削除）
                </li>
                <li>リクエストログの保持期間設定（デフォルト: 30日）</li>
                <li>監査ログの保持期間設定（デフォルト: 90日）</li>
                <li>パフォーマンスメトリクスの自動削除</li>
                <li>アプリケーションのアンインストール</li>
                <li>データベースファイルの手動削除</li>
              </ul>
            </div>
          </section>

          {/* Cookieとトラッキング */}
          <section className="privacy-policy-section">
            <h2 className="privacy-policy-section-title">
              7. Cookieとトラッキング
            </h2>
            <div className="privacy-policy-text-content">
              <p>
                本アプリケーションは、Cookieを使用しません。
                すべてのデータはローカルデバイス上で処理されます。
              </p>
              <p>
                <strong>ウェブサイトでの追跡</strong>:
                当プロジェクトのウェブサイトでは、ダウンロード統計の収集をオプトイン方式で行っています。
                初回ダウンロード時に同意を求め、同意がない場合は統計情報は収集されません。
                収集される情報は、OS情報とダウンロード日時のみで、ローカルストレージに保存されます。
                詳細は
                <a
                  href="https://unjuno.github.io/FLM/privacy.html"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  ウェブサイトのプライバシーポリシー
                </a>
                をご確認ください。
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
            <h2 className="privacy-policy-section-title">
              9. プライバシーポリシーの変更
            </h2>
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
