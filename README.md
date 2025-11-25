# FLM Monorepo (Next Generation)

> Status: WIP | Audience: All contributors | Updated: 2025-11-20

**注意**: 本アプリケーションは**個人利用・シングルユーザー環境向け**です。マルチユーザー対応やロールベースアクセス制御（RBAC）機能は提供されていません。

このリポジトリは、アーカイブ済みプロトタイプ (`archive/prototype/`) を置き換える次期実装です。旧アプリは `archive/prototype/` 以下に完全保管しており、参照専用です。新コアは以下の構成で進行中です。

```
flm/
  crates/              # Rust コア / CLI / Proxy / Engine adapters
  docs/                # PLAN, CORE_API, UI/CLI 仕様など
  README.md            # 本ファイル
  archive/prototype/   # 旧実装（参照のみ）
```

## 現状と方針
- 旧 Node/Electron 実装は保守対象外。必要に応じて `archive/prototype/README.md` を参照。
- 新 CLI / Proxy / UI は Rust ドメイン層を共通利用し、ドキュメントは `docs/planning/PLAN.md` を起点に参照する。
- 最新仕様は `docs/` 以下（`planning/PLAN.md`, `specs/CORE_API.md`, `specs/UI_MINIMAL.md`, `guides/SECURITY_FIREWALL_GUIDE.md` など）に集約。
- 旧プロトタイプの生成物（`coverage/`, `dist/`, `public/`, `test-results.txt`）は `archive/prototype/prototype-generated-assets.zip` に圧縮済みで、参照時のみ解凍する。
- テスト／監査レポートは `reports/` に集約しており、最新の統合結果は `reports/FULL_TEST_EXECUTION_REPORT.md`（詳細）と `reports/FULL_TEST_EXECUTION_SUMMARY.md`（要約）を参照。
- ドキュメントの詳細な索引は `docs/README.md` を参照し、進行状況は `docs/status/active/` へ一本化しています。

## 最新の進行状況とレポート
- **次のアクション**: `docs/status/active/NEXT_STEPS.md` が唯一の進行中タスクリストです。作業を開始する前にここを確認してください。
- **完了済みサマリー**: マイルストーンやタスクの完了報告は `docs/status/completed/` 配下に移動済みです。
- **テスト／監査ログ**: `reports/` ディレクトリに最新の実行結果を集約しています。README からリンクされている要約に加え、必要に応じて個別の `*-results*.txt` を参照してください。

## クイックスタート

### インストール

FLMはRustで実装されています。ビルドにはRust（nightly版）が必要です。

```bash
# Rust nightly toolchainのインストール
rustup toolchain install nightly
rustup default nightly

# プロジェクトのビルド
cargo build --release

# バイナリは target/release/flm に生成されます
```
> Rustビルド生成物は `target/` 配下（Git管理外）に配置されます。成果物を共有する場合はアーカイブ化して `reports/` 以下へ移してください。

## ドキュメントの参照方法
1. **索引**: `docs/README.md` で各カテゴリ（planning/specs/status など）の概要と推奨ドキュメントを確認。
2. **構成ポリシー**: `docs/DOCUMENTATION_STRUCTURE.md` が、アクティブ vs 完了、レポート配置、アーカイブ方針を定義します。
3. **進行状況**: `docs/status/active/NEXT_STEPS.md` で現在のタスク、`docs/status/completed/` で成果物を追跡。
4. **レポート**: `reports/` 内の Markdown / テキストが最新のテスト・監査ログです。最新版へは本 README と `docs/status/active` からリンクします。
5. **アーカイブ**: 旧実装は `archive/prototype/` 以下が唯一の参照元であり、凍結済みです。

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

# プロキシの状態確認
flm proxy status

# プロキシの停止
flm proxy stop --port 8080
```

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

- ルート直下の `scripts/` ディレクトリは廃止し、Cargoコマンド／Makefile／`just` など既存ツールを直接呼び出す運用に統一しています。
- 旧プロトタイプ向けユーティリティは `archive/prototype/scripts/` に保管済みです。参照・再利用時はアーカイブ外へコピーしてから実行してください。
- 一括実行結果や検証レポートは `reports/` へ配置し、必要に応じて本 README からリンクします。

## UIでの操作

モデルプロファイルとAPIプロンプトは、UIからも管理できます：

- **モデルプロファイル**: `/models/profiles` ページで一覧表示・作成・編集・削除が可能です。
- **APIプロンプト**: `/api/prompts` ページで一覧表示・編集が可能です。

UIから操作した内容は、CLIコマンドと同じ `config.db` に保存されるため、CLIとUIの両方から同じデータにアクセスできます。

## 開発に参加するには
1. `docs/planning/PLAN.md` でフェーズと成果物を確認。
2. CLI/Proxy/Engine の仕様は `docs/specs/CLI_SPEC.md`, `docs/specs/PROXY_SPEC.md`, `docs/specs/ENGINE_DETECT.md` を参照。
3. UI 作業時は `docs/specs/UI_MINIMAL.md` と `docs/specs/UI_EXTENSIONS.md` を確認し、Setup Wizard / Firewall 自動化の要件に従う。

## 旧プロトタイプを触る場合
- `archive/prototype/` は Git 追跡済みの完全アーカイブです。バグ修正や新機能を追加しないでください。
- 参考として動作させる際も、本番利用や配布は行わないでください。

---
質問や作業の割り当ては Issue または Docs コメントで調整してください。README は随時更新します。

