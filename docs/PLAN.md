# FLM Next Plan
> Status: Canonical | Audience: All contributors | Updated: 2025-11-18

## 背景
- 既存プロトタイプは機能が肥大化し保守が困難になったため `archive/prototype/` に退避した
- 本番版は「CLI → 最小UI → パッケージ」の段階的アプローチで再構築する

## 基本方針
1. **アプリケーションコア（Rust Domain）を唯一のビジネスロジック層**とし、CLI / UI / Proxy などはすべて薄いアダプタに徹する
2. CLI・UI・Proxy は同じコアライブラリを呼び出す構造に再設計し、重複実装や責務逆転を排除する
3. セキュリティ機能を Rust 側に統一し、HTTPS・認証・レート制限を同一言語で保証する
4. ネットワーク公開に関する安全策（IP制限、APIキー運用、TLS戦略）を最小単位から明示する
5. コア API / Proxy 変換ルール / エンジン検出 / DB マイグレーション / フェーズ合格基準を仕様書として固定し、実装前に参照できる状態を保つ

## アーキテクチャ

Rust ワークスペース構成（Domain / Application / Adapter を明確化）：

```
flm/
  crates/
    flm-core/         # Domain層: 純粋ロジック + 抽象ポート（Repository/HTTP/Proxyコントローラ等のtrait）
    flm-cli/          # CLI アダプタ
    flm-proxy/        # AxumベースのHTTP(S)プロキシ
    flm-engine-ollama/
    flm-engine-vllm/
    flm-engine-lmstudio/
    flm-engine-llamacpp/

  docs/
    PLAN.md
    FEATURE_SPEC.md
    CLI_SPEC.md
    CORE_API.md       # RustコアAPI仕様
    PROXY_SPEC.md     # プロキシ変換ルール
    ENGINE_DETECT.md  # エンジン検出ロジック
    DB_SCHEMA.md      # スキーマ＋マイグレーション指針
    diagram.md
    UI_MINIMAL.md     # Phase2 UI仕様
    SECURITY_FIREWALL_GUIDE.md  # Firewall自動化ガイド
```

詳細なアーキテクチャ図は `docs/diagram.md` を参照してください。

- Domain層 (`flm-core`) は純粋ロジックと抽象ポートのみ保持し、HTTP/DB/FSなどインフラ依存コードは Application/Adapter 層へ追い出す
- CLI・UI・Proxy はすべて Domain API を介して機能を呼び出す
- Proxy 実装も Rust (Axum/Hyper) で統一し、Express 実装はアーカイブに移行
- HTTPS は「ローカルHTTP + 外部HTTPS」をフェーズ分けし、ローカル検証は `local-http`、外部公開は `dev-selfsigned` を標準とし、`https-acme` はカスタムドメイン所有者向けオプションとする
- Domain / Application / Adapter の責務境界は `docs/CORE_API.md` に詳細記載
- 外部公開フローは UI Setup Wizard で一元化し、Firewall 設定は `docs/SECURITY_FIREWALL_GUIDE.md` のテンプレートを自動適用（権限不足時は手動参照）する

## 使用要素の整理

### コア機能
- **既存エンジン利用**: Ollama / LM Studio / vLLM / llama.cpp を自動検出し、稼働状態を統一APIで扱う
- **認証プロキシ**: Rust (Axum/Hyper) 製の HTTPS／認証レイヤー。Node実装はアーカイブ
- **証明書管理**: 初期フェーズはローカルHTTP (`local-http`) をデフォルト。外部公開時は `dev-selfsigned` を標準とし、ACME / Let’s Encrypt (`https-acme`) はカスタムドメイン所有者が必要に応じて利用
- **HTTPS方針**: ドメインを持たない利用者を想定し、自己署名HTTPS (`dev-selfsigned` モード) を標準公開手段とする。ACMEは任意オプション
- **設定保存**: SQLite を用途別に分割 (`config.db`, `security.db`) し、設定と秘密情報を分離
- **セキュリティ**: IPホワイトリスト、APIキーのローテーション、レート制限、CORS、Forward先ホスト固定を最小構成要件に含め、SecurityPolicy は Phase1/2 ではグローバルID `"default"` のみ扱う

### CLI
- `flm engines detect` : 対応エンジンを検出して JSON を出力（成功状態は `InstalledOnly`, `RunningHealthy`, `RunningDegraded`, `Error(Network)` など `docs/ENGINE_DETECT.md` 参照）
- `flm models list` : エンジン種別に応じた API（Ollama: `/api/tags`, その他: `/v1/models`）で利用可能モデルを取得。モデルIDは `flm://{engine_id}/{model_name}` に正規化
- `flm proxy start` : Rust製セキュアプロキシを起動（HTTPローカル→HTTPS/ACME設定はオプション）
- `flm proxy stop` : プロキシのプロセス管理
- `flm config set/get` : 設定DBへの読み書き
- `flm api-keys *` : APIキー生成／一覧／ローテーション（security DB を利用）
- `flm security policy` : IPホワイトリストやCORS設定を確認・変更
- `flm chat` / `flm chat --stream` : OpenAI互換APIに対して直接疎通するCLI（Proxy変換ルールは `docs/PROXY_SPEC.md` 参照）

### UI
- Rustコアを IPC 経由で呼び出し、状態表示と最低限の操作のみ提供
- API作成フォームはコアサービスの API を直接呼び出す（CLI subprocess を廃止）
- チャットタブは `/v1/chat/completions` へテスト送信する検証ツールに限定

### 配布
- CLI バイナリ: 単体配布用に Cargo build (Rust) + Node/Electron 依存なし
- Tauri アプリ: Rustコアを直接リンクし、共有ロジックを再利用
- ドキュメント: `README.md`, `docs/PLAN.md`, `docs/CLI_SPEC.md`, `docs/UI_MINIMAL.md`

## フェーズ

### Phase 0: ベース整備
- リポジトリの初期化（Rustワークスペース、Lint/Format 設定）
- アーカイブとの区別を README に追記
- Rustコアライブラリ（ドメインレイヤー）の骨格を作成し、CLI/UI/Proxyが利用するAPIを定義（詳細は `docs/CORE_API.md`）
- Domain/Ports と Application/Adapters の責務境界を `CORE_API.md` と `diagram.md` に反映
- エンジン検出仕様 (`docs/ENGINE_DETECT.md`)、DBスキーマ＋マイグレーション (`docs/DB_SCHEMA.md`)、プロキシ仕様 (`docs/PROXY_SPEC.md`) を完成させる
- UI モックの検討は Phase2 以降に回し、Phase0では Core API 固定を優先

### Phase 1: CLI コア
- エンジン検出 (`flm engines detect`)
- モデル一覧/選択 (`flm models list`)
- 認証プロキシ起動 (`flm proxy start --port 8080 --mode local-http` 等)
- APIキー管理・IPホワイトリスト・CORS設定コマンド
- CLIはすべて Rust コアのAPIを呼び出す構造で実装
- 単体テスト／統合テストを CLI ＋ Rustサービスで構築し、下記合格基準を満たす

### Phase 2: 最小 UI
- React/Tauri で RustコアAPIを直接呼び出す設定画面を実装（Core API 凍結済みを前提）
- 画面構成は「ステータス表示」「API作成フォーム」「テスト用チャット」のみに限定
- UI テストはコンポーネント単位＋手動シナリオを基本とし、IPC経路をモック化

### Phase 3: パッケージング
- Tauri で配布用ビルドを作成（Rustコアを共有）
- Windows/macOS/Linux 用インストーラを準備
- リリースノートを作成し、CLI 単体版も配布

## 成果物
- `README.md`: アーカイブとの区別と最新手順
- `docs/PLAN.md`: 本ドキュメント
- CLI コマンド仕様: `docs/CLI_SPEC.md`（Phase1で作成）
- UI ワイヤーフレーム: `docs/UI_MINIMAL.md`（Phase2で作成、Setup Wizard + Firewall Automation を含む）
- Firewall 設定ガイド: `docs/SECURITY_FIREWALL_GUIDE.md`

## メトリクス
- Rustコアの自動テストカバレッジ 80%以上
- CLI 経由でのプロキシ起動→HTTP応答（初回/2回目）を CI で検証
- セキュリティ設定（IP/CORS/APIキー）を含む統合テストを確立
- UI は主要操作 3 ケースの手動テスト手順を残し、IPC経路をユニットテスト
- Phaseごとの合格基準:
  - **Phase 1**: エンジン検出成功率100%（対象エンジン4種×主要OSで3回以上）、状態判定（InstalledOnly/RunningHealthy等）が正確にレポートされる、プロキシ再起動時間中央値<3s（初回除く）、APIキーがDBに平文で残らないことをテストで証明、ストリーミング負荷テスト（100 req/min）を成功させる、OpenAI互換→各エンジン変換で fallback ルール（未対応パラメータのログ・無視）を実装
  - **Phase 2**: UI 主要操作3ケースを実機確認、IPC経路ユニットテストで成功率100%、UIからの操作で全コアAPIが呼べることを自動テスト、Setup Wizard 4ステップが Windows/macOS/Linux で `SECURITY_FIREWALL_GUIDE.md` に沿って成功ログ（preview/apply + rollback含む）を出力することを実証
  - **Phase 3**: インストーラ生成→E2Eスモークテスト成功、CLI/GUI両方で `/v1/models` と `/v1/chat/completions` が動作、ACMEモードで証明書取得が自動化されていることを検証

## 今後のタスク例
- [ ] README の再構成
- [ ] CLI プロトタイプの最初のコマンド実装
- [ ] Rust製認証プロキシサービスの骨格実装
- [ ] UI モックの設計
- [ ] データベース分割（config/security）のマイグレーション設計
- [ ] docs/CORE_API.md / PROXY_SPEC.md / ENGINE_DETECT.md / DB_SCHEMA.md の初版確定
- [ ] Setup Wizard + Firewall Automation を Windows/macOS/Linux で検証（`docs/SECURITY_FIREWALL_GUIDE.md` 参照）
- [ ] UI 多言語対応の設計（`docs/UI_EXTENSIONS.md` セクション4）

---

必要に応じて本計画を更新し、進捗ごとにチェックボックスを更新する。

