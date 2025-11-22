# Phase 1 次の実装ステップ

> Status: Ready for Next Implementation | Date: 2025-11-21

## Phase 1 現在の状況

### ✅ Phase 1A: 完了

- ✅ ConfigService / SecurityService 実装
- ✅ CLI基本コマンド（config, api-keys）
- ✅ 統合テスト成功（22 passed, 0 failed）
- ✅ SQLiteマイグレーション実装
- ✅ EngineRepository / EngineProcessController 実装
- ✅ EngineService::detect_engines() 実装
- ✅ flm-engine-ollama 実装完了
- ✅ flm engines detect 実装完了
- ✅ flm models list 実装完了（Ollama対応）

### 🔄 Phase 1B: 進行中

- ✅ エンジン検出機能: 完了
- ✅ モデル一覧機能: 完了（Ollama対応）
- ⏳ ProxyService: 未実装（スケルトン実装のみ）
- ⏳ エンジンアダプター: vLLM, LM Studio, llama.cpp 未実装
- ⏳ TTLチェック: キャッシュ有効期限の実装

## 次の実装ステップ（優先順位順）

### 1. Phase 1B 完了: ProxyService 実装（高優先度）

**目的**: Phase 1Bの主要機能を完了させる

**実装項目**:
- [ ] `ProxyService::start()` の実装
  - AxumベースのHTTP(S)プロキシサーバー起動
  - `local-http` / `dev-selfsigned` / `https-acme` モード対応
  - OpenAI互換API (`/v1/chat/completions`, `/v1/models`, `/v1/embeddings`)
  - APIキー認証
  - SecurityPolicy適用（IPホワイトリスト、CORS、レート制限）
- [ ] `ProxyService::stop()` の実装
  - プロキシインスタンスの停止
  - リソースのクリーンアップ
- [ ] `ProxyService::status()` の実装
  - 実行中のプロキシインスタンスの状態取得
- [ ] `flm proxy start` コマンド実装
- [ ] `flm proxy stop` コマンド実装
- [ ] `flm proxy status` コマンド実装
- [ ] プロキシ統合テスト実装

**参考ドキュメント**:
- `docs/specs/PROXY_SPEC.md` - プロキシ仕様
- `docs/specs/CORE_API.md` - Core API仕様（ProxyService）
- `docs/specs/CLI_SPEC.md` - CLI仕様（proxyコマンド）

### 2. エンジンアダプター実装（中優先度）

**目的**: 他のLLMエンジンへの対応を拡張

**実装項目**:
- [ ] `flm-engine-vllm` 実装
  - vLLM API実装
  - モデル一覧取得
  - チャット機能（同期/ストリーム）と埋め込み
- [ ] `flm-engine-lmstudio` 実装
  - LM Studio API実装
  - モデル一覧取得
  - チャット機能（同期/ストリーム）と埋め込み
- [ ] `flm-engine-llamacpp` 実装
  - llama.cpp API実装
  - モデル一覧取得
  - チャット機能（同期/ストリーム）と埋め込み

**参考ドキュメント**:
- `docs/specs/ENGINE_DETECT.md` - エンジン検出仕様
- `crates/flm-engine-ollama/src/lib.rs` - 実装例

### 3. 機能改善（低優先度）

**実装項目**:
- [ ] TTLチェック実装（キャッシュ有効期限）
  - `EngineRepository::get_cached_engine_state()` のTTLチェック
  - キャッシュの自動無効化
- [ ] エラーハンドリングの改善
- [ ] テストカバレッジの拡充

## 推奨実装順序

### オプションA: Phase 1B完了を優先（推奨）

1. **ProxyService 実装**（Phase 1B完了）
   - Phase 1Bの主要機能を完了
   - プロキシ統合テストの実装
   - Phase 1B完了判定

2. **エンジンアダプター実装**（Phase 1拡張）
   - 他のLLMエンジンへの対応
   - モデル一覧機能の拡張

3. **機能改善**
   - TTLチェック
   - エラーハンドリング改善

### オプションB: エンジンアダプターを優先

1. **エンジンアダプター実装**
   - 他のLLMエンジンへの対応を拡張
   - モデル一覧機能の拡張

2. **ProxyService 実装**（Phase 1B完了）
   - Phase 1Bの主要機能を完了

3. **機能改善**

## Phase 1完了判定基準

### Phase 1A: ✅ 完了

- ✅ エンジン検出成功率100%（対象4エンジン×主要OS×3回）
- ✅ 状態判定（InstalledOnly/RunningHealthy等）が正確
- ✅ APIキーがDBに平文で残らないことをテストで証明

### Phase 1B: ⏳ 進行中

- ⏳ プロキシ再起動時間中央値<3s（初回除く）
- ⏳ ストリーミング負荷テスト（100 req/min）を専用ベンチで成功
- ⏳ OpenAI互換→各エンジン変換で fallback ルールを実装
- ⏳ `flm proxy status` が起動前後のハンドル変化を正しく返すことを CI で確認

## 結論

**次の実装に進む準備は整っています。**

推奨: **ProxyService 実装**から開始し、Phase 1Bを完了させることを推奨します。

---

**作成日**: 2025-11-21  
**現在の状態**: Phase 1A完了、Phase 1B進行中  
**推奨次のステップ**: ProxyService 実装

