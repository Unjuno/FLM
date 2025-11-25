// SPDX-License-Identifier: MIT
// ApiPrompts - APIプロンプトテンプレート管理ページ

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Breadcrumb, BreadcrumbItem } from '../components/common/Breadcrumb';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { useNotifications } from '../contexts/NotificationContext';
import { useI18n } from '../contexts/I18nContext';
import {
  ApiPrompt,
  fetchApiPrompts,
  getApiPrompt,
  setApiPrompt,
} from '../services/apiPrompts';
import './ApiPrompts.css';

export const ApiPrompts: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { showError, showSuccess } = useNotifications();

  const [prompts, setPrompts] = useState<ApiPrompt[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [apiId, setApiId] = useState('');
  const [templateText, setTemplateText] = useState('');
  const [selectedApiId, setSelectedApiId] = useState<string | null>(null);

  const breadcrumbItems: BreadcrumbItem[] = useMemo(
    () => [
      { label: t('header.home') || 'ホーム', path: '/' },
      { label: t('apiList.title') || 'API一覧', path: '/api/list' },
      { label: 'APIプロンプト' },
    ],
    [t]
  );

  const loadPrompts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchApiPrompts();
      setPrompts(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'APIプロンプトの取得に失敗しました'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPrompts();
  }, [loadPrompts]);

  const handleSelect = async (prompt: ApiPrompt) => {
    setSelectedApiId(prompt.apiId);
    setApiId(prompt.apiId);
    setTemplateText(prompt.templateText);
  };

  const handleLoadSingle = async (id: string) => {
    try {
      const prompt = await getApiPrompt(id);
      if (prompt) {
        handleSelect(prompt);
      }
    } catch (err) {
      showError(
        err instanceof Error ? err.message : 'APIプロンプトの取得に失敗しました'
      );
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!apiId.trim()) {
      showError('API IDを入力してください');
      return;
    }
    if (!templateText.trim()) {
      showError('テンプレートを入力してください');
      return;
    }

    try {
      await setApiPrompt(apiId.trim(), templateText);
      showSuccess('APIプロンプトを保存しました', '', 3000);
      setSelectedApiId(apiId.trim());
      await loadPrompts();
    } catch (err) {
      showError(
        err instanceof Error ? err.message : 'APIプロンプトの保存に失敗しました'
      );
    }
  };

  const handleNewPrompt = () => {
    setSelectedApiId(null);
    setApiId('');
    setTemplateText('');
  };

  return (
    <div className="page-background api-prompts-page">
      <div className="page-container api-prompts-container">
        <Breadcrumb items={breadcrumbItems} />
        <header className="page-header api-prompts-header">
          <div className="header-top">
            <button className="back-button" onClick={() => navigate('/api/list')}>
              ← API一覧に戻る
            </button>
            <h1>APIプロンプトテンプレート</h1>
          </div>
          <p className="header-description">
            APIごとの応答テンプレートやガイドラインを登録し、CLI / UI から再利用できます。
          </p>
        </header>

        <div className="api-prompts-layout">
          <section className="card prompts-list-card">
            <div className="section-header">
              <h2>登録済みテンプレート</h2>
              <button className="secondary" onClick={handleNewPrompt}>
                新規テンプレート
              </button>
            </div>

            {error && (
              <ErrorMessage
                message={error}
                type="api"
                onClose={() => setError(null)}
              />
            )}

            {loading ? (
              <p className="muted">読み込み中...</p>
            ) : prompts.length === 0 ? (
              <p className="muted">テンプレートはまだありません。</p>
            ) : (
              <div className="prompts-list">
                {prompts.map(prompt => (
                  <button
                    key={prompt.apiId}
                    className={`prompt-item ${
                      selectedApiId === prompt.apiId ? 'active' : ''
                    }`}
                    onClick={() => handleSelect(prompt)}
                  >
                    <div className="prompt-item-header">
                      <strong>{prompt.apiId}</strong>
                      <span>v{prompt.version}</span>
                    </div>
                    <div className="prompt-item-body">
                      <p className="prompt-snippet">
                        {prompt.templateText.slice(0, 120)}
                        {prompt.templateText.length > 120 ? '…' : ''}
                      </p>
                      <small>{prompt.updatedAt}</small>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="card prompts-form-card">
            <h2>{selectedApiId ? 'テンプレートを編集' : '新しいテンプレートを作成'}</h2>
            <form onSubmit={handleSubmit} className="prompts-form">
              <label>
                API ID
                <input
                  value={apiId}
                  onChange={event => setApiId(event.target.value)}
                  placeholder="例: chat_completions"
                  required
                />
              </label>

              <label>
                テンプレート
                <textarea
                  value={templateText}
                  onChange={event => setTemplateText(event.target.value)}
                  rows={14}
                  placeholder="プロンプトテンプレートを入力"
                  required
                />
              </label>

              <div className="form-actions">
                <button type="submit">保存</button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => void handleLoadSingle(apiId)}
                  disabled={!apiId}
                >
                  CLIから再取得
                </button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
};

