// FLM - テーマコンテキスト
// フロントエンドエージェント (FE) 実装
// FE-011-02: ダークモード実装

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { safeInvoke, isTauriAvailable } from '../utils/tauri';

/**
 * テーマタイプ
 */
export type ThemeType = 'light' | 'dark' | 'auto';

/**
 * 実際のテーマ（autoの場合はシステム設定に従う）
 */
export type ActualTheme = 'light' | 'dark';

/**
 * テーマコンテキストの値
 */
interface ThemeContextValue {
  /** 現在のテーマ設定 */
  theme: ThemeType;
  /** 実際に適用されているテーマ */
  actualTheme: ActualTheme;
  /** テーマを設定する */
  setTheme: (theme: ThemeType) => Promise<void>;
  /** テーマを切り替える（light ↔ dark） */
  toggleTheme: () => Promise<void>;
}

/**
 * テーマコンテキスト
 */
const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/**
 * システム設定のダークモード検出
 */
const getSystemTheme = (): ActualTheme => {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return 'light';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

/**
 * 実際のテーマを計算（システム設定を考慮）
 */
const calculateActualTheme = (theme: ThemeType): ActualTheme => {
  if (theme === 'auto') {
    return getSystemTheme();
  }
  return theme;
};

/**
 * テーマプロバイダーのプロパティ
 */
interface ThemeProviderProps {
  children: React.ReactNode;
}

/**
 * テーマプロバイダー
 * アプリケーション全体でテーマを管理します
 */
export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeType>('auto');
  const [actualTheme, setActualTheme] = useState<ActualTheme>(calculateActualTheme('auto'));
  const [isLoading, setIsLoading] = useState(true);

  // システム設定の変更を監視
  useEffect(() => {
    if (theme !== 'auto') {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      const newActualTheme = getSystemTheme();
      setActualTheme(newActualTheme);
      applyThemeToDocument(newActualTheme);
    };

    // モダンブラウザではaddEventListenerを使用
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else {
      // 古いブラウザではaddListenerを使用
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, [theme]);

  // 設定からテーマを読み込む
  useEffect(() => {
    loadThemeFromSettings();
  }, []);

  // 実際のテーマが変更されたときにCSS変数を適用
  useEffect(() => {
    applyThemeToDocument(actualTheme);
  }, [actualTheme]);

  /**
   * 設定からテーマを読み込む
   */
  const loadThemeFromSettings = async () => {
    try {
      // Tauri環境が利用可能かチェック
      if (!isTauriAvailable()) {
        // Tauri環境がない場合はデフォルト値を使用（開発環境やブラウザでの実行時）
        console.warn('Tauri環境が利用できないため、デフォルトテーマを使用します');
        setThemeState('auto');
        setActualTheme(calculateActualTheme('auto'));
        setIsLoading(false);
        return;
      }

      const settings = await safeInvoke<{ theme: string | null }>('get_app_settings');
      const savedTheme = settings.theme as ThemeType | null;
      
      if (savedTheme && ['light', 'dark', 'auto'].includes(savedTheme)) {
        setThemeState(savedTheme);
        const newActualTheme = calculateActualTheme(savedTheme);
        setActualTheme(newActualTheme);
      } else {
        // デフォルトはauto
        const defaultTheme: ThemeType = 'auto';
        setThemeState(defaultTheme);
        setActualTheme(calculateActualTheme(defaultTheme));
      }
    } catch (error) {
      // エラーログは開発者向けに残すが、ユーザーには分かりやすいメッセージを表示
      const errorMessage = error instanceof Error ? error.message : '不明なエラー';
      console.error('テーマ設定の読み込みに失敗しました:', errorMessage);
      
      // エラー時はデフォルト値を使用（アプリは継続して動作）
      setThemeState('auto');
      setActualTheme(calculateActualTheme('auto'));
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * テーマを設定する
   */
  const setTheme = useCallback(async (newTheme: ThemeType) => {
    try {
      // Tauri環境が利用可能かチェック
      if (!isTauriAvailable()) {
        // Tauri環境がない場合はローカルのみ更新（開発環境やブラウザでの実行時）
        setThemeState(newTheme);
        const newActualTheme = calculateActualTheme(newTheme);
        setActualTheme(newActualTheme);
        return;
      }

      // 設定を保存
      await safeInvoke('update_app_settings', {
        settings: { theme: newTheme },
      });
      
      setThemeState(newTheme);
      const newActualTheme = calculateActualTheme(newTheme);
      setActualTheme(newActualTheme);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '不明なエラー';
      console.error('テーマ設定の保存に失敗しました:', errorMessage);
      
      // ユーザーフレンドリーなエラーをスロー
      throw new Error(
        'テーマ設定の保存に失敗しました。アプリケーションを再起動してください。'
      );
    }
  }, []);

  /**
   * テーマを切り替える（light ↔ dark、autoの場合はlightに）
   */
  const toggleTheme = useCallback(async () => {
    const newTheme: ThemeType = theme === 'light' ? 'dark' : 'light';
    await setTheme(newTheme);
  }, [theme, setTheme]);

  /**
   * ドキュメントにテーマを適用
   */
  const applyThemeToDocument = (actual: ActualTheme) => {
    const root = document.documentElement;
    root.setAttribute('data-theme', actual);
    root.classList.remove('theme-light', 'theme-dark');
    root.classList.add(`theme-${actual}`);
  };

  // ローディング中は何も表示しない（またはローディング表示）
  if (isLoading) {
    return <>{children}</>; // 簡単な実装としてそのまま表示
  }

  return (
    <ThemeContext.Provider value={{ theme, actualTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

/**
 * テーマコンテキストを使用するフック
 */
export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

