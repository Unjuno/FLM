// useHomeFeatures - ホーム画面の機能定義と検索ロジックを提供するカスタムフック

import { useMemo, useRef } from 'react';
import { useI18n } from '../contexts/I18nContext';

/**
 * 機能定義の型
 */
export interface HomeFeature {
  id: string;
  label: string;
  description: string;
  path: string;
  section: string;
  category: 'primary' | 'monitoring' | 'settings' | 'advanced' | 'other';
}

/**
 * ホーム画面の機能定義と検索ロジックを提供するカスタムフック
 *
 * @param searchQuery 検索クエリ
 * @returns 機能定義とフィルタリングされた機能
 */
export function useHomeFeatures(searchQuery: string) {
  const { t, locale } = useI18n();
  const prevLocaleRef = useRef<string | null>(null);
  const prevAllFeaturesRef = useRef<HomeFeature[] | null>(null);

  // 機能定義（検索とフィルタリング用）
  // localeのみに依存することで、t関数の参照が変わるたびに再生成されることを防ぐ
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const allFeatures = useMemo<HomeFeature[]>(() => {
    // localeが変わっていない場合は、前回の値を返す
    if (prevLocaleRef.current === locale && prevAllFeaturesRef.current) {
      return prevAllFeaturesRef.current;
    }

    prevLocaleRef.current = locale;
    const features: HomeFeature[] = [
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
    ];

    prevAllFeaturesRef.current = features;
    return features;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

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

  return {
    allFeatures,
    filteredFeatures,
  };
}
