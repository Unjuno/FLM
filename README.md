# FLM - Local LLM API Manager

FLMは、**初心者でも外部に公開して使える安全なAPIが、インストールして実行するだけで手に入る**デスクトップアプリケーションです。

技術知識がなくても、コードを書かずに、直感的なUIでローカルLLMのAPIを作成・デプロイし、そのAPIを**外部からも安全に利用**できます。セキュリティ設定は自動化されているため、誰でも簡単に安全なAPIを作成・公開できます。

## プロジェクト構成

```
flm/
├── src/                    # フロントエンド (React + TypeScript)
│   ├── components/        # UIコンポーネント
│   ├── pages/             # ページコンポーネント
│   ├── hooks/             # カスタムフック
│   ├── utils/             # ユーティリティ
│   ├── types/              # TypeScript型定義
│   └── main.tsx           # エントリーポイント
│
├── src-tauri/             # Tauriバックエンド (Rust)
│   ├── src/
│   │   ├── main.rs        # Rustエントリーポイント
│   │   ├── lib.rs         # Tauriコマンド定義
│   │   └── ...            # 各種モジュール
│   ├── Cargo.toml         # Rust依存関係
│   └── tauri.conf.json    # Tauri設定
│
├── public/                # 静的ファイル
├── DOCKS/                 # 設計ドキュメント
│   ├── ARCHITECTURE.md    # システムアーキテクチャ設計書
│   ├── INTERFACE_SPEC.md  # モジュール間インターフェース仕様
│   ├── SPECIFICATION.md   # 完全な仕様書
│   ├── archive/           # 開発履歴（アーカイブ）
│   └── ...
├── package.json           # Node.js依存関係
├── tsconfig.json          # TypeScript設定
└── vite.config.ts         # Vite設定
```

## 技術スタック

- **UIフレームワーク**: Tauri 2.x
- **フロントエンド**: React 19.x + TypeScript
- **バックエンド**: Rust
- **データベース**: SQLite
- **LLM実行**: Ollama
- **認証プロキシ**: Express.js + express-http-proxy

## 開発環境セットアップ

### 必要な環境

- Node.js 18.x以上
- Rust (最新安定版)
- npm または yarn

### セットアップ手順

1. **依存関係のインストール**
   ```bash
   npm install
   ```

2. **開発サーバーの起動**
   ```bash
   npm run tauri dev
   ```

3. **ビルド**
   ```bash
   npm run tauri build
   ```

## 主要機能

### 🎯 核となるコンセプト

**「インストールして実行するだけで、初心者でも外部に公開して使える安全なAPIが手に入る」**

- ✅ **インストールして実行するだけ**: 複雑な設定やコーディングは一切不要
- ✅ **初心者でも簡単**: 技術知識がなくても、ワンクリックでAPIを作成・公開
- ✅ **外部公開に対応**: 作成したAPIは自動的に外部からもアクセス可能
- ✅ **安全が自動設定**: セキュリティ設定（APIキー認証など）が自動で有効化

### F001: API作成機能
- モデル選択からAPI作成まで、直感的なUIで操作可能
- 自動でAPIキー生成と暗号化保存（セキュリティ自動設定）
- Ollama自動起動・確認機能
- **外部公開対応**: 作成したAPIは自動的に外部からもアクセス可能

### F002: API利用機能
- 作成済みAPIのテスト用チャットインターフェース
- OpenAI互換APIとして利用可能（ローカルおよび外部アクセス対応）
- エンドポイント情報とAPIキーの表示
- **外部からの利用**: 他のデバイスやサービスからも簡単に利用可能

### F003: API管理機能
- APIの起動/停止管理
- 設定変更（ポート番号、認証設定）
- API削除と関連リソースのクリーンアップ

### F004: モデル管理機能
- Ollamaモデルの検索・ダウンロード
- インストール済みモデル一覧
- モデル情報の詳細表示

### F009: Ollama自動インストール機能
- システムパス上のOllama検出
- ポータブル版Ollamaの自動ダウンロード
- 自動起動と状態監視

## 開発フェーズ

**現在のステータス: v1.0 リリース準備完了** ✅

主要機能の実装が完了し、プロダクションレディな状態です。

### フェーズ1: 技術検証・基盤構築（完了）
- ✅ システムアーキテクチャ設計書作成
- ✅ IPC仕様書作成
- ✅ データベーススキーマ設計
- ✅ Tauriプロジェクト初期化
- ✅ 基本的なIPCコマンド実装
- ✅ React + TypeScript設定

### フェーズ2: 基盤機能実装（完了）
- ✅ SQLiteスキーマ実装
- ✅ データアクセス層実装（Repository パターン）
- ✅ 認証プロキシサーバー基本実装
- ✅ Ollama自動インストール機能

### フェーズ3: コア機能実装（完了）
- ✅ F001: API作成機能
- ✅ F002: API利用機能
- ✅ F003: API管理機能
- ✅ F004: モデル管理機能（基本機能）
- ✅ F005: 認証機能

### フェーズ4: 統合・テスト・品質保証（完了）
- ✅ 統合テストスイート作成・実行
- ✅ E2Eテストスイート作成・実行
- ✅ パフォーマンステスト
- ✅ セキュリティテスト
- ✅ コード品質チェック（リント、型チェック）
- ✅ 全モジュール統合確認
- ✅ UI/UX改善（エラーメッセージ、ガイダンス表示）
- ✅ パフォーマンス最適化（useCallback、useMemoによるメモ化）
- ✅ バグ修正、コンパイルエラー・警告修正完了
- ✅ ビルド設定最適化
- ✅ CI/CD設定完了
- ✅ ビルド・パッケージング自動化
- ✅ ドキュメント作成（ユーザーガイド、開発者ガイド、APIドキュメント）

### フェーズ5: 公式Webサイト実装（完了）
- ✅ ホームページ実装
- ✅ ダウンロードページ実装
- ✅ 機能紹介ページ実装
- ✅ 使い方ガイドページ実装
- ✅ FAQページ実装
- ✅ お問い合わせページ実装
- ✅ レスポンシブデザイン実装
- ✅ OS自動検出機能実装
- ✅ アクセシビリティ対応
- ✅ GitHub Pagesデプロイ自動化

## テスト

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
```

### Rustテスト

```bash
cd src-tauri
cargo test
```

## ドキュメント

**📚 [ドキュメントインデックス](./DOCKS/DOCUMENTATION_INDEX.md)** - すべてのドキュメントファイルの一覧と分類

### 開発者向け

- [開発環境セットアップ](./docs/DEVELOPMENT_SETUP.md) - 開発環境のセットアップ手順
- [プロジェクト構造](./docs/PROJECT_STRUCTURE.md) - プロジェクト構造の説明
- [開発者ガイド](./docs/DEVELOPER_GUIDE.md) - アーキテクチャ説明、コントリビューションガイド
- [アーキテクチャ設計書](./DOCKS/ARCHITECTURE.md) - システムアーキテクチャ設計書
- [モジュール間インターフェース仕様](./DOCKS/INTERFACE_SPEC.md) - モジュール間通信仕様
- [データベーススキーマ説明](./docs/DATABASE_SCHEMA.md) - データベーススキーマの説明
- [データベーススキーマSQL定義](./DOCKS/DATABASE_SCHEMA.sql) - データベーススキーマSQL
- [認証プロキシ仕様](./docs/AUTH_PROXY_SPEC.md) - 認証プロキシ仕様
- [APIドキュメント](./docs/API_DOCUMENTATION.md) - Tauri IPCコマンドとOpenAI互換API
- [将来の拡張計画](./docs/FUTURE_EXTENSIONS.md) - 将来の拡張計画
- [パフォーマンス最適化](./docs/PERFORMANCE_OPTIMIZATION.md) - パフォーマンス最適化

### ユーザー向け

- [インストールガイド](./docs/INSTALLATION_GUIDE.md) - インストール方法、システム要件、アップデート
- [ユーザーガイド](./docs/USER_GUIDE.md) - 使い方ガイド（ステップバイステップ）
- [FAQ](./docs/FAQ.md) - よくある質問（30の質問と回答）
- [トラブルシューティングガイド](./docs/TROUBLESHOOTING.md) - トラブルシューティング（15の問題と解決方法）

### 設計・プロジェクト管理

- [機能仕様書](./DOCKS/SPECIFICATION.md) - 完全な仕様書
- [アーキテクチャ設計書](./DOCKS/ARCHITECTURE.md) - システムアーキテクチャ設計書
- [プロジェクトコンセプト](./DOCKS/CONCEPT.md) - プロジェクトコンセプト

**📦 開発履歴**: v1.0リリース完了後の開発履歴ドキュメントは `DOCKS/archive/` と `docs/archive/` ディレクトリにアーカイブされています。

## 📄 ライセンス

MIT License

詳細は[LICENSE](./LICENSE)ファイルを参照してください。

## 🤝 コントリビューション

コントリビューションを歓迎します！

- [コントリビューションガイド](./CONTRIBUTING.md) - 貢献の手順
- [開発者ガイド](./docs/DEVELOPER_GUIDE.md) - アーキテクチャ説明、コントリビューションガイド
- [開発環境セットアップ](./docs/DEVELOPMENT_SETUP.md) - 開発環境のセットアップ手順

## 📝 変更履歴

- [CHANGELOG.md](./CHANGELOG.md) - すべての重要な変更の記録
- [RELEASE_NOTES.md](./RELEASE_NOTES.md) - v1.0.0リリースノート



