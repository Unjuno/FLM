// Home - ホーム画面

import React, {
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  useTransition,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { Tooltip } from '../components/common/Tooltip';
import { Onboarding, useOnboarding } from '../components/onboarding/Onboarding';
import {
  ApiCreationTutorial,
  useApiCreationTutorial,
} from '../components/onboarding/ApiCreationTutorial';
import { SystemCheck } from '../components/common/SystemCheck';
import { useGlobalKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { OllamaDetection } from '../components/common/OllamaDetection';
import { EngineStatus } from '../components/common/EngineStatus';
import { useOllamaDetection, useOllamaProcess } from '../hooks/useOllama';
import { useI18n } from '../contexts/I18nContext';
import { safeInvoke } from '../utils/tauri';
import { logger } from '../utils/logger';
import { Breadcrumb, BreadcrumbItem } from '../components/common/Breadcrumb';
import './Home.css';
import { useNotifications } from '../contexts/NotificationContext';

/**
 * ホーム画面
 * メインのナビゲーションハブとして機能します
 */
export const Home: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { showOnboarding, handleOnboardingComplete, handleOnboardingSkip } =
    useOnboarding();
  const { showTutorial, handleTutorialComplete, handleTutorialSkip } =
    useApiCreationTutorial();
  const [showSystemCheck, setShowSystemCheck] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set([t('home.sections.basicFeatures')])
  );
  const [isPending, startTransition] = useTransition(); // React 18 Concurrent Features用
  const {
    status,
    isDetecting: isOllamaDetecting,
    error: ollamaError,
    detect,
    autoSteps,
    autoStatus,
    autoError,
    runAutoSetup,
  } = useOllamaDetection();
  const { start } = useOllamaProcess();
  const { showInfo, showWarning } = useNotifications();

  // グローバルキーボードショートカットを有効化
  useGlobalKeyboardShortcuts();

  // useOllamaDetectionフックが自動検出するため、ここでの検出は不要
  // ただし、検出が完了したことをログに記録する
  useEffect(() => {
    if (status) {
      logger.info(
        'Ollama検出結果を受け取りました',
        JSON.stringify(status),
        'Home'
      );
    }
  }, [status]);

  // statusが更新されたら、Ollamaが起動していない場合は自動起動
  // useRefで起動済みフラグを管理して、重複起動を防ぐ
  const hasAttemptedStartRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const autoStartOllamaIfNeeded = async () => {
      logger.info('=== Ollama自動起動チェック開始 ===', 'Home');
      logger.info(
        `status状態: ${status ? JSON.stringify(status) : 'null'}`,
        'Home'
      );

      if (!status) {
        logger.info('statusがnullのため、自動起動をスキップします', 'Home');
        hasAttemptedStartRef.current = false;
        return;
      }

      logger.info(
        `Ollama状態: installed=${status.installed}, portable=${status.portable}, running=${status.running}`,
        'Home'
      );

      if (status.running) {
        logger.info('Ollamaは既に実行中です。フラグをリセットします', 'Home');
        hasAttemptedStartRef.current = false;
        return;
      }

      if (!status.installed && !status.portable) {
        logger.info(
          'Ollamaがインストールされていないため、自動起動をスキップします',
          'Home'
        );
        hasAttemptedStartRef.current = false;
        return;
      }

      if (isOllamaDetecting) {
        logger.info('現在検出処理中のため、自動起動を保留します', 'Home');
        return;
      }

      if (hasAttemptedStartRef.current) {
        logger.info('既に自動起動を試行中のため、今回はスキップします', 'Home');
        return;
      }

      hasAttemptedStartRef.current = true;

      try {
        logger.info('Ollama起動コマンドを実行します...', 'Home');
        const ollamaPath = status.portable_path || status.system_path || null;
        logger.info(
          `使用するOllamaパス: ${ollamaPath || '自動検出'}`,
          'Home'
        );
        await start(ollamaPath || undefined);
        logger.info('✓ Ollamaを自動起動しました。状態を再検出します', 'Home');

        if (!cancelled) {
          await detect();
          logger.info('再検出が完了しました', 'Home');
        }
      } catch (startErr) {
        hasAttemptedStartRef.current = false;
        logger.error(
          '✗ Ollamaの自動起動に失敗しました',
          startErr instanceof Error ? startErr.message : String(startErr),
          'Home'
        );
        logger.error(
          'エラー詳細',
          startErr instanceof Error ? startErr.stack : String(startErr),
          'Home'
        );
        logger.error(
          'エラーオブジェクト',
          JSON.stringify(startErr, Object.getOwnPropertyNames(startErr)),
          'Home'
        );
      }
    };

    autoStartOllamaIfNeeded().catch(err => {
      logger.error(
        '自動起動処理で予期しないエラーが発生しました',
        err instanceof Error ? err.message : String(err),
        'Home'
      );
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, detect, start, isOllamaDetecting]);

  const handleCreateApi = useCallback(() => {
    navigate('/api/create');
  }, [navigate]);

  const handleViewApis = useCallback(() => {
    navigate('/api/list');
  }, [navigate]);

  const handleManageModels = useCallback(() => {
    navigate('/models');
  }, [navigate]);

  const handleApiKeys = useCallback(() => {
    navigate('/api/keys');
  }, [navigate]);

  const handleLlmTest = useCallback(() => {
    navigate('/api/test');
  }, [navigate]);

  const handleLogs = useCallback(() => {
    navigate('/logs');
  }, [navigate]);

  const handlePerformance = useCallback(() => {
    navigate('/performance');
  }, [navigate]);

  const handleAlertHistoryView = useCallback(() => {
    navigate('/alerts/history');
  }, [navigate]);

  const handleAuditLogs = useCallback(() => {
    navigate('/audit-logs');
  }, [navigate]);

  const handleSettings = useCallback(() => {
    navigate('/settings');
  }, [navigate]);

  const handleEngineManagement = useCallback(() => {
    navigate('/engines');
  }, [navigate]);

  const handleAlertSettings = useCallback(() => {
    navigate('/alerts/settings');
  }, [navigate]);

  const handleBackupRestore = useCallback(() => {
    navigate('/backup');
  }, [navigate]);

  const handleScheduler = useCallback(() => {
    navigate('/scheduler');
  }, [navigate]);

  const handleCertificates = useCallback(() => {
    navigate('/certificates');
  }, [navigate]);

  const handleOAuth = useCallback(() => {
    navigate('/oauth');
  }, [navigate]);

  const handlePlugins = useCallback(() => {
    navigate('/plugins');
  }, [navigate]);

  const handleModelCatalog = useCallback(() => {
    navigate('/models/catalog');
  }, [navigate]);

  const handleOllamaSetup = useCallback(() => {
    navigate('/ollama-setup');
  }, [navigate]);

  const handleHelp = useCallback(() => {
    navigate('/help');
  }, [navigate]);

  const handleAbout = useCallback(() => {
    navigate('/about');
  }, [navigate]);

  const handleDiagnostics = useCallback(() => {
    navigate('/diagnostics');
  }, [navigate]);

  type PortResolutionDetail = Array<{
    api_id: string;
    api_name: string;
    old_port: number;
    new_port: number;
    reason: string;
  }>;

  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<PortResolutionDetail>).detail;
      if (!Array.isArray(detail)) return;

      detail.forEach(resolution => {
        showInfo(
          'ポート競合を自動解決しました',
          `${resolution.api_name} のポートを ${resolution.old_port} から ${resolution.new_port} に変更しました。`
        );
      });
    };

    window.addEventListener('flm-auto-port-resolved', listener as EventListener);
    return () => {
      window.removeEventListener(
        'flm-auto-port-resolved',
        listener as EventListener
      );
    };
  }, [showInfo]);

  // クイック作成機能（推奨設定で作成）
  const handleQuickCreate = async () => {
    try {
      // システムチェック結果を取得して推奨モデルを決定
      const recommendation = await safeInvoke<{
        recommended_model: string;
        reason: string;
        alternatives?: string[];
      }>('get_model_recommendation');

      const recommendedModelName = recommendation.recommended_model;
      let chosenModelName = recommendedModelName;

      try {
        const installedModels = await safeInvoke<
          Array<{
            name: string;
          }>
        >('get_installed_models');

        const installedSet = new Set(
          installedModels.map(model => model.name.toLowerCase())
        );

        if (!installedSet.has(recommendedModelName.toLowerCase())) {
          const alternative =
            recommendation.alternatives?.find(alt =>
              installedSet.has(alt.toLowerCase())
            ) ?? null;

          if (alternative) {
            showWarning(
              t('home.quickCreate.fallbackTitle'),
              t('home.quickCreate.fallbackMessage', {
                from: recommendedModelName,
                to: alternative,
              })
            );
            chosenModelName = alternative;
          } else if (installedModels.length > 0) {
            const fallback = installedModels[0].name;
            showWarning(
              t('home.quickCreate.fallbackTitle'),
              t('home.quickCreate.fallbackMessage', {
                from: recommendedModelName,
                to: fallback,
              })
            );
            chosenModelName = fallback;
          } else {
            showWarning(
              t('home.quickCreate.noInstalledTitle'),
              t('home.quickCreate.noInstalledMessage')
            );
            navigate('/models');
            return;
          }
        }
      } catch (checkError) {
        logger.warn(
          'インストール済みモデルの確認に失敗しました。推奨モデルをそのまま使用します。',
          'Home',
          checkError
        );
      }

      // 推奨または代替モデルを使用してAPI作成画面へ
      navigate('/api/create', {
        state: {
          quickCreate: true,
          recommendedModel: chosenModelName,
        },
      });
    } catch (err) {
      logger.error('クイック作成エラー', err, 'Home');
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

  // セクションの折りたたみ/展開を切り替え
  const toggleSection = useCallback((sectionName: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionName)) {
        newSet.delete(sectionName);
      } else {
        newSet.add(sectionName);
      }
      return newSet;
    });
  }, []);

  // 機能定義（検索とフィルタリング用）
  const allFeatures = useMemo(
    () => [
      // 基本機能
      {
        id: 'quick-create',
        label: t('home.features.quickCreate.label'),
        description: t('home.features.quickCreate.description'),
        path: 'quick-create',
        section: t('home.sections.basicFeatures'),
        category: 'primary',
      },
      {
        id: 'web-service',
        label: t('home.features.webService.label'),
        description: t('home.features.webService.description'),
        path: '/web-service/setup',
        section: t('home.sections.basicFeatures'),
        category: 'primary',
      },
      {
        id: 'create-api',
        label: t('home.features.createApi.label'),
        description: t('home.features.createApi.description'),
        path: '/api/create',
        section: t('home.sections.basicFeatures'),
        category: 'primary',
      },
      {
        id: 'api-list',
        label: t('home.features.apiList.label'),
        description: t('home.features.apiList.description'),
        path: '/api/list',
        section: t('home.sections.basicFeatures'),
        category: 'primary',
      },
      {
        id: 'model-management',
        label: t('home.features.modelManagement.label'),
        description: t('home.features.modelManagement.description'),
        path: '/models',
        section: t('home.sections.basicFeatures'),
        category: 'primary',
      },
      {
        id: 'api-keys',
        label: t('home.features.apiKeys.label'),
        description: t('home.features.apiKeys.description'),
        path: '/api/keys',
        section: t('home.sections.basicFeatures'),
        category: 'primary',
      },
      {
        id: 'llm-test',
        label: t('home.features.llmTest.label'),
        description: t('home.features.llmTest.description'),
        path: '/api/test',
        section: t('home.sections.basicFeatures'),
        category: 'primary',
      },

      // 監視・ログ
      {
        id: 'api-logs',
        label: t('home.features.apiLogs.label'),
        description: t('home.features.apiLogs.description'),
        path: '/logs',
        section: t('home.sections.monitoring'),
        category: 'monitoring',
      },
      {
        id: 'performance',
        label: t('home.features.performance.label'),
        description: t('home.features.performance.description'),
        path: '/performance',
        section: t('home.sections.monitoring'),
        category: 'monitoring',
      },
      {
        id: 'alert-history',
        label: t('home.features.alertHistory.label'),
        description: t('home.features.alertHistory.description'),
        path: '/alerts/history',
        section: t('home.sections.monitoring'),
        category: 'monitoring',
      },
      {
        id: 'audit-logs',
        label: t('home.features.auditLogs.label'),
        description: t('home.features.auditLogs.description'),
        path: '/audit-logs',
        section: t('home.sections.monitoring'),
        category: 'monitoring',
      },

      // 基本設定
      {
        id: 'settings',
        label: t('home.features.settings.label'),
        description: t('home.features.settings.description'),
        path: '/settings',
        section: t('home.sections.settings'),
        category: 'settings',
      },
      {
        id: 'engine-management',
        label: t('home.features.engineManagement.label'),
        description: t('home.features.engineManagement.description'),
        path: '/engines',
        section: t('home.sections.settings'),
        category: 'settings',
      },
      {
        id: 'alert-settings',
        label: t('home.features.alertSettings.label'),
        description: t('home.features.alertSettings.description'),
        path: '/alerts/settings',
        section: t('home.sections.settings'),
        category: 'settings',
      },

      // 高度な設定
      {
        id: 'backup-restore',
        label: t('home.features.backupRestore.label'),
        description: t('home.features.backupRestore.description'),
        path: '/backup',
        section: t('home.sections.advanced'),
        category: 'advanced',
      },
      {
        id: 'scheduler',
        label: t('home.features.scheduler.label'),
        description: t('home.features.scheduler.description'),
        path: '/scheduler',
        section: t('home.sections.advanced'),
        category: 'advanced',
      },
      {
        id: 'certificates',
        label: t('home.features.certificates.label'),
        description: t('home.features.certificates.description'),
        path: '/certificates',
        section: t('home.sections.advanced'),
        category: 'advanced',
      },
      {
        id: 'oauth',
        label: t('home.features.oauth.label'),
        description: t('home.features.oauth.description'),
        path: '/oauth',
        section: t('home.sections.advanced'),
        category: 'advanced',
      },
      {
        id: 'plugins',
        label: t('home.features.plugins.label'),
        description: t('home.features.plugins.description'),
        path: '/plugins',
        section: t('home.sections.advanced'),
        category: 'advanced',
      },
      {
        id: 'model-catalog',
        label: t('home.features.modelCatalog.label'),
        description: t('home.features.modelCatalog.description'),
        path: '/models/catalog',
        section: t('home.sections.advanced'),
        category: 'advanced',
      },
      {
        id: 'diagnostics',
        label: t('home.features.diagnostics.label'),
        description: t('home.features.diagnostics.description'),
        path: '/diagnostics',
        section: t('home.sections.advanced'),
        category: 'advanced',
      },

      // その他
      {
        id: 'ollama-setup',
        label: t('home.features.ollamaSetup.label'),
        description: t('home.features.ollamaSetup.description'),
        path: '/ollama-setup',
        section: t('home.sections.other'),
        category: 'other',
      },
      {
        id: 'help',
        label: t('home.features.help.label'),
        description: t('home.features.help.description'),
        path: '/help',
        section: t('home.sections.other'),
        category: 'other',
      },
      {
        id: 'about',
        label: t('home.features.about.label'),
        description: t('home.features.about.description'),
        path: '/about',
        section: t('home.sections.other'),
        category: 'other',
      },
    ],
    [t]
  );

  // 検索フィルタリング
  const filteredFeatures = useMemo(() => {
    if (!searchQuery.trim()) {
      return allFeatures;
    }
    const query = searchQuery.toLowerCase();
    return allFeatures.filter(
      feature =>
        feature.label.toLowerCase().includes(query) ||
        feature.description.toLowerCase().includes(query) ||
        feature.section.toLowerCase().includes(query)
    );
  }, [searchQuery, allFeatures]);

  // パンくずリストの項目（ホームのみ）
  const breadcrumbItems: BreadcrumbItem[] = useMemo(() => [
    { label: t('header.home') || 'ホーム' },
  ], [t]);

  return (
    <div className="home-page">
      {showOnboarding && (
        <Onboarding
          onComplete={handleOnboardingComplete}
          onSkip={handleOnboardingSkip}
        />
      )}

      {/* API作成チュートリアル（オンボーディング完了後） */}
      {showTutorial && !showOnboarding && (
        <ApiCreationTutorial
          onComplete={handleTutorialComplete}
          onSkip={handleTutorialSkip}
        />
      )}

      <div className="home-container">
        <Breadcrumb items={breadcrumbItems} />
        <section className="home-section engine-status-section">
          <h2 className="home-section-title">エンジン ステータス</h2>
          <EngineStatus
            engineTypes={['ollama', 'lm_studio', 'vllm', 'llama_cpp']}
            autoDetect={true}
            refreshInterval={30000}
          />
        </section>

        <header className="home-header">
          <div className="home-header-logo-container">
            <img 
              src="/logo.png" 
              alt="FLM" 
              className="home-header-logo" 
              width="48" 
              height="48"
              aria-hidden="true"
            />
            <h1>FLM - Local LLM API Manager</h1>
          </div>
          <p className="home-subtitle" role="doc-subtitle">
            ローカルLLMのAPIを簡単に作成・管理できるツール
          </p>

          {/* 検索バー */}
          <div className="home-search">
            <input
              type="text"
              className="home-search-input"
              placeholder={t('home.search.placeholder')}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              aria-label="機能検索"
            />
            {searchQuery && (
              <button
                className="home-search-clear"
                onClick={() => setSearchQuery('')}
                aria-label="検索をクリア"
              >
                ×
              </button>
            )}
          </div>
        </header>

        {/* 検索結果がある場合、検索結果を表示 */}
        {searchQuery && (
          <section className="home-section search-results">
            <h2 className="home-section-title">
              検索結果: {filteredFeatures.length}件
              {filteredFeatures.length === 0 && (
                <span className="home-search-empty">
                  (該当する機能が見つかりませんでした)
                </span>
              )}
            </h2>
            {filteredFeatures.length > 0 && (
              <nav className="home-actions" aria-label="検索結果">
                {filteredFeatures.map(feature => {
                  const handleClick = () => {
                    if (feature.id === 'quick-create') {
                      startTransition(() => {
                        handleQuickCreate();
                      });
                    } else {
                      navigate(feature.path);
                    }
                  };
                  return (
                    <Tooltip
                      key={feature.id}
                      content={feature.description}
                      position="right"
                    >
                      <button
                        className={`home-action-button ${feature.category === 'primary' ? 'primary' : ''}`}
                        onClick={handleClick}
                        aria-label={feature.label}
                      >
                        <span className="button-text">
                          <strong>{feature.label}</strong>
                          <small>{feature.description}</small>
                        </span>
                      </button>
                    </Tooltip>
                  );
                })}
              </nav>
            )}
          </section>
        )}

        {/* 通常表示（検索がない場合） */}
        {!searchQuery && (
          <>
            {/* 基本機能セクション */}
            <section className="home-section">
              <button
                className="home-section-header"
                onClick={() => toggleSection(t('home.sections.basicFeatures'))}
              >
                <h2 className="home-section-title">{t('home.sections.basicFeatures')}</h2>
                <span className="home-section-toggle">
                  {expandedSections.has(t('home.sections.basicFeatures')) ? '▼' : '▶'}
                </span>
              </button>
              {expandedSections.has(t('home.sections.basicFeatures')) && (
                <nav className="home-actions" aria-label={t('home.sections.basicFeatures')}>
                  <Tooltip
                    content={t('home.features.quickCreate.tooltip')}
                    position="right"
                  >
                    <button
                      className="home-action-button quick-create"
                      onClick={() => {
                        startTransition(() => {
                          handleQuickCreate();
                        });
                      }}
                      aria-label={t('home.features.quickCreate.ariaLabel')}
                      disabled={isPending}
                    >
                      <span className="button-text">
                        <strong>{t('home.features.quickCreate.label')}</strong>
                        <small>{t('home.features.quickCreate.description')}</small>
                      </span>
                    </button>
                  </Tooltip>
                  <Tooltip
                    content={t('home.features.webService.tooltip')}
                    position="right"
                  >
                    <button
                      className="home-action-button web-service"
                      onClick={() => navigate('/web-service/setup')}
                      aria-label={t('home.features.webService.ariaLabel')}
                    >
                      <span className="button-text">
                        <strong>{t('home.features.webService.label')}</strong>
                        <small>{t('home.features.webService.description')}</small>
                      </span>
                    </button>
                  </Tooltip>
                  <Tooltip
                    content={t('home.features.createApi.tooltip')}
                    position="right"
                  >
                    <button
                      className="home-action-button primary"
                      onClick={handleCreateApi}
                      aria-label={t('home.features.createApi.ariaLabel')}
                    >
                      <span className="button-text">
                        <strong>{t('home.features.createApi.label')}</strong>
                        <small>{t('home.features.createApi.description')}</small>
                      </span>
                    </button>
                  </Tooltip>
                  <Tooltip
                    content={t('home.features.apiList.tooltip')}
                    position="right"
                  >
                    <button
                      className="home-action-button"
                      onClick={handleViewApis}
                      aria-label={t('home.features.apiList.ariaLabel')}
                    >
                      <span className="button-text">
                        <strong>{t('home.features.apiList.label')}</strong>
                        <small>{t('home.features.apiList.description')}</small>
                      </span>
                    </button>
                  </Tooltip>
                  <Tooltip
                    content={t('home.features.modelManagement.tooltip')}
                    position="right"
                  >
                    <button
                      className="home-action-button"
                      onClick={handleManageModels}
                      aria-label={t('home.features.modelManagement.ariaLabel')}
                    >
                      <span className="button-text">
                        <strong>{t('home.features.modelManagement.label')}</strong>
                        <small>{t('home.features.modelManagement.description')}</small>
                      </span>
                    </button>
                  </Tooltip>
                  <Tooltip
                    content={t('home.features.apiKeys.tooltip')}
                    position="right"
                  >
                    <button
                      className="home-action-button"
                      onClick={handleApiKeys}
                      aria-label={t('home.features.apiKeys.ariaLabel')}
                    >
                      <span className="button-text">
                        <strong>{t('home.features.apiKeys.label')}</strong>
                        <small>{t('home.features.apiKeys.description')}</small>
                      </span>
                    </button>
                  </Tooltip>
                  <Tooltip
                    content={t('home.features.llmTest.tooltip')}
                    position="right"
                  >
                    <button
                      className="home-action-button"
                      onClick={handleLlmTest}
                      aria-label={t('home.features.llmTest.ariaLabel')}
                    >
                      <span className="button-text">
                        <strong>{t('home.features.llmTest.label')}</strong>
                        <small>{t('home.features.llmTest.description')}</small>
                      </span>
                    </button>
                  </Tooltip>
                </nav>
              )}
            </section>

            {/* 監視・ログセクション */}
            <section className="home-section">
              <button
                className="home-section-header"
                onClick={() => toggleSection(t('home.sections.monitoring'))}
              >
                <h2 className="home-section-title">{t('home.sections.monitoring')}</h2>
                <span className="home-section-toggle">
                  {expandedSections.has(t('home.sections.monitoring')) ? '▼' : '▶'}
                </span>
              </button>
              {expandedSections.has(t('home.sections.monitoring')) && (
                <nav className="home-actions" aria-label={t('home.sections.monitoring')}>
                  <Tooltip
                    content={t('home.features.apiLogs.tooltip')}
                    position="right"
                  >
                    <button
                      className="home-action-button"
                      onClick={handleLogs}
                      aria-label={t('home.features.apiLogs.ariaLabel')}
                    >
                      <span className="button-text">
                        <strong>{t('home.features.apiLogs.label')}</strong>
                        <small>{t('home.features.apiLogs.description')}</small>
                      </span>
                    </button>
                  </Tooltip>
                  <Tooltip
                    content={t('home.features.performance.tooltip')}
                    position="right"
                  >
                    <button
                      className="home-action-button"
                      onClick={handlePerformance}
                      aria-label={t('home.features.performance.ariaLabel')}
                    >
                      <span className="button-text">
                        <strong>{t('home.features.performance.label')}</strong>
                        <small>{t('home.features.performance.description')}</small>
                      </span>
                    </button>
                  </Tooltip>
                  <Tooltip
                    content={t('home.features.alertHistory.tooltip')}
                    position="right"
                  >
                    <button
                      className="home-action-button"
                      onClick={handleAlertHistoryView}
                      aria-label={t('home.features.alertHistory.ariaLabel')}
                    >
                      <span className="button-text">
                        <strong>{t('home.features.alertHistory.label')}</strong>
                        <small>{t('home.features.alertHistory.description')}</small>
                      </span>
                    </button>
                  </Tooltip>
                  <Tooltip
                    content={t('home.features.auditLogs.tooltip')}
                    position="right"
                  >
                    <button
                      className="home-action-button"
                      onClick={handleAuditLogs}
                      aria-label={t('home.features.auditLogs.ariaLabel')}
                    >
                      <span className="button-text">
                        <strong>{t('home.features.auditLogs.label')}</strong>
                        <small>{t('home.features.auditLogs.description')}</small>
                      </span>
                    </button>
                  </Tooltip>
                </nav>
              )}
            </section>

            {/* 基本設定セクション */}
            <section className="home-section">
              <button
                className="home-section-header"
                onClick={() => toggleSection(t('home.sections.settings'))}
              >
                <h2 className="home-section-title">{t('home.sections.settings')}</h2>
                <span className="home-section-toggle">
                  {expandedSections.has(t('home.sections.settings')) ? '▼' : '▶'}
                </span>
              </button>
              {expandedSections.has(t('home.sections.settings')) && (
                <nav className="home-actions" aria-label={t('home.sections.settings')}>
                  <Tooltip
                    content={t('home.features.settings.tooltip')}
                    position="right"
                  >
                    <button
                      className="home-action-button"
                      onClick={handleSettings}
                      aria-label={t('home.features.settings.ariaLabel')}
                    >
                      <span className="button-text">
                        <strong>{t('home.features.settings.label')}</strong>
                        <small>{t('home.features.settings.description')}</small>
                      </span>
                    </button>
                  </Tooltip>
                  <Tooltip
                    content={t('home.features.engineManagement.tooltip')}
                    position="right"
                  >
                    <button
                      className="home-action-button"
                      onClick={handleEngineManagement}
                      aria-label={t('home.features.engineManagement.ariaLabel')}
                    >
                      <span className="button-text">
                        <strong>{t('home.features.engineManagement.label')}</strong>
                        <small>{t('home.features.engineManagement.description')}</small>
                      </span>
                    </button>
                  </Tooltip>
                  <Tooltip
                    content={t('home.features.alertSettings.tooltip')}
                    position="right"
                  >
                    <button
                      className="home-action-button"
                      onClick={handleAlertSettings}
                      aria-label={t('home.features.alertSettings.ariaLabel')}
                    >
                      <span className="button-text">
                        <strong>{t('home.features.alertSettings.label')}</strong>
                        <small>{t('home.features.alertSettings.description')}</small>
                      </span>
                    </button>
                  </Tooltip>
                </nav>
              )}
            </section>

            {/* 高度な設定セクション */}
            <section className="home-section home-section-advanced">
              <button
                className="home-section-header"
                onClick={() => toggleSection(t('home.sections.advanced'))}
              >
                <h2 className="home-section-title">{t('home.sections.advanced')}</h2>
                <span className="home-section-toggle">
                  {expandedSections.has(t('home.sections.advanced')) ? '▼' : '▶'}
                </span>
              </button>
              {expandedSections.has(t('home.sections.advanced')) && (
                <nav className="home-actions" aria-label={t('home.sections.advanced')}>
                  <Tooltip
                    content={t('home.features.backupRestore.tooltip')}
                    position="right"
                  >
                    <button
                      className="home-action-button"
                      onClick={handleBackupRestore}
                      aria-label={t('home.features.backupRestore.ariaLabel')}
                    >
                      <span className="button-text">
                        <strong>{t('home.features.backupRestore.label')}</strong>
                        <small>{t('home.features.backupRestore.description')}</small>
                      </span>
                    </button>
                  </Tooltip>
                  <Tooltip
                    content={t('home.features.scheduler.tooltip')}
                    position="right"
                  >
                    <button
                      className="home-action-button"
                      onClick={handleScheduler}
                      aria-label={t('home.features.scheduler.ariaLabel')}
                    >
                      <span className="button-text">
                        <strong>{t('home.features.scheduler.label')}</strong>
                        <small>{t('home.features.scheduler.description')}</small>
                      </span>
                    </button>
                  </Tooltip>
                  <Tooltip content={t('home.features.certificates.tooltip')} position="right">
                    <button
                      className="home-action-button"
                      onClick={handleCertificates}
                      aria-label={t('home.features.certificates.ariaLabel')}
                    >
                      <span className="button-text">
                        <strong>{t('home.features.certificates.label')}</strong>
                        <small>{t('home.features.certificates.description')}</small>
                      </span>
                    </button>
                  </Tooltip>
                  <Tooltip
                    content={t('home.features.oauth.tooltip')}
                    position="right"
                  >
                    <button
                      className="home-action-button"
                      onClick={handleOAuth}
                      aria-label={t('home.features.oauth.ariaLabel')}
                    >
                      <span className="button-text">
                        <strong>{t('home.features.oauth.label')}</strong>
                        <small>{t('home.features.oauth.description')}</small>
                      </span>
                    </button>
                  </Tooltip>
                  <Tooltip
                    content={t('home.features.plugins.tooltip')}
                    position="right"
                  >
                    <button
                      className="home-action-button"
                      onClick={handlePlugins}
                      aria-label={t('home.features.plugins.ariaLabel')}
                    >
                      <span className="button-text">
                        <strong>{t('home.features.plugins.label')}</strong>
                        <small>{t('home.features.plugins.description')}</small>
                      </span>
                    </button>
                  </Tooltip>
                  <Tooltip
                    content={t('home.features.modelCatalog.tooltip')}
                    position="right"
                  >
                    <button
                      className="home-action-button"
                      onClick={handleModelCatalog}
                      aria-label={t('home.features.modelCatalog.ariaLabel')}
                    >
                      <span className="button-text">
                        <strong>{t('home.features.modelCatalog.label')}</strong>
                        <small>{t('home.features.modelCatalog.description')}</small>
                      </span>
                    </button>
                  </Tooltip>
                  <Tooltip
                    content={t('home.features.diagnostics.tooltip')}
                    position="right"
                  >
                    <button
                      className="home-action-button"
                      onClick={handleDiagnostics}
                      aria-label={t('home.features.diagnostics.ariaLabel')}
                    >
                      <span className="button-text">
                        <strong>{t('home.features.diagnostics.label')}</strong>
                        <small>{t('home.features.diagnostics.description')}</small>
                      </span>
                    </button>
                  </Tooltip>
                </nav>
              )}
            </section>

            {/* その他セクション */}
            <section className="home-section">
              <button
                className="home-section-header"
                onClick={() => toggleSection(t('home.sections.other'))}
              >
                <h2 className="home-section-title">{t('home.sections.other')}</h2>
                <span className="home-section-toggle">
                  {expandedSections.has(t('home.sections.other')) ? '▼' : '▶'}
                </span>
              </button>
              {expandedSections.has(t('home.sections.other')) && (
                <nav className="home-actions" aria-label={t('home.sections.other')}>
                  <Tooltip
                    content={t('home.features.ollamaSetup.tooltip')}
                    position="right"
                  >
                    <button
                      className="home-action-button"
                      onClick={handleOllamaSetup}
                      aria-label={t('home.features.ollamaSetup.ariaLabel')}
                    >
                      <span className="button-text">
                        <strong>{t('home.features.ollamaSetup.label')}</strong>
                        <small>{t('home.features.ollamaSetup.description')}</small>
                      </span>
                    </button>
                  </Tooltip>
                  <Tooltip content={t('home.features.help.tooltip')} position="right">
                    <button
                      className="home-action-button"
                      onClick={handleHelp}
                      aria-label={t('home.features.help.ariaLabel')}
                    >
                      <span className="button-text">
                        <strong>{t('home.features.help.label')}</strong>
                        <small>{t('home.features.help.description')}</small>
                      </span>
                    </button>
                  </Tooltip>
                  <Tooltip
                    content={t('home.features.about.tooltip')}
                    position="right"
                  >
                    <button
                      className="home-action-button"
                      onClick={handleAbout}
                      aria-label={t('home.features.about.ariaLabel')}
                    >
                      <span className="button-text">
                        <strong>{t('home.features.about.label')}</strong>
                        <small>{t('home.features.about.description')}</small>
                      </span>
                    </button>
                  </Tooltip>
                </nav>
              )}
            </section>
          </>
        )}

        {/* システムチェックセクション */}
        <section className="home-system-check">
          <div className="system-check-toggle">
            <button
              className="toggle-button"
              onClick={() => setShowSystemCheck(!showSystemCheck)}
            >
              {showSystemCheck
                ? `▼ ${t('home.systemCheck.hide')}`
                : `▶ ${t('home.systemCheck.show')}`}
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
          <h2 id="usage-heading">{t('home.usage.title')}</h2>
          <ol className="home-steps">
            <li>{t('home.usage.step1')}</li>
            <li>{t('home.usage.step2')}</li>
            <li>{t('home.usage.step3')}</li>
            <li>{t('home.usage.step4')}</li>
            <li>{t('home.usage.step5')}</li>
            <li>{t('home.usage.step6')}</li>
          </ol>
        </section>
      </div>
    </div>
  );
};
