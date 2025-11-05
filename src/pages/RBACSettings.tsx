// RBACSettings - RBAC設定ページ
// ロールベースアクセス制御の設定

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
// import { useNotifications } from '../contexts/NotificationContext';
import { ErrorMessage } from '../components/common/ErrorMessage';
import { useGlobalKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import './RBACSettings.css';

/**
 * ユーザーロール
 */
type UserRole = 'Admin' | 'Editor' | 'Viewer' | 'Custom';

/**
 * 権限
 */
type Permission = 
  | 'CreateApi'
  | 'EditApi'
  | 'DeleteApi'
  | 'ViewApi'
  | 'ManageUsers'
  | 'ManageSettings'
  | 'ViewLogs'
  | 'ViewMetrics';

/**
 * ロールと権限のマッピング
 */
interface RolePermissions {
  role: UserRole;
  permissions: Permission[];
}

/**
 * RBAC設定ページ
 */
export const RBACSettings: React.FC = () => {
  const navigate = useNavigate();
  // const { showError } = useNotifications();
  const [roles, setRoles] = useState<RolePermissions[]>([
    {
      role: 'Admin',
      permissions: [
        'CreateApi',
        'EditApi',
        'DeleteApi',
        'ViewApi',
        'ManageUsers',
        'ManageSettings',
        'ViewLogs',
        'ViewMetrics',
      ],
    },
    {
      role: 'Editor',
      permissions: ['CreateApi', 'EditApi', 'ViewApi', 'ViewLogs', 'ViewMetrics'],
    },
    {
      role: 'Viewer',
      permissions: ['ViewApi', 'ViewLogs', 'ViewMetrics'],
    },
  ]);
  const [loading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // グローバルキーボードショートカットを有効化
  useGlobalKeyboardShortcuts();

  /**
   * 権限の表示名を取得
   */
  const getPermissionName = (permission: Permission): string => {
    const names: { [key in Permission]: string } = {
      CreateApi: 'API作成',
      EditApi: 'API編集',
      DeleteApi: 'API削除',
      ViewApi: 'API閲覧',
      ManageUsers: 'ユーザー管理',
      ManageSettings: '設定管理',
      ViewLogs: 'ログ閲覧',
      ViewMetrics: 'メトリクス閲覧',
    };
    return names[permission];
  };

  /**
   * ロールの表示名を取得
   */
  const getRoleName = (role: UserRole): string => {
    const names: { [key: string]: string } = {
      Admin: '管理者',
      Editor: '編集者',
      Viewer: '閲覧者',
      Custom: 'カスタム',
    };
    return names[role] || role;
  };

  /**
   * 権限のチェック状態を切り替え
   */
  const handleTogglePermission = (roleIndex: number, permission: Permission) => {
    const updatedRoles = [...roles];
    const role = updatedRoles[roleIndex];
    
    if (role.permissions.includes(permission)) {
      role.permissions = role.permissions.filter((p) => p !== permission);
    } else {
      role.permissions.push(permission);
    }
    
    setRoles(updatedRoles);
  };

  if (loading) {
    return (
      <div className="rbac-settings-page">
        <div className="rbac-settings-container">
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>設定を読み込んでいます...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rbac-settings-page">
      <div className="rbac-settings-container">
        <header className="rbac-settings-header">
          <button className="back-button" onClick={() => navigate('/settings')}>
            ← 戻る
          </button>
          <h1>RBAC設定</h1>
        </header>

        {error && (
          <ErrorMessage
            message={error}
            type="api"
            onClose={() => setError(null)}
          />
        )}

        <div className="rbac-settings-content">
          <div className="rbac-info-banner">
            <h2>ロールベースアクセス制御（RBAC）</h2>
            <p>
              ユーザーロールと権限を管理できます。管理者、編集者、閲覧者のロールを設定し、各ロールに適切な権限を割り当てることができます。
            </p>
            <ul className="rbac-features-list">
              <li>ユーザーロールの定義（管理者、編集者、閲覧者）</li>
              <li>ロールごとの権限設定</li>
              <li>カスタムロールの作成</li>
              <li>ユーザーへのロール割り当て</li>
            </ul>
          </div>

          <div className="rbac-roles-section">
            <h2>ロールと権限</h2>
            
            <div className="roles-list">
              {roles.map((roleData, roleIndex) => (
                <div key={roleIndex} className="role-card">
                  <h3 className="role-title">{getRoleName(roleData.role)}</h3>
                  <div className="permissions-list">
                    {([
                      'CreateApi',
                      'EditApi',
                      'DeleteApi',
                      'ViewApi',
                      'ManageUsers',
                      'ManageSettings',
                      'ViewLogs',
                      'ViewMetrics',
                    ] as Permission[]).map((permission) => (
                      <label
                        key={permission}
                        className="permission-checkbox-label"
                        htmlFor={`${roleData.role}-${permission}`}
                      >
                        <input
                          id={`${roleData.role}-${permission}`}
                          type="checkbox"
                          className="permission-checkbox"
                          checked={roleData.permissions.includes(permission)}
                          onChange={() => handleTogglePermission(roleIndex, permission)}
                          disabled={roleData.role === 'Admin' && ['CreateApi', 'EditApi', 'DeleteApi', 'ViewApi'].includes(permission)}
                        />
                        <span className="permission-checkbox-text">
                          {getPermissionName(permission)}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="rbac-note">
              <p className="rbac-note-text">
                <strong>注意:</strong> 管理者ロールの基本権限（API作成、編集、削除、閲覧）は変更できません。
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

