# Phase 1 実装準備

> Status: Ready | Date: 2025-01-27

## Phase 0 完了確認

Phase 0 のすべてのタスクが完了し、以下の状態が確認されました：

- ✅ Rust ワークスペース構造完成
- ✅ ドメインモデル定義完了（28型）
- ✅ Port トレイト定義完了（8トレイト）
- ✅ Service スケルトン完成（4サービス）
- ✅ エラータイプ定義完了（4型）
- ✅ DBマイグレーションファイル作成済み
- ✅ 統合テスト実装済み（5テスト、すべて成功）
- ✅ CIワークフロー設定済み
- ✅ コンパイル・Clippy・フォーマット検証完了

## Phase 1 の実装項目

Phase 1 では、CLI Core Implementation を進めます。主な実装項目は以下の通りです：

### 1. Adapter層の実装

#### `flm-cli` クレート
- [ ] `ConfigRepository` の実装（SQLite接続、`config.db` 操作）
- [ ] `SecurityRepository` の実装（SQLite接続、`security.db` 操作、OSキーチェーン統合）
- [ ] `EngineRepository` の実装（エンジン登録管理）
- [ ] `EngineProcessController` の実装（エンジン検出ロジック）
- [ ] `HttpClient` の実装（reqwest または hyper ベース）

#### `flm-engine-*` クレート
- [ ] `LlmEngine` トレイトの実装（各エンジン用）
  - `flm-engine-ollama`
  - `flm-engine-vllm`
  - `flm-engine-lmstudio`
  - `flm-engine-llamacpp`

### 2. Service層の実装

#### `EngineService`
- [ ] `detect_engines()`: エンジン検出ロジック（`ENGINE_DETECT.md` 準拠）
- [ ] `list_models()`: モデル一覧取得
- [ ] `chat()`: チャットリクエスト処理
- [ ] `chat_stream()`: ストリーミングチャット処理
- [ ] `embeddings()`: 埋め込み生成

#### `ProxyService`
- [ ] `start()`: プロキシ起動（Axum/Hyper ベース）
- [ ] `stop()`: プロキシ停止
- [ ] `status()`: プロキシ状態取得

#### `SecurityService`
- [ ] `create_api_key()`: APIキー生成（Argon2 ハッシュ）
- [ ] `revoke_api_key()`: APIキー無効化
- [ ] `list_api_keys()`: APIキー一覧
- [ ] `rotate_api_key()`: APIキーローテーション
- [ ] `get_policy()` / `set_policy()`: セキュリティポリシー管理

#### `ConfigService`
- [ ] `get()` / `set()` / `list()`: 設定値の読み書き

### 3. CLI コマンド実装

#### 基本コマンド（`CLI_SPEC.md` 準拠）
- [ ] `flm engines detect`: エンジン検出
- [ ] `flm models list`: モデル一覧
- [ ] `flm proxy start`: プロキシ起動
- [ ] `flm proxy stop`: プロキシ停止
- [ ] `flm proxy status`: プロキシ状態確認
- [ ] `flm config get/set`: 設定管理
- [ ] `flm api-keys create/list/revoke/rotate`: APIキー管理
- [ ] `flm security policy get/set`: セキュリティポリシー管理

### 4. マイグレーション実行

- [ ] `EngineService::new()` で `config.db` マイグレーション実行
- [ ] `SecurityService::new()` で `security.db` マイグレーション実行
- [ ] マイグレーション失敗時の読み取り専用モード対応

### 5. テスト

- [ ] ユニットテスト（各Service、Repository）
- [ ] 統合テスト（CLI ↔ Core）
- [ ] E2Eテスト（実際のエンジンとの連携）

## 実装順序の推奨

1. **Adapter層の基本実装**（ConfigRepository, SecurityRepository）
2. **Service層の基本実装**（ConfigService, SecurityService）
3. **CLI基本コマンド**（`flm config`, `flm api-keys`）
4. **エンジン検出実装**（EngineProcessController, EngineService::detect_engines）
5. **エンジンアダプタ実装**（各 `flm-engine-*`）
6. **チャット機能実装**（EngineService::chat, chat_stream）
7. **プロキシ実装**（ProxyService, `flm-proxy`）
8. **CLI残りのコマンド**（`flm engines`, `flm models`, `flm proxy`）

## 参考ドキュメント

- `docs/CORE_API.md`: Core API 仕様
- `docs/CLI_SPEC.md`: CLI コマンド仕様
- `docs/ENGINE_DETECT.md`: エンジン検出ロジック
- `docs/DB_SCHEMA.md`: データベーススキーマ
- `docs/PROXY_SPEC.md`: プロキシ仕様
- `docs/TEST_STRATEGY.md`: テスト戦略

---

**Phase 1 開始準備完了**: 2025-01-27

