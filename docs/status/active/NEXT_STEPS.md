# 次の作業ステップ

> Status: Ready | Date: 2025-01-XX

## 現在の状況

### ✅ 完了済み
- **Phase 0**: ベース整備完了
- **Phase 1A**: エンジン検出/モデル一覧機能完了
- **Phase 2**: ProxyService基本実装完了（`/v1/models`, `/v1/chat/completions`, `/v1/embeddings`）
- **監査修正**: 中優先度の項目すべて対応完了

### 🔄 進行中・未完了
- **Phase 1B**: ProxyService完全実装（一部機能は実装済み）
- **エンジンアダプター**: vLLM実装済み、LM Studio/llama.cpp未実装
- **監査低優先度項目**: 仕様書更新、使用例追加、ドメイン名検証

## 推奨作業順序

### オプションA: 機能拡張を優先（推奨）

#### 1. エンジンアダプター実装（中優先度）

**目的**: 他のLLMエンジンへの対応を拡張

**実装項目**:
- [ ] `flm-engine-lmstudio` 実装
  - LM Studio API実装
  - モデル一覧取得
  - チャット機能（同期/ストリーム）と埋め込み
- [ ] `flm-engine-llamacpp` 実装
  - llama.cpp API実装
  - モデル一覧取得
  - チャット機能（同期/ストリーム）と埋め込み

**参考**:
- `crates/flm-engine-ollama/src/lib.rs` - 実装例
- `crates/flm-engine-vllm/src/lib.rs` - 実装例
- `docs/specs/ENGINE_DETECT.md` - エンジン検出仕様

**見積もり**: 各エンジンアダプターで2-3時間

#### 2. ProxyService機能拡張（中優先度）

**目的**: Phase 1Bの完全実装

**実装項目**:
- [ ] SecurityPolicy適用（IPホワイトリスト、CORS、レート制限）
  - ミドルウェアでのIPホワイトリストチェック
  - CORSヘッダーの設定
  - レート制限の実装
- [ ] プロキシプロファイル管理の改善
- [ ] エラーハンドリングの強化

**参考**:
- `docs/specs/PROXY_SPEC.md` - プロキシ仕様
- `crates/flm-proxy/src/middleware.rs` - 認証ミドルウェア

**見積もり**: 4-6時間

#### 3. 機能改善（低優先度）

**実装項目**:
- [ ] TTLチェック実装（キャッシュ有効期限）
  - `EngineRepository::get_cached_engine_state()` のTTLチェック
  - キャッシュの自動無効化
- [ ] ドメイン名の検証実装
  - `SecurityPolicy`の`acme_domain`検証
  - 正規表現またはライブラリ使用

**見積もり**: 2-3時間

### オプションB: ドキュメント整備を優先

#### 1. 仕様書の更新（低優先度）

**目的**: 実装を反映して仕様書を更新

**更新項目**:
- [ ] `docs/specs/CORE_API.md` の更新
  - `EngineRepository`で`Arc`を使用することを明記
  - `ProxyController`、`ProxyRepository`、`ConfigRepository`、`SecurityRepository`が非同期であることを明記
- [ ] 実装と仕様書の不整合を解消

**見積もり**: 1-2時間

#### 2. 使用例の追加（低優先度）

**目的**: 開発者の理解を向上

**追加項目**:
- [ ] 主要なAPIに使用例を追加
  - `SecurityService`の使用例
  - `EngineService`の使用例
  - `ProxyService`の使用例
- [ ] READMEにクイックスタートガイドを追加

**見積もり**: 2-3時間

## 推奨される次のステップ

### 即座に実施すべき項目（優先度: 高）

**なし** - 高優先度の項目はすべて完了済み

### 短期対応推奨（優先度: 中）

1. **エンジンアダプター実装**（LM Studio / llama.cpp）
   - 既存のOllama/vLLM実装を参考に実装
   - テストも含めて実装

2. **ProxyService機能拡張**
   - SecurityPolicy適用（IPホワイトリスト、CORS、レート制限）
   - エラーハンドリングの強化

### 長期対応（優先度: 低）

1. **仕様書の更新**
   - 実装を反映して仕様書を更新

2. **使用例の追加**
   - 主要なAPIに使用例を追加

3. **ドメイン名の検証**
   - `SecurityPolicy`の`acme_domain`検証を実装

## 判断基準

### 機能拡張を優先する場合
- より多くのエンジンに対応したい
- ProxyServiceの機能を充実させたい
- 実用的な機能を優先したい

### ドキュメント整備を優先する場合
- 仕様書と実装の整合性を保ちたい
- 新しい開発者のオンボーディングを改善したい
- コードの保守性を向上させたい

## 次のアクション

どちらの方向性で進めるか決定してください：

1. **機能拡張**: エンジンアダプター実装から開始
2. **ドキュメント整備**: 仕様書更新から開始
3. **その他**: 特定の機能や改善を指定

---

**更新日**: 2025-01-XX  
**現在のフェーズ**: Phase 1B進行中 / Phase 2基本完了

