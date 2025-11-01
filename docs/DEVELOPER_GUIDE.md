# FLM - 開発者ガイド

## フェーズ4: ドキュメントエージェント (DOC) 実装

このガイドは、FLMプロジェクトの開発に参加する開発者向けのドキュメントです。

---

## 目次

1. [アーキテクチャ概要](#アーキテクチャ概要)
2. [開発環境セットアップ](#開発環境セットアップ)
3. [プロジェクト構造](#プロジェクト構造)
4. [開発フロー](#開発フロー)
5. [コーディング規約](#コーディング規約)
6. [テスト](#テスト)
7. [コントリビューション](#コントリビューション)

---

## アーキテクチャ概要

### システム構成

FLMは、以下のコンポーネントで構成されています：

```
┌─────────────────────────────────────┐
│       フロントエンド (React)        │
│   - UIコンポーネント                │
│   - ページ                          │
│   - カスタムフック                  │
└──────────────┬──────────────────────┘
               │ IPC (Tauri)
┌──────────────▼──────────────────────┐
│     バックエンド (Rust/Tauri)        │
│   - IPCコマンド                      │
│   - データベース管理                │
│   - Ollama管理                      │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│    認証プロキシ (Express.js)         │
│   - APIキー検証                      │
│   - OpenAI互換API                    │
└──────────────┬──────────────────────┘
               │ HTTP
┌──────────────▼──────────────────────┐
│        Ollama API                   │
│   - LLM実行                          │
└─────────────────────────────────────┘
```

### 主要モジュール

#### フロントエンド (`src/`)
- **`pages/`**: ページコンポーネント
- **`components/`**: 再利用可能なUIコンポーネント
- **`hooks/`**: カスタムフック（IPC通信など）
- **`types/`**: TypeScript型定義

#### バックエンド (`src-tauri/src/`)
- **`commands/`**: Tauri IPCコマンド
- **`database/`**: データベース管理（Repository パターン）
- **`ollama.rs`**: Ollama管理機能
- **`auth.rs`**: 認証プロキシ管理

#### 認証プロキシ (`src/backend/auth/`)
- **`server.ts`**: Express.jsサーバー
- **`keygen.ts`**: APIキー生成・検証
- **`database.ts`**: データベース統合
- **`proxy.ts`**: Ollama APIプロキシ

---

## 開発環境セットアップ

詳細は [開発環境セットアップガイド](./DEVELOPMENT_SETUP.md) を参照してください。

### 必要な環境

- **Node.js**: 18.x以上
- **Rust**: 最新安定版
- **npm**: またはyarn
- **Git**: バージョン管理

### セットアップ手順

1. **リポジトリのクローン**
   ```bash
   git clone https://github.com/your-repo/FLM.git
   cd FLM
   ```

2. **依存関係のインストール**
   ```bash
   npm install
   ```

3. **開発サーバーの起動**
   ```bash
   npm run tauri dev
   ```

---

## プロジェクト構造

詳細は [プロジェクト構造ドキュメント](./PROJECT_STRUCTURE.md) を参照してください。

### ディレクトリ構成

```
FLM/
├── src/                    # フロントエンド
│   ├── pages/             # ページコンポーネント
│   ├── components/        # UIコンポーネント
│   ├── hooks/             # カスタムフック
│   ├── types/              # TypeScript型定義
│   └── backend/           # 認証プロキシ
│       └── auth/          # 認証プロキシ実装
│
├── src-tauri/             # Tauriバックエンド
│   ├── src/
│   │   ├── commands/      # IPCコマンド
│   │   ├── database/      # データベース
│   │   ├── ollama.rs      # Ollama管理
│   │   └── auth.rs        # 認証プロキシ管理
│   └── Cargo.toml
│
├── tests/                  # テスト
│   ├── unit/              # 単体テスト
│   ├── integration/      # 統合テスト
│   ├── e2e/               # E2Eテスト
│   └── performance/       # パフォーマンステスト
│
├── docs/                   # ドキュメント
├── DOCKS/                  # 設計ドキュメント
└── package.json
```

---

## 開発フロー

### 1. ブランチ戦略

- **`main`**: 本番環境用ブランチ
- **`develop`**: 開発用ブランチ
- **`feature/***`**: 機能追加用ブランチ
- **`bugfix/***`**: バグ修正用ブランチ

### 2. 開発手順

1. **ブランチを作成**
   ```bash
   git checkout -b feature/new-feature
   ```

2. **実装・テスト**
   - 機能を実装
   - テストを作成・実行

3. **コミット**
   ```bash
   git add .
   git commit -m "feat: add new feature"
   ```

4. **プッシュ・プルリクエスト**
   ```bash
   git push origin feature/new-feature
   ```

### 3. コードレビュー

- プルリクエストを作成
- コードレビューを受ける
- フィードバックを反映

---

## コーディング規約

### TypeScript/React

- **命名規則**: 
  - コンポーネント: PascalCase（例: `ApiList.tsx`）
  - 関数・変数: camelCase（例: `handleClick`）
  - 定数: UPPER_SNAKE_CASE（例: `MAX_RETRY_COUNT`）

- **型定義**: すべての関数に型を定義
- **インポート**: アルファベット順に整理

### Rust

- **命名規則**: 
  - 関数・変数: snake_case（例: `create_api`）
  - 構造体: PascalCase（例: `ApiCreateConfig`）

- **エラーハンドリング**: `Result<T, E>`を使用
- **ドキュメント**: 公開関数にはdocコメントを追加

### エラーメッセージ

- **非開発者向け**: 専門用語を避け、わかりやすい表現を使用
- **具体的な指示**: 問題を解決するための具体的な手順を含める

例:
- ❌ 悪い例: "DatabaseError: connection failed"
- ✅ 良い例: "データベースに接続できませんでした。アプリケーションを再起動してください。"

---

## テスト

### テストの実行

```bash
# すべてのテスト
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

### テストの書き方

詳細は [テストドキュメント](../tests/README.md) を参照してください。

### Rustテスト

```bash
cd src-tauri
cargo test
```

---

## コントリビューション

### コントリビューションの流れ

1. **Issueの作成**: バグ報告や機能要望のIssueを作成
2. **ブランチの作成**: `feature/***`または`bugfix/***`ブランチを作成
3. **実装**: 機能を実装し、テストを作成
4. **プルリクエスト**: プルリクエストを作成
5. **コードレビュー**: レビューを受けて修正
6. **マージ**: 承認後にマージ

### コミットメッセージ

以下のフォーマットに従ってください：

```
<type>: <subject>

<body>
```

**タイプ**:
- `feat`: 新機能
- `fix`: バグ修正
- `docs`: ドキュメント
- `test`: テスト
- `refactor`: リファクタリング
- `style`: コードスタイル

**例**:
```
feat: add model search functionality

- Implement real-time search bar
- Add category filters
- Add size filters
```

---

## アーキテクチャ設計

詳細は以下を参照してください：

- [アーキテクチャ設計書](../ARCHITECTURE.md)
- [IPCインターフェース仕様](../INTERFACE_SPEC.md)
- [データベーススキーマ説明](./DATABASE_SCHEMA.md)
- [認証プロキシ仕様](./AUTH_PROXY_SPEC.md)

---

## デバッグ

### フロントエンド

```bash
# 開発モードで起動（デバッグ情報表示）
npm run tauri dev
```

### バックエンド

```bash
# Rustデバッグ
cd src-tauri
cargo build
RUST_BACKTRACE=1 cargo run
```

### 認証プロキシ

```bash
# 認証プロキシを直接起動
cd src/backend/auth
npm install
npx tsx server.ts
```

---

## パフォーマンス最適化

### フロントエンド

- React.memoの使用
- useMemo/useCallbackの適切な使用
- 不要な再レンダリングの防止

### バックエンド

- データベースクエリの最適化
- 非同期処理の適切な使用
- メモリリークの防止

---

## セキュリティ

### APIキー

- AES-256-GCMで暗号化
- ハッシュ化して検証
- ログに記録しない

### 入力値検証

- SQLインジェクション対策（パラメータ化クエリ）
- XSS対策（Reactの自動エスケープ）

---

## 関連ドキュメント

- [開発環境セットアップ](./DEVELOPMENT_SETUP.md)
- [プロジェクト構造](./PROJECT_STRUCTURE.md)
- [テストドキュメント](../tests/README.md)
- [コードレビューチェックリスト](../tests/code-review/review-checklist.md)

---

**開発に参加いただき、ありがとうございます！**

