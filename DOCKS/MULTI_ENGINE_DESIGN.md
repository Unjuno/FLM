# FLM - マルチLLMエンジン対応設計書

## 📋 概要

FLMに複数のローカルLLMエンジン（Ollama、LM Studio、vLLM、llama.cpp等）を対応させる設計書。

## 🎯 目標

- ユーザーが複数のLLMエンジンから選択可能
- 各エンジンのAPI形式をOpenAI互換APIに統一
- エンジンの検出・起動・停止を統一インターフェースで管理
- 既存のOllama実装を維持しながら拡張

## 🏗️ アーキテクチャ設計

### 1. エンジン抽象化レイヤー

```
┌─────────────────────────────────────────┐
│         UI Layer (React)                │
│  - エンジン選択UI                        │
│  - モデル選択UI                          │
└─────────────────┬───────────────────────┘
                  │ IPC
┌─────────────────▼───────────────────────┐
│     Engine Manager (Rust)               │
│  - エンジン検出・起動・停止               │
│  - エンジン状態管理                       │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│     Engine Trait (統一インターフェース)   │
│  - detect()                              │
│  - start()                               │
│  - stop()                                │
│  - get_models()                          │
│  - get_base_url()                       │
└─────┬──────┬──────┬──────┬──────────────┘
      │      │      │      │
   ┌──▼──┐ ┌─▼──┐ ┌─▼──┐ ┌▼──────┐
   │Ollama│ │LM  │ │vLLM│ │llama. │
   │Engine│ │Std │ │Eng │ │cpp Eng│
   └──────┘ └────┘ └────┘ └───────┘
```

### 2. データベーススキーマ拡張

#### APIsテーブル拡張

```sql
ALTER TABLE apis ADD COLUMN engine_type TEXT NOT NULL DEFAULT 'ollama';
ALTER TABLE apis ADD COLUMN engine_config TEXT; -- JSON設定（エンジン固有の設定）
```

#### エンジン設定テーブル（新規）

```sql
CREATE TABLE IF NOT EXISTS engine_configs (
    id TEXT PRIMARY KEY,
    engine_type TEXT NOT NULL, -- 'ollama', 'lm_studio', 'vllm', etc.
    name TEXT NOT NULL,        -- ユーザー定義名
    base_url TEXT NOT NULL,    -- エンジンのベースURL
    auto_detect INTEGER DEFAULT 1, -- 自動検出するか
    executable_path TEXT,      -- 実行ファイルのパス（ポータブル版など）
    is_default INTEGER DEFAULT 0, -- デフォルトエンジンか
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX idx_engine_configs_type ON engine_configs(engine_type);
CREATE INDEX idx_engine_configs_default ON engine_configs(is_default);
```

## 🔧 実装計画

### Phase 1: エンジン抽象化レイヤー

#### 1.1 Engine Trait定義

**ファイル**: `src-tauri/src/engines/traits.rs`

```rust
pub trait LLMEngine: Send + Sync {
    /// エンジン名を取得
    fn name(&self) -> &str;
    
    /// エンジンを検出
    async fn detect(&self) -> Result<EngineDetectionResult, AppError>;
    
    /// エンジンを起動
    async fn start(&self, config: &EngineConfig) -> Result<u32, AppError>;
    
    /// エンジンを停止
    async fn stop(&self) -> Result<(), AppError>;
    
    /// 実行中かチェック
    async fn is_running(&self) -> Result<bool, AppError>;
    
    /// インストール済みモデル一覧を取得
    async fn get_models(&self) -> Result<Vec<ModelInfo>, AppError>;
    
    /// エンジンのベースURLを取得
    fn get_base_url(&self) -> String;
    
    /// OpenAI互換APIエンドポイントかチェック
    fn supports_openai_compatible_api(&self) -> bool;
}
```

#### 1.2 エンジン実装例（Ollama）

**ファイル**: `src-tauri/src/engines/ollama.rs`

既存の`ollama.rs`を`engines::ollama`モジュールに移動し、`LLMEngine`トレイトを実装。

#### 1.3 エンジンマネージャー

**ファイル**: `src-tauri/src/engines/manager.rs`

```rust
pub struct EngineManager {
    engines: HashMap<String, Box<dyn LLMEngine>>,
}

impl EngineManager {
    pub fn new() -> Self {
        let mut manager = EngineManager {
            engines: HashMap::new(),
        };
        
        // 各エンジンを登録
        manager.register_engine("ollama", Box::new(OllamaEngine::new()));
        // manager.register_engine("lm_studio", Box::new(LMStudioEngine::new()));
        // manager.register_engine("vllm", Box::new(VLLMEngine::new()));
        
        manager
    }
    
    pub fn get_engine(&self, engine_type: &str) -> Option<&dyn LLMEngine>;
    pub async fn detect_all_engines(&self) -> Vec<EngineDetectionResult>;
    pub fn get_available_engines(&self) -> Vec<String>;
}
```

### Phase 2: データベース拡張

#### 2.1 スキーママイグレーション

**ファイル**: `src-tauri/src/database/migrations.rs`

```rust
pub fn add_engine_support(conn: &Connection) -> Result<(), DatabaseError> {
    // APIsテーブルにengine_typeカラムを追加
    conn.execute(
        "ALTER TABLE apis ADD COLUMN engine_type TEXT NOT NULL DEFAULT 'ollama'",
        [],
    )?;
    
    conn.execute(
        "ALTER TABLE apis ADD COLUMN engine_config TEXT",
        [],
    )?;
    
    // engine_configsテーブル作成
    conn.execute(
        r#"
        CREATE TABLE IF NOT EXISTS engine_configs (
            id TEXT PRIMARY KEY,
            engine_type TEXT NOT NULL,
            name TEXT NOT NULL,
            base_url TEXT NOT NULL,
            auto_detect INTEGER DEFAULT 1,
            executable_path TEXT,
            is_default INTEGER DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        "#,
        [],
    )?;
    
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_engine_configs_type ON engine_configs(engine_type)",
        [],
    )?;
    
    Ok(())
}
```

### Phase 3: IPCコマンド拡張

#### 3.1 エンジン管理コマンド

**ファイル**: `src-tauri/src/commands/engine.rs` (新規)

```rust
/// 利用可能なエンジン一覧を取得
#[tauri::command]
pub async fn get_available_engines() -> Result<Vec<String>, AppError>;

/// 特定のエンジンを検出
#[tauri::command]
pub async fn detect_engine(engine_type: String) -> Result<EngineDetectionResult, AppError>;

/// すべてのエンジンを検出
#[tauri::command]
pub async fn detect_all_engines() -> Result<Vec<EngineDetectionResult>, AppError>;

/// エンジンを起動
#[tauri::command]
pub async fn start_engine(engine_type: String, config: Option<EngineConfig>) -> Result<u32, AppError>;

/// エンジンを停止
#[tauri::command]
pub async fn stop_engine(engine_type: String) -> Result<(), AppError>;

/// エンジン設定を保存
#[tauri::command]
pub async fn save_engine_config(config: EngineConfigData) -> Result<String, AppError>;
```

### Phase 4: 認証プロキシの拡張

#### 4.1 エンジン別ベースURL設定

**ファイル**: `src/backend/auth/server.ts`

```typescript
// 環境変数またはデータベースからエンジン設定を取得
const getEngineBaseUrl = async (apiId: string): Promise<string> => {
    // データベースからAPI情報を取得
    const api = await getApiFromDatabase(apiId);
    const engineType = api.engine_type || 'ollama';
    
    switch (engineType) {
        case 'ollama':
            return 'http://localhost:11434';
        case 'lm_studio':
            return 'http://localhost:1234'; // LM Studioのデフォルトポート
        case 'vllm':
            return 'http://localhost:8000'; // vLLMのデフォルトポート
        default:
            return 'http://localhost:11434';
    }
};

// プロキシミドルウェアでエンジン別URLを使用
app.use('/v1', async (req, res, next) => {
    const apiId = process.env.API_ID || '';
    const baseUrl = await getEngineBaseUrl(apiId);
    
    // エンジン別のプロキシ設定
    createProxyMiddleware(baseUrl)(req, res, next);
});
```

### Phase 5: UI拡張

#### 5.1 エンジン選択UI

**ファイル**: `src/pages/ApiCreate.tsx`

- API作成時にエンジンを選択
- エンジンに応じたモデル一覧を表示
- エンジン固有の設定項目を表示

#### 5.2 エンジン管理ページ

**ファイル**: `src/pages/EngineManagement.tsx` (新規)

- インストール済みエンジンの一覧
- エンジンの検出・起動・停止
- エンジン設定の編集

## 🔌 対応エンジン一覧

### 1. Ollama（既存実装）
- **状態**: ✅ 実装済み
- **ポート**: 11434
- **API**: OpenAI互換API対応済み
- **検出方法**: システムパス、ポータブル版

### 2. LM Studio
- **状態**: 🟡 未実装
- **ポート**: 1234（デフォルト）
- **API**: OpenAI互換API対応
- **検出方法**: 
  - Windows: `%LOCALAPPDATA%\Programs\LM Studio\LM Studio.exe`
  - macOS: `/Applications/LM Studio.app`
  - Linux: `~/.lmstudio/lm-studio`

### 3. vLLM
- **状態**: 🟡 未実装
- **ポート**: 8000（デフォルト）
- **API**: OpenAI互換API対応
- **検出方法**: 
  - Pythonパッケージとしてインストール済みか
  - Dockerコンテナとして実行中か

### 4. llama.cpp (server)
- **状態**: 🟡 未実装
- **ポート**: 8080（デフォルト）
- **API**: OpenAI互換API対応（オプション）
- **検出方法**: 
  - 実行ファイルの検出
  - システムパス

## 📊 実装優先順位

### 優先度: 高
1. ✅ **エンジン抽象化レイヤー**: Trait定義とマネージャー実装
2. ✅ **データベース拡張**: スキーママイグレーション
3. ✅ **IPCコマンド拡張**: エンジン管理コマンド
4. 🟡 **Ollama実装のリファクタリング**: Trait実装

### 優先度: 中
5. 🟡 **LM Studio対応**: 検出・起動実装
6. 🟡 **UI拡張**: エンジン選択UI
7. 🟡 **認証プロキシ拡張**: エンジン別URL設定

### 優先度: 低
8. 🔵 **vLLM対応**
9. 🔵 **llama.cpp対応**
10. 🔵 **エンジン管理ページ**: 専用UI

## 🔄 マイグレーション戦略

1. **後方互換性維持**: 既存のOllama実装は維持
2. **段階的移行**: 
   - Phase 1-3: 基盤実装（エンジン抽象化、DB拡張）
   - Phase 4-5: UI拡張と新規エンジン対応
3. **デフォルトエンジン**: 既存APIは全て`engine_type='ollama'`として動作

## 📝 次のステップ

1. エンジン抽象化レイヤーの実装開始
2. データベースマイグレーションの作成
3. Ollama実装のリファクタリング（Trait実装）
4. LM Studio対応の実装

