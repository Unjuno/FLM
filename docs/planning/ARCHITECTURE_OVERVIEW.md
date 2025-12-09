# FLM アーキテクチャ概要

> Updated: 2025-02-01 | Status: Current Implementation

## アーキテクチャの基本方針

### 1. レイヤードアーキテクチャ（クリーンアーキテクチャ）

FLMは**レイヤードアーキテクチャ**を採用し、以下の原則に従っています：

1. **Domain層（`flm-core`）を唯一のビジネスロジック層**とする
2. **CLI / UI / Proxy はすべて薄いアダプタ**として実装
3. **依存性逆転の原則（DIP）**: Domain層は抽象ポート（trait）のみに依存し、実装は外側の層で注入

### 2. モノレポ構成（Rust Workspace）

```
flm/
├── crates/
│   ├── core/flm-core/          # Domain層: 純粋ロジック + 抽象ポート
│   ├── apps/flm-cli/           # CLIアダプタ
│   ├── services/flm-proxy/     # HTTP(S)プロキシ（Axum/Hyper）
│   ├── engines/                # エンジンアダプタ
│   │   ├── flm-engine-ollama/
│   │   ├── flm-engine-vllm/
│   │   ├── flm-engine-lmstudio/
│   │   └── flm-engine-llamacpp/
│   └── libs/lego-runner/       # ACME証明書管理ライブラリ
├── src/                        # Tauri UI（React/TypeScript）
├── src-tauri/                  # Tauriバックエンド（Rust）
└── docs/                       # ドキュメント
```

## レイヤー構造

### Domain層 (`flm-core`)

**責務**: ビジネスロジックとドメインモデルの定義

```
crates/core/flm-core/
├── domain/                     # ドメインモデル
│   ├── engine.rs              # エンジン関連モデル
│   ├── proxy.rs                # プロキシ関連モデル
│   ├── security.rs             # セキュリティ関連モデル
│   ├── chat.rs                 # チャット関連モデル
│   └── models.rs               # モデル情報
├── services/                   # ビジネスロジックサービス
│   ├── engine.rs               # EngineService
│   ├── proxy.rs                # ProxyService
│   ├── security.rs              # SecurityService
│   ├── config.rs                # ConfigService
│   └── certificate.rs          # 証明書管理サービス
├── ports/                      # 抽象ポート（trait定義）
│   ├── engine.rs               # EngineRepository, EngineProcessController
│   ├── proxy.rs                # ProxyController, ProxyRepository
│   ├── security.rs              # SecurityRepository
│   ├── config.rs                # ConfigRepository
│   ├── http.rs                  # HttpClient
│   └── engine_health_log.rs     # EngineHealthLogRepository
└── error.rs                     # エラー型定義
```

**特徴**:
- 純粋なRustコード（HTTP/DB/FSへの直接依存なし）
- すべてのI/O操作はtrait経由で抽象化
- テスト容易性が高い（モック可能）

### Application層（アダプタ）

#### 1. CLIアダプタ (`flm-cli`)

**責務**: コマンドラインインターフェースの提供

```
crates/apps/flm-cli/
├── commands/                   # CLIコマンド実装
│   ├── engines.rs              # flm engines detect
│   ├── models.rs                # flm models list
│   ├── proxy.rs                 # flm proxy start/stop/status
│   ├── api_keys.rs              # flm api-keys *
│   ├── security.rs              # flm security *
│   └── ...
├── adapters/                   # インフラ実装
│   ├── engine.rs                # EngineRepository実装（SQLite）
│   ├── proxy.rs                 # ProxyRepository実装（SQLite）
│   ├── security.rs               # SecurityRepository実装（SQLite）
│   └── ...
└── cli/                         # CLI定義（clap）
```

**特徴**:
- `flm-core`のサービスを直接呼び出し
- SQLiteアダプタでデータ永続化
- JSON形式での出力

#### 2. Proxyサービス (`flm-proxy`)

**責務**: HTTP(S)プロキシサーバーの実装

```
crates/services/flm-proxy/
├── controller.rs                # ProxyController実装（Axum）
├── middleware.rs                # 認証・レート制限・CORS
├── security/                    # セキュリティ機能
│   ├── intrusion_detection.rs   # 侵入検知
│   ├── anomaly_detection.rs    # 異常検知
│   ├── ip_blocklist.rs          # IPブロックリスト
│   └── resource_protection.rs   # リソース保護
├── certificate.rs               # 証明書管理
├── metrics.rs                   # Prometheusメトリクス
└── http_client.rs               # HttpClient実装（reqwest）
```

**特徴**:
- Axum/HyperベースのHTTPサーバー
- OpenAI互換API (`/v1/models`, `/v1/chat/completions`)
- セキュリティ機能統合（認証、レート制限、IP制限）

#### 3. エンジンアダプタ (`flm-engine-*`)

**責務**: 各LLMエンジンとの通信

```
crates/engines/flm-engine-ollama/
└── src/lib.rs                   # OllamaEngine実装

crates/engines/flm-engine-vllm/
└── src/lib.rs                   # VllmEngine実装

... (他のエンジンも同様)
```

**特徴**:
- `flm-core::ports::LlmEngine` traitを実装
- エンジン固有のAPIを統一インターフェースに変換

### UI層（Tauriアプリケーション）

**責務**: デスクトップアプリケーションのUI

```
src/                            # React/TypeScriptフロントエンド
├── pages/                      # ページコンポーネント
│   ├── Home.tsx                # ダッシュボード
│   ├── ChatTester.tsx          # チャットテスト
│   ├── SecurityEvents.tsx      # セキュリティイベント
│   └── ...
├── components/                  # UIコンポーネント
├── services/                    # フロントエンドサービス
├── contexts/                   # Reactコンテキスト
│   ├── I18nContext.tsx         # 国際化
│   └── ThemeContext.tsx         # テーマ管理
└── utils/                       # ユーティリティ

src-tauri/src/                   # Tauriバックエンド
├── commands/
│   ├── cli_bridge.rs            # CLIコマンドのIPCラッパー
│   └── firewall.rs               # ファイアウォール操作
└── main.rs                      # Tauriアプリケーションエントリーポイント
```

**特徴**:
- React + TypeScriptでUI実装
- Tauri IPC経由でRustバックエンドと通信
- CLIコマンドをIPC経由で呼び出し

## データフロー

### 1. エンジン検出フロー

```
UI/CLI
  ↓ (IPC/CLI)
Tauri Backend / CLI
  ↓ (EngineService)
flm-core::services::engine
  ↓ (trait: EngineRepository)
flm-cli::adapters::engine (SQLite実装)
  ↓ (trait: HttpClient)
flm-cli::adapters::http (reqwest実装)
  ↓ (HTTP)
LLM Engine (Ollama/vLLM/etc.)
```

### 2. プロキシリクエストフロー

```
Client (ブラウザ/アプリ)
  ↓ (HTTP/HTTPS)
flm-proxy::controller (Axum)
  ↓ (Middleware: 認証・レート制限)
flm-proxy::security (IP制限・侵入検知)
  ↓ (ProxyService)
flm-core::services::proxy
  ↓ (trait: ProxyController)
flm-proxy::controller (実装)
  ↓ (trait: HttpClient)
flm-proxy::http_client (reqwest)
  ↓ (HTTP)
LLM Engine
```

### 3. APIキー認証フロー

```
Client Request (API Key)
  ↓
flm-proxy::middleware (認証ミドルウェア)
  ↓
flm-core::services::security::verify_api_key
  ↓ (trait: SecurityRepository)
flm-cli::adapters::security (SQLite実装)
  ↓ (Argon2ハッシュ検証)
認証結果
```

## データベース構造

### 1. `config.db` (設定データベース)

**用途**: アプリケーション設定、プロキシプロファイル、モデルプロファイル

**主要テーブル**:
- `config` - キー・バリュー設定
- `proxy_profiles` - プロキシ設定プロファイル
- `model_profiles` - モデル設定プロファイル
- `api_prompts` - APIプロンプトテンプレート
- `active_proxy_handles` - アクティブなプロキシハンドル

### 2. `security.db` (セキュリティデータベース)

**用途**: APIキー、セキュリティポリシー、監査ログ

**主要テーブル**:
- `api_keys` - APIキー（Argon2ハッシュ化）
- `security_policies` - セキュリティポリシー
- `audit_logs` - 監査ログ
- `blocked_ips` - IPブロックリスト
- `dns_credentials` - DNS認証情報（ACME DNS-01用）

**セキュリティ対策**:
- OSキーチェーン（DPAPI/Keychain/libsecret）で暗号化鍵を保護
- ファイル権限: 600相当（Unix）、ACL（Windows）
- 自動バックアップ（3世代保持）

## 依存関係の方向

```
┌─────────────────────────────────────┐
│  UI Layer (React/TypeScript)        │
│  └─ Tauri IPC                        │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  Application Layer                   │
│  ├─ flm-cli (CLI Adapter)           │
│  ├─ flm-proxy (HTTP Proxy)          │
│  └─ flm-engine-* (Engine Adapters)   │
└─────────────────────────────────────┘
              ↓ (trait依存)
┌─────────────────────────────────────┐
│  Domain Layer (flm-core)             │
│  ├─ services/ (ビジネスロジック)      │
│  ├─ domain/ (ドメインモデル)          │
│  └─ ports/ (抽象インターフェース)     │
└─────────────────────────────────────┘
              ↑ (実装注入)
┌─────────────────────────────────────┐
│  Infrastructure Layer                │
│  ├─ SQLite (データベース)            │
│  ├─ reqwest (HTTPクライアント)       │
│  ├─ Axum (HTTPサーバー)              │
│  └─ OS Keychain (秘密鍵管理)         │
└─────────────────────────────────────┘
```

## 主要な設計パターン

### 1. Repository パターン

- **目的**: データアクセスを抽象化
- **実装**: `flm-core::ports::*Repository` traitを定義し、`flm-cli::adapters::*`で実装

### 2. Service パターン

- **目的**: ビジネスロジックを集約
- **実装**: `flm-core::services::*Service`で実装

### 3. Adapter パターン

- **目的**: 外部システムとの統合
- **実装**: `flm-engine-*`で各LLMエンジンのAPIを統一インターフェースに変換

### 4. Dependency Injection (DI)

- **目的**: 依存関係の注入による疎結合
- **実装**: trait経由で依存を注入、テスト時にモックを注入可能

## セキュリティアーキテクチャ

### 1. 認証・認可

- **APIキー認証**: Argon2ハッシュ化、タイミング攻撃対策
- **IPホワイトリスト**: 接続元IPの制限
- **CORS**: クロスオリジンリクエストの制御

### 2. セキュリティ機能

- **侵入検知**: 異常なリクエストパターンの検出
- **異常検知**: リソース使用量の異常検出
- **レート制限**: リクエスト頻度の制限
- **IPブロックリスト**: 悪意のあるIPの自動ブロック

### 3. 証明書管理

- **local-http**: HTTPのみ（ローカル環境）
- **dev-selfsigned**: 自己署名証明書（開発/LAN）
- **https-acme**: Let's Encrypt自動証明書（外部公開）
- **packaged-ca**: パッケージ配布用CA証明書（インストール時自動登録）

## 通信プロトコル

### 1. CLI ↔ Core

- **直接呼び出し**: Rustの関数呼び出し
- **データ形式**: Rust構造体

### 2. UI ↔ Backend

- **Tauri IPC**: `invoke()`経由でRust関数を呼び出し
- **データ形式**: JSON（serdeでシリアライズ/デシリアライズ）

### 3. Proxy ↔ Engine

- **HTTP/HTTPS**: reqwestクライアントでLLMエンジンに接続
- **プロトコル**: OpenAI互換API (`/v1/models`, `/v1/chat/completions`)

## テスト戦略

### 1. Unit Tests

- **Domain層**: 純粋関数のテスト（モック不要）
- **Service層**: Repository traitのモックを使用

### 2. Integration Tests

- **CLI統合テスト**: 実際のSQLiteデータベースを使用
- **Proxy統合テスト**: モックHTTPサーバーを使用
- **エンジン統合テスト**: 実際のエンジンに接続（オプション）

### 3. E2E Tests

- **UIテスト**: React Testing Library + Tauri IPCモック
- **CLI E2E**: 実際のCLIコマンドを実行

## ビルド・配布

### 1. CLIバイナリ

- **ビルド**: `cargo build --release`
- **配布**: 単体バイナリ（Rust依存のみ）

### 2. Tauriアプリケーション

- **ビルド**: `npm run tauri:build`
- **配布**: Windows (MSI/NSIS), macOS (DMG), Linux (DEB/AppImage)
- **コード署名**: Windows (signtool), macOS (codesign), Linux (GPG)

## バージョン管理

- **Core API**: v1.0.0で凍結（変更はADR経由）
- **CLI/Proxy**: Core APIに依存
- **UI**: 独立したバージョン管理

## まとめ

FLMは**クリーンアーキテクチャ**の原則に従い、以下の特徴を持ちます：

1. **Domain層中心**: ビジネスロジックは`flm-core`に集約
2. **アダプタパターン**: CLI/UI/Proxyはすべて薄いアダプタ
3. **依存性逆転**: Domain層は抽象に依存、実装は外側で注入
4. **テスト容易性**: traitベースの設計によりモック可能
5. **セキュリティ**: 多層防御アプローチ

このアーキテクチャにより、保守性、テスト容易性、拡張性を確保しています。

