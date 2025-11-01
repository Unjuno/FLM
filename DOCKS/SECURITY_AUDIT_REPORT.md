# FLM - セキュリティ監査レポート

## 文書情報

- **プロジェクト名**: FLM
- **監査日**: 2024年
- **監査範囲**: プロジェクト全体（仕様書、ドキュメント、設計）
- **監査者**: AIセキュリティ監査システム
- **ステータス**: 設計段階の監査

---

## 実行概要

### 監査目的
FLMプロジェクトのセキュリティ要件、設計、実装方針について包括的なセキュリティ監査を実施し、潜在的な脆弱性と改善点を特定する。

### 監査範囲
1. 認証・認可メカニズム
2. データ保護と暗号化
3. 入力検証とサニタイゼーション
4. 通信セキュリティ
5. 依存関係とサードパーティライブラリ
6. Webサイトセキュリティ
7. データベースセキュリティ

### 監査結果サマリー
- **総合評価**: ⚠️ **設計段階のため、実装後の再監査が必要**
- **発見事項**: 15件
  - 高リスク: 2件
  - 中リスク: 6件
  - 低リスク: 7件
- **推奨事項**: 9件

---

## 1. 認証・認可メカニズム

### 1.1 現在の設計

**実装方針**:
- Bearer Token認証（APIキー方式）
- 認証プロキシ（Express.js + express-http-proxy）
- APIキー生成（32文字ランダム）
- SQLiteへの暗号化保存

### 1.2 発見された問題

#### 🔴 高リスク: APIキーの生成・保存方法の詳細が不明確
**問題点**:
- APIキーの生成アルゴリズム（ランダム文字列の生成方法）が未定義
- 暗号化アルゴリズムとキー管理方法が未指定
- APIキーの有効期限・ローテーション機能が未実装

**推奨事項**:
```javascript
// 推奨実装例
const crypto = require('crypto');

// APIキー生成（cryptographically secure random）
function generateAPIKey() {
  return crypto.randomBytes(32).toString('base64url');
}

// ハッシュ化して保存（bcrypt推奨）
const bcrypt = require('bcrypt');
const hashedKey = await bcrypt.hash(apiKey, 10);
```

**アクション項目**:
- [ ] 暗号学的に安全な乱数生成器（`crypto.randomBytes`）の使用を必須化
- [ ] APIキーはハッシュ化して保存（平文保存の禁止）
- [ ] APIキーの有効期限機能を追加検討
- [ ] APIキーローテーション機能を追加検討

---

#### 🟡 中リスク: 認証プロキシの実装詳細が不足
**問題点**:
- 認証プロキシでのエラーハンドリング方針が未定義
- レート制限（Rate Limiting）機能が未実装
- 認証失敗時の詳細ログ取得方針が不明確

**推奨事項**:
```javascript
// 推奨実装例
const rateLimit = require('express-rate-limit');

// レート制限ミドルウェア
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分
  max: 100, // 最大100リクエスト
  message: 'Too many requests from this IP'
});

// 認証ミドルウェア
function authenticateRequest(req, res, next) {
  const apiKey = req.headers.authorization?.replace('Bearer ', '');
  if (!apiKey) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  // APIキー検証ロジック
}
```

**アクション項目**:
- [ ] レート制限機能の実装を必須化
- [ ] 認証失敗時の適切なエラーメッセージ（情報漏洩を防ぐ）
- [ ] 認証試行の監査ログ記録機能

---

#### 🟡 中リスク: セッション管理機能が未定義
**問題点**:
- Web UI（Tauriアプリ）とAPI間のセッション管理が未定義
- トークンリフレッシュ機能が未実装

**推奨事項**:
- Tauriアプリ内での認証トークン管理方針を明確化
- 必要に応じてJWTトークンの導入を検討

---

## 2. データ保護と暗号化

### 2.1 現在の設計

**実装方針**:
- SQLiteへのAPIキー暗号化保存
- ローカルデータベース（外部送信なし）

### 2.2 発見された問題

#### 🔴 高リスク: 暗号化実装の詳細が未定義
**問題点**:
- 使用する暗号化アルゴリズム（AES-256等）が未指定
- 暗号化キーの管理方法が未定義
- キー導出関数（KDF）の使用有無が不明確

**推奨事項**:
```javascript
// 推奨実装例
const crypto = require('crypto');

// 暗号化キーの生成（OSのキーチェーン/キーストア利用推奨）
// Windows: DPAPI, macOS: Keychain, Linux: Secret Service

function encryptAPIKey(apiKey, masterKey) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', masterKey, iv);
  const encrypted = Buffer.concat([cipher.update(apiKey, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return { encrypted, iv, authTag };
}
```

**アクション項目**:
- [ ] AES-256-GCMまたはAES-256-CBCの使用を必須化
- [ ] OSネイティブのキーストア（Windows DPAPI、macOS Keychain、Linux Secret Service）の利用
- [ ] IV（初期化ベクトル）の適切な生成と保存
- [ ] 暗号化キーのローテーション機能を検討

---

#### 🟡 中リスク: データベースアクセス制御が未定義
**問題点**:
- SQLiteデータベースファイルのアクセス権限設定が未定義
- データベースファイルのバックアップ・復元時のセキュリティが未検討

**推奨事項**:
- SQLiteファイルのアクセス権限を適切に設定（読み取り専用のユーザー権限）
- バックアップファイルも暗号化して保存
- データベースファイルの場所を適切に設定（ユーザーディレクトリ内の隠しフォルダ等）

---

## 3. 入力検証とサニタイゼーション

### 3.1 現在の設計

**実装方針**:
- 静的Webサイト（ユーザー入力が限定的）
- APIエンドポイントでの入力検証が必要

### 3.2 発見された問題

#### 🟡 中リスク: APIエンドポイントの入力検証方針が未定義
**問題点**:
- POST /v1/chat/completions での入力検証ルールが未定義
- SQLインジェクション対策（Ollama API経由の場合、リスクは低いが確認必要）
- XSS対策（Web UI側）

**推奨事項**:
```javascript
// 推奨実装例
const express = require('express');
const { body, validationResult } = require('express-validator');

app.post('/v1/chat/completions', 
  [
    body('model').trim().isLength({ min: 1, max: 100 }),
    body('messages').isArray().notEmpty(),
    body('messages.*.role').isIn(['user', 'assistant', 'system']),
    body('messages.*.content').trim().isLength({ max: 100000 })
  ],
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
);
```

**アクション項目**:
- [ ] 入力検証ライブラリ（express-validator等）の使用を必須化
- [ ] リクエストサイズの制限（body-parserのlimit設定）
- [ ] メッセージ配列の最大長・最大サイズの制限

---

#### 🟢 低リスク: WebサイトのXSS対策
**現状**:
- 仕様書にCSP（Content-Security-Policy）の設定が記載されている ✅

**改善点**:
```html
<!-- 推奨CSP設定（より厳格） -->
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; 
               script-src 'self' 'unsafe-inline'; 
               style-src 'self' 'unsafe-inline'; 
               img-src 'self' data: https:; 
               connect-src 'self'; 
               font-src 'self' https://fonts.gstatic.com;">
```

**アクション項目**:
- [ ] `unsafe-inline`を削除し、nonceまたはhashベースのCSPに変更（将来的に）
- [ ] 外部CDN使用時の適切なCSP設定

---

## 4. 通信セキュリティ

### 4.1 現在の設計

**実装方針**:
- HTTPS必須（Let's Encrypt等）
- ローカル通信（localhost）

### 4.2 発見された問題

#### 🟡 中リスク: ローカル通信のセキュリティ強化
**問題点**:
- localhost通信のセキュリティリスクが低いが、将来的な拡張に備えた方針が不明確
- 証明書ピニング（Certificate Pinning）の必要性が未検討

**推奨事項**:
- ローカル通信のみの場合、証明書ピニングは不要
- 将来的にリモートアクセス機能を追加する場合、TLS証明書の検証を必須化

---

#### 🟢 低リスク: WebサイトのHTTPS設定
**現状**:
- 仕様書にHTTPS必須が記載されている ✅
- GitHub Pagesは自動でHTTPS対応 ✅

**改善点**:
- HSTS（HTTP Strict Transport Security）ヘッダーの設定を推奨

```html
<!-- .htaccess またはサーバー設定 -->
<IfModule mod_headers.c>
  Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"
</IfModule>
```

---

#### 🟢 低リスク: 外部リンクのセキュリティ
**現状**:
- 仕様書に`rel="noopener noreferrer"`の設定が記載されている ✅

**確認事項**:
- 実装時に全ての外部リンクに適用されているか確認

---

## 5. 依存関係とサードパーティライブラリ

### 5.1 現在の設計

**使用予定のライブラリ**:
- Express.js (MIT)
- express-http-proxy (MIT)
- SQLite (Public Domain)
- Tauri (Apache-2.0 / MIT)
- Ollama (OSS)

### 5.2 発見された問題

#### 🟡 中リスク: 依存関係の脆弱性管理が未実装
**問題点**:
- 定期的な脆弱性スキャンの自動化が未定義
- 依存関係の更新プロセスが未明確化

**推奨事項**:
```json
// package.json にスクリプト追加
{
  "scripts": {
    "audit": "npm audit",
    "audit:fix": "npm audit fix",
    "deps:update": "npm update && npm audit"
  }
}
```

**アクション項目**:
- [ ] npm audit または Snyk をCI/CDパイプラインに組み込む
- [ ] 依存関係の更新を定期的（月1回等）に実施
- [ ] セキュリティアドバイザリの監視

---

#### 🟢 低リスク: ライセンス管理
**現状**:
- OSSライブラリのみを使用 ✅
- プロプライエタリサービス不使用 ✅

**確認事項**:
- ライセンス互換性の確認（特にTauriのApache-2.0/MITライセンス）

---

## 6. Webサイトセキュリティ

### 6.1 現在の設計

**実装方針**:
- 静的サイト（HTML/CSS/JavaScriptのみ）
- GitHub Pagesホスティング
- CSP設定

### 6.2 発見された問題

#### 🟢 低リスク: CSP設定の最適化
**現状**:
- CSP設定が仕様書に記載されている ✅

**改善点**:
- `unsafe-inline`の削除（将来的に）
- nonceまたはhashベースのCSPへの移行

---

#### 🟢 低リスク: セキュリティヘッダーの追加
**推奨事項**:
```html
<!-- 追加推奨ヘッダー -->
<meta http-equiv="X-Content-Type-Options" content="nosniff">
<meta http-equiv="X-Frame-Options" content="DENY">
<meta http-equiv="X-XSS-Protection" content="1; mode=block">
<meta http-equiv="Referrer-Policy" content="strict-origin-when-cross-origin">
```

---

## 7. データベースセキュリティ

### 7.1 現在の設計

**実装方針**:
- SQLite（ローカルファイルベース）
- 暗号化保存

### 7.2 発見された問題

#### 🟢 低リスク: SQLiteのセキュリティ設定
**推奨事項**:
- プリペアドステートメントの使用（SQLインジェクション対策）
- データベースファイルのパーミッション設定
- 定期的なバックアップ（暗号化済み）

---

## 8. ログと監視

### 8.1 発見された問題

#### 🟡 中リスク: セキュリティログの詳細が未定義
**問題点**:
- 認証失敗ログの記録方針が不明確
- 異常なアクセスパターンの検出機能が未実装
- ログの保持期間・ローテーション方針が未定義

**推奨事項**:
- 認証試行のログ記録（成功/失敗）
- レート制限違反のログ記録
- ログファイルの適切な権限設定
- ログの保持期間を設定（例: 90日）

---

## 9. 総合評価と優先度付きアクション項目

### 9.1 優先度：高（即座に対応が必要）

1. **APIキーの暗号学的に安全な生成とハッシュ化保存**
   - 実装段階で必須
   - 平文保存の絶対禁止

2. **暗号化アルゴリズムとキー管理方法の明確化**
   - AES-256-GCMの使用
   - OSネイティブキーストアの利用

### 9.2 優先度：中（実装前に設計を確定）

3. **レート制限機能の実装**
   - DDoS攻撃対策
   - ブルートフォース攻撃対策

4. **入力検証の実装**
   - express-validator等の使用
   - リクエストサイズ制限

5. **認証プロキシのエラーハンドリング**
   - 情報漏洩を防ぐエラーメッセージ
   - 適切なHTTPステータスコード

6. **セキュリティログの実装**
   - 認証試行の記録
   - 異常検知機能

7. **依存関係の脆弱性管理**
   - npm auditの自動化
   - 定期的な更新プロセス

### 9.3 優先度：低（改善推奨）

8. **CSP設定の最適化**
   - `unsafe-inline`の削除
   - nonce/hashベースへの移行

9. **セキュリティヘッダーの追加**
   - X-Content-Type-Options
   - X-Frame-Options
   - Referrer-Policy

---

## 10. セキュリティチェックリスト

### 実装前チェックリスト

- [ ] APIキー生成アルゴリズムの確定（crypto.randomBytes使用）
- [ ] 暗号化アルゴリズムの確定（AES-256-GCM推奨）
- [ ] キー管理方法の確定（OSネイティブキーストア）
- [ ] レート制限機能の設計
- [ ] 入力検証ルールの定義
- [ ] エラーハンドリング方針の確定
- [ ] ログ記録方針の確定

### 実装時チェックリスト

- [ ] APIキーは必ずハッシュ化して保存
- [ ] プリペアドステートメントの使用
- [ ] HTTPSの強制（Webサイト）
- [ ] CSPヘッダーの設定
- [ ] セキュリティヘッダーの設定
- [ ] 外部リンクに`rel="noopener noreferrer"`を設定
- [ ] 入力検証の実装
- [ ] レート制限の実装

### デプロイ前チェックリスト

- [ ] 依存関係の脆弱性スキャン（npm audit）
- [ ] セキュリティテストの実施
- [ ] ログ設定の確認
- [ ] アクセス権限の確認
- [ ] バックアップ・復元プロセスの確認

---

## 11. 推奨されるセキュリティテスト

### 実装後のテスト項目

1. **認証テスト**
   - 無効なAPIキーでのアクセス試行
   - APIキーなしでのアクセス試行
   - 有効期限切れAPIキーのテスト

2. **入力検証テスト**
   - 非常に長い文字列の送信
   - 特殊文字の送信
   - SQLインジェクション試行（リスク低いが確認）

3. **レート制限テスト**
   - 短時間での大量リクエスト送信
   - レート制限超過時の動作確認

4. **暗号化テスト**
   - データベースファイルの内容確認（暗号化されているか）
   - バックアップファイルの暗号化確認

5. **ログテスト**
   - 認証失敗時のログ記録確認
   - 異常アクセスの検知確認

---

## 12. 結論

### 総合評価

FLMプロジェクトは、**設計段階**において基本的なセキュリティ要件が仕様書に記載されているが、**実装の詳細が不足**している部分が多い。特に以下の点が重要：

1. **認証・認可**: APIキーの生成・保存方法の詳細定義が必要
2. **データ保護**: 暗号化アルゴリズムとキー管理方法の明確化が必要
3. **入力検証**: APIエンドポイントでの入力検証ルールの定義が必要
4. **監視・ログ**: セキュリティログの記録方針の確定が必要

### 次のステップ

1. **設計フェーズ**: 上記の高・中優先度の項目について、詳細設計を確定
2. **実装フェーズ**: セキュリティチェックリストに従って実装
3. **テストフェーズ**: セキュリティテストを実施
4. **デプロイフェーズ**: デプロイ前チェックリストを確認

### 継続的な改善

- 定期的なセキュリティ監査（四半期ごと推奨）
- 依存関係の定期的な更新
- セキュリティアドバイザリの監視
- セキュリティインシデント対応計画の策定

---

## 付録

### A. 参考資料

- メインプロジェクト仕様書: `SPECIFICATION.md`
- Webサイト仕様書: `DOCKS/公式サイト仕様書.md`
- コンセプトドキュメント: `CONCEPT.md`

### B. セキュリティリソース

- OWASP Top 10: https://owasp.org/www-project-top-ten/
- Node.js Security Best Practices: https://nodejs.org/en/docs/guides/security/
- Express.js Security Best Practices: https://expressjs.com/en/advanced/best-practice-security.html

---

**監査レポート終了**

