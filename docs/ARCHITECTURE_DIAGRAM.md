# FLM システムアーキテクチャとデータフロー図

このドキュメントでは、FLMプロジェクトのシステムアーキテクチャとデータフローをMermaidダイアグラムで可視化しています。

---

## システムアーキテクチャ図

```mermaid
graph TB
    subgraph "フロントエンド層"
        UI[React UI<br/>TypeScript]
        Pages[ページコンポーネント<br/>Home, ApiList, ApiTest等]
        Components[UIコンポーネント<br/>ApiCreateForm, ModelCatalog等]
        Hooks[カスタムフック<br/>useApi, useOllama等]
    end

    subgraph "IPC通信層"
        IPC[Tauri IPC<br/>invoke/emit]
    end

    subgraph "バックエンド層 (Rust + Tauri)"
        Commands[IPCコマンドハンドラー<br/>commands::api, ollama等]
        EngineManager[エンジンマネージャー<br/>Ollama, LM Studio等]
        AuthModule[認証モジュール<br/>APIキー生成・検証]
        ProxyManager[プロキシ管理<br/>認証プロキシ起動・停止]
    end

    subgraph "データ層"
        SQLite[(SQLiteデータベース<br/>API設定, APIキー, ログ等)]
    end

    subgraph "認証プロキシ層 (Node.js + Express)"
        AuthProxy[認証プロキシサーバー<br/>Express.js]
        AuthMiddleware[認証ミドルウェア<br/>APIキー検証]
        ProxyMiddleware[プロキシミドルウェア<br/>Ollama API転送]
        RateLimit[レート制限<br/>リクエスト制御]
    end

    subgraph "外部サービス"
        Ollama[Ollama<br/>LLM実行エンジン<br/>localhost:11434]
        LMStudio[LM Studio<br/>LLM実行エンジン<br/>オプション]
        OtherEngines[その他エンジン<br/>vLLM, llama.cpp等]
    end

    UI --> Pages
    Pages --> Components
    Components --> Hooks
    Hooks --> IPC
    IPC --> Commands
    Commands --> EngineManager
    Commands --> AuthModule
    Commands --> ProxyManager
    Commands --> SQLite
    AuthModule --> SQLite
    ProxyManager --> AuthProxy
    AuthProxy --> AuthMiddleware
    AuthMiddleware --> RateLimit
    RateLimit --> ProxyMiddleware
    ProxyMiddleware --> Ollama
    ProxyMiddleware --> LMStudio
    ProxyMiddleware --> OtherEngines
    AuthProxy --> SQLite

    style UI fill:#e1f5ff
    style Commands fill:#fff4e1
    style SQLite fill:#e8f5e9
    style AuthProxy fill:#f3e5f5
    style Ollama fill:#ffebee
```

---

## データフロー図

### 1. API作成フロー

```mermaid
sequenceDiagram
    participant User as ユーザー
    participant UI as React UI
    participant IPC as Tauri IPC
    participant Backend as Rustバックエンド
    participant DB as SQLite
    participant Auth as 認証モジュール
    participant Proxy as 認証プロキシ
    participant Engine as Ollama

    User->>UI: API作成フォーム入力
    UI->>IPC: invoke('create_api', config)
    IPC->>Backend: create_apiコマンド実行
    
    Backend->>DB: モデル存在確認
    DB-->>Backend: インストール済みモデル一覧
    
    Backend->>Auth: APIキー生成
    Auth-->>Backend: APIキー（ハッシュ化）
    
    Backend->>DB: API設定保存<br/>(API情報, APIキーハッシュ)
    DB-->>Backend: 保存完了
    
    Backend->>Engine: Ollama起動確認
    Engine-->>Backend: 起動状態
    
    Backend->>Proxy: 認証プロキシ起動<br/>(Node.jsプロセス)
    Proxy-->>Backend: 起動完了
    
    Backend-->>IPC: API作成レスポンス
    IPC-->>UI: API情報表示
    UI-->>User: 作成完了通知
```

### 2. API利用フロー（チャット）

```mermaid
sequenceDiagram
    participant Client as クライアント<br/>(外部アプリ)
    participant Proxy as 認証プロキシ<br/>(Express.js)
    participant Auth as 認証ミドルウェア
    participant RateLimit as レート制限
    participant DB as SQLite
    participant Ollama as Ollama API

    Client->>Proxy: POST /v1/chat/completions<br/>Authorization: Bearer <API_KEY>
    
    Proxy->>Auth: APIキー検証
    Auth->>DB: APIキーハッシュ検証
    DB-->>Auth: 検証結果
    
    alt APIキー無効
        Auth-->>Client: 401 Unauthorized
    else APIキー有効
        Auth->>RateLimit: レート制限チェック
        RateLimit->>DB: リクエスト数確認
        DB-->>RateLimit: リクエスト数
        
        alt レート制限超過
            RateLimit-->>Client: 429 Too Many Requests
        else リクエスト許可
            RateLimit->>Proxy: リクエスト転送許可
            Proxy->>Ollama: POST /api/chat<br/>(リクエスト変換)
            
            Ollama-->>Proxy: ストリーミングレスポンス
            Proxy-->>Client: ストリーミングレスポンス転送
            
            Proxy->>DB: リクエストログ保存
            Proxy->>DB: パフォーマンスメトリクス記録
        end
    end
```

### 3. モデルダウンロードフロー

```mermaid
sequenceDiagram
    participant User as ユーザー
    participant UI as React UI
    participant IPC as Tauri IPC
    participant Backend as Rustバックエンド
    participant Ollama as Ollama API
    participant DB as SQLite

    User->>UI: モデルダウンロード選択
    UI->>IPC: invoke('download_model', model_name)
    IPC->>Backend: download_modelコマンド実行
    
    Backend->>Ollama: POST /api/pull<br/>{name: model_name}
    
    loop ストリーミング進捗
        Ollama-->>Backend: 進捗イベント<br/>(downloaded, total)
        Backend->>IPC: emit('model_download_progress', progress)
        IPC-->>UI: 進捗更新イベント
        UI-->>User: プログレスバー更新
    end
    
    Ollama-->>Backend: ダウンロード完了
    Backend->>DB: インストール済みモデル登録
    DB-->>Backend: 登録完了
    
    Backend-->>IPC: ダウンロード完了
    IPC-->>UI: 完了通知
    UI-->>User: ダウンロード完了表示
```

### 4. API起動・停止フロー

```mermaid
sequenceDiagram
    participant User as ユーザー
    participant UI as React UI
    participant IPC as Tauri IPC
    participant Backend as Rustバックエンド
    participant Proxy as 認証プロキシ
    participant Engine as Ollama
    participant DB as SQLite

    User->>UI: API起動ボタンクリック
    UI->>IPC: invoke('start_api', api_id)
    IPC->>Backend: start_apiコマンド実行
    
    Backend->>DB: API設定取得
    DB-->>Backend: API情報（ポート、エンジン等）
    
    Backend->>Engine: エンジン起動確認・起動
    Engine-->>Backend: 起動状態
    
    Backend->>Proxy: 認証プロキシ起動<br/>(ポート、API_ID等)
    Proxy-->>Backend: 起動完了
    
    Backend->>DB: APIステータス更新<br/>(status: 'running')
    DB-->>Backend: 更新完了
    
    Backend-->>IPC: 起動完了
    IPC-->>UI: ステータス更新
    UI-->>User: 起動完了表示
    
    Note over User,Engine: 停止時は逆のフローで<br/>ProxyとEngineを停止
```

---

## モジュール構成図

```mermaid
graph LR
    subgraph "フロントエンド (src/)"
        A1[components/<br/>UIコンポーネント]
        A2[pages/<br/>ページコンポーネント]
        A3[hooks/<br/>カスタムフック]
        A4[utils/<br/>ユーティリティ]
        A5[types/<br/>型定義]
    end

    subgraph "バックエンド (src-tauri/src/)"
        B1[commands/<br/>IPCコマンド]
        B2[database/<br/>データベース操作]
        B3[engines/<br/>エンジン管理]
        B4[auth/<br/>認証モジュール]
        B5[utils/<br/>ユーティリティ]
    end

    subgraph "認証プロキシ (src/backend/auth/)"
        C1[server.ts<br/>Expressサーバー]
        C2[keygen.ts<br/>APIキー生成]
        C3[proxy.ts<br/>プロキシ実装]
        C4[rate-limit.ts<br/>レート制限]
        C5[database.ts<br/>DB接続]
    end

    A1 --> A2
    A2 --> A3
    A3 --> A4
    A4 --> A5
    
    A3 -.IPC通信.-> B1
    B1 --> B2
    B1 --> B3
    B1 --> B4
    B1 --> B5
    
    B1 -.プロセス起動.-> C1
    C1 --> C2
    C1 --> C3
    C1 --> C4
    C1 --> C5
    
    B2 -.DB接続.-> C5

    style A1 fill:#e1f5ff
    style B1 fill:#fff4e1
    style C1 fill:#f3e5f5
```

---

## セキュリティフロー図

```mermaid
graph TB
    subgraph "APIキー管理"
        A1[APIキー生成<br/>32文字以上ランダム]
        A2[ハッシュ化<br/>bcrypt/argon2]
        A3[SQLite保存<br/>暗号化]
    end

    subgraph "認証フロー"
        B1[リクエスト受信<br/>Authorization Header]
        B2[APIキー抽出<br/>Bearer Token]
        B3[ハッシュ検証<br/>データベース照合]
        B4[認証成功/失敗]
    end

    subgraph "アクセス制御"
        C1[レート制限チェック]
        C2[IPホワイトリスト<br/>オプション]
        C3[リクエスト転送許可]
    end

    A1 --> A2
    A2 --> A3
    B1 --> B2
    B2 --> B3
    B3 --> B4
    B4 -->|成功| C1
    C1 --> C2
    C2 --> C3

    style A2 fill:#fff4e1
    style B3 fill:#e8f5e9
    style C1 fill:#ffebee
```

---

## エンジン管理フロー図

```mermaid
graph TB
    subgraph "エンジン検出"
        E1[Ollama検出]
        E2[LM Studio検出]
        E3[カスタムエンドポイント検出]
    end

    subgraph "エンジン管理"
        M1[エンジンマネージャー<br/>EngineManager]
        M2[エンジン起動]
        M3[エンジン停止]
        M4[エンジン状態監視]
    end

    subgraph "エンジン実装"
        I1[Ollama実装<br/>ollama.rs]
        I2[LM Studio実装<br/>lm_studio.rs]
        I3[カスタム実装<br/>custom_endpoint.rs]
    end

    E1 --> M1
    E2 --> M1
    E3 --> M1
    
    M1 --> M2
    M1 --> M3
    M1 --> M4
    
    M2 --> I1
    M2 --> I2
    M2 --> I3
    
    M3 --> I1
    M3 --> I2
    M3 --> I3

    style M1 fill:#fff4e1
    style I1 fill:#e1f5ff
    style I2 fill:#e1f5ff
    style I3 fill:#e1f5ff
```

---

## データベーススキーマ関係図

```mermaid
erDiagram
    APIs ||--o{ API_KEYS : "has"
    APIs ||--o{ REQUEST_LOGS : "generates"
    APIs ||--o{ ERROR_LOGS : "generates"
    APIs ||--o{ PERFORMANCE_METRICS : "records"
    APIs }o--|| INSTALLED_MODELS : "uses"
    USER_SETTINGS ||--o{ ALERT_SETTINGS : "configures"
    USER_SETTINGS ||--o{ ENGINE_CONFIGS : "stores"
    
    APIs {
        string id PK
        string name
        string model_name
        int port
        boolean enable_auth
        string status
        datetime created_at
        datetime updated_at
    }
    
    API_KEYS {
        string id PK
        string api_id FK
        string key_hash
        datetime created_at
        datetime expires_at
    }
    
    REQUEST_LOGS {
        string id PK
        string api_id FK
        string method
        string endpoint
        int status_code
        datetime created_at
    }
    
    ERROR_LOGS {
        string id PK
        string api_id FK
        string error_type
        string error_message
        datetime created_at
    }
    
    PERFORMANCE_METRICS {
        string id PK
        string api_id FK
        string metric_type
        float value
        datetime recorded_at
    }
    
    INSTALLED_MODELS {
        string id PK
        string name
        string engine_type
        datetime installed_at
    }
    
    USER_SETTINGS {
        string key PK
        string value
        datetime updated_at
    }
    
    ALERT_SETTINGS {
        string id PK
        string metric_type
        float threshold
        boolean enabled
    }
    
    ENGINE_CONFIGS {
        string id PK
        string engine_type
        string config_json
        datetime updated_at
    }
```

---

## まとめ

このドキュメントでは、FLMプロジェクトの主要なアーキテクチャとデータフローを可視化しました。

### 主要な特徴

1. **3層アーキテクチャ**: フロントエンド（React）、バックエンド（Rust/Tauri）、認証プロキシ（Node.js/Express）
2. **IPC通信**: Tauri IPCによる安全なフロントエンド-バックエンド通信
3. **認証プロキシ**: APIキー検証とレート制限を提供する中間層
4. **マルチエンジン対応**: Ollama、LM Studio、カスタムエンドポイントに対応
5. **データ永続化**: SQLiteによる設定、ログ、メトリクスの保存

### データフローの要点

- **API作成**: UI → IPC → バックエンド → DB保存 → プロキシ起動
- **API利用**: クライアント → 認証プロキシ → 認証 → レート制限 → Ollama → レスポンス
- **モデル管理**: UI → IPC → バックエンド → Ollama API → 進捗通知 → DB保存

---

**最終更新日**: 2025年

