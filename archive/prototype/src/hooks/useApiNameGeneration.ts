// useApiNameGeneration - API名自動生成用カスタムフック

import { useState, useCallback } from 'react';
import { safeInvoke } from '../utils/tauri';
import { logger } from '../utils/logger';

/**
 * API名生成フックの戻り値
 */
export interface UseApiNameGenerationReturn {
  /** 名前生成中かどうか */
  nameSuggesting: boolean;
  /** 名前が生成されたかどうか */
  nameGenerated: boolean;
  /** API名を自動生成 */
  suggestApiName: (currentName: string, modelName?: string) => Promise<string | null>;
}

/**
 * API名自動生成用カスタムフック
 * 
 * @param onNameGenerated - 名前生成時のコールバック
 */
export const useApiNameGeneration = (
  onNameGenerated?: (name: string) => void
): UseApiNameGenerationReturn => {
  const [nameSuggesting, setNameSuggesting] = useState(false);
  const [nameGenerated, setNameGenerated] = useState(false);

  // API名の自動生成
  const suggestApiName = useCallback(
    async (currentName: string, modelName?: string): Promise<string | null> => {
      try {
        setNameSuggesting(true);
        setNameGenerated(false);
        
        // モデル名を考慮したベース名を生成
        let baseName = currentName;
        if (!baseName || baseName.trim() === '') {
          // 名前が空の場合、モデル名から自動生成
          if (modelName) {
            baseName = `${modelName} API`;
          } else {
            baseName = 'LocalAI API';
          }
        }
        
        logger.debug(
          `API名の自動生成: ベース名="${baseName}", モデル名="${modelName || 'なし'}"`,
          'useApiNameGeneration'
        );
        
        const result = await safeInvoke<{
          suggested_name: string;
          alternatives: string[];
          is_available: boolean;
        }>('suggest_api_name', { base_name: baseName });

        if (!result.is_available || result.suggested_name !== currentName) {
          setNameGenerated(true);
          onNameGenerated?.(result.suggested_name);
          logger.info(`API名を生成しました: "${result.suggested_name}"`, 'useApiNameGeneration');
          // 3秒後に成功メッセージを非表示
          setTimeout(() => setNameGenerated(false), 3000);
          return result.suggested_name;
        } else {
          // 既に使用可能な名前の場合も成功として扱う
          setNameGenerated(true);
          logger.info(`API名は既に使用可能です: "${result.suggested_name}"`, 'useApiNameGeneration');
          setTimeout(() => setNameGenerated(false), 2000);
          return result.suggested_name;
        }
      } catch (err) {
        logger.error('API名提案エラー', err, 'useApiNameGeneration');
        setNameGenerated(false);
        return null;
      } finally {
        setNameSuggesting(false);
      }
    },
    [onNameGenerated]
  );

  return {
    nameSuggesting,
    nameGenerated,
    suggestApiName,
  };
};

