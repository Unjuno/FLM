// FLM - フッターコンポーネント
// フロントエンドエージェント (FE) 実装
// FE-017-01: 共通レイアウトコンポーネント実装

import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Footer.css';

/**
 * フッターコンポーネントのプロパティ
 */
export interface FooterProps {
  /** カスタムクラス名 */
  className?: string;
}

/**
 * フッターコンポーネント
 * アプリケーション全体で使用する共通フッター
 */
export const Footer: React.FC<FooterProps> = ({ className = '' }) => {
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();

  const footerLinks = [
    { path: '/help', label: 'ヘルプ' },
    { path: '/about', label: 'アプリについて' },
    { path: '/settings', label: '設定' },
    { path: '/privacy', label: 'プライバシーポリシー' },
    { path: '/terms', label: '利用規約' },
  ];

  return (
    <footer className={`app-footer ${className}`}>
      <div className="footer-container">
        <div className="footer-content">
          {/* 左側: コピーライト */}
          <div className="footer-copyright">
            <p>© {currentYear} FLM Project. All rights reserved.</p>
          </div>

          {/* 中央: リンク */}
          <nav className="footer-nav" aria-label="フッターナビゲーション">
            <ul className="footer-links">
              {footerLinks.map((link) => (
                <li key={link.path} className="footer-link-item">
                  <button
                    className="footer-link"
                    onClick={() => navigate(link.path)}
                    aria-label={link.label}
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          {/* 右側: バージョン情報 */}
          <div className="footer-version">
            <p>Version 1.0.0</p>
          </div>
        </div>
      </div>
    </footer>
  );
};

