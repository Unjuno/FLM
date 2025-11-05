// TeamManagement - チーム管理ページ
// チームの作成・管理、API共有機能

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { safeInvoke } from '../utils/tauri';
import { useNotifications } from '../contexts/NotificationContext';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { useGlobalKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import './TeamManagement.css';

/**
 * チーム情報
 */
interface Team {
  id: string;
  name: string;
  description?: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

/**
 * API共有情報
 */
interface ApiShare {
  id: string;
  api_id: string;
  api_name?: string;
  team_id?: string;
  shared_with_user_id?: string;
  permission: string;
  created_at: string;
}

/**
 * チーム管理ページ
 */
export const TeamManagement: React.FC = () => {
  const navigate = useNavigate();
  const { showSuccess, showError } = useNotifications();
  const [teams, setTeams] = useState<Team[]>([]);
  const [apiShares, setApiShares] = useState<ApiShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDescription, setNewTeamDescription] = useState('');

  // グローバルキーボードショートカットを有効化
  useGlobalKeyboardShortcuts();

  useEffect(() => {
    loadTeams();
    loadApiShares();
  }, []);

  /**
   * チーム一覧を読み込む
   */
  const loadTeams = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // チーム一覧を取得
      const teamsData = await safeInvoke<Team[]>('get_teams', {});
      setTeams(teamsData);
    } catch (err) {
      // エラーは静かに処理（基盤実装のため）
      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.error('チームの読み込みに失敗しました:', err);
      }
      setTeams([]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * API共有一覧を読み込む
   */
  const loadApiShares = async () => {
    try {
      // API共有一覧を取得
      const sharesData = await safeInvoke<ApiShare[]>('get_api_shares', {});
      setApiShares(sharesData);
    } catch (err) {
      // エラーは無視（基盤実装のため）
      setApiShares([]);
    }
  };

  /**
   * チームを作成
   */
  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) {
      showError('チーム名を入力してください');
      return;
    }

    try {
      setSaving(true);
      
      // 現在のユーザーID（マルチユーザー機能が実装されていないため、固定値を使用）
      // 将来の実装では、認証システムから現在のユーザーIDを取得
      const currentUserId = 'user-1';
      
      await safeInvoke('create_team', {
        name: newTeamName.trim(),
        owner_id: currentUserId,
        description: newTeamDescription.trim() || null,
      });

      showSuccess('チームを作成しました');
      setNewTeamName('');
      setNewTeamDescription('');
      setShowCreateTeam(false);
      loadTeams();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'チームの作成に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  /**
   * APIをチームと共有
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _handleShareApi = async (_apiId: string, _teamId: string, _permission: string) => {
    try {
      setSaving(true);
      
      await safeInvoke('share_api_with_team', {
        api_id: _apiId,
        team_id: _teamId,
        permission: _permission,
      });

      showSuccess('APIを共有しました');
      loadApiShares();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'APIの共有に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="team-management-page">
        <div className="team-management-container">
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>チームを読み込んでいます...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="team-management-page">
      <div className="team-management-container">
        <header className="team-management-header">
          <button className="back-button" onClick={() => navigate('/')}>
            ← 戻る
          </button>
          <h1>チーム管理</h1>
        </header>

        {error && (
          <ErrorMessage
            message={error}
            type="api"
            onClose={() => setError(null)}
          />
        )}

        <div className="team-management-content">
          <div className="team-info-banner">
            <h2>コラボレーション機能</h2>
            <p>
              チームを作成してAPIを共有し、コラボレーションできます。チームメンバーに適切な権限を割り当て、APIの共同管理が可能です。
            </p>
            <ul className="team-features-list">
              <li>チームの作成・管理</li>
              <li>APIのチーム共有（読み取り、編集、管理権限）</li>
              <li>コメント・アノテーション機能</li>
              <li>ロールベースアクセス制御（RBAC）</li>
            </ul>
          </div>

          <div className="teams-section">
            <div className="teams-header">
              <h2>チーム一覧</h2>
              <button
                type="button"
                className="button-primary"
                onClick={() => setShowCreateTeam(!showCreateTeam)}
                disabled={saving}
              >
                {showCreateTeam ? 'キャンセル' : '+ チームを作成'}
              </button>
            </div>

            {showCreateTeam && (
              <div className="create-team-form">
                <div className="form-group">
                  <label className="form-label" htmlFor="team-name">
                    チーム名 <span className="required">*</span>
                  </label>
                  <input
                    id="team-name"
                    type="text"
                    className="form-input"
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    placeholder="チーム名を入力"
                    disabled={saving}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="team-description">
                    説明
                  </label>
                  <textarea
                    id="team-description"
                    className="form-textarea"
                    value={newTeamDescription}
                    onChange={(e) => setNewTeamDescription(e.target.value)}
                    placeholder="チームの説明を入力（オプション）"
                    rows={3}
                    disabled={saving}
                  />
                </div>
                <div className="form-actions">
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => {
                      setShowCreateTeam(false);
                      setNewTeamName('');
                      setNewTeamDescription('');
                    }}
                    disabled={saving}
                  >
                    キャンセル
                  </button>
                  <button
                    type="button"
                    className="button-primary"
                    onClick={handleCreateTeam}
                    disabled={saving || !newTeamName.trim()}
                  >
                    {saving ? '作成中...' : 'チームを作成'}
                  </button>
                </div>
              </div>
            )}

            {teams.length === 0 ? (
              <div className="teams-empty">
                <p>チームがまだありません</p>
                <p className="teams-empty-hint">
                  チームを作成して、APIを共有しましょう。
                </p>
              </div>
            ) : (
              <div className="teams-list">
                {teams.map((team) => (
                  <div key={team.id} className="team-item">
                    <div className="team-header">
                      <h3 className="team-name">{team.name}</h3>
                      <span className="team-owner">オーナー</span>
                    </div>
                    {team.description && (
                      <p className="team-description">{team.description}</p>
                    )}
                    <div className="team-meta">
                      <span className="team-meta-item">
                        作成日: {new Date(team.created_at).toLocaleDateString('ja-JP')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="api-shares-section">
            <h2>共有されたAPI</h2>
            {apiShares.length === 0 ? (
              <div className="api-shares-empty">
                <p>共有されたAPIはありません</p>
              </div>
            ) : (
              <div className="api-shares-list">
                {apiShares.map((share) => (
                  <div key={share.id} className="api-share-item">
                    <div className="api-share-header">
                      <h3 className="api-share-name">{share.api_name || share.api_id}</h3>
                      <span className={`api-share-permission permission-${share.permission.toLowerCase()}`}>
                        {share.permission === 'Read' ? '読み取り' : share.permission === 'Write' ? '編集' : '管理'}
                      </span>
                    </div>
                    <div className="api-share-meta">
                      <span className="api-share-meta-item">
                        共有日: {new Date(share.created_at).toLocaleDateString('ja-JP')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

