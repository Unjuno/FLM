// Help - ヘルプページ

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { useOnboarding } from '../components/onboarding/Onboarding';
import { KeyboardShortcuts } from '../components/common/KeyboardShortcuts';
import {
  useGlobalKeyboardShortcuts,
  KeyboardShortcut,
} from '../hooks/useKeyboardShortcuts';
import { Breadcrumb, BreadcrumbItem } from '../components/common/Breadcrumb';
import { Tooltip } from '../components/common/Tooltip';
import { useI18n } from '../contexts/I18nContext';
import './Help.css';

/**
 * ヘルプページコンポーネント
 * よくある質問、使い方ガイド、トラブルシューティングを提供
 */
export const Help: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18n();
  const [activeSection, setActiveSection] = useState<string>('faq');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const { handleShowOnboarding } = useOnboarding();

  // グローバルキーボードショートカットを有効化
  useGlobalKeyboardShortcuts();

  // URL stateからエラータイプを取得（ErrorMessageから遷移した場合）
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const errorType = urlParams.get('errorType');
    if (errorType) {
      // エラータイプからトラブルシューティングIDを取得
      const getTroubleIdFromErrorType = (errType: string): number => {
        switch (errType) {
          case 'ollama':
            return 1; // 'Ollamaが起動しない'
          case 'api':
            return 2; // 'APIが起動しない'
          case 'model':
            return 3; // 'モデルのダウンロードが失敗する'
          case 'network':
            return 3; // 'モデルのダウンロードが失敗する'（ネットワークエラーの場合）
          default:
            return 5; // 'エラーメッセージがわかりません'
        }
      };

      // エラータイプに応じたトラブルシューティングセクションを開く
      setActiveSection('trouble');
      // 該当するトラブルシューティング項目を展開
      const troubleId = `trouble-${getTroubleIdFromErrorType(errorType)}`;
      setExpandedItems(new Set([troubleId]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  // ショートカット定義（表示用）
  const globalShortcuts: KeyboardShortcut[] = useMemo(() => [
    {
      key: 'n',
      description: t('help.shortcuts.shortcuts.createApi'),
      ctrlKey: true,
      handler: () => navigate('/api/create'),
    },
    {
      key: 'l',
      description: t('help.shortcuts.shortcuts.showLogs'),
      ctrlKey: true,
      handler: () => navigate('/logs'),
    },
    {
      key: 'p',
      description: t('help.shortcuts.shortcuts.showPerformance'),
      ctrlKey: true,
      handler: () => navigate('/performance'),
    },
    {
      key: 'm',
      description: t('help.shortcuts.shortcuts.showModels'),
      ctrlKey: true,
      handler: () => navigate('/models'),
    },
    {
      key: 'h',
      description: t('help.shortcuts.shortcuts.showHelp'),
      ctrlKey: true,
      handler: () => navigate('/help'),
    },
    {
      key: 'Home',
      description: t('help.shortcuts.shortcuts.goHome'),
      ctrlKey: true,
      handler: () => navigate('/'),
    },
    {
      key: 'Escape',
      description: t('help.shortcuts.shortcuts.closeModal'),
      handler: () => {
        const event = new CustomEvent('closeModal');
        window.dispatchEvent(event);
      },
    },
  ], [t, navigate]);

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

  const faqItems = useMemo(() => [
    {
      id: 'faq-1',
      question: t('help.faq.items.faq1.question'),
      answer: t('help.faq.items.faq1.answer'),
    },
    {
      id: 'faq-2',
      question: t('help.faq.items.faq2.question'),
      answer: t('help.faq.items.faq2.answer'),
    },
    {
      id: 'faq-3',
      question: t('help.faq.items.faq3.question'),
      answer: t('help.faq.items.faq3.answer'),
    },
    {
      id: 'faq-4',
      question: t('help.faq.items.faq4.question'),
      answer: t('help.faq.items.faq4.answer'),
    },
    {
      id: 'faq-5',
      question: t('help.faq.items.faq5.question'),
      answer: t('help.faq.items.faq5.answer'),
    },
    {
      id: 'faq-6',
      question: t('help.faq.items.faq6.question'),
      answer: t('help.faq.items.faq6.answer'),
    },
    {
      id: 'faq-7',
      question: t('help.faq.items.faq7.question'),
      answer: t('help.faq.items.faq7.answer'),
    },
    {
      id: 'faq-8',
      question: t('help.faq.items.faq8.question'),
      answer: t('help.faq.items.faq8.answer'),
    },
    {
      id: 'faq-9',
      question: t('help.faq.items.faq9.question'),
      answer: t('help.faq.items.faq9.answer'),
    },
    {
      id: 'faq-10',
      question: t('help.faq.items.faq10.question'),
      answer: t('help.faq.items.faq10.answer'),
    },
  ], [t]);

  const guideSections = useMemo(() => {
    const getContent = (guideId: string, count: number): string[] => {
      const content: string[] = [];
      for (let i = 0; i < count; i++) {
        const key = `help.guide.sections.${guideId}.content${i}`;
        const text = t(key);
        if (text && text !== key) {
          content.push(text);
        }
      }
      return content;
    };
    
    return [
      {
        id: 'guide-1',
        title: t('help.guide.sections.guide1.title'),
        content: getContent('guide1', 4),
      },
      {
        id: 'guide-2',
        title: t('help.guide.sections.guide2.title'),
        content: getContent('guide2', 6),
      },
      {
        id: 'guide-3',
        title: t('help.guide.sections.guide3.title'),
        content: getContent('guide3', 6),
      },
      {
        id: 'guide-4',
        title: t('help.guide.sections.guide4.title'),
        content: getContent('guide4', 4),
      },
      {
        id: 'guide-5',
        title: t('help.guide.sections.guide5.title'),
        content: getContent('guide5', 5),
      },
    ];
  }, [t]);

  const troubleshootingItems = useMemo(() => {
    const getSymptoms = (troubleId: string, count: number): string[] => {
      const symptoms: string[] = [];
      for (let i = 0; i < count; i++) {
        const key = `help.trouble.items.${troubleId}.symptom${i}`;
        const text = t(key);
        if (text && text !== key) {
          symptoms.push(text);
        }
      }
      return symptoms;
    };
    
    const getSolutions = (troubleId: string, count: number): string[] => {
      const solutions: string[] = [];
      for (let i = 0; i < count; i++) {
        const key = `help.trouble.items.${troubleId}.solution${i}`;
        const text = t(key);
        if (text && text !== key) {
          solutions.push(text);
        }
      }
      return solutions;
    };
    
    return [
      {
        id: 'trouble-1',
        title: t('help.trouble.items.trouble1.title'),
        symptoms: getSymptoms('trouble1', 2),
        solutions: getSolutions('trouble1', 4),
      },
      {
        id: 'trouble-2',
        title: t('help.trouble.items.trouble2.title'),
        symptoms: getSymptoms('trouble2', 2),
        solutions: getSolutions('trouble2', 4),
      },
      {
        id: 'trouble-3',
        title: t('help.trouble.items.trouble3.title'),
        symptoms: getSymptoms('trouble3', 2),
        solutions: getSolutions('trouble3', 4),
      },
      {
        id: 'trouble-4',
        title: t('help.trouble.items.trouble4.title'),
        symptoms: getSymptoms('trouble4', 2),
        solutions: getSolutions('trouble4', 3),
      },
      {
        id: 'trouble-5',
        title: t('help.trouble.items.trouble5.title'),
        symptoms: getSymptoms('trouble5', 2),
        solutions: getSolutions('trouble5', 4),
      },
      {
        id: 'trouble-6',
        title: t('help.trouble.items.trouble6.title'),
        symptoms: getSymptoms('trouble6', 3),
        solutions: getSolutions('trouble6', 4),
      },
    ];
  }, [t]);

  // パンくずリストの項目
  const breadcrumbItems: BreadcrumbItem[] = useMemo(() => [
    { label: t('header.home') || 'ホーム', path: '/' },
    { label: t('help.title') || 'ヘルプ' },
  ], [t]);

  return (
    <AppLayout>
      <Breadcrumb items={breadcrumbItems} />
      <div className="help-page">
        <div className="page-container help-container">
          <header className="page-header help-header">
            <h1>{t('help.title')}</h1>
            <p className="help-subtitle">
              {t('help.subtitle')}
            </p>
          </header>

          <div className="help-content-wrapper">
            <nav className="help-nav">
              <button
                className={`help-nav-button ${activeSection === 'faq' ? 'active' : ''}`}
                onClick={() => setActiveSection('faq')}
              >
                <span className="nav-icon"></span>
                {t('help.nav.faq')}
              </button>
              <button
                className={`help-nav-button ${activeSection === 'guide' ? 'active' : ''}`}
                onClick={() => setActiveSection('guide')}
              >
                <span className="nav-icon"></span>
                {t('help.nav.guide')}
              </button>
              <button
                className={`help-nav-button ${activeSection === 'trouble' ? 'active' : ''}`}
                onClick={() => setActiveSection('trouble')}
              >
                <span className="nav-icon"></span>
                {t('help.nav.trouble')}
              </button>
              <button
                className={`help-nav-button ${activeSection === 'shortcuts' ? 'active' : ''}`}
                onClick={() => setActiveSection('shortcuts')}
              >
                <span className="nav-icon"></span>
                {t('help.nav.shortcuts')}
              </button>
              <button
                className={`help-nav-button ${activeSection === 'glossary' ? 'active' : ''}`}
                onClick={() => setActiveSection('glossary')}
              >
                <span className="nav-icon"></span>
                用語集
              </button>
            </nav>

            <div className="help-content">
              {activeSection === 'faq' && (
                <section className="help-section">
                  <h2>{t('help.faq.title')}</h2>
                  <div className="faq-list">
                    {faqItems.map(item => (
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
                  <h2>{t('help.guide.title')}</h2>
                  <div className="guide-list">
                    {guideSections.map(section => (
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
                  <h2>{t('help.trouble.title')}</h2>
                  <div className="trouble-list">
                    {troubleshootingItems.map(item => (
                      <div key={item.id} className="trouble-item">
                        <button
                          className="trouble-title-button"
                          onClick={() => toggleItem(item.id)}
                        >
                          <span className="trouble-icon">
                            {expandedItems.has(item.id) ? '▼' : '▶'}
                          </span>
                          <span className="trouble-title-text">
                            {item.title}
                          </span>
                        </button>
                        {expandedItems.has(item.id) && (
                          <div className="trouble-content">
                            <div className="trouble-symptoms">
                              <h4>{t('help.trouble.symptoms')}</h4>
                              <ul>
                                {item.symptoms.map((symptom, index) => (
                                  <li key={index}>{symptom}</li>
                                ))}
                              </ul>
                            </div>
                            <div className="trouble-solutions">
                              <h4>{t('help.trouble.solutions')}</h4>
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
                  <h2>{t('help.shortcuts.title')}</h2>
                  <p className="help-section-intro">
                    {t('help.shortcuts.intro')}
                  </p>
                  <KeyboardShortcuts shortcuts={globalShortcuts} />
                </section>
              )}

              {activeSection === 'glossary' && (
                <section className="help-section">
                  <h2>用語集</h2>
                  <p className="help-section-intro">
                    アプリケーションで使用される技術用語の説明です。分からない用語があれば、こちらを参照してください。
                  </p>
                  <div className="glossary-list">
                    <div className="glossary-item">
                      <h3 className="glossary-term">
                        <Tooltip
                          content="APIの接続先URLです。外部アプリケーションからこのURLにアクセスしてAPIを使用できます。"
                          title="エンドポイントとは？"
                        >
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                            エンドポイント
                            <span style={{ fontSize: '0.875rem', opacity: 0.7 }}>❓</span>
                          </span>
                        </Tooltip>
                      </h3>
                      <p className="glossary-definition">
                        APIの接続先URLです。外部アプリケーションからこのURLにアクセスしてAPIを使用できます。
                        例: <code>https://localhost:8080</code>
                      </p>
                    </div>
                    <div className="glossary-item">
                      <h3 className="glossary-term">
                        <Tooltip
                          content="APIを安全に使用するための認証キーです。外部アプリケーションからAPIを使用する際に必要です。"
                          title="APIキーとは？"
                        >
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                            APIキー
                            <span style={{ fontSize: '0.875rem', opacity: 0.7 }}>❓</span>
                          </span>
                        </Tooltip>
                      </h3>
                      <p className="glossary-definition">
                        APIを安全に使用するための認証キーです。外部アプリケーションからAPIを使用する際に必要です。
                        このキーは秘密にしてください。他人に知られると、あなたのAPIが不正に使用される可能性があります。
                      </p>
                    </div>
                    <div className="glossary-item">
                      <h3 className="glossary-term">
                        <Tooltip
                          content="APIが使用する通信ポート番号です。通常は自動的に設定されます。"
                          title="ポート番号とは？"
                        >
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                            ポート番号
                            <span style={{ fontSize: '0.875rem', opacity: 0.7 }}>❓</span>
                          </span>
                        </Tooltip>
                      </h3>
                      <p className="glossary-definition">
                        APIが使用する通信ポート番号です。通常は自動的に設定されますが、必要に応じて変更できます。
                        ポート番号が使用中の場合は自動的に利用可能なポートを選択します。
                        例: <code>8080</code>, <code>8081</code>
                      </p>
                    </div>
                    <div className="glossary-item">
                      <h3 className="glossary-term">モデル</h3>
                      <p className="glossary-definition">
                        質問に答えてくれるAIです。用途に応じて様々なモデルが用意されています。
                        推奨モデルは初心者にも使いやすいモデルです。
                      </p>
                    </div>
                    <div className="glossary-item">
                      <h3 className="glossary-term">エンジン</h3>
                      <p className="glossary-definition">
                        AIモデルを実行するためのソフトウェアです。Ollama、LM Studio、vLLMなどがあります。
                        最も一般的なのはOllamaです。
                      </p>
                    </div>
                    <div className="glossary-item">
                      <h3 className="glossary-term">認証</h3>
                      <p className="glossary-definition">
                        APIを安全に使用するための機能です。認証を有効にすると、APIキーが必要になります。
                        外部アプリケーションから使用する場合は有効にすることをおすすめします。
                      </p>
                    </div>
                  </div>
                </section>
              )}
            </div>

            <footer className="help-footer">
              <div className="help-footer-content">
                <p>
                  {t('help.footer.moreQuestions')}
                  <a
                    href={t('help.footer.githubUrl')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="help-link"
                  >
                    {t('help.footer.githubIssues')}
                  </a>
                  {t('help.footer.reportOn')}
                </p>
                <div className="help-footer-buttons">
                  <button
                    className="help-onboarding-button"
                    onClick={() => {
                      handleShowOnboarding();
                      navigate('/');
                    }}
                  >
                    {t('help.footer.showOnboarding')}
                  </button>
                  <button
                    className="help-onboarding-button"
                    onClick={() => {
                      localStorage.removeItem(
                        'flm_api_creation_tutorial_completed'
                      );
                      navigate('/');
                    }}
                  >
                    {t('help.footer.showTutorial')}
                  </button>
                </div>
              </div>
            </footer>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};
