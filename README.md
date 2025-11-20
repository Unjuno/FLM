# FLM Monorepo (Next Generation)

> Status: WIP | Audience: All contributors | Updated: 2025-11-18

このリポジトリは、アーカイブ済みプロトタイプ (`archive/prototype/`) を置き換える次期実装です。旧アプリは `archive/prototype/` 以下に完全保管しており、参照専用です。新コアは以下の構成で進行中です。

```
flm/
  crates/              # Rust コア / CLI / Proxy / Engine adapters ✅ 実装開始
    flm-core/          # Domain層（ビジネスロジック） ✅
    flm-cli/           # CLI（コマンドライン） ✅
    flm-proxy/         # HTTP(S)プロキシ 🚧
    flm-engine-*/      # エンジンアダプタ 🚧
  docs/                # PLAN, CORE_API, UI/CLI 仕様など
  README.md            # 本ファイル
  archive/prototype/   # 旧実装（参照のみ）
```

## ビルド方法

```bash
# Rust ワークスペース全体をチェック
cargo check --workspace

# CLI バイナリをビルド
cargo build --bin flm

# CLI を実行
./target/debug/flm --help
```

## Phase 0 進捗

- ✅ Rust ワークスペース構造の作成
- ✅ `flm-core` ドメイン層の骨格実装
- ✅ `flm-cli` コマンドライン骨格実装
- ✅ ドキュメントの整備（PLAN.md, CORE_API.md等）
- 🚧 エンジン検出ロジックの実装（次のステップ）
- 🚧 プロキシサーバーの実装
- 🚧 データベース実装

**注**: HTTP依存関係は一時的に無効化しています（Rust 1.82 互換性の問題）。Rust 1.83へのアップグレード後に再有効化します。

## 現状と方針
- 旧 Node/Electron 実装は保守対象外。必要に応じて `archive/prototype/README.md` を参照。
- 新 CLI / Proxy / UI は Rust ドメイン層を共通利用し、ドキュメントは `docs/PLAN.md` を起点に参照する。
- 最新仕様は `docs/` 以下（`PLAN.md`, `CORE_API.md`, `UI_MINIMAL.md`, `SECURITY_FIREWALL_GUIDE.md` など）に集約。

## 開発に参加するには
1. `docs/PLAN.md` でフェーズと成果物を確認。
2. CLI/Proxy/Engine の仕様は `docs/CLI_SPEC.md`, `docs/PROXY_SPEC.md`, `docs/ENGINE_DETECT.md` を参照。
3. UI 作業時は `docs/UI_MINIMAL.md` と `docs/UI_EXTENSIONS.md` を確認し、Setup Wizard / Firewall 自動化の要件に従う。

## 旧プロトタイプを触る場合
- `archive/prototype/` は Git 追跡済みの完全アーカイブです。バグ修正や新機能を追加しないでください。
- 参考として動作させる際も、本番利用や配布は行わないでください。

---
質問や作業の割り当ては Issue または Docs コメントで調整してください。README は随時更新します。

