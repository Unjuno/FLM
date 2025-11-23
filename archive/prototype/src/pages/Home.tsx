// Home - ホーム画面

import React, {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useTransition,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { Onboarding, useOnboarding } from '../components/onboarding/Onboarding';
import {
  ApiCreationTutorial,
  useApiCreationTutorial,
} from '../components/onboarding/ApiCreationTutorial';
import { SystemCheck } from '../components/common/SystemCheck';
import { useGlobalKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { EngineStatus } from '../components/common/EngineStatus';
import { useOllamaDetection } from '../hooks/useOllama';
import { useI18n } from '../contexts/I18nContext';
import { Breadcrumb, BreadcrumbItem } from '../components/common/Breadcrumb';
import { useNotifications } from '../contexts/NotificationContext';
import { useOllamaAutoStart } from '../hooks/useOllamaAutoStart';
import { useHomeNavigation } from '../hooks/useHomeNavigation';
import { useHomeFeatures, type HomeFeature } from '../hooks/useHomeFeatures';
import { HomeSearchResults } from '../components/home/HomeSearchResults';
import { HomeFeatureSection } from '../components/home/HomeFeatureSection';
import './Home.css';

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
  // expandedSectionsの初期値を関数形式で固定（初回レンダリング時のみ実行）
  // 翻訳キーを使用して、言語変更時にも正しく動作するようにする
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => {
    // 初期値は翻訳キーを使用（翻訳値ではなく）
    return new Set(['home.sections.basicFeatures']);
  });
  const [isPending, startTransition] = useTransition(); // React 18 Concurrent Features用
  useOllamaDetection();
  const { showInfo } = useNotifications();

  // Ollama自動起動
  useOllamaAutoStart();

  // ナビゲーションハンドラー
  const navigation = useHomeNavigation();

  // 機能定義と検索
  const { allFeatures, filteredFeatures } = useHomeFeatures(searchQuery);

  // グローバルキーボードショートカットを有効化
  useGlobalKeyboardShortcuts();

  // セクション名で機能をフィルタリングする関数
  // allFeaturesの参照が変わるたびに再生成されることを防ぐため、useCallbackを使用
  const getSectionFeatures = useCallback(
    (sectionName: string) => {
      return allFeatures.filter(feature => feature.section === sectionName);
    },
    [allFeatures]
  );

  // 機能クリックハンドラー
  const handleFeatureClick = useCallback(
    (feature: HomeFeature) => {
      if (feature.id === 'quick-create') {
        startTransition(() => {
          navigation.handleQuickCreate();
        });
      } else {
        navigate(feature.path);
      }
    },
    [navigation, navigate, startTransition]
  );

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

    window.addEventListener(
      'flm-auto-port-resolved',
      listener as EventListener
    );
    return () => {
      window.removeEventListener(
        'flm-auto-port-resolved',
        listener as EventListener
      );
    };
  }, [showInfo]);

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

  // パンくずリストの項目（ホームのみ）
  const breadcrumbItems: BreadcrumbItem[] = useMemo(
    () => [{ label: t('header.home') || 'ホーム' }],
    [t]
  );

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
        <HomeSearchResults
          searchQuery={searchQuery}
          filteredFeatures={filteredFeatures}
          onQuickCreate={() => {
            startTransition(() => {
              navigation.handleQuickCreate();
            });
          }}
          isPending={isPending}
        />

        {/* 通常表示（検索がない場合） */}
        {!searchQuery && (
          <>
            {/* 基本機能セクション */}
            <HomeFeatureSection
              title={t('home.sections.basicFeatures')}
              features={getSectionFeatures(t('home.sections.basicFeatures'))}
              isExpanded={expandedSections.has('home.sections.basicFeatures')}
              onToggle={() => toggleSection('home.sections.basicFeatures')}
              onFeatureClick={handleFeatureClick}
              isPending={isPending}
            />

            {/* 監視・ログセクション */}
            <HomeFeatureSection
              title={t('home.sections.monitoring')}
              features={getSectionFeatures(t('home.sections.monitoring'))}
              isExpanded={expandedSections.has('home.sections.monitoring')}
              onToggle={() => toggleSection('home.sections.monitoring')}
              onFeatureClick={handleFeatureClick}
              isPending={isPending}
            />

            {/* 基本設定セクション */}
            <HomeFeatureSection
              title={t('home.sections.settings')}
              features={getSectionFeatures(t('home.sections.settings'))}
              isExpanded={expandedSections.has('home.sections.settings')}
              onToggle={() => toggleSection('home.sections.settings')}
              onFeatureClick={handleFeatureClick}
              isPending={isPending}
            />

            {/* 高度な設定セクション */}
            <HomeFeatureSection
              title={t('home.sections.advanced')}
              features={getSectionFeatures(t('home.sections.advanced'))}
              isExpanded={expandedSections.has('home.sections.advanced')}
              onToggle={() => toggleSection('home.sections.advanced')}
              onFeatureClick={handleFeatureClick}
              isPending={isPending}
            />

            {/* その他セクション */}
            <HomeFeatureSection
              title={t('home.sections.other')}
              features={getSectionFeatures(t('home.sections.other'))}
              isExpanded={expandedSections.has('home.sections.other')}
              onToggle={() => toggleSection('home.sections.other')}
              onFeatureClick={handleFeatureClick}
              isPending={isPending}
            />
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
              onModelSelected={navigation.handleModelSelected}
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
