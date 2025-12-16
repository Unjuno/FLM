# Hacker News 投稿準備ガイド
> Status: Reference | Audience: Project leads | Updated: 2025-02-01

## 1. 投稿タイミング

**Phase 3完了後（パッケージング完了、セキュリティ対策実装済み）に投稿する。**

### 1.1 投稿条件

必須条件:
- ✅ Phase 3完了（パッケージング完了）
- ✅ インストーラー配布可能（Windows/macOS/Linux）
- ✅ セキュリティ対策実装済み（コード署名、ハッシュ値公開、ビルド環境保護）
- ✅ `packaged-ca`モード実装済み（証明書自動インストール）
- ✅ 英語版README完成
- ✅ デモ動画/スクリーンショット準備済み

### 1.2 投稿しない理由（Phase 3未完了の場合）

- ❌ インストーラーがない → ユーザーがすぐ使えない
- ❌ セキュリティ対策未実装 → セキュリティリスクが高い
- ❌ 証明書の手動インストールが必要 → 大衆向けに使えない

## 2. 投稿内容

### 2.1 タイトル案

```
FLM: Self-hosted local LLM API manager with automatic security (Rust)
```

または

```
Show HN: FLM – One-click local LLM API creation with automatic HTTPS (Rust)
```

### 2.2 説明文案

```
FLM is a desktop application that lets you create and expose secure local LLM APIs without coding. Built with Rust, it automatically handles API key authentication, HTTPS certificates (ACME/Let's Encrypt or packaged CA), and firewall configuration. Supports Ollama, LM Studio, vLLM, and llama.cpp.

Key features:
- One-click API creation with automatic security setup
- OpenAI-compatible API endpoints
- Automatic HTTPS certificate management (ACME or packaged CA)
- Built-in firewall configuration wizard
- Multi-engine support (Ollama, LM Studio, vLLM, llama.cpp)

Currently in Phase 3 (packaging complete). Installers available for Windows, macOS, and Linux.

GitHub: [URL]
Website: [URL]
```

### 2.3 技術的な詳細

```
Tech stack:
- Core: Rust (Domain-driven design)
- UI: Tauri (React + Rust)
- Proxy: Axum/Hyper (Rust)
- Security: Argon2 (API key hashing), ACME (certificate management)
- Database: SQLite (config.db, security.db)

Architecture:
- Domain layer (pure logic, no I/O)
- Application layer (services)
- Adapter layer (CLI, UI, Proxy)

Security features:
- Code signing (Windows, macOS, Linux)
- SHA256 hash publication
- Build environment protection
- In-installer certificate verification
- Secure distribution channels
```

## 3. 必要な資料

### 3.1 必須資料

1. **英語版README** (`README_EN.md` - 将来作成予定)
   - プロジェクト説明
   - 特徴
   - 技術スタック
   - インストール方法
   - 現在の状態

2. **デモ動画/スクリーンショット**
   - インストール手順のスクリーンショット
   - UIのデモ動画（1-2分）
   - アーキテクチャ図

3. **インストーラーのダウンロードリンク**
   - Windows/macOS/Linux用インストーラー
   - ハッシュ値の公開

4. **セキュリティ情報**
   - コード署名の説明
   - ハッシュ値検証の手順
   - セキュリティ対策の説明

### 3.2 オプション資料

1. **技術ブログ記事**
   - Rust実装の詳細
   - アーキテクチャの説明
   - セキュリティ機能の説明

2. **ユースケース例**
   - 実際の使用例
   - ベータテスターの感想

## 4. 投稿手順

### 4.1 投稿前の確認

- [ ] Phase 3完了確認
- [ ] インストーラーの動作確認（Windows/macOS/Linux）
- [ ] セキュリティ対策の確認（コード署名、ハッシュ値）
- [ ] 英語版README完成
- [ ] デモ動画/スクリーンショット準備
- [ ] GitHubリポジトリ公開
- [ ] 公式サイト公開（オプション）

### 4.2 投稿内容の作成

1. **タイトル**: 上記のタイトル案から選択
2. **説明文**: 上記の説明文案を参考に作成
3. **URL**: GitHubリポジトリまたは公式サイト

### 4.3 投稿後の対応

1. **コメントへの対応**
   - 技術的な質問に回答
   - バグ報告に対応
   - 機能リクエストを記録

2. **トラフィック対応**
   - サーバー負荷の監視
   - ダウンロード数の確認
   - エラーログの確認

## 5. よくある質問への回答準備

### Q: セキュリティは大丈夫ですか？
A: コード署名、ハッシュ値公開、ビルド環境保護など、複数のセキュリティ対策を実装しています。詳細は `docs/specs/PROXY_SPEC.md` セクション10.6を参照してください。

### Q: どのOSで動作しますか？
A: Windows、macOS、Linuxで動作します。各OS用のインストーラーを提供しています。

### Q: どのLLMエンジンをサポートしていますか？
A: Ollama、LM Studio、vLLM、llama.cppをサポートしています。

### Q: オープンソースですか？
A: はい、MIT Licenseで公開しています。

### Q: どのようにインストールしますか？
A: 公式サイトからインストーラーをダウンロードし、実行するだけです。詳細はルートの `README.md` を参照してください。

## 6. 参考資料

- `docs/specs/PROXY_SPEC.md` セクション10.6 - パッケージングのセキュリティ対策
- `docs/guides/SECURITY_FIREWALL_GUIDE.md` セクション9 - セキュリティ検証手順
- `docs/planning/PLAN.md` - プロジェクト計画とフェーズ
- `docs/planning/diagram.md` - アーキテクチャ図

---

**注意**: Phase 3完了まで投稿しないこと。セキュリティ対策が未実装の状態で公開すると、ユーザーにリスクを与える可能性があります。

