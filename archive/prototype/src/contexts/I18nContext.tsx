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
import { isTauriAvailable, safeInvoke } from '../utils/tauri';
import { setTranslateFunction } from '../utils/errorHandler';
import { setValidationTranslateFunction } from '../utils/validation';
import jaTranslations from '../locales/ja.json';
import enTranslations from '../locales/en.json';
import zhTranslations from '../locales/zh.json';
import koTranslations from '../locales/ko.json';
import esTranslations from '../locales/es.json';
import frTranslations from '../locales/fr.json';
import deTranslations from '../locales/de.json';

type Locale = 'ja' | 'en' | 'zh' | 'ko' | 'es' | 'fr' | 'de';

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
  zh: zhTranslations,
  ko: koTranslations,
  es: esTranslations,
  fr: frTranslations,
  de: deTranslations,
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
      // Tauri環境が利用可能かチェック
      if (!isTauriAvailable()) {
        // 開発環境（ブラウザなど）ではデフォルトの言語を使用
        const isDev =
          process.env.NODE_ENV === 'development' ||
          process.env.NODE_ENV !== 'production';
        if (isDev) {
          console.warn(
            'Tauri環境が利用できないため、デフォルト言語を使用します'
          );
        }
        return;
      }

      try {
        const settings = await safeInvoke<{ language?: string }>(
          'get_app_settings'
        );
        if (
          settings?.language &&
          ['ja', 'en', 'zh', 'ko', 'es', 'fr', 'de'].includes(settings.language)
        ) {
          setLocaleState(settings.language as Locale);
        }
      } catch (error) {
        // エラーの詳細情報をログに出力（開発環境では無視）
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const isDev =
          process.env.NODE_ENV === 'development' ||
          process.env.NODE_ENV !== 'production';
        // invokeが未定義の場合の特別な処理
        if (
          errorMessage.includes('invoke') ||
          errorMessage.includes('undefined') ||
          errorMessage.includes('Cannot read properties') ||
          errorMessage.includes('アプリケーションが正しく起動')
        ) {
          if (isDev) {
            console.warn(
              'Tauri環境が初期化されていません。デフォルト言語を使用します'
            );
          }
        } else {
          if (isDev) {
            console.error('言語設定の読み込みに失敗しました:', errorMessage);
          }
        }
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

  // 言語を変更し、設定に保存する（useCallbackでメモ化）
  const setLocale = useCallback(async (newLocale: Locale) => {
    setLocaleState(newLocale);

    // Tauri環境が利用可能かチェック
    if (!isTauriAvailable()) {
      console.warn('Tauri環境が利用できないため、言語設定を保存できません');
      return;
    }

    try {
      const currentSettings = await safeInvoke<{ language?: string }>(
        'get_app_settings'
      );
      await safeInvoke('update_app_settings', {
        settings: { ...currentSettings, language: newLocale },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      // invokeが未定義の場合の特別な処理
      if (
        errorMessage.includes('invoke') ||
        errorMessage.includes('undefined') ||
        errorMessage.includes('Cannot read properties') ||
        errorMessage.includes('アプリケーションが正しく起動')
      ) {
        console.warn(
          'Tauri環境が初期化されていません。言語設定を保存できません'
        );
      } else {
        console.error('言語設定の保存に失敗しました:', errorMessage);
      }
    }
  }, []);

  // 翻訳関数（useCallbackでメモ化）
  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const keys = key.split('.');

      // 現在のロケールから翻訳を取得
      let value = getTranslationValue(translations[locale], keys);

      // フォールバック: 日本語の翻訳を使用
      if (value === null) {
        value = getTranslationValue(jaTranslations, keys);
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

  // コンテキスト値をメモ化（locale, setLocale, tが変更された場合のみ再作成）
  const contextValue = useMemo(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t]
  );

  // errorHandlerとvalidationに翻訳関数を設定
  useEffect(() => {
    setTranslateFunction(t);
    setValidationTranslateFunction(t);
  }, [t]);

  return (
    <I18nContext.Provider value={contextValue}>{children}</I18nContext.Provider>
  );
};

/**
 * 翻訳値を取得するヘルパー関数（フォールバック用）
 */
const getTranslationValueFallback = (
  translationObj: Translations,
  keys: string[]
): string | null => {
  let current: Translations | string = translationObj;
  for (const k of keys) {
    if (current && typeof current === 'object' && k in current) {
      current = current[k];
    } else {
      return null;
    }
  }
  return typeof current === 'string' ? current : null;
};

// 警告を一度だけ表示するためのフラグ
let hasWarnedAboutProvider = false;

/**
 * i18nフック
 */
export const useI18n = (): I18nContextType => {
  const context = useContext(I18nContext);
  if (!context) {
    // I18nProviderの外で使用された場合のフォールバック
    // 開発環境では警告を一度だけ表示し、デフォルトの翻訳関数を返す
    if (process.env.NODE_ENV === 'development' && !hasWarnedAboutProvider) {
      hasWarnedAboutProvider = true;
      console.warn(
        'useI18n must be used within an I18nProvider. Using fallback translations.'
      );
    }

    // フォールバック: デフォルトの翻訳関数を返す
    const fallbackT = (
      key: string,
      params?: Record<string, string | number>
    ): string => {
      const keys = key.split('.');
      const value = getTranslationValueFallback(jaTranslations, keys);

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
        // setLocaleの警告も一度だけ表示
        if (process.env.NODE_ENV === 'development' && !hasWarnedAboutProvider) {
          hasWarnedAboutProvider = true;
          console.warn('setLocale called outside I18nProvider');
        }
      },
      t: fallbackT,
    };
  }
  return context;
};
