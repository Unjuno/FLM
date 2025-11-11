// Default Models - デフォルトモデルリスト
// データベースが空の場合に使用されるフォールバックモデルリスト

/**
 * モデル情報（ModelSearch.tsxから型を共有）
 */
export interface ModelInfo {
  name: string;
  description?: string;
  size?: number;
  parameters?: number;
  category?: 'chat' | 'code' | 'translation' | 'summarization' | 'qa' | 'other';
  recommended?: boolean;
  author?: string;
  license?: string;
  modified_at?: string;
}

/**
 * デフォルトモデルリスト（フォールバック用）
 */
export const DEFAULT_MODELS: ModelInfo[] = [
  {
    name: 'llama3:8b',
    description: '高性能な汎用チャットモデル（Meta製）',
    size: 4649132864,
    parameters: 8000000000,
    category: 'chat',
    recommended: true,
  },
  {
    name: 'llama3:70b',
    description: '超大規模汎用チャットモデル（高精度版）',
    size: 40724254720,
    parameters: 70000000000,
    category: 'chat',
    recommended: true,
  },
  {
    name: 'llama3.1:8b',
    description: 'Llama 3.1の改良版（最新モデル）',
    size: 4800000000,
    parameters: 8000000000,
    category: 'chat',
    recommended: true,
  },
  {
    name: 'llama3.1:70b',
    description: 'Llama 3.1の大規模版',
    size: 40800000000,
    parameters: 70000000000,
    category: 'chat',
    recommended: true,
  },
  {
    name: 'llama3.2:1b',
    description: '軽量で高速なLlama 3.2モデル',
    size: 1200000000,
    parameters: 1000000000,
    category: 'chat',
    recommended: false,
  },
  {
    name: 'llama3.2:3b',
    description: 'バランス型Llama 3.2モデル',
    size: 2400000000,
    parameters: 3000000000,
    category: 'chat',
    recommended: true,
  },
  {
    name: 'codellama:7b',
    description: 'コード生成に特化したモデル',
    size: 3858733056,
    parameters: 7000000000,
    category: 'code',
    recommended: true,
  },
  {
    name: 'codellama:13b',
    description: '大規模コード生成モデル',
    size: 7318691840,
    parameters: 13000000000,
    category: 'code',
    recommended: true,
  },
  {
    name: 'codellama:34b',
    description: '超大規模コード生成モデル',
    size: 19200000000,
    parameters: 34000000000,
    category: 'code',
    recommended: false,
  },
  {
    name: 'mistral:7b',
    description: '効率的な多目的モデル',
    size: 4117237760,
    parameters: 7000000000,
    category: 'chat',
    recommended: true,
  },
  {
    name: 'mistral:8x7b',
    description: 'Mixture of Expertsモデル（高性能）',
    size: 47000000000,
    parameters: 56000000000,
    category: 'chat',
    recommended: true,
  },
  {
    name: 'phi3:mini',
    description: 'Microsoft製の軽量高性能モデル',
    size: 2300000000,
    parameters: 3800000000,
    category: 'chat',
    recommended: true,
  },
  {
    name: 'phi3:medium',
    description: 'Microsoft製の中規模モデル',
    size: 7800000000,
    parameters: 14000000000,
    category: 'chat',
    recommended: false,
  },
  {
    name: 'gemma:2b',
    description: 'Google製の軽量モデル',
    size: 1600000000,
    parameters: 2000000000,
    category: 'chat',
    recommended: false,
  },
  {
    name: 'gemma:7b',
    description: 'Google製の中規模モデル',
    size: 5100000000,
    parameters: 7000000000,
    category: 'chat',
    recommended: true,
  },
  {
    name: 'neural-chat:7b',
    description: '会話に最適化されたモデル',
    size: 4200000000,
    parameters: 7000000000,
    category: 'chat',
    recommended: false,
  },
  {
    name: 'starling-lm:7b',
    description: 'OpenAIフォーマット対応モデル',
    size: 4300000000,
    parameters: 7000000000,
    category: 'chat',
    recommended: false,
  },
  {
    name: 'openchat:7b',
    description: 'オープンソースチャットモデル',
    size: 4100000000,
    parameters: 7000000000,
    category: 'chat',
    recommended: false,
  },
  {
    name: 'dolphin-mixtral:8x7b',
    description: 'ファインチューニング済みMixtral',
    size: 47000000000,
    parameters: 56000000000,
    category: 'chat',
    recommended: false,
  },
  {
    name: 'qwen:7b',
    description: 'Alibaba製の高性能モデル',
    size: 4600000000,
    parameters: 7000000000,
    category: 'chat',
    recommended: false,
  },
  {
    name: 'qwen:14b',
    description: 'Alibaba製の大規模モデル',
    size: 9000000000,
    parameters: 14000000000,
    category: 'chat',
    recommended: false,
  },
  {
    name: 'tinyllama:1.1b',
    description: '最小サイズの軽量モデル',
    size: 637000000,
    parameters: 1100000000,
    category: 'chat',
    recommended: false,
  },
  {
    name: 'nous-hermes:13b',
    description: '推論に優れたモデル',
    size: 7400000000,
    parameters: 13000000000,
    category: 'chat',
    recommended: false,
  },
  {
    name: 'wizardcoder:13b',
    description: 'コード生成特化モデル',
    size: 7300000000,
    parameters: 13000000000,
    category: 'code',
    recommended: false,
  },
  {
    name: 'deepseek-coder:6.7b',
    description: 'コード生成に特化した中国製モデル',
    size: 3900000000,
    parameters: 6700000000,
    category: 'code',
    recommended: false,
  },
  {
    name: 'starcoder:15b',
    description: '大規模コード生成モデル',
    size: 31000000000,
    parameters: 15000000000,
    category: 'code',
    recommended: false,
  },
  {
    name: 'orca-mini:3b',
    description: '軽量会話モデル',
    size: 2000000000,
    parameters: 3000000000,
    category: 'chat',
    recommended: false,
  },
  {
    name: 'vicuna:13b',
    description: 'オープンソースチャットモデル',
    size: 7300000000,
    parameters: 13000000000,
    category: 'chat',
    recommended: false,
  },
  {
    name: 'falcon:7b',
    description: 'Abu Dhabi製の高性能モデル',
    size: 3900000000,
    parameters: 7000000000,
    category: 'chat',
    recommended: false,
  },
  {
    name: 'falcon:40b',
    description: 'Abu Dhabi製の超大規模モデル',
    size: 22000000000,
    parameters: 40000000000,
    category: 'chat',
    recommended: false,
  },
];

