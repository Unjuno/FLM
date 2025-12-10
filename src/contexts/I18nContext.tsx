// I18nContext - 多言語対応コンテキスト

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';
import { safeInvoke } from '../utils/tauri';
import jaTranslations from '../locales/ja.json';
import enTranslations from '../locales/en.json';

type Locale = 'ja' | 'en';

interface Translations {
  [key: string]: string | Translations;
}

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => Promise<void>;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

const translations: Record<Locale, Translations> = {
  ja: jaTranslations,
  en: enTranslations,
};

interface I18nProviderProps {
  children: ReactNode;
}

/**
 * 多言語対応プロバイダー
 */
export const I18nProvider: React.FC<I18nProviderProps> = ({ children }) => {
  const [locale, setLocaleState] = useState<Locale>('ja');

  // 設定から言語を読み込む
  useEffect(() => {
    const loadLocale = async () => {
      try {
        // OSの言語設定を取得
        const osLocale = navigator.language.toLowerCase();
        let detectedLocale: Locale = 'ja';

        // OSの言語設定から言語を検出
        if (osLocale.startsWith('ja')) {
          detectedLocale = 'ja';
        } else if (osLocale.startsWith('en')) {
          detectedLocale = 'en';
        }

        // config.dbからpreferred_languageを取得
        try {
          const result = await safeInvoke<{
            version: string;
            data: { key: string; value: string | null };
          }>('ipc_config_get', { key: 'preferred_language' });

          if (
            result?.data?.value &&
            (result.data.value === 'ja' || result.data.value === 'en')
          ) {
            detectedLocale = result.data.value as Locale;
          }
        } catch (error) {
          // 設定が存在しない場合はOSの言語設定を使用
          // エラーは無視（初回起動時など）
        }

        setLocaleState(detectedLocale);
      } catch (error) {
        // エラー時はデフォルトの日本語を使用
        setLocaleState('ja');
      }
    };
    loadLocale();
  }, []);

  // 翻訳値を取得するヘルパー関数
  const getTranslationValue = useCallback(
    (translationObj: Translations, keys: string[]): string | null => {
      let current: Translations | string = translationObj;
      for (const k of keys) {
        if (current && typeof current === 'object' && k in current) {
          current = current[k];
        } else {
          return null;
        }
      }
      return typeof current === 'string' ? current : null;
    },
    []
  );

  // 言語を変更し、設定に保存する
  const setLocale = useCallback(
    async (newLocale: Locale) => {
      setLocaleState(newLocale);

      try {
        // config.dbにpreferred_languageを保存
        await safeInvoke('ipc_config_set', {
          key: 'preferred_language',
          value: newLocale,
        });
      } catch (error) {
        // エラー時はloggerに記録（設定の保存に失敗しても動作は継続）
        // loggerは利用できない可能性があるため、エラーを無視する
      }
    },
    []
  );

  // 翻訳関数
  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const keys = key.split('.');

      // 現在のロケールから翻訳を取得
      let value = getTranslationValue(translations[locale], keys);

      // フォールバック: 日本語の翻訳を使用
      if (value === null && locale !== 'ja') {
        value = getTranslationValue(jaTranslations, keys);
      }

      // フォールバック: 英語の翻訳を使用
      if (value === null) {
        value = getTranslationValue(enTranslations, keys);
      }

      // 翻訳が見つからない場合はキーを返す
      if (value === null) {
        return key;
      }

      // パラメータの置換
      if (params) {
        return value.replace(/\{\{(\w+)\}\}/g, (match, paramKey) => {
          return params[paramKey]?.toString() || match;
        });
      }

      return value;
    },
    [locale, getTranslationValue]
  );

  // コンテキスト値をメモ化
  const contextValue = useMemo(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t]
  );

  return (
    <I18nContext.Provider value={contextValue}>{children}</I18nContext.Provider>
  );
};

/**
 * i18nフック
 */
export const useI18n = (): I18nContextType => {
  const context = useContext(I18nContext);
  if (!context) {
    // I18nProviderの外で使用された場合のフォールバック
    const fallbackT = (
      key: string,
      params?: Record<string, string | number>
    ): string => {
      const keys = key.split('.');
      let value: string | null = null;

      // 日本語から翻訳を取得
      let current: Translations | string = jaTranslations;
      for (const k of keys) {
        if (current && typeof current === 'object' && k in current) {
          current = current[k];
        } else {
          return key;
        }
      }
      value = typeof current === 'string' ? current : null;

      if (value === null) {
        return key;
      }

      if (params) {
        return value.replace(/\{\{(\w+)\}\}/g, (match, paramKey) => {
          return params[paramKey]?.toString() || match;
        });
      }

      return value;
    };

    return {
      locale: 'ja' as Locale,
      setLocale: async () => {
        // setLocale called outside I18nProvider - this should not happen
        // Note: Cannot use logger here due to potential circular dependency
      },
      t: fallbackT,
    };
  }
  return context;
};
