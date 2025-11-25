# FLM - Local LLM API Manager

FLMは、**初心者でも外部に公開して使える安全なAPIが、インストールして実行するだけで手に入る**デスクトップアプリケーションです。

> Status: Archived | Audience: Reference only | Updated: 2025-11-25  
> このディレクトリは旧実装の完全アーカイブです。新機能や修正はルート配下の Rust 実装で行い、ここでは構成参照以外の変更を加えないでください。

技術知識がなくても、コードを書かずに、直感的なUIでローカルLLMのAPIを作成・デプロイし、そのAPIを**外部からも安全に利用**できます。セキュリティ設定は自動化されているため、誰でも簡単に安全なAPIを作成・公開できます。

**注意**: 本アプリケーションは**シングルユーザー環境専用**です。マルチユーザー対応やロールベースアクセス制御（RBAC）機能は提供されていません。

> 生成物（`coverage/`, `dist/`, `public/`, `test-results.txt`）は `prototype-generated-assets.zip` に圧縮済みです。内容を確認する場合のみ解凍してください。

**プロジェクト名について**: 本プロジェクトの正式名称は「FLM (Local LLM API Manager)」です。パッケージ名（`package.json`の`name`、`Cargo.toml`の`name`）は技術的制約により小文字の「flm」となっていますが、プロジェクト名は「FLM」で統一されています。

## ✨ 主な特徴

- 🚀 **簡単セットアップ**: インストールして実行するだけ
- 🔒 **自動セキュリティ**: APIキー認証が自動設定
- 🌐 **外部公開対応**: 作成したAPIを外部からも安全に利用可能
- 📊 **パフォーマンス監視**: レスポンスタイム、リクエスト数、エラー率を監視
- 📝 **ログ管理**: APIリクエストログの表示・エクスポート・削除
- 🔔 **アラート機能**: パフォーマンス低下やエラー発生を通知
- 🎨 **直感的なUI**: 初心者でも迷わず操作できるインターフェース
- 🌍 **多言語対応**: 日本語・英語に対応
- 🎯 **OpenAI互換**: OpenAI APIと互換性があり、既存のクライアントコードをそのまま利用可能

## 📋 プロジェクト構成

```
FLM/
├── src/                          # フロントエンド (React + TypeScript)
│   ├── components/               # UIコンポーネント
│   │   ├── api/                  # API関連コンポーネント
│   │   ├── common/               # 共通コンポーネント
│   │   ├── forms/                # フォームコンポーネント
│   │   ├── layout/               # レイアウトコンポーネント
│   │   ├── models/               # モデル関連コンポーネント
│   │   └── navigation/           # ナビゲーションコンポーネント
│   ├── pages/                    # ページコンポーネント
│   ├── hooks/                    # カスタムフック
│   ├── utils/                    # ユーティリティ関数
│   ├── types/                    # TypeScript型定義
│   ├── contexts/                 # React Context
│   ├── locales/                 # 多言語化リソース
│   └── backend/                  # 認証プロキシサーバー
│       └── auth/                 # Express.js認証プロキシ
│
├── src-tauri/                    # Tauriバックエンド (Rust)
│   ├── src/
│   │   ├── commands/             # Tauri IPCコマンド
│   │   │   ├── api.rs            # API管理コマンド
│   │   │   ├── ollama.rs         # Ollama管理コマンド
│   │   │   ├── performance.rs    # パフォーマンス監視コマンド
│   │   │   └── ...
│   │   ├── database/             # データベース層
│   │   │   ├── repository/       # Repositoryパターン実装
│   │   │   └── ...
│   │   ├── engines/              # LLMエンジン管理
│   │   └── utils/                # ユーティリティ
│   ├── Cargo.toml                # Rust依存関係
│   └── tauri.conf.json           # Tauri設定
│
├── docs/                         # ドキュメント
│   ├── DEVELOPMENT_SETUP.md      # 開発環境セットアップ
│   ├── USER_GUIDE.md             # ユーザーガイド
│   └── ...
│
├── DOCKS/                        # 設計ドキュメント
│   ├── ARCHITECTURE.md           # システムアーキテクチャ
│   ├── SPECIFICATION.md          # 機能仕様書
│   └── archive/                  # アーカイブ
│
├── tests/                        # テストスイート
│   ├── unit/                     # 単体テスト
│   ├── integration/              # 統合テスト
│   └── e2e/                      # E2Eテスト
│
├── package.json                  # Node.js依存関係
├── tsconfig.json                 # TypeScript設定
└── vite.config.ts                # Vite設定
```

## 🛠️ 技術スタック

- **UIフレームワーク**: Tauri 2.x
- **フロントエンド**: React 18.3.1 + TypeScript 5.5.4
- **バックエンド**: Rust (Edition 2021)
- **データベース**: SQLite (rusqlite)
- **LLM実行**: Ollama
- **認証プロキシ**: Express.js + express-http-proxy
- **ビルドツール**: Vite 7.2.2
- **テスト**: Jest

## 🚀 クイックスタート

### 必要な環境

- Node.js 18.x以上（現在v24.6.0で動作確認済み）
- Rust (最新安定版、cargo 1.88.0で動作確認済み)
- npm または yarn

### セットアップ手順

1. **リポジトリのクローン**
   ```bash
   git clone https://github.com/Unjuno/FLM.git
   cd FLM
   ```

2. **依存関係のインストール**
   ```bash
   npm install
   ```

3. **開発サーバーの起動**
   ```bash
   npm run tauri:dev
   ```

4. **ビルド**
   ```bash
   npm run tauri:build
   ```

## 📚 主要機能

### API管理
- **API作成**: モデル選択からAPI作成まで直感的なUIで操作
- **API一覧**: 作成済みAPIの一覧表示と管理
- **API設定**: ポート番号、認証設定などの変更
- **APIテスト**: チャットインターフェースでのAPI動作確認

### モデル管理
- **モデル検索**: Ollamaモデルの検索・フィルタ・ソート
- **モデルダウンロード**: 進捗表示付きのモデルダウンロード
- **インストール済みモデル**: 利用可能なモデル一覧表示

### ログ・監視
- **リクエストログ**: APIリクエストログの表示・検索・フィルタ
- **パフォーマンス監視**: レスポンスタイム、リクエスト数、エラー率の可視化
- **ログエクスポート**: CSV形式でのログエクスポート
- **アラート機能**: パフォーマンス低下やエラー発生時の通知

### セキュリティ
- **APIキー管理**: セキュアなAPIキー生成・暗号化保存
- **認証プロキシ**: Bearer Token認証によるAPI保護
- **HTTPS対応**: 自動証明書生成によるHTTPS通信

## 🧪 テスト

### テストの実行

```bash
# 全テスト実行
npm test

# 単体テストのみ
npm run test:unit

# 統合テストのみ
npm run test:integration

# E2Eテストのみ
npm run test:e2e

# カバレッジレポート
npm run test:coverage
```

### Rustテスト

```bash
cd src-tauri
cargo test
```

## 📖 ドキュメント

**📚 [ドキュメントインデックス](./DOCKS/DOCUMENTATION_INDEX.md)** - すべてのドキュメントファイルの一覧と分類（推奨）

### 📋 プロジェクト情報
- [プロジェクト構造](./docs/PROJECT_STRUCTURE.md) - プロジェクト構造の説明
- [アプリケーション情報](./docs/overview/APP_INFO.md) - アプリケーションの種類とセキュリティ情報
- [使用可能状況](./docs/overview/USAGE_STATUS.md) - 実装済み機能の一覧

### 開発者向け
- [開発環境セットアップ](./docs/DEVELOPMENT_SETUP.md) - 開発環境のセットアップ手順
- [プロジェクト構造](./docs/PROJECT_STRUCTURE.md) - プロジェクト構造の説明
- [開発者ガイド](./docs/DEVELOPER_GUIDE.md) - アーキテクチャ説明、コントリビューションガイド
- [アーキテクチャ設計書](./DOCKS/ARCHITECTURE.md) - システムアーキテクチャ設計書
- [APIドキュメント](./docs/API_DOCUMENTATION.md) - Tauri IPCコマンドとOpenAI互換API

### ユーザー向け
- [インストールガイド](./docs/INSTALLATION_GUIDE.md) - インストール方法、システム要件
- [ユーザーガイド](./docs/USER_GUIDE.md) - 使い方ガイド（ステップバイステップ）
- [FAQ](./docs/FAQ.md) - よくある質問
- [トラブルシューティングガイド](./docs/TROUBLESHOOTING.md) - トラブルシューティング

### 📁 ドキュメントディレクトリ
詳細なドキュメントは以下のディレクトリに整理されています：

- **[docs/](./docs/)** - ユーザー向け・開発者向けドキュメント
  - [docs/README.md](./docs/README.md) - ドキュメント一覧
  - [docs/release/](./docs/release/) - リリース関連ドキュメント
  - [docs/reports/](./docs/reports/) - 実装・テストレポート
  - [docs/tests/guides/](./docs/tests/guides/) - テストガイド
  - [docs/procedures/](./docs/procedures/) - 公開手順・開発手順
  - [docs/guides/](./docs/guides/) - 各種機能の使用方法ガイド

## 🔧 開発状況

**現在のバージョン**: v1.0.0

### 最新の更新 (2024-12-31)

- ✅ **プロジェクト全体の整理完了**: 28ファイルを整理・アーカイブ、ドキュメント構造を明確化
- ✅ **コード整理・リファクタリング完了**: 182ファイルを整理、234行のコード削減
- ✅ **コメントフォーマット統一**: 全ファイルで統一されたコメント形式
- ✅ **不要コード削除**: コメントアウトコード、プレースホルダーコードの削除
- ✅ **開発環境チェック**: console出力を開発環境のみで実行するように最適化
- ✅ **Rustコード品質向上**: Clippy警告の修正、format!マクロの改善
- ✅ **パフォーマンス最適化**: ページ非表示時の自動更新停止

詳細は[CHANGELOG.md](./CHANGELOG.md)を参照してください。  
プロジェクト整理の詳細は[PROJECT_ORGANIZATION_SUMMARY.md](./PROJECT_ORGANIZATION_SUMMARY.md)を参照してください。  
プロジェクト構造の詳細は[プロジェクト構造](./docs/PROJECT_STRUCTURE.md)を参照してください。

## 📄 ライセンス

MIT License

詳細は[LICENSE](./LICENSE)ファイルを参照してください。

## 🤝 コントリビューション

コントリビューションを歓迎します！

- [コントリビューションガイド](./CONTRIBUTING.md) - 貢献の手順
- [開発者ガイド](./docs/DEVELOPER_GUIDE.md) - アーキテクチャ説明、コントリビューションガイド

## 📝 変更履歴

- [CHANGELOG.md](./CHANGELOG.md) - すべての重要な変更の記録
- [RELEASE_NOTES.md](./RELEASE_NOTES.md) - v1.0.0リリースノート

## 🔗 リンク

- **リポジトリ**: https://github.com/Unjuno/FLM

---

**FLM - ローカルLLMを簡単にAPI化**
