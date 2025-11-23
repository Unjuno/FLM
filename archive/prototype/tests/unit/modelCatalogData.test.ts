import { describe, it, expect } from '@jest/globals';
import { DEFAULT_MODELS } from '../../src/constants/defaultModels';
import {
  FALLBACK_MODELS,
  createFallbackModels,
} from '../../src/constants/fallbackModels';

describe('model catalog constants', () => {
  const requiredModels = [
    {
      name: 'llama-guard:latest',
      category: 'other',
      recommended: true,
    },
    {
      name: 'nllb-200:3.3b',
      category: 'translation',
      recommended: true,
    },
    {
      name: 'mistral-summarize:latest',
      category: 'summarization',
      recommended: true,
    },
    {
      name: 'moondream:latest',
      category: 'multimodal',
      recommended: true,
    },
    {
      name: 'flux:latest',
      category: 'image-generation',
      recommended: true,
    },
    {
      name: 'bark:latest',
      category: 'audio-generation',
      recommended: true,
    },
    {
      name: 'medllama:latest',
      category: 'qa',
      recommended: false,
    },

    // 業界特化モデル強化

    // 軽量モデル
    {
      name: 'qwen2.5:1.5b',
      category: 'chat',
      recommended: true,
    },
    {
      name: 'smol-lm:600m',
      category: 'chat',
      recommended: true,
    },
    // マルチモーダル拡張
    {
      name: 'pixtral:latest',
      category: 'multimodal',
      recommended: true,
    },
    {
      name: 'xtts-v2:latest',
      category: 'audio-generation',
      recommended: true,
    },
    {
      name: 'stable-diffusion-xl:latest',
      category: 'image-generation',
      recommended: true,
    },
    {
      name: 'animagine-xl:latest',
      category: 'image-generation',
      recommended: false,
    },
    // 業界特化モデル追加

    // 軽量モデル追加
    {
      name: 'phi-3:mini-4k',
      category: 'chat',
      recommended: true,
    },
    {
      name: 'gemma:2b-it',
      category: 'chat',
      recommended: true,
    },
    // マルチモーダル追加
    {
      name: 'cogvlm:latest',
      category: 'multimodal',
      recommended: true,
    },
    {
      name: 'qwen-vl:latest',
      category: 'multimodal',
      recommended: true,
    },
    {
      name: 'clip:latest',
      category: 'multimodal',
      recommended: true,
    },
    {
      name: 'blip:latest',
      category: 'multimodal',
      recommended: false,
    },
    // 業界特化モデル追加（第2弾）

    // 軽量モデル追加（第2弾）
    {
      name: 'phi-3:mini-128k',
      category: 'chat',
      recommended: true,
    },
    {
      name: 'gemma:1.1b',
      category: 'chat',
      recommended: true,
    },
    {
      name: 'nano-gpt:latest',
      category: 'chat',
      recommended: true,
    },
    // マルチモーダル追加（第2弾）
    {
      name: 'musicgen:latest',
      category: 'audio-generation',
      recommended: true,
    },
    {
      name: 'audiocraft:latest',
      category: 'audio-generation',
      recommended: false,
    },

    // 業界特化モデル追加（第3弾）

    // 軽量モデル追加（第3弾）

    {
      name: 'micro-llm:latest',
      category: 'chat',
      recommended: true,
    },
    // マルチモーダル追加（第3弾）

    {
      name: 'gen2:latest',
      category: 'image-generation',
      recommended: true,
    },
    {
      name: 'point-e:latest',
      category: 'image-generation',
      recommended: false,
    },
    // 特殊モデル（制約緩和・非検閲モデル）

    // 数学・科学計算モデル
    {
      name: 'wizard-math:7b',
      category: 'qa',
      recommended: true,
    },
    {
      name: 'deepseek-math:7b',
      category: 'qa',
      recommended: true,
    },
    // 創作・ストーリー生成モデル

    // データ分析・ビジネスモデル

    // ソフトウェア開発モデル

    // 検索・RAGモデル

    // 感情・心理分析モデル

    // ゲーム・エンターテインメントモデル

    // その他特殊用途モデル

    {
      name: 'mistral-instruct:7b',
      category: 'chat',
      recommended: true,
    },

    // SEO・マーケティングモデル

    // カスタマーサポートモデル

    // コード生成モデル（追加）
    {
      name: 'starcoder2:15b',
      category: 'code',
      recommended: true,
    },
    // マルチモーダルモデル（追加）
    {
      name: 'instructblip:7b',
      category: 'multimodal',
      recommended: true,
    },
    // 実用用途モデル

    // その他追加モデル
    {
      name: 'phi-3:medium-4k',
      category: 'chat',
      recommended: true,
    },
    {
      name: 'qwen2.5:3b',
      category: 'chat',
      recommended: true,
    },
    // 追加バリエーションモデル
    {
      name: 'llama3.2:8b',
      category: 'chat',
      recommended: true,
    },

    {
      name: 'qwen2.5:7b',
      category: 'chat',
      recommended: true,
    },
    {
      name: 'gemma:7b-it',
      category: 'chat',
      recommended: true,
    },
    {
      name: 'phi-3:small',
      category: 'chat',
      recommended: true,
    },
    // 追加軽量モデル
    {
      name: 'tinyllama:1.1b-chat',
      category: 'chat',
      recommended: true,
    },
    {
      name: 'stablelm-zephyr:3b',
      category: 'chat',
      recommended: true,
    },
    // 追加マルチモーダルモデル
    {
      name: 'llava-llama3:8b',
      category: 'multimodal',
      recommended: true,
    },
    // 追加コード生成モデル
    {
      name: 'deepseek-coder:1.3b',
      category: 'code',
      recommended: true,
    },
    // 音声対話モデル（音声入力・出力対応）
    {
      name: 'speecht5:latest',
      category: 'audio',
      recommended: true,
    },
    {
      name: 'speechllm:7b',
      category: 'multimodal',
      recommended: true,
    },
    {
      name: 'bark:latest',
      category: 'audio-generation',
      recommended: true,
    },
    {
      name: 'valle-x:latest',
      category: 'audio-generation',
      recommended: true,
    },
    {
      name: 'funasr:latest',
      category: 'audio',
      recommended: true,
    },
    {
      name: 'realtime-voice:latest',
      category: 'audio',
      recommended: true,
    },
    {
      name: 'multilingual-voice:latest',
      category: 'audio',
      recommended: true,
    },
  ] as const;

  it('includes new special-purpose models in defaults', () => {
    for (const { name, category, recommended } of requiredModels) {
      const match = DEFAULT_MODELS.find(model => model.name === name);
      expect(match).toBeDefined();
      expect(match?.category).toBe(category);
      if (typeof recommended === 'boolean') {
        expect(match?.recommended).toBe(recommended);
      }
    }
  });

  it('propagates new models to fallback list and clone output', () => {
    const fallbackNames = FALLBACK_MODELS.map(model => model.name);
    const clone = createFallbackModels();

    for (const { name, category, recommended } of requiredModels) {
      const fallback = FALLBACK_MODELS.find(model => model.name === name);
      expect(fallback).toBeDefined();
      expect(fallback?.category).toBe(category);
      if (typeof recommended === 'boolean') {
        expect(fallback?.recommended).toBe(recommended);
      }
      expect(fallbackNames).toContain(name);

      const cloneModel = clone.find(model => model.name === name);
      expect(cloneModel).toBeDefined();
      // ensure clone returns new object reference
      expect(cloneModel).not.toBe(fallback);
    }
  });
});
