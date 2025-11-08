# プロジェクト構造説明文書

## 文書情報

- **プロジェクト名**: FLM
- **バージョン**: 1.0.0
- **作成日**: 2024年
- **目的**: プロジェクトの構造と各ディレクトリ・ファイルの役割を説明

---

## 目次

1. [プロジェクト概要](#プロジェクト概要)
2. [ディレクトリ構造](#ディレクトリ構造)
3. [主要ファイルの説明](#主要ファイルの説明)
4. [モジュール構成](#モジュール構成)
5. [開発ワークフロー](#開発ワークフロー)

---

## プロジェクト概要

FLMは、Tauriベースのデスクトップアプリケーションです。フロントエンドはReact + TypeScript、バックエンドはRustで実装されています。

### 技術スタック

- **フロントエンド**: React 18.3.1 + TypeScript + Vite
- **バックエンド**: Rust + Tauri 2.0
- **データベース**: SQLite (rusqlite)
- **認証**: Express.js（認証プロキシ）

---

## ディレクトリ構造

```
FLLM/
├── docs/                      # ドキュメント
│   ├── DEVELOPMENT_SETUP.md  # 開発環境セットアップ手順
│   ├── PROJECT_STRUCTURE.md   # このファイル
│   └── ...
├── DOCKS/                     # 設計ドキュメント
│   ├── AGENT_ARCHITECTURE.md  # エージェント構成設計書
│   ├── AGENT_CHECKLIST.md     # エージェント別タスクチェックリスト
│   ├── ARCHITECTURE.md        # システムアーキテクチャ設計書
│   ├── INTERFACE_SPEC.md      # モジュール間インターフェース仕様
│   ├── DATABASE_SCHEMA.sql    # データベーススキーマ定義
│   └── ...
├── src/                       # フロントエンドソースコード
│   ├── components/           # Reactコンポーネント
│   │   ├── common/           # 共通コンポーネント
│   │   ├── api/              # API関連コンポーネント
│   │   └── models/           # モデル関連コンポーネント
│   ├── pages/                # ページコンポーネント
│   ├── hooks/                # カスタムフック
│   ├── stores/               # 状態管理
│   ├── utils/                # ユーティリティ関数
│   ├── types/                # TypeScript型定義
│   ├── App.tsx               # メインアプリケーションコンポーネント
│   └── main.tsx              # エントリーポイント
├── src-tauri/                # Tauriバックエンドソースコード
│   ├── src/
│   │   ├── commands/         # Tauri IPCコマンド
│   │   │   ├── api.rs        # API関連コマンド
│   │   │   ├── database.rs   # データベース関連コマンド
│   │   │   ├── model.rs      # モデル関連コマンド
│   │   │   ├── ollama.rs     # Ollama関連コマンド
│   │   │   └── mod.rs        # モジュール定義
│   │   ├── database/         # データベースモジュール
│   │   │   ├── mod.rs
│   │   │   ├── connection.rs # データベース接続管理
│   │   │   ├── schema.rs     # スキーマ定義
│   │   │   ├── models.rs     # データモデル
│   │   │   ├── repository.rs # データアクセス層
│   │   │   └── migrations.rs # マイグレーション
│   │   ├── utils/            # ユーティリティモジュール
│   │   │   ├── mod.rs
│   │   │   └── error.rs       # エラーハンドリング
│   │   ├── lib.rs            # ライブラリエントリーポイント
│   │   └── main.rs            # バイナリエントリーポイント
│   ├── Cargo.toml            # Rust依存関係定義
│   ├── tauri.conf.json        # Tauri設定ファイル
│   └── build.rs               # ビルドスクリプト
├── tests/                     # テストコード
│   ├── unit/                  # 単体テスト
│   ├── integration/           # 統合テスト
│   ├── e2e/                   # E2Eテスト
│   └── setup/                 # テストセットアップ
├── public/                    # 静的ファイル
├── WEB/                       # 公式Webサイト（静的HTML）
├── package.json               # Node.js依存関係定義
├── tsconfig.json              # TypeScript設定
├── vite.config.ts             # Vite設定
├── jest.config.js             # Jest設定
└── README.md                  # プロジェクト概要
```

---

## 主要ファイルの説明

### フロントエンド

#### `src/main.tsx`
Reactアプリケーションのエントリーポイント。Tauriアプリケーションの初期化とルートコンポーネントのレンダリングを行います。

#### `src/App.tsx`
メインアプリケーションコンポーネント。ルーティングとレイアウトを管理します。

#### `src/components/`
再利用可能なUIコンポーネントを配置します。

#### `src/pages/`
各ページ/画面のコンポーネントを配置します。

#### `src/hooks/`
カスタムフックを配置します。Tauri IPC呼び出しのラッパーなどが含まれます。

### バックエンド

#### `src-tauri/src/main.rs`
Rustバイナリのエントリーポイント。Tauriアプリケーションの起動処理を行います。

#### `src-tauri/src/lib.rs`
ライブラリのエントリーポイント。Tauriコマンドハンドラーの登録を行います。

#### `src-tauri/src/commands/`
Tauri IPCコマンドの実装を配置します。各コマンドはフロントエンドから呼び出すことができます。

#### `src-tauri/src/database/`
データベース操作のモジュールです。SQLiteへの接続、スキーマ定義、データアクセス層が含まれます。

### 設定ファイル

#### `package.json`
Node.jsプロジェクトの依存関係とスクリプトを定義します。

#### `Cargo.toml`
Rustプロジェクトの依存関係とメタデータを定義します。

#### `tauri.conf.json`
Tauriアプリケーションの設定（ウィンドウ設定、パーミッションなど）を定義します。

#### `tsconfig.json`
TypeScriptコンパイラの設定を定義します。

#### `vite.config.ts`
Viteビルドツールの設定を定義します。

#### `jest.config.js`
Jestテストフレームワークの設定を定義します。

---

## モジュール構成

### フロントエンドモジュール

```
src/
├── components/        # UIコンポーネント
│   ├── common/       # 共通コンポーネント（ボタン、入力欄など）
│   ├── api/          # API関連コンポーネント（API作成フォーム、API一覧など）
│   └── models/       # モデル関連コンポーネント（モデルカタログ、ダウンロードなど）
├── pages/            # ページコンポーネント
│   ├── Home.tsx      # ホーム画面
│   ├── ApiCreate.tsx # API作成画面
│   ├── ApiList.tsx   # API一覧画面
│   └── ModelManagement.tsx # モデル管理画面
├── hooks/            # カスタムフック
│   ├── useIpc.ts     # IPC呼び出しフック
│   ├── useApi.ts     # API関連フック
│   └── useModel.ts   # モデル関連フック
└── utils/            # ユーティリティ関数
    └── apiClient.ts  # APIクライアント
```

### バックエンドモジュール

```
src-tauri/src/
├── commands/         # IPCコマンド
│   ├── api.rs        # API作成・管理コマンド
│   ├── database.rs   # データベース操作コマンド
│   ├── model.rs      # モデル管理コマンド
│   └── ollama.rs     # Ollama統合コマンド
├── database/         # データベースモジュール
│   ├── connection.rs # 接続管理
│   ├── schema.rs     # スキーマ定義
│   ├── models.rs     # データモデル
│   ├── repository.rs # リポジトリパターン実装
│   └── migrations.rs # マイグレーション
└── utils/            # ユーティリティ
    └── error.rs      # エラー型定義
```

---

## 開発ワークフロー

### 1. 新機能の開発

1. **設計**: `DOCKS/`ディレクトリのドキュメントを参照
2. **実装**: 
   - フロントエンド: `src/`ディレクトリにコンポーネントを作成
   - バックエンド: `src-tauri/src/commands/`にIPCコマンドを実装
3. **テスト**: `tests/`ディレクトリにテストを追加
4. **ドキュメント**: 必要に応じて`docs/`にドキュメントを追加

### 2. IPCコマンドの実装

1. **コマンド定義**: `src-tauri/src/commands/`に新しい関数を追加
2. **ハンドラー登録**: `src-tauri/src/lib.rs`の`invoke_handler`に追加
3. **フロントエンド呼び出し**: `src/hooks/useIpc.ts`にフックを追加

### 3. データベース操作

1. **スキーマ変更**: `DOCKS/DATABASE_SCHEMA.sql`を更新
2. **マイグレーション**: `src-tauri/src/database/migrations.rs`にマイグレーションを追加
3. **リポジトリ**: `src-tauri/src/database/repository.rs`にデータアクセスメソッドを追加

---

## 参考情報

- [Tauri公式ドキュメント](https://tauri.app/)
- [React公式ドキュメント](https://react.dev/)
- [Rust公式ドキュメント](https://www.rust-lang.org/learn)

---

**このドキュメントは開発の進行に伴い更新されます。**

