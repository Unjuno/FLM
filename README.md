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
```

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

#### 5. 設定の管理

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

## 開発に参加するには
1. `docs/planning/PLAN.md` でフェーズと成果物を確認。
2. CLI/Proxy/Engine の仕様は `docs/specs/CLI_SPEC.md`, `docs/specs/PROXY_SPEC.md`, `docs/specs/ENGINE_DETECT.md` を参照。
3. UI 作業時は `docs/specs/UI_MINIMAL.md` と `docs/specs/UI_EXTENSIONS.md` を確認し、Setup Wizard / Firewall 自動化の要件に従う。

## 旧プロトタイプを触る場合
- `archive/prototype/` は Git 追跡済みの完全アーカイブです。バグ修正や新機能を追加しないでください。
- 参考として動作させる際も、本番利用や配布は行わないでください。

---
質問や作業の割り当ては Issue または Docs コメントで調整してください。README は随時更新します。

