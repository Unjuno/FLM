// useHomeNavigation - ホーム画面のナビゲーションハンドラーを提供するカスタムフック

import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../contexts/I18nContext';
import { useNotifications } from '../contexts/NotificationContext';
import { safeInvoke } from '../utils/tauri';
import { logger } from '../utils/logger';
import { useErrorHandler } from './useErrorHandler';

/**
 * ホーム画面のナビゲーションハンドラーを提供するカスタムフック
 */
export function useHomeNavigation() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { showWarning } = useNotifications();
  const { withErrorHandling } = useErrorHandler({
    componentName: 'HomeNavigation',
  });

  const handleCreateApi = useCallback(() => {
    navigate('/api/create');
  }, [navigate]);

  const handleApiList = useCallback(() => {
    navigate('/api/list');
  }, [navigate]);

  const handleModelManagement = useCallback(() => {
    navigate('/models');
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

  /**
   * クイック作成機能（推奨設定で作成）
   */
  const handleQuickCreate = useCallback(async () => {
    const result = await withErrorHandling(async () => {
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
          'HomeNavigation',
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
    }, 'クイック作成');

    // エラー時は通常のAPI作成画面へ
    if (!result) {
      navigate('/api/create');
    }
  }, [navigate, t, showWarning, withErrorHandling]);

  /**
   * システムチェックでモデルが選択された時の処理
   */
  const handleModelSelected = useCallback((modelName: string) => {
    navigate('/api/create', {
      state: {
        selectedModelName: modelName,
      },
    });
  }, [navigate]);

  return {
    handleCreateApi,
    handleApiList,
    handleModelManagement,
    handlePerformance,
    handleAlertHistoryView,
    handleAuditLogs,
    handleSettings,
    handleEngineManagement,
    handleAlertSettings,
    handleBackupRestore,
    handleScheduler,
    handleCertificates,
    handleOAuth,
    handlePlugins,
    handleModelCatalog,
    handleOllamaSetup,
    handleHelp,
    handleAbout,
    handleDiagnostics,
    handleQuickCreate,
    handleModelSelected,
  };
}

