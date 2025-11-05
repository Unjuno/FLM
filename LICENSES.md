# FLM - 使用OSSライブラリ一覧

このドキュメントは、FLMプロジェクトで使用しているオープンソースソフトウェア（OSS）ライブラリとそのライセンス情報を記載しています。

最終更新日: 2024年

---

## フロントエンド（Node.js/TypeScript）

### コアライブラリ

| ライブラリ名 | バージョン | ライセンス | 用途 |
|------------|----------|----------|------|
| **@tauri-apps/api** | ^2 | MIT/Apache 2.0 | Tauri API通信 |
| **@tauri-apps/plugin-opener** | ^2 | MIT/Apache 2.0 | 外部アプリケーション起動 |
| **react** | ^19.1.0 | MIT | UIライブラリ |
| **react-dom** | ^19.1.0 | MIT | React DOMレンダリング |
| **react-router-dom** | ^7.9.5 | MIT | ルーティング |
| **recharts** | ^2.15.4 | MIT | チャート表示 |

### 開発ツール

| ライブラリ名 | バージョン | ライセンス | 用途 |
|------------|----------|----------|------|
| **@tauri-apps/cli** | ^2 | MIT/Apache 2.0 | Tauri CLI |
| **vite** | ^7.0.4 | MIT | ビルドツール |
| **typescript** | ~5.8.3 | Apache 2.0 | 型チェック |
| **eslint** | ^8.57.1 | MIT | リント |
| **prettier** | ^3.6.2 | MIT | コードフォーマッター |
| **jest** | ^29.7.0 | MIT | テストフレームワーク |

---

## バックエンド（Rust）

### コアライブラリ

| ライブラリ名 | バージョン | ライセンス | 用途 |
|------------|----------|----------|------|
| **tauri** | 2 | MIT/Apache 2.0 | デスクトップアプリフレームワーク |
| **tauri-plugin-opener** | 2 | MIT/Apache 2.0 | 外部アプリケーション起動 |
| **serde** | 1 | MIT/Apache 2.0 | シリアライゼーション |
| **serde_json** | 1 | MIT/Apache 2.0 | JSON処理 |
| **reqwest** | 0.11 | MIT/Apache 2.0 | HTTPクライアント |
| **tokio** | 1 | MIT | 非同期ランタイム |
| **rusqlite** | 0.31 | MIT | SQLiteデータベース |
| **chrono** | 0.4 | MIT/Apache 2.0 | 日時処理 |
| **uuid** | 1.0 | Apache 2.0/MIT | UUID生成 |
| **sha2** | 0.10 | MIT/Apache 2.0 | ハッシュ関数 |
| **aes-gcm** | 0.10 | MIT/Apache 2.0 | 暗号化 |
| **rand** | 0.8 | MIT/Apache 2.0 | 乱数生成 |
| **base64** | 0.22 | MIT/Apache 2.0 | Base64エンコーディング |
| **dirs** | 5.0 | MIT | ディレクトリパス取得 |
| **regex** | 1.10 | MIT/Apache 2.0 | 正規表現 |
| **rcgen** | 0.13 | MIT/Apache 2.0 | SSL証明書生成 |
| **sysinfo** | 0.27 | MIT | システムリソース情報取得 |
| **zip** | 0.6 | MIT | ZIPファイル処理 |
| **flate2** | 1.0 | MIT/Apache 2.0 | 圧縮 |
| **tar** | 0.4 | MIT/Apache 2.0 | TARファイル処理 |
| **futures-util** | 0.3 | Apache 2.0/MIT | 非同期ユーティリティ |
| **bytes** | 1.5 | MIT | バイト操作 |
| **hex** | 0.4 | MIT/Apache 2.0 | 16進数エンコーディング |

---

## 認証プロキシサーバー（Node.js）

### コアライブラリ

| ライブラリ名 | バージョン | ライセンス | 用途 |
|------------|----------|----------|------|
| **express** | ^4.18.2 | MIT | Webフレームワーク |
| **express-http-proxy** | ^2.0.0 | MIT | HTTPプロキシ |
| **cors** | ^2.8.5 | MIT | CORS対応 |
| **sqlite3** | ^5.1.7 | MIT | SQLiteデータベース（Node.js） |

---

## 外部依存（実行時）

### LLM実行エンジン

| ソフトウェア名 | ライセンス | 用途 | インストール方法 |
|-------------|----------|------|---------------|
| **Ollama** | MIT | ローカルLLM実行エンジン | 自動インストール（FLM内蔵）または手動インストール |
| **LM Studio** | プロプライエタリ | LLM実行エンジン（オプション） | 手動インストール |
| **vLLM** | Apache 2.0 | 高速LLM推論サーバー（オプション） | 手動インストール |
| **llama.cpp** | MIT | C++ LLM推論エンジン（オプション） | 手動インストール |

---

## 主要ライセンスの説明

### MIT License
最も緩いライセンスの一つ。商用利用、改変、配布が自由に行えます。ライセンス表示と著作権表示のみが必要です。

### Apache 2.0 License
MITと同様に緩いライセンスですが、特許保護が含まれています。Apache 2.0でライセンスされたコードを変更した場合は、変更箇所を明記する必要があります。

### BSD License
MITと同様に緩いライセンス。複数のバリエーションがありますが、一般的に商用利用可能です。

---

## ライセンス互換性

FLMプロジェクトは**MIT License**でライセンスされています。

使用しているすべてのOSSライブラリは、MIT Licenseと互換性があります：
- MIT License
- Apache 2.0 License
- BSD License

---

## 依存関係の管理

### フロントエンド
- **package.json**: Node.js依存関係を管理
- **npm/yarn**: パッケージマネージャー

### バックエンド
- **Cargo.toml**: Rust依存関係を管理
- **cargo**: Rustパッケージマネージャー

### 認証プロキシサーバー
- **src/backend/auth/package.json**: Node.js依存関係を管理

---

## セキュリティ

定期的に依存関係のセキュリティチェックを実施しています：
- `npm audit` (Node.js)
- `cargo audit` (Rust)

---

## OSSコミュニティへの貢献

FLMプロジェクトは以下のOSSプロジェクトに依存しており、これらのコミュニティに感謝します：

- **Tauri**: 軽量なデスクトップアプリケーションフレームワーク
- **React**: UIライブラリ
- **Ollama**: ローカルLLM実行環境
- **SQLite**: 軽量データベース
- **Express.js**: Webフレームワーク

---

## 更新履歴

- 2024年: 初版作成

---

## 参考リンク

- [Tauri License](https://github.com/tauri-apps/tauri/blob/dev/LICENSE)
- [React License](https://github.com/facebook/react/blob/main/LICENSE)
- [Ollama License](https://github.com/ollama/ollama/blob/main/LICENSE)
- [SQLite License](https://www.sqlite.org/copyright.html)

