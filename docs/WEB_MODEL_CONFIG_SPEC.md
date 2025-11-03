# Webサイト用モデル設定JSON仕様書

## 📋 概要

Webサイトで使用するモデルを限定するためのJSON設定ファイルの仕様です。このJSONファイルを読み込むことで、Webサイト専用のAPIを簡単に作成できます。

## 🎯 目的

- Webサイト用途に適したモデルのみを表示
- モデルごとの推奨設定を事前定義
- 一貫性のあるAPI設定の提供
- 管理者によるモデル選択の制御

## 📄 JSONスキーマ

### ファイル名
`web-models-config.json`

### ファイル配置場所
- アプリケーションリソース: `src/assets/web-models-config.json`
- ユーザー設定: `~/.fllm/web-models-config.json` (オプション、優先される)

### スキーマ定義

```typescript
interface WebModelConfig {
  version: string;              // 設定ファイルのバージョン
  lastUpdated: string;          // 最終更新日時 (ISO 8601)
  description?: string;         // 設定ファイルの説明
  models: WebModelDefinition[]; // モデル定義の配列
}

interface WebModelDefinition {
  id: string;                   // モデルID（一意）
  name: string;                 // 表示名
  modelName: string;            // Ollamaなどの実際のモデル名
  engine: string;                // エンジンタイプ ('ollama', 'lm_studio', etc.)
  description: string;          // モデルの説明
  category: string;             // カテゴリ ('chat', 'code', 'vision', 'audio', 'multimodal')
  capabilities?: {
    vision?: boolean;
    audio?: boolean;
    video?: boolean;
  };
  size?: number;                // モデルサイズ（バイト）
  recommended?: boolean;        // 推奨モデルかどうか
  icon?: string;                // アイコン（絵文字またはアイコン名）
  tags?: string[];              // タグ
  
  // デフォルト設定
  defaultSettings: {
    port?: number;              // デフォルトポート
    enableAuth?: boolean;       // 認証を有効化するか
    modelParameters?: {
      temperature?: number;
      top_p?: number;
      top_k?: number;
      max_tokens?: number;
      repeat_penalty?: number;
    };
    memory?: {
      context_window?: number;
      num_gpu_layers?: number;
      batch_size?: number;
    };
    multimodal?: {
      enableVision?: boolean;
      enableAudio?: boolean;
      enableVideo?: boolean;
      maxImageSize?: number;
      maxAudioSize?: number;
      maxVideoSize?: number;
    };
  };
  
  // 使用例・説明
  useCases?: string[];          // 使用例の説明
  requirements?: {
    minMemory?: number;         // 最小メモリ要件（GB）
    recommendedMemory?: number; // 推奨メモリ（GB）
    gpuRecommended?: boolean;   // GPU推奨かどうか
  };
}
```

## 📝 サンプルJSON

```json
{
  "version": "1.0.0",
  "lastUpdated": "2024-11-02T00:00:00Z",
  "description": "Webサイト用途向けの推奨モデル設定",
  "models": [
    {
      "id": "llama3-8b-chat",
      "name": "Llama 3 8B Chat",
      "modelName": "llama3:8b",
      "engine": "ollama",
      "description": "高性能な汎用チャットモデル。会話、質問応答、文章生成に最適。",
      "category": "chat",
      "recommended": true,
      "icon": "💬",
      "tags": ["chat", "general", "conversation"],
      "defaultSettings": {
        "port": 8080,
        "enableAuth": true,
        "modelParameters": {
          "temperature": 0.7,
          "top_p": 0.9,
          "top_k": 40,
          "max_tokens": 2048,
          "repeat_penalty": 1.1
        },
        "memory": {
          "context_window": 8192,
          "batch_size": 512
        }
      },
      "useCases": [
        "Webサイトのチャットボット",
        "FAQ自動応答システム",
        "コンテンツ生成"
      ],
      "requirements": {
        "minMemory": 8,
        "recommendedMemory": 16,
        "gpuRecommended": true
      }
    },
    {
      "id": "llava-vision",
      "name": "LLaVA Vision",
      "modelName": "llava:latest",
      "engine": "ollama",
      "description": "画像認識・画像説明が可能なマルチモーダルモデル。",
      "category": "vision",
      "recommended": true,
      "icon": "🖼️",
      "tags": ["vision", "image", "multimodal"],
      "capabilities": {
        "vision": true
      },
      "defaultSettings": {
        "port": 8081,
        "enableAuth": true,
        "modelParameters": {
          "temperature": 0.7,
          "max_tokens": 1024
        },
        "multimodal": {
          "enableVision": true,
          "maxImageSize": 10
        }
      },
      "useCases": [
        "画像説明生成",
        "画像分類",
        "視覚的な質問応答"
      ],
      "requirements": {
        "minMemory": 12,
        "recommendedMemory": 24,
        "gpuRecommended": true
      }
    },
    {
      "id": "whisper-audio",
      "name": "Whisper Audio",
      "modelName": "whisper:latest",
      "engine": "ollama",
      "description": "音声認識・音声変換が可能なモデル。",
      "category": "audio",
      "recommended": false,
      "icon": "🎵",
      "tags": ["audio", "speech", "transcription"],
      "capabilities": {
        "audio": true
      },
      "defaultSettings": {
        "port": 8082,
        "enableAuth": true,
        "multimodal": {
          "enableAudio": true,
          "maxAudioSize": 50
        }
      },
      "useCases": [
        "音声文字起こし",
        "音声翻訳",
        "音声コマンド認識"
      ],
      "requirements": {
        "minMemory": 4,
        "recommendedMemory": 8,
        "gpuRecommended": false
      }
    }
  ]
}
```

## 🔧 実装仕様

### 1. JSON読み込み機能

#### フロントエンド（TypeScript）
- `src/utils/webModelConfig.ts` を作成
- JSONファイルを読み込む関数を実装
- バリデーション機能を追加

#### バックエンド（Rust、オプション）
- 設定ファイルの検証機能（オプション）
- カスタム設定ファイルの読み込み（オプション）

### 2. API作成フロー

1. **Webサイト用API作成画面を追加**
   - 通常のAPI作成画面とは別のエントリーポイント
   - または、モデル選択時に「Webサイト用モデル」タブを追加

2. **モデルリストの表示**
   - JSONから読み込んだモデルのみを表示
   - カテゴリでフィルタリング
   - 推奨モデルのハイライト

3. **デフォルト設定の適用**
   - JSONに定義されたデフォルト設定を自動適用
   - ユーザーがカスタマイズ可能

### 3. UI設計

#### 新規追加画面（オプション）
- `src/pages/WebApiCreate.tsx` - Webサイト専用API作成画面

#### 既存画面の拡張
- `src/components/api/ModelSelection.tsx` - 「Webサイト用」タブを追加

## 📊 データフロー

```
[web-models-config.json]
    ↓
[読み込み関数] (src/utils/webModelConfig.ts)
    ↓
[バリデーション]
    ↓
[モデルリスト表示] (ModelSelection コンポーネント)
    ↓
[モデル選択]
    ↓
[デフォルト設定適用] (ApiConfigForm)
    ↓
[API作成]
```

## 🔍 バリデーションルール

1. **必須フィールド**
   - `version`: 必須
   - `models`: 必須、空配列不可
   - 各モデルの `id`, `name`, `modelName`, `engine`: 必須

2. **型チェック**
   - `version`: 文字列（セマンティックバージョニング推奨）
   - `lastUpdated`: ISO 8601形式の日時
   - `port`: 1024-65535の範囲
   - 数値フィールド: 適切な範囲内

3. **一意性チェック**
   - `id`: モデル間で一意である必要がある
   - 同じ `modelName` + `engine` の組み合わせは1つのみ

## 🔄 更新・メンテナンス

### 設定ファイルの更新方法

1. **手動更新**
   - JSONファイルを直接編集
   - バージョンを更新

2. **自動更新（将来の拡張）**
   - リモートURLから定期的に更新
   - バージョンチェック機能

### バージョン管理

- メジャーバージョン: スキーマの破壊的変更
- マイナーバージョン: 機能追加
- パッチバージョン: バグ修正・モデル追加

## 📦 ファイル構成

```
src/
├── assets/
│   └── web-models-config.json      # デフォルト設定ファイル
├── utils/
│   └── webModelConfig.ts            # 読み込み・バリデーション関数
└── types/
    └── webModel.ts                  # 型定義
```

## 🚀 使用方法

### ユーザー向け

1. Webサイト用API作成画面を開く
2. JSONから読み込まれたモデルリストから選択
3. デフォルト設定が自動適用される（カスタマイズ可能）
4. APIを作成

### 管理者向け

1. `web-models-config.json` を編集
2. モデル定義を追加・更新
3. デフォルト設定を調整
4. アプリケーションに反映

## ⚠️ 注意事項

1. **セキュリティ**
   - JSONファイルの改ざんを防ぐ（将来の拡張: 署名検証）
   - 外部URLからの読み込みは慎重に（HTTPS必須）

2. **パフォーマンス**
   - 大きなJSONファイルの読み込み時間
   - キャッシュ機能の実装（推奨）

3. **互換性**
   - スキーマの後方互換性を維持
   - 旧バージョンとの互換性チェック

## 📚 関連ドキュメント

- `docs/API_DOCUMENTATION.md` - API仕様
- `docs/USER_GUIDE.md` - ユーザーガイド
- `DOCKS/SPECIFICATION.md` - システム仕様

