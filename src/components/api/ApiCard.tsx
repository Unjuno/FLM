// ApiCard - APIカードコンポーネント

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTransition } from 'react';
import { Tooltip } from '../common/Tooltip';
import { ApiOperationProgress } from './ApiOperationProgress';
import { useI18n } from '../../contexts/I18nContext';
import type { ApiInfoExtended } from '../../hooks/useApiList';
import type { ApiOperationProgress as ApiOperationProgressType } from '../../hooks/useApiOperations';

/**
 * APIカードコンポーネントのプロパティ
 */
export interface ApiCardProps {
  api: ApiInfoExtended;
  isSelected: boolean;
  isOperating: boolean;
  progress?: ApiOperationProgressType;
  onToggleSelection: (apiId: string) => void;
  onToggleStatus: (
    apiId: string,
    currentStatus: 'running' | 'preparing' | 'stopped' | 'error'
  ) => Promise<void> | void;
  onDelete: (apiId: string, apiName: string, modelName?: string) => void;
  getStatusText: (status: 'running' | 'preparing' | 'stopped' | 'error') => string;
}

/**
 * APIカードコンポーネント
 * 個別のAPI情報を表示します
 */
const ApiCardComponent: React.FC<ApiCardProps> = ({
  api,
  isSelected,
  isOperating,
  progress,
  onToggleSelection,
  onToggleStatus,
  onDelete,
  getStatusText,
}) => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [_isPending, startTransition] = useTransition();
  const isRunning = api.status === 'running';
  const isPreparing = api.status === 'preparing';

  return (
    <div className="api-card">
      <div className="api-card-header">
        <label className="api-select-checkbox">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelection(api.id)}
            aria-label={t('apiList.selectApiAria', { name: api.name })}
            disabled={isOperating}
          />
        </label>
        <h3 className="api-name">{api.name}</h3>
        <div className={`status-badge status-${api.status} ${isOperating ? 'operating' : ''}`}>
          {isOperating ? (
            <span className="status-operating-text">
              <span className="loading-spinner-small"></span>
              {isRunning
                ? t('apiList.status.stopping') || '停止中...'
                : isPreparing
                  ? t('apiList.status.preparing') || '起動準備中...'
                  : t('apiList.status.starting') || '起動中...'}
            </span>
          ) : (
            getStatusText(api.status)
          )}
        </div>
      </div>

      <div className="api-info">
        <div className="info-row">
          <span className="info-label">{t('apiList.info.model')}</span>
          <span className="info-value">{api.model_name}</span>
        </div>
        <div className="info-row">
          <span className="info-label">
            <Tooltip
              content={t('apiList.info.endpointTooltip.content')}
              title={t('apiList.info.endpointTooltip.title')}
            >
              <span className="tooltip-label-with-icon">
                {t('apiList.info.endpoint')}
                <span className="tooltip-icon">❓</span>
              </span>
            </Tooltip>
          </span>
          <code className="info-value">{api.endpoint}</code>
        </div>
        <div className="info-row">
          <span className="info-label">
            <Tooltip
              content={t('apiList.info.portTooltip.content')}
              title={t('apiList.info.portTooltip.title')}
            >
              <span className="tooltip-label-with-icon">
                {t('apiList.info.port')}
                <span className="tooltip-icon">❓</span>
              </span>
            </Tooltip>
          </span>
          <span className="info-value">{api.port}</span>
        </div>
      </div>

      <div className="api-actions">
        <Tooltip 
          content={isOperating 
            ? (isRunning
                ? t('apiList.actions.stopping') || '停止中...'
                : t('apiList.actions.starting') || '起動中...')
            : (isPreparing
                ? t('apiList.status.preparing') || '起動準備中...'
                : (isRunning 
              ? t('apiList.actions.stopTooltip')
              : t('apiList.actions.startTooltip')))}
          position="top"
        >
          <button
            className={`action-button ${isRunning ? 'stop' : 'start'} ${isOperating ? 'operating' : ''}`}
            onClick={() => {
              if (!isOperating && !isPreparing) {
                startTransition(() => {
                  onToggleStatus(api.id, api.status);
                });
              }
            }}
            disabled={isOperating || isPreparing}
          >
            {isOperating ? (
              <span className="button-loading-content">
                <span className="loading-spinner-small button-spinner"></span>
                {isRunning
                  ? t('apiList.actions.stopping') || '停止中...'
                  : t('apiList.actions.starting') || '起動中...'}
              </span>
            ) : isPreparing ? (
              t('apiList.status.preparing') || '起動準備中...'
            ) : (
              isRunning ? t('apiList.actions.stop') : t('apiList.actions.start')
            )}
          </button>
        </Tooltip>
        <Tooltip content={t('apiList.actions.testTooltip')} position="top">
          <button
            className="action-button test"
            onClick={() => navigate(`/api/test/${api.id}`)}
            disabled={isOperating}
          >
            {t('apiList.actions.test')}
          </button>
        </Tooltip>
        <Tooltip content={t('apiList.actions.detailsTooltip')} position="top">
          <button
            className="action-button details"
            onClick={() => navigate(`/api/details/${api.id}`)}
            disabled={isOperating}
          >
            {t('apiList.actions.details')}
          </button>
        </Tooltip>
        <Tooltip content={t('apiList.actions.editTooltip') || 'API設定を変更'} position="top">
          <button
            className="action-button edit"
            onClick={() => navigate(`/api/edit/${api.id}`)}
            disabled={isOperating}
          >
            {t('apiList.actions.edit') || '設定変更'}
          </button>
        </Tooltip>
        <Tooltip content={t('apiList.actions.deleteTooltip')} position="top">
          <button
            className="action-button delete"
            onClick={() => {
              if (!isOperating) {
                startTransition(() => {
                  onDelete(api.id, api.name, api.model_name);
                });
              }
            }}
            disabled={isOperating}
          >
            {t('apiList.actions.delete')}
          </button>
        </Tooltip>
      </div>
      {isOperating && progress && (
        <ApiOperationProgress
          progress={progress.progress}
          step={progress.step}
          status={api.status}
        />
      )}
    </div>
  );
};

/**
 * ApiCardをメモ化してパフォーマンスを最適化
 * api.id, isSelected, isOperating, progressが変更された場合のみ再レンダリング
 */
export const ApiCard = React.memo(ApiCardComponent, (prevProps, nextProps) => {
  return (
    prevProps.api.id === nextProps.api.id &&
    prevProps.api.status === nextProps.api.status &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isOperating === nextProps.isOperating &&
    prevProps.progress?.progress === nextProps.progress?.progress &&
    prevProps.progress?.step === nextProps.progress?.step
  );
});
