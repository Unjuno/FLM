# 開発環境セットアップ手順

## 文書情報

- **プロジェクト名**: FLM
- **バージョン**: 1.0.0
- **作成日**: 2024年
- **作成者**: ドキュメントエージェント (DOC)
- **目的**: 開発環境のセットアップ手順を説明

---

## 目次

1. [前提条件](#前提条件)
2. [必要なソフトウェア](#必要なソフトウェア)
3. [セットアップ手順](#セットアップ手順)
4. [動作確認](#動作確認)
5. [トラブルシューティング](#トラブルシューティング)

---

## 前提条件

### 必要な知識

- 基本的なコマンドライン操作
- Gitの基本的な使用方法
- Node.jsとnpmの基本操作
- Rustの基本的な知識（オプション）

---

## 必要なソフトウェア

### 必須ソフトウェア

#### 1. Node.js (v18以上)

**Windows**:
1. [Node.js公式サイト](https://nodejs.org/)からLTS版をダウンロード
2. インストーラーを実行してインストール
3. インストール後、コマンドプロンプトまたはPowerShellで確認:
   ```bash
   node --version
   npm --version
   ```

**macOS**:
```bash
# Homebrewを使用する場合
brew install node
```

**Linux**:
```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Fedora/RHEL
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo dnf install -y nodejs
```

#### 2. Rust (v1.70以上)

**Windows**:
1. [Rust公式サイト](https://www.rust-lang.org/tools/install)からインストーラーをダウンロード
2. `rustup-init.exe`を実行
3. インストール後、コマンドプロンプトまたはPowerShellで確認:
   ```bash
   rustc --version
   cargo --version
   ```

**macOS/Linux**:
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
```

#### 3. Tauri CLI

```bash
npm install -g @tauri-apps/cli
```

または、プロジェクトローカルにインストール（推奨）:
```bash
npm install --save-dev @tauri-apps/cli
```

#### 4. Git

**Windows**:
- [Git for Windows](https://git-scm.com/download/win)からダウンロード・インストール

**macOS**:
```bash
brew install git
```

**Linux**:
```bash
# Ubuntu/Debian
sudo apt-get install git

# Fedora/RHEL
sudo dnf install git
```

### オプションソフトウェア

#### Visual Studio Code (推奨)

- [VS Code公式サイト](https://code.visualstudio.com/)からダウンロード
- 推奨拡張機能:
  - Rust Analyzer
  - Tauri Extension
  - ESLint
  - Prettier

---

## セットアップ手順

### ステップ1: リポジトリのクローン

```bash
git clone <repository-url>
cd FLLM
```

### ステップ2: 依存関係のインストール

#### フロントエンド依存関係

```bash
npm install
```

#### Rust依存関係（自動）

Rust依存関係は、初回ビルド時に自動的にインストールされます。

### ステップ3: 環境変数の設定（オプション）

`.env`ファイルを作成（必要に応じて）:

```bash
cp .env.example .env
```

### ステップ4: データベースの初期化

データベースは初回実行時に自動的に初期化されます。

---

## 動作確認

### 開発モードでの起動

```bash
npm run tauri dev
```

正常に起動すると、Tauriアプリケーションのウィンドウが表示されます。

### ビルド確認

```bash
npm run build
```

### テスト実行

```bash
# 全テスト実行
npm test

# ウォッチモード
npm run test:watch

# カバレッジレポート生成
npm run test:coverage
```

---

## トラブルシューティング

### 問題1: Node.jsが見つからない

**エラーメッセージ**: `'node' は、内部コマンドまたは外部コマンド、操作可能なプログラムまたはバッチ ファイルとして認識されていません。`

**解決方法**:
1. Node.jsが正しくインストールされているか確認
2. 環境変数PATHにNode.jsのパスが含まれているか確認
3. コマンドプロンプトまたはPowerShellを再起動

### 問題2: Rustが見つからない

**エラーメッセージ**: `error: linker 'cc' not found`

**解決方法（Windows）**:
1. Visual Studio Build Toolsをインストール
2. または、Microsoft C++ Build Toolsをインストール

**解決方法（Linux）**:
```bash
sudo apt-get install build-essential
```

### 問題3: Tauriビルドエラー

**エラーメッセージ**: `Failed to bundle application`

**解決方法**:
1. `src-tauri/target`ディレクトリを削除して再ビルド
2. キャッシュをクリア:
   ```bash
   npm run tauri clean
   ```

### 問題4: ポート番号が既に使用されている

**エラーメッセージ**: `Port 5173 is already in use`

**解決方法**:
1. 他のプロセスがポートを使用している場合は終了
2. Viteの設定ファイルでポート番号を変更

---

## 次のステップ

セットアップが完了したら、以下を参照してください:

- [プロジェクト構造の説明](./PROJECT_STRUCTURE.md)
- [開発ガイド](./DEVELOPER_GUIDE.md)
- [コントリビューションガイド](./CONTRIBUTING.md)

---

## 参考リンク

- [Tauri公式ドキュメント](https://tauri.app/)
- [Rust公式ドキュメント](https://www.rust-lang.org/learn)
- [React公式ドキュメント](https://react.dev/)

---

**このドキュメントについて質問がある場合は、Issueを作成してください。**

