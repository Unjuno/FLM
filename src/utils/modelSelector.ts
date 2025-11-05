// modelSelector - Webサイト要件に基づくモデル自動選定ロジック

import type { WebModelDefinition } from '../types/webModel';
import type { WebServiceRequirements, ModelSelectionResult } from '../types/webService';
import { loadWebModelConfig } from './webModelConfig';
import { PORT_RANGE, FORMATTING } from '../constants/config';
import { logger } from './logger';

/**
 * 要件に基づいて最適なモデルを選定
 */
export async function selectBestModel(
  requirements: WebServiceRequirements
): Promise<ModelSelectionResult | null> {
  try {
    // Webモデル設定を読み込む
    const webModelConfig = await loadWebModelConfig();
    
    // モデルリストの存在確認
    if (!webModelConfig.models || webModelConfig.models.length === 0) {
      if (import.meta.env.DEV) {
        logger.warn('利用可能なモデルが設定されていません', 'modelSelector');
      }
      return null;
    }
    
    // 候補モデルをスコアリング
    const candidates: Array<{ model: WebModelDefinition; score: number; reason: string }> = [];
    
    for (const model of webModelConfig.models) {
      let score = 0;
      const reasons: string[] = [];
      
      // カテゴリマッチング（20点）
      let categoryScoreAdded = false;
      if (requirements.category && model.category === requirements.category) {
        score += 20;
        reasons.push('カテゴリが一致');
        categoryScoreAdded = true;
      } else if (!requirements.category && model.recommended) {
        score += 10;
        reasons.push('推奨モデル（カテゴリ未指定時）');
        categoryScoreAdded = true;
      }
      
      // 使用例マッチング（30点）
      if (requirements.useCase && model.useCases && model.useCases.length > 0) {
        const useCaseLower = requirements.useCase.toLowerCase();
        const useCaseMatch = model.useCases.some(
          (uc) => uc.toLowerCase().includes(useCaseLower) ||
                  useCaseLower.includes(uc.toLowerCase())
        );
        if (useCaseMatch) {
          score += 30;
          reasons.push('使用例が一致');
        }
      }
      
      // 機能要件マッチング（25点）
      let featureScore = 0;
      if (requirements.needsVision && model.capabilities?.vision) {
        featureScore += 8;
        reasons.push('画像処理対応');
      }
      if (requirements.needsAudio && model.capabilities?.audio) {
        featureScore += 8;
        reasons.push('音声処理対応');
      }
      if (requirements.needsVideo && model.capabilities?.video) {
        featureScore += 9;
        reasons.push('動画処理対応');
      }
      // 不要な機能は減点
      if (!requirements.needsVision && model.capabilities?.vision && !model.capabilities.audio && !model.capabilities.video) {
        featureScore -= 5;
      }
      if (!requirements.needsAudio && !requirements.needsVideo && model.capabilities?.audio) {
        featureScore -= 3;
      }
      score += Math.max(0, featureScore);
      
      // リソース要件マッチング（25点）
      if (requirements.availableMemory && 
          typeof requirements.availableMemory === 'number' && 
          isFinite(requirements.availableMemory) &&
          requirements.availableMemory > 0 &&
          model.requirements) {
        if (model.requirements.minMemory && 
            typeof model.requirements.minMemory === 'number' &&
            isFinite(model.requirements.minMemory) &&
            requirements.availableMemory >= model.requirements.minMemory) {
          score += 15;
          reasons.push(`メモリ要件を満たす（${model.requirements.minMemory}GB以上必要、利用可能: ${requirements.availableMemory}GB）`);
          
          // 推奨メモリを満たしている場合は追加点
          if (model.requirements.recommendedMemory && 
              typeof model.requirements.recommendedMemory === 'number' &&
              isFinite(model.requirements.recommendedMemory) &&
              requirements.availableMemory >= model.requirements.recommendedMemory) {
            score += 10;
            reasons.push('推奨メモリ要件を満たす');
          }
        } else if (model.requirements.minMemory && 
                   typeof model.requirements.minMemory === 'number' &&
                   isFinite(model.requirements.minMemory) &&
                   requirements.availableMemory < model.requirements.minMemory) {
          score -= 20; // メモリ不足は大幅減点
          reasons.push(`メモリ不足（必要: ${model.requirements.minMemory}GB、利用可能: ${requirements.availableMemory}GB）`);
        }
      }
      
      // GPU要件マッチング（5点）
      if (requirements.hasGpu !== undefined && model.requirements?.gpuRecommended !== undefined) {
        if (requirements.hasGpu === model.requirements.gpuRecommended) {
          score += 5;
          reasons.push(requirements.hasGpu ? 'GPU推奨と一致' : 'CPU利用可能');
        } else if (model.requirements.gpuRecommended && !requirements.hasGpu) {
          score -= 5;
          reasons.push('GPU推奨だが利用不可');
        }
      }
      
      // モデルサイズ制限チェック（減点）
      if (requirements.maxModelSize && 
          typeof requirements.maxModelSize === 'number' &&
          isFinite(requirements.maxModelSize) &&
          requirements.maxModelSize > 0 &&
          model.size && 
          typeof model.size === 'number' && 
          isFinite(model.size)) {
        const modelSizeGB = model.size / FORMATTING.BYTES_PER_GB;
        if (isFinite(modelSizeGB) && modelSizeGB > requirements.maxModelSize) {
          score -= 30;
          reasons.push(`モデルサイズが制限を超える（${modelSizeGB.toFixed(FORMATTING.DECIMAL_PLACES_SHORT)}GB > ${requirements.maxModelSize}GB）`);
        }
      }
      
      // 推奨モデルは追加点（10点）
      // カテゴリマッチングで既に推奨モデルとして点数が加算されている場合は重複しない
      if (model.recommended && !categoryScoreAdded) {
        score += 10;
        reasons.push('推奨モデルとしてマーク');
      }
      
      // スコアが正の値で有限値の場合のみ候補に追加（NaNやInfinityを除外）
      if (isFinite(score) && score > 0) {
        candidates.push({
          model,
          score,
          reason: reasons.join('、'),
        });
      }
    }
    
    // スコアが高い順にソート（スコアが有限値であることを確認）
    candidates.sort((a, b) => {
      const scoreDiff = b.score - a.score;
      // NaNやInfinityの場合は0を返す（順序を保持）
      return isFinite(scoreDiff) ? scoreDiff : 0;
    });
    
    if (candidates.length === 0) {
      return null;
    }
    
    // 最高スコアのモデルを選定
    const bestMatch = candidates[0];
    
    // bestMatchの妥当性チェック
    if (!bestMatch || !bestMatch.model) {
      throw new Error('モデル選定の結果が不正です');
    }
    
    // スコアの妥当性チェック
    if (!isFinite(bestMatch.score) || bestMatch.score <= 0) {
      throw new Error('モデル選定のスコアが不正です');
    }
    
    const selectedModel = bestMatch.model;
    
    // モデルの必須プロパティの存在確認
    if (!selectedModel.id || !selectedModel.name || !selectedModel.modelName || !selectedModel.engine) {
      throw new Error(`モデル "${selectedModel.name || '不明'}" に必須プロパティが設定されていません`);
    }
    
    // defaultSettingsの存在確認（バリデーションで保証されているが、念のため）
    if (!selectedModel.defaultSettings) {
      throw new Error(`モデル "${selectedModel.name}" にdefaultSettingsが設定されていません`);
    }
    
    // ポート番号の妥当性チェック
    let port = requirements.preferredPort ?? selectedModel.defaultSettings.port ?? PORT_RANGE.DEFAULT;
    if (typeof port !== 'number' || !isFinite(port) || port < PORT_RANGE.MIN || port > PORT_RANGE.MAX) {
      if (import.meta.env.DEV) {
        console.warn(`無効なポート番号: ${port}。デフォルト値${PORT_RANGE.DEFAULT}を使用します。`);
      }
      port = PORT_RANGE.DEFAULT;
    }
    
    // 設定を構築（安全にアクセス）
    // modelParametersがオブジェクトでない場合は空オブジェクトを使用
    const modelParameters = selectedModel.defaultSettings.modelParameters;
    const safeModelParameters = (modelParameters && typeof modelParameters === 'object' && !Array.isArray(modelParameters))
      ? modelParameters
      : {};
    
    const apiConfig: ModelSelectionResult['config'] = {
      port: Math.floor(port),
      enableAuth: requirements.enableAuth ?? selectedModel.defaultSettings.enableAuth ?? true,
      modelParameters: safeModelParameters,
      memory: selectedModel.defaultSettings.memory,
      multimodal: selectedModel.defaultSettings.multimodal,
    };
    
    return {
      model: {
        id: selectedModel.id,
        name: selectedModel.name,
        modelName: selectedModel.modelName,
        engine: selectedModel.engine,
        description: selectedModel.description || '', // 空文字列をデフォルト値として使用
      },
      score: bestMatch.score,
      reason: bestMatch.reason,
      config: apiConfig,
    };
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('モデル選定エラー:', error);
    }
    throw error;
  }
}

/**
 * システムリソースを取得（簡易版）
 */
export async function getSystemResources(): Promise<{
  availableMemory: number;
  hasGpu: boolean;
}> {
  try {
    // Tauri環境が利用可能かチェック
    const { isTauriAvailable } = await import('../utils/tauri');
    if (!isTauriAvailable()) {
      throw new Error('Tauri環境が初期化されていません。アプリケーションを再起動してください。');
    }
    
    // バックエンドからシステムリソースを取得（実装済みのコマンドを使用）
    const { invoke } = await import('@tauri-apps/api/core');
    const resources = await invoke<{
      total_memory: number;
      available_memory: number;
      cpu_cores: number;
      cpu_usage: number;
      total_disk: number;
      available_disk: number;
      resource_level: string;
    }>('get_system_resources');
    
    // リソースデータの妥当性チェック
    if (!resources || typeof resources.available_memory !== 'number') {
      throw new Error('システムリソースデータが不正です');
    }
    
    // 利用可能メモリをGBに変換（available_memoryはバイト単位）
    // 注意: モデル選定には利用可能メモリを使用する（実際に使用できるメモリ量）
    let availableMemoryGB = resources.available_memory / FORMATTING.BYTES_PER_GB;
    
    // NaNや負の値のチェック
    if (!isFinite(availableMemoryGB) || availableMemoryGB < 0) {
      if (import.meta.env.DEV) {
        console.warn('利用可能メモリの値が不正です。デフォルト値を使用します。', availableMemoryGB);
      }
      availableMemoryGB = 8; // デフォルト値
    }
    
    // GPUの検出は簡単ではないため、デフォルトでfalseとする
    // 将来的には専用のコマンドで検出できるようにする
    const hasGpu = false;
    
    // 利用可能メモリが0GB以下の場合は、最小値として1GBを設定
    const finalAvailableMemory = Math.max(1, Math.floor(availableMemoryGB));
    
    return {
      availableMemory: finalAvailableMemory,
      hasGpu,
    };
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('システムリソース取得エラー:', error);
    }
    
    // Tauri環境が初期化されていない場合は、エラーメッセージをそのまま再スロー
    if (error instanceof Error && error.message.includes('Tauri環境が初期化されていません')) {
      throw error;
    }
    
    // その他のエラーの場合は、デフォルト値を返す（エラー時も安全な値を返す）
    return {
      availableMemory: 8,
      hasGpu: false,
    };
  }
}

