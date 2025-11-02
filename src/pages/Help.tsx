// FLM - Help Page
// フロントエンドエージェント (FE) 実装
// FE-009-01: ヘルプページ実装

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOnboarding } from '../components/onboarding/Onboarding';
import { KeyboardShortcuts } from '../components/common/KeyboardShortcuts';
import { useGlobalKeyboardShortcuts, KeyboardShortcut } from '../hooks/useKeyboardShortcuts';
import './Help.css';

/**
 * ヘルプページコンポーネント
 * よくある質問、使い方ガイド、トラブルシューティングを提供
 */
export const Help: React.FC = () => {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<string>('faq');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const { handleShowOnboarding } = useOnboarding();
  
  // グローバルキーボードショートカットを有効化
  useGlobalKeyboardShortcuts();
  
  // ショートカット定義（表示用）
  const globalShortcuts: KeyboardShortcut[] = [
    {
      key: 'n',
      description: '新しいAPIを作成',
      ctrlKey: true,
      handler: () => navigate('/api/create'),
    },
    {
      key: 'l',
      description: 'APIログを表示',
      ctrlKey: true,
      handler: () => navigate('/logs'),
    },
    {
      key: 'p',
      description: 'パフォーマンスダッシュボードを表示',
      ctrlKey: true,
      handler: () => navigate('/performance'),
    },
    {
      key: 'm',
      description: 'モデル管理を表示',
      ctrlKey: true,
      handler: () => navigate('/models'),
    },
    {
      key: 'h',
      description: 'ヘルプを表示',
      ctrlKey: true,
      handler: () => navigate('/help'),
    },
    {
      key: 'Home',
      description: 'ホーム画面に戻る',
      ctrlKey: true,
      handler: () => navigate('/'),
    },
    {
      key: 'Escape',
      description: 'モーダルを閉じる',
      handler: () => {
        const event = new CustomEvent('closeModal');
        window.dispatchEvent(event);
      },
    },
  ];
  
  // グローバルキーボードショートカットを有効化
  useGlobalKeyboardShortcuts();

  const toggleItem = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  const faqItems = [
    {
      id: 'faq-1',
      question: 'FLMとは何ですか？',
      answer: 'FLM（Local LLM API Management Tool）は、技術知識がなくても、コードを書かずに、ローカルLLMのAPIを作成・利用できるデスクトップアプリケーションです。'
    },
    {
      id: 'faq-2',
      question: 'FLMは無料ですか？',
      answer: 'はい、FLMは無料で使用できます。オープンソースプロジェクトです。'
    },
    {
      id: 'faq-3',
      question: 'どのOSで動作しますか？',
      answer: '現在はWindowsを主にサポートしています。将来的にはmacOS、Linuxにも対応予定です。'
    },
    {
      id: 'faq-4',
      question: '必要なシステム要件は？',
      answer: 'OS: Windows 10以上（推奨: Windows 11）、メモリ: 8GB以上（推奨: 16GB以上）、ストレージ: 10GB以上の空き容量（モデルによって追加の容量が必要）、CPU: 64ビットプロセッサ'
    },
    {
      id: 'faq-5',
      question: 'Ollamaとは何ですか？',
      answer: 'Ollamaは、ローカルでLLM（大規模言語モデル）を実行するためのツールです。FLMはOllamaを使用してLLMのAPIを提供します。'
    },
    {
      id: 'faq-6',
      question: 'Ollamaのインストールは必要ですか？',
      answer: 'いいえ、必要ありません。FLMが自動的にOllamaをダウンロード・インストールします。既にインストールされている場合は、それを使用します。'
    },
    {
      id: 'faq-7',
      question: 'どのモデルを選べばいいですか？',
      answer: '初心者の方は推奨モデルを選択してください（画面上でハイライト表示）。チャット用途ならllama3:8b、mistral:7bなど。コード生成ならcodellama:7b、deepseek-coder:6.7bなど。軽量モデルならtinyllama:1.1b、phi:2.7bなどがおすすめです。'
    },
    {
      id: 'faq-8',
      question: 'ポート番号は何を選べばいいですか？',
      answer: 'デフォルトの8080で問題ありません。他のアプリケーションが使用している場合は、8081、8082などの別のポート番号を選択してください。'
    },
    {
      id: 'faq-9',
      question: '認証を有効にする必要はありますか？',
      answer: 'ローカル環境のみで使用する場合は認証を無効にしても問題ありません。外部アプリケーションから使用する場合は、認証を有効にすることをおすすめします。'
    },
    {
      id: 'faq-10',
      question: 'APIキーはどこで確認できますか？',
      answer: 'API作成時の成功画面に表示されます。また、API詳細画面の「詳細」ボタンから確認できます。設定変更画面でAPIキーを再生成することもできます。'
    }
  ];

  const guideSections = [
    {
      id: 'guide-1',
      title: '初回起動',
      content: [
        '1. FLMアプリケーションを起動すると、最初にOllamaの状態を確認します',
        '2. Ollamaがインストールされていない場合、自動的にダウンロードします（推奨）',
        '3. 既にインストールされているOllamaを使用することもできます',
        '4. 「Ollamaをダウンロード」ボタンをクリックして、ダウンロード進捗を確認します'
      ]
    },
    {
      id: 'guide-2',
      title: 'APIの作成',
      content: [
        'ステップ1: ホーム画面で「新しいAPIを作成」ボタンをクリック',
        'ステップ2: 使用したいモデルを選択します（推奨モデルがハイライト表示されます）',
        'ステップ3: API設定を入力（API名、ポート番号、認証設定）',
        'ステップ4: 「作成」ボタンをクリックしてAPI作成処理を開始',
        'ステップ5: 成功画面でAPIエンドポイントとAPIキー（認証が有効な場合）を確認',
        '重要: APIキーは作成時のみ表示されます。安全な場所に保存してください'
      ]
    },
    {
      id: 'guide-3',
      title: 'APIの利用',
      content: [
        '1. ホーム画面またはメニューから「API一覧」を選択',
        '2. 作成済みのAPI一覧が表示されます',
        '3. 「起動」ボタンをクリックしてAPIを起動',
        '4. APIエンドポイントとAPIキーを使用して、OpenAI互換の形式でAPIを利用',
        '5. 「テスト」ボタンから直接APIをテストできます',
        '6. 「ログ」画面でリクエストログを確認できます'
      ]
    },
    {
      id: 'guide-4',
      title: 'モデルの管理',
      content: [
        '1. ホーム画面から「モデル管理」を選択',
        '2. 利用可能なモデルを検索・ダウンロード',
        '3. インストール済みモデル一覧からモデルを削除できます',
        '4. モデルのサイズによってダウンロード時間が異なります（小: 数分、中: 10-30分、大: 1時間以上）'
      ]
    },
    {
      id: 'guide-5',
      title: 'パフォーマンス監視',
      content: [
        '1. ホーム画面から「パフォーマンス監視」を選択',
        '2. API選択ドロップダウンから監視したいAPIを選択',
        '3. 期間選択（1時間、24時間、7日間）',
        '4. レスポンス時間、リクエスト数、CPU/メモリ使用量、エラー率などのグラフを確認',
        '5. 統計サマリーカードで現在の状態を確認'
      ]
    }
  ];

  const troubleshootingItems = [
    {
      id: 'trouble-1',
      title: 'Ollamaが起動しない',
      symptoms: ['「Ollamaが実行されていません」というエラー', 'API作成時に失敗'],
      solutions: [
        'アプリケーションを再起動して、Ollamaの状態を確認',
        '手動でOllamaを起動（コマンドラインから `ollama serve` を実行）',
        'ポート11434が他のアプリケーションで使用されていないか確認',
        'Ollamaの自動ダウンロードを再試行'
      ]
    },
    {
      id: 'trouble-2',
      title: 'APIが起動しない',
      symptoms: ['「起動」ボタンをクリックしても起動しない', 'ステータスが「停止中」のまま'],
      solutions: [
        'Ollamaが起動しているか確認',
        'ポート番号が使用されていないか確認（他のアプリケーションとポートが競合していないか）',
        'エラーメッセージの内容を確認',
        'アプリケーションを再起動して再試行'
      ]
    },
    {
      id: 'trouble-3',
      title: 'モデルのダウンロードが失敗する',
      symptoms: ['ダウンロード進捗が進まない', 'ダウンロードが途中で失敗'],
      solutions: [
        'インターネット接続を確認',
        '十分なストレージ容量があるか確認（最低10GB）',
        'ダウンロードを再試行',
        '数回試しても失敗する場合、手動でOllamaモデルをダウンロード'
      ]
    },
    {
      id: 'trouble-4',
      title: 'APIキーを忘れてしまった',
      symptoms: ['APIキーが表示されない', 'APIに接続できない'],
      solutions: [
        'API詳細画面の「詳細」ボタンからAPIキーを確認',
        '設定変更画面で「APIキーを再生成」ボタンをクリック',
        '注意: 古いAPIキーは無効になります'
      ]
    },
    {
      id: 'trouble-5',
      title: 'エラーメッセージがわかりません',
      symptoms: ['エラーメッセージが表示される', '問題が解決しない'],
      solutions: [
        'エラーメッセージの内容に従って操作',
        'このヘルプページのトラブルシューティングセクションを確認',
        'アプリケーションを再起動して再試行',
        '問題が解決しない場合は、GitHub Issuesで報告'
      ]
    },
    {
      id: 'trouble-6',
      title: 'パフォーマンスが悪い',
      symptoms: ['APIの応答が遅い', 'CPU使用率が高い', 'メモリ使用量が多い'],
      solutions: [
        'これは正常な動作です。LLMの推論処理はCPUとメモリを多く使用します',
        '軽量モデルを使用することをおすすめします',
        '複数のAPIを同時に起動している場合は、不要なAPIを停止',
        '他のアプリケーションを終了してリソースを確保'
      ]
    }
  ];

  return (
    <div className="help-page">
      <div className="help-container">
        <header className="help-header">
          <h1>ヘルプ &amp; サポート</h1>
          <p className="help-subtitle">
            FLMアプリケーションの使い方、よくある質問、トラブルシューティング
          </p>
        </header>

        <nav className="help-nav">
          <button
            className={`help-nav-button ${activeSection === 'faq' ? 'active' : ''}`}
            onClick={() => setActiveSection('faq')}
          >
            <span className="nav-icon">❓</span>
            よくある質問
          </button>
          <button
            className={`help-nav-button ${activeSection === 'guide' ? 'active' : ''}`}
            onClick={() => setActiveSection('guide')}
          >
            <span className="nav-icon">📖</span>
            使い方ガイド
          </button>
          <button
            className={`help-nav-button ${activeSection === 'trouble' ? 'active' : ''}`}
            onClick={() => setActiveSection('trouble')}
          >
            <span className="nav-icon">🔧</span>
            トラブルシューティング
          </button>
          <button
            className={`help-nav-button ${activeSection === 'shortcuts' ? 'active' : ''}`}
            onClick={() => setActiveSection('shortcuts')}
          >
            <span className="nav-icon">⌨️</span>
            キーボードショートカット
          </button>
        </nav>

        <div className="help-content">
          {activeSection === 'faq' && (
            <section className="help-section">
              <h2>よくある質問（FAQ）</h2>
              <div className="faq-list">
                {faqItems.map((item) => (
                  <div key={item.id} className="faq-item">
                    <button
                      className="faq-question"
                      onClick={() => toggleItem(item.id)}
                    >
                      <span className="faq-icon">
                        {expandedItems.has(item.id) ? '▼' : '▶'}
                      </span>
                      <span className="faq-text">{item.question}</span>
                    </button>
                    {expandedItems.has(item.id) && (
                      <div className="faq-answer">{item.answer}</div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {activeSection === 'guide' && (
            <section className="help-section">
              <h2>使い方ガイド</h2>
              <div className="guide-list">
                {guideSections.map((section) => (
                  <div key={section.id} className="guide-item">
                    <h3 className="guide-title">{section.title}</h3>
                    <ul className="guide-content">
                      {section.content.map((line, index) => (
                        <li key={index}>{line}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          )}

          {activeSection === 'trouble' && (
            <section className="help-section">
              <h2>トラブルシューティング</h2>
              <div className="trouble-list">
                {troubleshootingItems.map((item) => (
                  <div key={item.id} className="trouble-item">
                    <button
                      className="trouble-title-button"
                      onClick={() => toggleItem(item.id)}
                    >
                      <span className="trouble-icon">
                        {expandedItems.has(item.id) ? '▼' : '▶'}
                      </span>
                      <span className="trouble-title-text">{item.title}</span>
                    </button>
                    {expandedItems.has(item.id) && (
                      <div className="trouble-content">
                        <div className="trouble-symptoms">
                          <h4>症状:</h4>
                          <ul>
                            {item.symptoms.map((symptom, index) => (
                              <li key={index}>{symptom}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="trouble-solutions">
                          <h4>解決方法:</h4>
                          <ol>
                            {item.solutions.map((solution, index) => (
                              <li key={index}>{solution}</li>
                            ))}
                          </ol>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {activeSection === 'shortcuts' && (
            <section className="help-section">
              <h2>キーボードショートカット</h2>
              <p className="help-section-intro">
                以下のキーボードショートカットを使用して、素早く操作できます。
              </p>
              <KeyboardShortcuts shortcuts={globalShortcuts} />
            </section>
          )}
        </div>

        <footer className="help-footer">
          <div className="help-footer-content">
            <p>
              まだ質問がある場合:
              <a
                href="https://github.com/your-repo/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="help-link"
              >
                GitHub Issues
              </a>
              で報告してください。
            </p>
            <button
              className="help-onboarding-button"
              onClick={() => {
                handleShowOnboarding();
                navigate('/');
              }}
            >
              📚 チュートリアルを再表示
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};

