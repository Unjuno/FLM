# FLM Monorepo (Next Generation)

> Status: Active Development | Audience: All contributors | Updated: 2025-02-01

**注意**: 本アプリケーションは**個人利用・シングルユーザー環境向け**です。マルチユーザー対応やロールベースアクセス制御（RBAC）機能は提供されていません。

このリポジトリは、アーカイブ済みプロトタイプ (`archive/prototype/`) を置き換える次期実装です。旧アプリは `archive/prototype/` 以下に完全保管しており、参照専用です。新コアは以下の構成で進行中です。

```
flm/
  crates/                    # Rustコア/サービス/アプリ/エンジン
    core/flm-core            # Domain + services
    services/flm-proxy       # OpenAI互換プロキシ
    apps/flm-cli             # CLIエントリーポイント
    engines/                 # Engine adapters (ollama, vllm, lmstudio, llamacpp)
  docs/                      # PLAN, CORE_API, UI/CLI 仕様など
  README.md                  # 本ファイル
  archive/prototype/         # 旧実装（参照のみ）
```

## 実装状況

> **注意**: 本セクションでは、Rustバックエンド（CLI、Proxy、Core API）の実装状況を記載しています。UI実装（Tauriアプリケーションのフロントエンド）については「UI機能」セクションを参照してください。  
> **実装状況の表記**: ✅ は実装完了、⏳ は未実装または部分実装、⚠️ は注意事項を表します。

### ✅ 実装済み（Phase 1-2）

#### CLIコマンド
- ✅ `flm engines detect` - エンジン検出
- ✅ `flm models list` - モデル一覧
- ✅ `flm proxy start/stop/status` - プロキシ制御
- ✅ `flm api-keys create/list/rotate/revoke` - APIキー管理
- ✅ `flm config get/set/list` - 設定管理
- ✅ `flm security policy show/set` - セキュリティポリシー管理
- ✅ `flm security backup create/restore` - セキュリティバックアップ
- ✅ `flm security ip-blocklist` - IPブロックリスト管理
- ✅ `flm security audit-logs` - 監査ログ表示
- ✅ `flm security intrusion` - 侵入検知イベント表示
- ✅ `flm security anomaly` - 異常検知イベント表示
- ✅ `flm security install-ca` - packaged-ca証明書のOS信頼ストア登録
- ✅ `flm model-profiles list/save/delete` - モデルプロファイル管理
- ✅ `flm api prompts list/show/set` - APIプロンプト管理
- ✅ `flm chat` - チャットインターフェース（マルチモーダル対応）
- ✅ `flm check` - データベース整合性チェック

#### プロキシサービス
- ✅ OpenAI互換API（`/v1/models`, `/v1/chat/completions`, `/v1/embeddings`）
- ✅ 認証・認可（APIキー、IPホワイトリスト、CORS）
- ✅ セキュリティ機能（Phase 1-3完了、詳細は「セキュリティ機能（Botnet対策）」セクションを参照）
- ✅ マルチモーダル対応（画像・音声入力/出力）

#### エンジンアダプター
- ✅ Ollama（完全実装）
- ✅ vLLM（実装済み、テスト修正完了）
- ✅ LM Studio（実装済み）
- ✅ llama.cpp（実装済み）

### ✅ 実装済み（Phase 3）
- ✅ **データ移行**: `flm migrate legacy` コマンド（実装完了）
  - ✅ CLI定義・基本構造（dry-run, convert, applyフレームワーク）
  - ✅ 設定ファイル（config.json）の変換ロジック
  - ✅ データベース変換ロジック（旧プロトタイプの`flm.db`から`apis`, `api_keys`, `user_settings`テーブルを変換）
  - ✅ バックアップ作成と適用ロジック（変換ファイルの本番DBへの適用）
  - ⚠️ **注意**: 旧データベースの暗号化されたAPIキーは移行できません。新しいAPIキーを作成する必要があります。
  - 詳細: [`docs/specs/CLI_SPEC.md`](docs/specs/CLI_SPEC.md) セクション3.13

### ⏳ 部分実装・進行中（Phase 3）

> **注意**: 以下の項目は優先度順に実装を進めています。詳細な実装計画は [`docs/status/active/NEXT_STEPS.md`](docs/status/active/NEXT_STEPS.md) を参照してください。  
> **UI実装について**: UI機能（Tauriアプリケーションのフロントエンド）は、バックエンドAPIが実装済みでもフロントエンド実装が必要です。プロトタイプ（`archive/prototype/`）に実装例がある場合は参照可能です。  
> **実装状況の表記**: ✅ は実装完了、⏳ は未実装または部分実装、⚠️ は注意事項を表します。

#### パッケージング
- ✅ **packaged-caモード**: 基本実装完了
  - ✅ ルートCA証明書生成機能（`crates/core/flm-core/src/services/certificate.rs`）
  - ✅ サーバー証明書自動生成機能（`crates/services/flm-proxy/src/controller.rs`内の`ensure_server_cert_artifacts`）
  - ✅ OS信頼ストアへの自動登録機能（Windows/macOS/Linux対応、`register_root_ca_with_os_trust_store`関数）
  - ✅ CLIコマンド `flm security install-ca`（証明書の手動登録）
  - ✅ `start_packaged_ca_server`関数の実装
  - ⚠️ **注意**: `packaged-ca` featureが有効なビルドでのみ利用可能（`cargo build --features packaged-ca`で有効化）
  - ✅ **インストーラー統合**: 実装完了
    - ✅ CLI版インストーラースクリプト: Windows用PowerShell（`scripts/install.ps1`）、macOS/Linux用シェル（`scripts/install.sh`）
    - ✅ Tauri設定: 基本設定完了（`archive/prototype/src-tauri/tauri.conf.json`）
    - ✅ **ビルド時証明書生成**: 実装完了（`archive/prototype/src-tauri/build.rs`）
      - ✅ ビルドスクリプト（`build.rs`）での証明書生成（`flm-core`の`certificate::generate_root_ca`関数を使用）
      - ✅ 生成した証明書の`resources/certs/flm-ca.crt`への配置
      - ✅ 証明書の有効性検証（既存証明書の再利用）
      - ✅ 秘密鍵のGitHub Secrets管理（`FLM_ROOT_CA_KEY`環境変数対応）
      - ✅ 開発モードでの自動証明書生成（環境変数未設定時）
      - ⚠️ **注意**: 開発モードで生成された秘密鍵はリポジトリにコミットしないでください。本番環境では`FLM_ROOT_CA_KEY`環境変数を設定してください。
    - ✅ **インストーラーフック**: 実装完了
      - ✅ インストールスクリプト（`resources/scripts/install-ca.ps1`, `install-ca.sh`）は実装済み
      - ✅ アンインストールスクリプト（`resources/scripts/uninstall-ca.ps1`, `uninstall-ca.sh`）は実装済み
      - ✅ NSIS/DMG/DEBインストーラーからの自動呼び出し（Tauriインストーラーフック統合）
        - ✅ NSISカスタムスクリプト（`installer/install-ca.nsh`、`tauri.conf.json`の`nsis.customScript`設定）
        - ✅ DMG postinstallスクリプト（`installer/postinstall.sh`、macOS）
        - ✅ DEB postinstスクリプト（`installer/postinst`、Linux）
      - ⚠️ **注意**: インストーラーフックは、証明書ファイルが存在する場合にのみ実行されます。ユーザーは証明書のインストールを選択できます。
  - ✅ コード署名（Windows/macOS/Linux、GitHub Actions統合）
    - ✅ 基本方針策定: コード署名ポリシー策定（`docs/specs/CODE_SIGNING_POLICY.md`）、GitHub Actionsワークフロー基本設定
    - ✅ Windowsコード署名: Tauri Signing Private Key統合完了
    - ✅ macOSコード署名: Apple Developer ID統合完了
    - ✅ Linux GPG署名: GitHub ActionsワークフローにGPG署名ステップ追加完了、Secrets設定ドキュメント化完了
      - ✅ アンインストーラー証明書削除統合: Windows NSIS、Linux DEBのアンインストールフック実装完了（`tauri.conf.json`に`postRemoveScript`設定追加完了）
    - ✅ Tauriが自動的に署名処理を実行（Secretsが設定されている場合）
    - ✅ Linux GPG署名: 実装完了（`.github/workflows/build.yml`に追加、`LINUX_GPG_KEY`、`LINUX_GPG_KEY_PASS`、`LINUX_GPG_KEY_ID` Secretsが必要）
    - ✅ 署名検証とハッシュ値公開: 実装完了（`checksums.txt`生成とGPG署名、GitHub Releasesへの公開）
    - ⚠️ **注意**: GPG署名とハッシュ値公開は、GitHub Secrets（`LINUX_GPG_KEY`、`LINUX_GPG_KEY_PASS`、`LINUX_GPG_KEY_ID`）が設定されている場合にのみ実行されます。
  - 詳細: [`docs/specs/CODE_SIGNING_POLICY.md`](docs/specs/CODE_SIGNING_POLICY.md), [`docs/planning/PHASE3_PACKAGING_PLAN.md`](docs/planning/PHASE3_PACKAGING_PLAN.md)

#### セキュリティ機能（Botnet対策）
- ✅ **Phase 1-3 実装完了**（バックエンド機能）
  - ✅ IPブロックリスト（自動ブロック、手動管理）
  - ✅ 侵入検知システム（SQLインジェクション、パストラバーサル等の検出）
  - ✅ 監査ログ（イベントタイプ、重大度、詳細情報の記録）
  - ✅ 異常検知システム（リクエストレート、異常パターンの検出、スコアリング）
  - ✅ リソース保護（CPU/メモリ使用量の監視とスロットリング）
  - ✅ IPベースレート制限（IPアドレスごとのrpm/burst制限）
  - ✅ ハニーポットエンドポイント（攻撃者の早期検出）
- ✅ **CLIコマンド実装完了**
  - ✅ `flm security ip-blocklist` - IPブロックリスト管理（`list`/`unblock`/`clear`サブコマンド）
  - ✅ `flm security audit-logs` - 監査ログ表示（`--event-type`, `--severity`, `--ip`, `--limit`, `--offset`オプション）
  - ✅ `flm security intrusion` - 侵入検知イベント表示（`--ip`, `--min-score`, `--limit`, `--offset`オプション）
  - ✅ `flm security anomaly` - 異常検知イベント表示（`--ip`, `--anomaly-type`, `--limit`, `--offset`オプション）
- ✅ **UI機能**（実装完了、詳細は「UI機能」セクションを参照）
- 詳細: [`docs/planning/BOTNET_PROTECTION_IMPLEMENTATION_PLAN.md`](docs/planning/BOTNET_PROTECTION_IMPLEMENTATION_PLAN.md), [`docs/status/completed/security/`](docs/status/completed/security/)

#### UI機能
- ✅ **実装済み**
  - ✅ モデルプロファイル管理UI（`/models/profiles`）
  - ✅ APIプロンプト管理UI（`/api/prompts`）
  - ✅ Tauri IPCブリッジ拡張
  - ✅ **Chat Tester**（モデルテスト用UI）
    - ✅ バックエンドAPI実装済み（`/v1/chat/completions`、`/v1/models`エンドポイント）
    - ✅ フロントエンドUI実装完了（`src/pages/ChatTester.tsx`）
    - ✅ I18N対応（日本語/英語）
    - 詳細: [`docs/specs/UI_MINIMAL.md`](docs/specs/UI_MINIMAL.md) セクション2.3
  - ✅ **セキュリティUI**（Botnet対策のUI統合）
    - ✅ セキュリティイベント可視化UI（監査ログ、侵入検知、異常検知の可視化）
    - ✅ IPブロックリスト管理UI（ブロック/解除、一時ブロッククリア）
    - ✅ I18N対応（日本語/英語）
    - ⏳ 正当ユーザーホワイトリスト機能（IPホワイトリストのUI管理）- Phase 3以降
    - ⏳ ログレベル調整機能（セキュリティログの詳細度調整）- Phase 3以降
    - ⏳ アラート通知機能（セキュリティイベントの通知設定）- Phase 3以降
  - ✅ **ホーム画面**（アプリケーション概要、クイックアクション、システムステータス表示）
  - ✅ **設定ページ**（言語切り替えUI）
  - ⏳ Setup Wizard Firewall自動適用 IPC - Phase 3以降
  - ⏳ モデル詳細設定パネル（UI Extensions）- Phase 3以降
  - ⏳ モデル比較/ヘルス履歴（UI Extensions）- Phase 3以降
  - ⏳ ダークモード（Phase 3以降）
- 詳細: [`docs/specs/UI_MINIMAL.md`](docs/specs/UI_MINIMAL.md), [`docs/specs/UI_EXTENSIONS.md`](docs/specs/UI_EXTENSIONS.md)

#### 国際化（I18N）
- ✅ **完全実装**: 実装完了
  - ✅ 翻訳ファイルの作成（`locales/ja.json`, `locales/en.json`）
  - ✅ `preferred_language` 設定保存機能（`flm config set preferred_language <ja|en>`で設定可能、`config.db`の`settings`テーブルに保存）
  - ✅ `flm config get preferred_language`で言語設定を取得可能
  - ✅ i18n コンテキストの実装（`src/contexts/I18nContext.tsx`）
  - ✅ 言語切り替えUIの実装（設定ページ）
  - ✅ 初回起動時の言語自動検出（OSの言語設定から検出）
  - ✅ 全ページのI18N対応（Home、ChatTester、SecurityEvents、IpBlocklistManagement、Settings、Sidebar）
  - ⏳ 言語切り替えUIの実装（設定画面）
  - ⏳ 初回起動時の言語自動検出（OSの言語設定を自動検出）
- ⚠️ **注意**: CLIは英語のみ（技術者向けのため）。UIのみ日本語・英語対応。
- 詳細: [`docs/specs/I18N_SPEC.md`](docs/specs/I18N_SPEC.md)

#### プロキシ機能拡張

- **HTTPS ACMEモード**（`https-acme`）
  - ✅ `rustls-acme` + DirCache によるHTTP-01チャレンジ自動化（stagingを既定、`FLM_ACME_USE_PROD=true` または `FLM_ACME_DIRECTORY=<url>` で切替可能）
  - ✅ `start_https_acme_server`（HTTPチャレンジ専用サーバー + HTTPS本線 + ACMEスーパーバイザー + HSTSリダイレクト）
  - ✅ CLI `flm proxy start` に `--challenge` / `--dns-profile` を追加（現状 `http-01` のみ動作、`dns-01` は今後サポート予定）
  - ✅ 証明書メタデータの永続化（`~/.flm/certs/acme-live/<domain>/fullchain.pem|privkey.pem` へ展開し、`security.db` の `certificates` テーブルに `mode=acme` で格納）
  - ✅ DNS-01チャレンジ対応（DNSプロバイダ資格情報連携と`acme_dns_profile_id`の実働化）
  - ⏳ ACME失敗時のフォールバック（既存証明書再利用、`dev-selfsigned`/`local-http`自動提案）
  - 詳細: [`docs/specs/PROXY_SPEC.md`](docs/specs/PROXY_SPEC.md) セクション6.3-6.4, [`docs/specs/CORE_API.md`](docs/specs/CORE_API.md) セクション7

**中優先度**:
- ⏳ **Proxy設定ホットリロード**
  - ⏳ 設定変更の検知機能（ファイル監視またはデータベースポーリング）
  - ⏳ 実行中プロキシの再設定機能（証明書更新、ポリシー変更等）
  - ⚠️ **注意**: 現在はプロキシの再起動が必要
  - ⚠️ **実装状況**: `docs/specs/PROXY_SPEC.md` セクション12の「未決事項」として記載（実装方針未確定）
  - 詳細: [`docs/specs/PROXY_SPEC.md`](docs/specs/PROXY_SPEC.md) セクション12

**低優先度**（将来拡張）:
- ✅ **音声転写機能**（`/v1/audio/transcriptions`エンドポイント）
  - ✅ **エンドポイント実装**: 基本構造とバリデーション完了
    - ✅ multipart/form-dataからの音声ファイル取得
    - ✅ ファイルサイズ検証（25MB制限）
    - ✅ モデルIDパース（`flm://{engine_id}/{model}`形式）
    - ✅ エンジン能力チェック（`audio_inputs`）
    - ✅ エラーハンドリング（ファイル読み込みエラー、モデルID形式エラー等）
  - ✅ **音声認識エンジン統合**: Whisper型エンジン（基本実装完了）
    - ✅ `LlmEngine` traitに`transcribe_audio`メソッドを追加（`crates/core/flm-core/src/ports/engine.rs`）
    - ✅ `TranscriptionRequest`/`TranscriptionResponse`ドメインモデルを追加（`crates/core/flm-core/src/domain/chat.rs`）
    - ✅ Ollamaエンジンに`transcribe_audio`メソッドを実装（`crates/engines/flm-engine-ollama/src/lib.rs`）
    - ✅ プロキシコントローラーで`transcribe_audio`メソッドを呼び出すように修正（`crates/services/flm-proxy/src/controller.rs`）
    - ⚠️ **注意**: OllamaのWhisperモデルを使用する場合、モデル名に"whisper"が含まれている必要があります。OllamaのAPI仕様に応じて実装を調整する必要がある場合があります。
    - 詳細: [`docs/guides/SPECIALIZED_ENGINES.md`](docs/guides/SPECIALIZED_ENGINES.md) セクション2.2、4.1
- ⏳ **ACMEワイルドカード対応**
  - ⏳ ワイルドカード証明書の発行機能
  - ⚠️ **注意**: 現在は単一ドメインのみ対応（`https-acme`モード実装後に検討）
  - 詳細: [`docs/specs/PROXY_SPEC.md`](docs/specs/PROXY_SPEC.md) セクション6.3
- ⏳ **Grafanaレポート統合**
  - ⏳ メトリクスエクスポート機能（Prometheus形式）
  - ⏳ Grafanaダッシュボード設定
  - 詳細: [`docs/guides/MONITORING.md`](docs/guides/MONITORING.md)（将来実装予定）

> **注意**: 未実装項目の詳細と優先度は [`docs/status/active/UNIMPLEMENTED_REPORT.md`](docs/status/active/UNIMPLEMENTED_REPORT.md) と [`docs/status/active/NEXT_STEPS.md`](docs/status/active/NEXT_STEPS.md) を参照してください。  
> 詳細な実装状況は [`docs/status/active/PROJECT_STATUS_SUMMARY.md`](docs/status/active/PROJECT_STATUS_SUMMARY.md) を参照してください。

## クイックスタート

### インストール

FLMはRustで実装されています。ビルドにはRust（nightly版）が必要です。

#### ソースからビルド

```bash
# Rust nightly toolchainのインストール
rustup toolchain install nightly
rustup default nightly

# プロジェクトのビルド
cargo build --release

# packaged-caモードを有効にする場合
cargo build --release --features packaged-ca

# バイナリは target/release/flm に生成されます
```

#### インストーラースクリプトを使用（推奨）

ビルド後、インストーラースクリプトを使用してシステムにインストールできます：

**Linux/macOS:**
```bash
# ビルド後、インストーラースクリプトを実行
./scripts/install.sh

# システム全体にインストール（sudoが必要）
sudo ./scripts/install.sh

# 証明書も同時にインストール（証明書ファイルが存在する場合、対話的に確認）
./scripts/install.sh
```

**Windows (PowerShell):**
```powershell
# ビルド後、インストーラースクリプトを実行
.\scripts\install.ps1

# システム全体にインストール（管理者権限が必要）
.\scripts\install.ps1 -SystemWide

# 証明書も同時にインストール
.\scripts\install.ps1 -InstallCert

# システム全体インストール + 証明書インストール
.\scripts\install.ps1 -SystemWide -InstallCert
```

> **注意**: インストーラースクリプトはCLI版のインストール用です。Tauriアプリケーション版のインストーラーは、GitHub Releasesからダウンロードできます。

> Rustビルド生成物は `target/` 配下（Git管理外）に配置されます。成果物を共有する場合はアーカイブ化して `reports/` 以下へ移してください。

### 基本的な使い方

#### 1. エンジンの検出

利用可能なLLMエンジン（Ollama、vLLM、LM Studio、llama.cpp）を検出します：

```bash
# すべてのエンジンを検出
flm engines detect

# JSON形式で出力
flm engines detect --format json

# 特定のエンジンのみ検出
flm engines detect ollama

# キャッシュを無視して再検出（engines_cacheは最長5分間再利用）
flm engines detect --fresh
```

> `engines detect` の結果は `config.db` の `engines_cache` に最大5分間保存されます。直前の変更（エンジンの起動/停止）をすぐに反映させたい場合は `--fresh` を併用してください。
>
> 詳細なトラブルシューティングは `docs/guides/ENGINE_CACHE_FAQ.md` を参照してください。

#### 2. モデル一覧の取得

検出されたエンジンで利用可能なモデルを一覧表示します：

```bash
# すべてのエンジンのモデルを一覧表示
flm models list

# 特定のエンジンのモデルのみ表示
flm models list --engine ollama

# JSON形式で出力
flm models list --format json
```

#### 3. プロキシサーバーの起動

OpenAI互換APIを提供するプロキシサーバーを起動します：

```bash
# ローカルHTTPモードで起動（デフォルト: ポート8080）
flm proxy start --mode local-http --port 8080

# 外部アクセスを許可する場合（0.0.0.0にバインド）
flm proxy start --mode local-http --port 8080 --bind 0.0.0.0

# HTTPSモード（自己署名証明書、開発用途）
flm proxy start --mode dev-selfsigned --port 8080

# HTTPSモード（ACME証明書、インターネット公開用）
flm proxy start \
  --mode https-acme \
  --port 8080 \
  --acme-email admin@example.com \
  --acme-domain example.com \
  --challenge http-01

# packaged-caモード（パッケージCA証明書、配布用）
# ⚠️ 注意: packaged-caモードは`--features packaged-ca`でビルドする必要があります
# flm proxy start --mode packaged-ca --port 8080

# プロキシの状態確認
flm proxy status

# プロキシの停止
flm proxy stop --port 8080
```

`https-acme` モードは `--acme-email` と `--acme-domain` が必須です。`--challenge` は `http-01`（デフォルト）／`dns-01` を指定でき、`dns-01` を選んだ場合は `--dns-profile <id>` により保存済みの DNS 資格情報を参照して TXT レコードを自動作成します。ACMEエンドポイントは既定でLet's Encrypt **staging** を使用し、`FLM_ACME_USE_PROD=true` で本番、または `FLM_ACME_DIRECTORY=https://acme.custom.example/directory` で任意エンドポイントへ切り替えられます。

取得した証明書は `~/.flm/certs/acme-live/<your-domain>/` に `fullchain.pem` / `privkey.pem` としてエクスポートされ、同時に `security.db` の `certificates` テーブルへ保存されます。今後追加されるUI/CLIからもこのメタデータを参照できます。

> **注意**: 
> - ✅ `local-http`と`dev-selfsigned`モードは実装済みです。
> - ✅ `https-acme`モードはLet's Encrypt互換のHTTP-01 / DNS-01チャレンジで証明書を自動取得し、`run_acme_supervisor` が継続更新を担当します。
> - ✅ `dev-selfsigned` / `packaged-ca` モードでは、HTTPポート（`--port`）が常にHTTPS（`port+1`）へStrict-Transport-Security付きでリダイレクトされます。
> - ✅ `packaged-ca`モードは基本実装が完了しています。`packaged-ca`モードを使用するには、`cargo build --features packaged-ca`でビルドする必要があります。証明書の登録は`flm security install-ca`コマンドで手動実行できます。インストーラーフックとコード署名（Windows/macOS/Linux）は実装済みです。
> - ✅ コード署名（Windows/macOS/Linux）とハッシュ値公開は実装済みです。GitHub Releasesには`checksums.txt`とGPG署名が含まれます。

#### 4. APIキーの管理

プロキシサーバーへのアクセスに使用するAPIキーを管理します：

```bash
# APIキーの作成
flm api-keys create --label "my-api-key"

# APIキーの一覧表示
flm api-keys list

# APIキーのローテーション
flm api-keys rotate <key-id>

# APIキーの失効
flm api-keys revoke <key-id>
```

#### 5. モデルプロファイルの管理

モデル固有のパラメータ設定（プロファイル）を管理します：

```bash
# プロファイル一覧の表示
flm model-profiles list

# エンジンでフィルタ
flm model-profiles list --engine ollama

# モデルでフィルタ
flm model-profiles list --model flm://ollama/llama3

# プロファイルの保存（JSONファイルから）
flm model-profiles save \
  --engine ollama \
  --model llama3 \
  --label "High Temperature" \
  --params profile.json

# プロファイルの削除
flm model-profiles delete --id <profile-id>
```


プロファイルJSONファイルの例（`profile.json`）：

```json
{
  "temperature": 0.9,
  "top_p": 0.95,
  "max_tokens": 2048,
  "presence_penalty": 0.1
}
```

#### 6. APIプロンプトテンプレートの管理

APIエンドポイント固有のプロンプトテンプレートを管理します：

```bash
# すべてのプロンプトを一覧表示
flm api prompts list

# 特定のAPI IDのプロンプトを表示
flm api prompts show --api-id chat_completions

# プロンプトテンプレートを設定（テキストファイルから）
flm api prompts set --api-id chat_completions --file prompt.txt

# プロンプトを削除
flm api prompts delete --api-id chat_completions

# JSON形式で出力
flm api prompts list --format json
```


プロンプトテンプレートファイルの例（`prompt.txt`）：

```
You are a helpful assistant. Answer the user's question concisely.

User: {{user_message}}
Assistant:
```

#### 7. 設定の管理

アプリケーション設定を管理します：

```bash
# 設定値の取得
flm config get <key>

# 設定値の設定
flm config set <key> <value>

# すべての設定の一覧表示
flm config list
```

#### 8. セキュリティ管理

セキュリティポリシーとバックアップを管理します：

```bash
# セキュリティポリシーの表示
flm security policy show

# セキュリティポリシーの設定（JSONファイルから）
flm security policy set --file policy.json

# セキュリティデータベースのバックアップ作成
flm security backup create --output ./backups

# セキュリティデータベースの復元
flm security backup restore --file ./backups/security.db.bak.20250101

# パッケージCA証明書のOS信頼ストアへの登録（packaged-caモード用）
flm security install-ca

# 特定の証明書ファイルを指定して登録
flm security install-ca --cert-path ./certs/flm-ca.crt

# IPブロックリストの管理
flm security ip-blocklist list
flm security ip-blocklist unblock <ip>
flm security ip-blocklist clear

# 監査ログの表示
flm security audit-logs --limit 50
flm security audit-logs --event-type auth_failure --severity high

# 侵入検知イベントの表示
flm security intrusion --min-score 100 --limit 50

# 異常検知イベントの表示
flm security anomaly --anomaly-type high_request_rate --limit 50
```

#### 9. データベース整合性チェック

データベースの整合性を検証します：

```bash
# 基本的な整合性チェック
flm check

# 詳細情報を表示
flm check --verbose
```

#### 10. チャットインターフェース

LLMモデルと直接対話します：

```bash
# 基本的なチャット
flm chat --model flm://ollama/llama2 --prompt "Hello, how are you?"

# ストリーミング出力
flm chat --model flm://ollama/llama2 --prompt "Tell me a story" --stream

# 画像入力（Vision対応モデル）
flm chat --model flm://ollama/llava --image ./image.png --prompt "Describe this image"
```

#### 11. レガシーデータの移行

旧プロトタイプ（`archive/prototype/`）からデータを新スキーマへ移行します：

```bash
# ドライラン（移行計画のプレビュー）
flm migrate legacy plan --source ./archive/prototype --tmp ./tmp/migrate-preview

# 変換のみ実行（移行ファイルを生成、適用はしない）
flm migrate legacy convert --source ./archive/prototype --tmp ./tmp/migrate-preview

# 移行を実行（自動バックアップ取得後に適用）
flm migrate legacy apply --source ./archive/prototype --confirm
```

> `--tmp` を省略した場合は `./tmp/flm-migrate-<timestamp>` が使用されます。`apply` 実行時は安全のため `--confirm` フラグが必須です。

**機能**:
- `plan`: ドライラン（移行計画の生成と `migration-plan.json` の出力）
- `convert`: 設定ファイル（config.json）の変換と移行ファイル生成
- `apply`: `convert` + データベース適用（自動バックアップ取得後に適用）
- データベース変換（旧プロトタイプの`flm.db`/`database.db`/`data.db`から変換）
  - `apis` テーブル → `proxy_profiles`
  - `api_keys` テーブル → APIキーメタデータ（暗号化キーは移行不可）
  - `user_settings` テーブル → `settings`
- バックアップ作成（適用前の自動バックアップ）
- 適用ロジック（変換ファイルを本番DBに適用）

**注意事項**:
- ⚠️ 暗号化されたAPIキーは移行できません。移行後は新しいAPIキーを作成してください。
- 適用前に既存のデータベースが自動的にバックアップされます（`.bak.<timestamp>`形式）。

詳細は [`docs/specs/CLI_SPEC.md`](docs/specs/CLI_SPEC.md) セクション3.13と [`docs/specs/DB_SCHEMA.md`](docs/specs/DB_SCHEMA.md) セクション6を参照してください。

### プロキシサーバーの使用例

プロキシサーバーを起動した後、OpenAI互換APIとして使用できます：

```bash
# プロキシを起動
flm proxy start --mode local-http --port 8080

# 別のターミナルでAPIリクエストを送信
curl -X POST http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your-api-key>" \
  -d '{
    "model": "flm://ollama/llama2",
    "messages": [
      {"role": "user", "content": "Hello, how are you?"}
    ]
  }'
```

## スクリプトと自動化

`scripts/` ディレクトリにはCI/CDスクリプトが含まれています：

- **CI/CDスクリプト**:
  - `ci-cli.sh` / `ci-cli.ps1` - CLI統合テスト（フォーマットチェック、Clippy、ユニットテスト、統合スモークテスト）
  - `ci-proxy-load.sh` / `ci-proxy-load.ps1` - プロキシ負荷テスト（k6/wrk2を使用）
  - `ci-acme-smoke.sh` / `ci-acme-smoke.ps1` - ACME証明書発行のスモークテスト
- **ユーティリティ**:
  - `align_versions.rs` - バージョン整合性チェックツール
  - `tag_core_api.sh` - Core APIバージョンタグ作成スクリプト
  - `validate_schemas.sh` - スキーマ検証スクリプト
- 旧プロトタイプ向けユーティリティは `archive/prototype/scripts/` に保管済みです。参照・再利用時はアーカイブ外へコピーしてから実行してください。
- 一括実行結果や検証レポートは `reports/` へ配置し、必要に応じて本 README からリンクします。

## コマンドリファレンス

すべてのCLIコマンドの詳細な仕様は [`docs/specs/CLI_SPEC.md`](docs/specs/CLI_SPEC.md) を参照してください。

### 実装済みコマンド

| カテゴリ | コマンド | 説明 | 実装状況 |
|---------|---------|------|---------|
| エンジン | `flm engines detect` | 利用可能なLLMエンジンを検出 | ✅ 実装済み |
| モデル | `flm models list` | 利用可能なモデルを一覧表示 | ✅ 実装済み |
| プロキシ | `flm proxy start/stop/status` | プロキシサーバーの制御 | ✅ 実装済み<br/>モード: `local-http`, `dev-selfsigned`, `https-acme`（HTTP-01 / DNS-01 対応済み）, `packaged-ca`（`--features packaged-ca`で有効化が必要） |
| APIキー | `flm api-keys create/list/revoke/rotate` | APIキーの管理 | ✅ 実装済み |
| モデルプロファイル | `flm model-profiles list/save/delete` | モデル固有のパラメータ設定 | ✅ 実装済み |
| APIプロンプト | `flm api prompts list/show/set/delete` | APIエンドポイント固有のプロンプト | ✅ 実装済み |
| 設定 | `flm config get/set/list` | アプリケーション設定 | ✅ 実装済み |
| セキュリティ | `flm security policy show/set` | セキュリティポリシー管理 | ✅ 実装済み |
| セキュリティ | `flm security backup create/restore` | セキュリティDBのバックアップ | ✅ 実装済み |
| セキュリティ | `flm security ip-blocklist` | IPブロックリスト管理 | ✅ 実装済み |
| セキュリティ | `flm security audit-logs` | 監査ログ表示 | ✅ 実装済み |
| セキュリティ | `flm security intrusion` | 侵入検知イベント表示 | ✅ 実装済み |
| セキュリティ | `flm security anomaly` | 異常検知イベント表示 | ✅ 実装済み |
| セキュリティ | `flm security install-ca` | packaged-ca証明書のOS信頼ストア登録 | ✅ 実装済み |
| ヘルスチェック | `flm check` | データベース整合性チェック | ✅ 実装済み |
| チャット | `flm chat` | LLMモデルとの対話（マルチモーダル対応） | ✅ 実装済み |
| データ移行 | `flm migrate legacy` | 旧プロトタイプからのデータ移行 | ✅ 実装済み<br/>⚠️ 暗号化APIキーは移行不可 |


## UIでの操作

モデルプロファイルとAPIプロンプトは、UIからも管理できます：

- **モデルプロファイル**: `/models/profiles` ページで一覧表示・作成・編集・削除が可能です。
- **APIプロンプト**: `/api/prompts` ページで一覧表示・編集が可能です。

UIから操作した内容は、CLIコマンドと同じ `config.db` に保存されるため、CLIとUIの両方から同じデータにアクセスできます。

## 開発に参加するには

### 新規参加者向け
1. **プロジェクト概要**: 本READMEと `docs/planning/PLAN.md` を読む
2. **アーキテクチャ**: `docs/planning/diagram.md` で全体像を把握
3. **次の作業**: `docs/status/active/NEXT_STEPS.md` で現在のタスクを確認

### 開発者向け
- **仕様書**: `docs/specs/` 配下の各仕様書を参照
  - `CLI_SPEC.md` - CLIコマンド仕様
  - `PROXY_SPEC.md` - プロキシ仕様
  - `CORE_API.md` - コアAPI仕様
  - `ENGINE_DETECT.md` - エンジン検出仕様
- **テスト戦略**: `docs/guides/TEST_STRATEGY.md` を参照
- **コーディング規約**: プロジェクトの既存コードパターンに従う

### セキュリティ実装者向け
- **実装計画**: `docs/planning/BOTNET_PROTECTION_IMPLEMENTATION_PLAN.md`
- **ユーザーガイド**: `docs/guides/SECURITY_BOTNET_PROTECTION.md`
- **ファイアウォール設定**: `docs/guides/SECURITY_FIREWALL_GUIDE.md`

## アーカイブと旧プロトタイプ

- `archive/prototype/` は Git 追跡済みの完全アーカイブです。バグ修正や新機能を追加しないでください。
- 参考として動作させる際も、本番利用や配布は行わないでください。
- 旧プロトタイプの生成物は `archive/prototype/prototype-generated-assets.zip` に圧縮済みです。

---

**最終更新**: 2025-12-13（Clippy警告の修正完了、コンパイルエラーの修正完了、Codecov設定の改善、カバレッジレポーターの追加、HTTPS ACMEモードのHTTP-01チャレンジ対応エンドポイント実装完了、README.md構成整理・実装状況表記の明確化、コマンドリファレンスセクション整理、HTTPS ACMEモードの基本構造を明確化、UI機能の実装状況を明確化、I18N基本構造実装完了、音声転写機能のエンジン統合実装完了）  
**質問や作業の割り当て**: Issue または Docs コメントで調整してください。

---

## 参考リンク

### 実装状況・進捗
- **実装状況の詳細**: [`docs/status/active/PROJECT_STATUS_SUMMARY.md`](docs/status/active/PROJECT_STATUS_SUMMARY.md)
- **未実装項目**: [`docs/status/active/UNIMPLEMENTED_REPORT.md`](docs/status/active/UNIMPLEMENTED_REPORT.md)
- **未実装分析**: [`docs/status/active/UNIMPLEMENTED_ANALYSIS.md`](docs/status/active/UNIMPLEMENTED_ANALYSIS.md)
- **次のステップ**: [`docs/status/active/NEXT_STEPS.md`](docs/status/active/NEXT_STEPS.md)

### 仕様書・計画
- **プロジェクト計画**: [`docs/planning/PLAN.md`](docs/planning/PLAN.md)
- **Phase 3パッケージング計画**: [`docs/planning/PHASE3_PACKAGING_PLAN.md`](docs/planning/PHASE3_PACKAGING_PLAN.md)
- **Botnet対策実装計画**: [`docs/planning/BOTNET_PROTECTION_IMPLEMENTATION_PLAN.md`](docs/planning/BOTNET_PROTECTION_IMPLEMENTATION_PLAN.md)
- **CLI仕様**: [`docs/specs/CLI_SPEC.md`](docs/specs/CLI_SPEC.md)
- **プロキシ仕様**: [`docs/specs/PROXY_SPEC.md`](docs/specs/PROXY_SPEC.md)



