# FLM Next Plan
> Status: Canonical | Audience: All contributors | Updated: 2025-11-20

## 背景
- 既存プロトタイプは機能が肥大化し保守が困難になったため `archive/prototype/` に退避した
- 本番版は「CLI → 最小UI → パッケージ」の段階的アプローチで再構築する

## 基本方針
1. **アプリケーションコア（Rust Domain）を唯一のビジネスロジック層**とし、CLI / UI / Proxy などはすべて薄いアダプタに徹する
2. CLI・UI・Proxy は同じコアライブラリを呼び出す構造に再設計し、重複実装や責務逆転を排除する
3. セキュリティ機能を Rust 側に統一し、HTTPS・認証・レート制限を同一言語で保証する
4. ネットワーク公開に関する安全策（IP制限、APIキー運用、TLS戦略）を最小単位から明示する
5. コア API / Proxy 変換ルール / エンジン検出 / DB マイグレーション / フェーズ合格基準を仕様書として固定し、実装前に参照できる状態を保つ
6. **個人利用・シングルユーザー環境を前提**とし、マルチユーザー機能はスコープ外とする

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
    MIGRATION_GUIDE.md # 旧プロトタイプからの移行手順
    TEST_STRATEGY.md   # CI/負荷/手動テストの方針
    VERSIONING_POLICY.md # Core/API/CLI/Proxyのバージョン管理
    templates/ADR_TEMPLATE.md # 変更管理テンプレート
    diagram.md
    UI_MINIMAL.md     # Phase2 UI仕様
    SECURITY_FIREWALL_GUIDE.md  # Firewall自動化ガイド
```

詳細なアーキテクチャ図は `docs/planning/diagram.md` を参照してください。

- Domain層 (`flm-core`) は純粋ロジックと抽象ポートのみ保持し、HTTP/DB/FSなどインフラ依存コードは Application/Adapter 層へ追い出す
- CLI・UI・Proxy はすべて Domain API を介して機能を呼び出す
- Proxy 実装も Rust (Axum/Hyper) で統一し、Express 実装はアーカイブに移行
- HTTPS は「ローカルHTTP + 外部HTTPS」をフェーズ分けし、ローカル検証は `local-http`、外部公開は 既定で `https-acme`（ACME / 既存 CA 署名証明書）を使用し、自己署名 (`dev-selfsigned`) は LAN / 開発用途に限定する
- Domain / Application / Adapter の責務境界は `docs/specs/CORE_API.md` に詳細記載
- 外部公開フローは UI Setup Wizard で一元化し、Firewall 設定は `docs/guides/SECURITY_FIREWALL_GUIDE.md` のテンプレートを **プレビュー + 手動適用** を基本とし、管理者権限を自動取得できる場合のみオプションで自動適用する。権限不足時やヘッドレス環境では CLI スクリプトとチェックリストを提示する

## 使用要素の整理

### コア機能
- **既存エンジン利用**: Ollama / LM Studio / vLLM / llama.cpp を自動検出し、稼働状態を統一APIで扱う
- **認証プロキシ**: Rust (Axum/Hyper) 製の HTTPS／認証レイヤー。Node実装はアーカイブ
- **証明書管理**: 初期フェーズはローカルHTTP (`local-http`) をデフォルト。外部公開時は ACME / Let's Encrypt (`https-acme`) を推奨し、自己署名 (`dev-selfsigned`) を選択する場合はルート証明書配布・信頼設定・ローテーション手順を `docs/specs/PROXY_SPEC.md` / `docs/guides/SECURITY_FIREWALL_GUIDE.md` に従って実施。Phase 3 のパッケージング時には `packaged-ca` モードを実装し、インストール時にルートCA証明書をOS信頼ストアへ自動登録する方式を提供（大衆向け配布に最適）
- **HTTPS方針**: ドメインを持たない利用者でも ACME を利用できるように CLI/Wizard から DNS-01 / HTTP-01 を補助し、自己署名はオフライン/LAN 限定モードとして明確に区別する。パッケージ版では `packaged-ca` モードを既定とし、証明書の自動インストールによりブラウザ警告なしでHTTPS利用を可能にする
- **設定保存**: SQLite を用途別に分割 (`config.db`, `security.db`) し、`security.db` は OS キーチェーン（DPAPI / Keychain / libsecret）で暗号化鍵を保護、600相当の権限設定、バックアップ/復旧フロー、APIキーのローテーション自動化を `docs/specs/DB_SCHEMA.md` / `docs/guides/SECURITY_FIREWALL_GUIDE.md` に記載。`config.db` / `security.db` のマイグレーション失敗時は読み取り専用のセーフモードで起動できるようにする
- **セキュリティ**: IPホワイトリスト、APIキーのローテーション、レート制限、CORS、Forward先ホスト固定を最小構成要件に含め、SecurityPolicy は Phase1/2 ではグローバルID `"default"` のみ扱う
    - **security.db ガバナンス**: 
        - 暗号化鍵は OS キーチェーン (DPAPI/macOS Keychain/libsecret) から取得し、起動ごとに memory-only で展開。鍵ローテーション時は新ファイルへマイグレーション→差し替え→旧ファイル secure delete。 
        - 自動バックアップは暗号化済み `.bak` を 3 世代保持し、復旧手順（停止→バックアップ復元→再起動）を CLI ヘルプとドキュメントに記載。 
        - `security.db` マイグレーションが失敗した場合は読み取り専用モードで起動し、APIキー発行/ポリシー編集をブロックしてユーザーへ復旧手順を案内。 
        - ログや証明書メタデータは最小限のみ保存し、ファイアウォール等の昇格ログは `logs/security/firewall-*.log` で管理する（DBと分離）。

### CLI
- `flm engines detect` : 対応エンジンを検出して JSON を出力（成功状態は `InstalledOnly`, `RunningHealthy`, `RunningDegraded`, `ErrorNetwork`, `ErrorApi` など `docs/specs/ENGINE_DETECT.md` 参照）
- `flm models list` : エンジン種別に応じた API（Ollama: `/api/tags`, その他: `/v1/models`）で利用可能モデルを取得。モデルIDは `flm://{engine_id}/{model_name}` に正規化
- `flm proxy start` : Rust製セキュアプロキシを起動（HTTPローカル→HTTPS/ACME設定はオプション）
- `flm proxy stop` : プロキシのプロセス管理
- `flm proxy status` : 稼働中ハンドルのモード / ポート / 証明書状態を JSON で確認
- `flm config set/get` : 設定DBへの読み書き
- `flm api-keys *` : APIキー生成／一覧／ローテーション（security DB を利用）
- `flm security policy` : IPホワイトリストやCORS設定を確認・変更
- `flm chat` / `flm chat --stream` : OpenAI互換APIに対して直接疎通するCLI（Proxy変換ルールは `docs/specs/PROXY_SPEC.md` 参照）

### UI
- Rustコアを IPC 経由で呼び出し、状態表示と最低限の操作のみ提供
- API作成フォームはコアサービスの API を直接呼び出す（CLI subprocess を廃止）
- チャットタブは `/v1/chat/completions` へテスト送信する検証ツールに限定

### 配布
- CLI バイナリ: 単体配布用に Cargo build (Rust) + Node/Electron 依存なし
- Tauri アプリ: Rustコアを直接リンクし、共有ロジックを再利用
- ドキュメント: `README.md`, `docs/planning/PLAN.md`, `docs/specs/CLI_SPEC.md`, `docs/specs/UI_MINIMAL.md`

## フェーズ

### Phase 0: ベース整備
- リポジトリの初期化（Rustワークスペース、Lint/Format 設定）
- アーカイブとの区別を README に追記
- Rustコアライブラリ（ドメインレイヤー）の骨格を作成し、CLI/UI/Proxyが利用するAPIを定義（詳細は `docs/specs/CORE_API.md`）
- Domain/Ports と Application/Adapters の責務境界を `CORE_API.md` と `diagram.md` に反映
- エンジン検出仕様 (`docs/specs/ENGINE_DETECT.md`)、DBスキーマ＋マイグレーション (`docs/specs/DB_SCHEMA.md`)、プロキシ仕様 (`docs/specs/PROXY_SPEC.md`)、移行ガイド (`docs/guides/MIGRATION_GUIDE.md`)、テスト戦略 (`docs/guides/TEST_STRATEGY.md`) を完成させ、**Core API / Proxy / DB Schema を `v1.0.0` としてタグ付け・署名し、以降の変更は ADR + バージョンアップでのみ許可**  
  - フリーズ手順: (1) `docs/*` に最終版を反映 → (2) `core-api-v1.0.0` タグを GPG 署名で作成 → (3) 変更要望は `docs/templates/ADR_TEMPLATE.md` で提出 → (4) 承認後に `docs/guides/VERSIONING_POLICY.md` に従ってマイナー/パッチバージョンを更新
- UI モックの検討は Phase2 以降に回し、Phase0では Core API 固定を優先
- 旧 `archive/prototype/` から `config.json` / SQLite 等のデータをエクスポートする移行計画（変換スクリプト、ロールバック手順、テストデータ）を策定

### Phase 1: CLI コア
- エンジン検出 (`flm engines detect`)
- モデル一覧/選択 (`flm models list`)
- 認証プロキシ起動 (`flm proxy start --port 8080 --mode local-http` 等)
- プロキシ状態確認 (`flm proxy status` でハンドル一覧を取得)
- APIキー管理・IPホワイトリスト・CORS設定コマンド
- CLIはすべて Rust コアのAPIを呼び出す構造で実装
- 単体テスト／統合テストを CLI ＋ Rustサービスで構築し、下記合格基準を満たす。**Phase 1 の成功基準は 2 つのサブフェーズ（1A: エンジン検出/モデル一覧、1B: Proxy/セキュリティ）で個別に判定し、どちらかが遅延した場合でもリリースできるようにする**  
  - Phase1A ロールバック条件: 対象 4 エンジン × 3 OS × 3 回の検出テストのうち 1 つでも `ErrorApi`/`ErrorNetwork` が 3 連続した場合は release branch をブロックし、registry / detection ロジックを修正後に再実行。  
  - Phase1B ロールバック条件: プロキシ統合テスト（local-http/dev-selfsigned/https-acme）で 2 回連続失敗、または負荷テスト(100 req/min SSE)の P95 レイテンシ > 2s を検知した場合は phased rollout を停止し、直近の安定タグへ戻す。
- **Phase1C: Tor / 上流プロキシ経由オプション**  
  - CLI: `flm proxy start --egress-mode tor|socks5` と `--egress-fail-open`/`--socks5-endpoint` を追加し、Tor ソケット(127.0.0.1:9050)への疎通確認 → 失敗時は `PROXY_INVALID_CONFIG`。`flm proxy status` でも egress 情報を表示。  
  - Core/Proxy: `ProxyConfig.egress`（`Direct`/`Tor`/`CustomSocks5` + fail_open）を定義し、reqwest の `socks` feature で outbound HTTP/ACME 全体を SOCKS5 経由に切り替える。Tor断で fail-closed 既定。  
  - テスト: CLI 統合テストは `tor_mock`（SOCKS5 echo server）で接続確認、Proxy 統合テストは `tor`/`direct` 切替でチャット→SSE を流し遅延許容範囲を検証。ACME + Tor は warning を出し `local-http` fallback を確認。

### Phase 2: 最小 UI
- React/Tauri で RustコアAPIを直接呼び出す設定画面を実装（Core API 凍結済みを前提）
- 画面構成は「ステータス表示」「API作成フォーム」「テスト用チャット」のみに限定
- UI テストはコンポーネント単位＋手動シナリオを基本とし、IPC経路をモック化

### Phase 3: パッケージング
- Tauri で配布用ビルドを作成（Rustコアを共有）
- Windows/macOS/Linux 用インストーラを準備
- `packaged-ca` モードの実装:
  - ビルド時にルートCA証明書 (`flm-ca.crt`) を生成し、インストーラに同梱
  - インストール時にOS信頼ストアへ自動登録（UAC/sudo確認あり）
  - サーバー証明書は起動時に自動生成（ルートCAで署名、SANにRFC1918範囲を含める）
  - アンインストール時に証明書削除オプションを提供
- **セキュリティ対策**: パッケージングのセキュリティ対策（コード署名、ハッシュ値の公開、ビルド環境の保護、インストール時の検証、配布チャネルの保護）の詳細は `docs/specs/PROXY_SPEC.md` セクション10.6を参照。検証手順は `docs/guides/SECURITY_FIREWALL_GUIDE.md` セクション9を参照。
- リリースノートを作成し、CLI 単体版も配布

## データ移行戦略
- 旧 `archive/prototype` からの移行は `migrations/legacy/` に Rust CLI (`flm migrate legacy`) を用意し、以下を実施:
  1. 旧 SQLite / JSON 設定を読み取り、`config.db` / `security.db` の新スキーマへ変換（モデルキャッシュ → `engines_cache`、APIキー → ハッシュ化、ポリシー → 新 JSON スキーマ）。  
  2. 変換結果を `/tmp/flm-migrate-<ts>/` にエクスポートし、ユーザーに確認させる。  
  3. `--apply` でのみ本番 DB を置換。適用前に自動バックアップ (`*.bak`) を作成し、失敗時は自動的にロールバック。  
  4. 移行ログと差分レポートを `logs/migrations/<ts>.log` に保存。
- 検証手順: 移行後に `flm check` を実行し、APIキー件数/ラベル、SecurityPolicy の JSON、ProxyProfile のポート値が旧バージョンと一致することを確認。  
- 失敗時ワークフロー: (1) 変換ステップで例外が発生 → CLI が詳細ログを表示し、データを変更せず終了。 (2) 適用後に整合性チェックで失敗 → 自動ロールバックし、バックアップから復元。 (3) ロールバック不能な場合、手動復旧手順を `docs/specs/DB_SCHEMA.md` の「バックアップ/復元」節に従って実施。

## 成果物
- `README.md`: アーカイブとの区別と最新手順
- `docs/planning/PLAN.md`: 本ドキュメント
- CLI コマンド仕様: `docs/specs/CLI_SPEC.md`（Phase1で作成）
- UI ワイヤーフレーム: `docs/specs/UI_MINIMAL.md`（Phase2で作成、Setup Wizard + Firewall Automation を含む）
- Firewall 設定ガイド: `docs/guides/SECURITY_FIREWALL_GUIDE.md`
- 移行ガイド: `docs/guides/MIGRATION_GUIDE.md`
- バージョン管理ポリシー: `docs/guides/VERSIONING_POLICY.md`
- テスト戦略: `docs/guides/TEST_STRATEGY.md`
- 手動UIシナリオ: `tests/ui-scenarios.md`
- ADR テンプレート: `docs/templates/ADR_TEMPLATE.md`

## メトリクス
- Rustコアの自動テストカバレッジ 80%以上
- CLI 経由でのプロキシ起動→HTTP応答（初回/2回目）を CI で検証
- セキュリティ設定（IP/CORS/APIキー）を含む統合テストを確立
- UI は主要操作 3 ケースの手動テスト手順（`tests/ui-scenarios.md` 参照）を残し、IPC経路をユニットテスト
- 受入メトリクスは GitHub Actions / self-hosted runners 上の OS 行列（Windows 11, macOS Sonoma, Ubuntu 22.04）で自動計測し、負荷テスト（100 req/min）は専用ベンチマークジョブ＋モックエンジンで継続的に検証する。CI マトリクス:
    - `ci-cli` ワークフロー: {OS × Engine} = (Win/macOS/Linux) × (Ollama/vLLM/LM Studio/llama.cpp mock)。`flm engines detect`, `flm models list`, `flm proxy start/stop`, `flm proxy status` を実行し、SSE/非SSE を確認（詳細は `docs/guides/TEST_STRATEGY.md`）。
    - `ci-proxy-load` ワークフロー: Linux self-hosted runnerで vLLM + mock engines を起動し、`wrk`/`k6` による 100 req/min (チャット + embeddings) を 10 分間流し、P95 レイテンシとエラー率を記録。結果は GitHub Actions artifacts + Grafana snapshot に保管。
    - `ci-acme-smoke` ワークフロー: nightly で staging ACME サーバと接続し、DNS-01/HTTP-01 モードをそれぞれ実行。82 分以内に証明書取得完了しない場合は失敗として issue を自動作成。
- Phaseごとの合格基準:
  - **Phase 1**: 
      - **1A (エンジン検出/モデル一覧)**: エンジン検出成功率100%（対象4エンジン×主要OS×3回）、状態判定（InstalledOnly/RunningHealthy等）が正確、APIキーがDBに平文で残らないことをテストで証明
      - **1B (プロキシ/セキュリティ)**: プロキシ再起動時間中央値<3s（初回除く）※`https-acme` は<90s、ストリーミング負荷テスト（100 req/min）を専用ベンチで成功、OpenAI互換→各エンジン変換で fallback ルールを実装、`flm proxy status` が起動前後のハンドル変化を正しく返すことを CI で確認
  - **Phase 2**: UI 主要操作3ケースを実機確認、IPCユニットテスト成功率100%、UIから全コアAPIが呼べることを自動テスト、Setup Wizard 4ステップが Windows/macOS/Linux で `SECURITY_FIREWALL_GUIDE.md` に沿って成功ログ（preview/apply + rollback含む）を出力し、権限不足時の手動適用フローが案内されること
  - **Phase 3**: インストーラ生成→E2Eスモークテスト成功、CLI/GUI両方で `/v1/models` と `/v1/chat/completions` が動作、`https-acme` モードの証明書発行/更新が自動化され、失敗時のフォールバック手順が確認済みであること。`packaged-ca` モードでは、インストール時にルートCA証明書が OS 信頼ストアへ自動登録され、ブラウザ警告なしで HTTPS が利用可能であることを Windows/macOS/Linux で検証済みであること。アンインストール時に証明書削除オプションが正常に動作すること。

## 今後のタスク例
- [ ] README の再構成
- [ ] CLI プロトタイプの最初のコマンド実装
- [ ] Rust製認証プロキシサービスの骨格実装
- [ ] UI モックの設計
- [ ] データベース分割（config/security）のマイグレーション設計
- [ ] docs/specs/CORE_API.md / PROXY_SPEC.md / ENGINE_DETECT.md / DB_SCHEMA.md の初版確定
- [ ] Setup Wizard + Firewall Automation を Windows/macOS/Linux で検証（`docs/guides/SECURITY_FIREWALL_GUIDE.md` 参照）
- [ ] UI 多言語対応の設計（`docs/specs/UI_EXTENSIONS.md` セクション4）
- [ ] Tor/SOCKS5 egress オプションの CLI/Proxy 実装（`CLI_SPEC` / `PROXY_SPEC` / `CORE_API` 同期、`tor_mock` でテスト）

---

必要に応じて本計画を更新し、進捗ごとにチェックボックスを更新する。

