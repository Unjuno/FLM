# プライバシー監査レポート V2（詳細版）

**プロジェクト名**: FLM (Local LLM API Manager)  
**監査日**: 2025年1月（再監査）  
**バージョン**: 1.0.0  
**監査者**: AI アシスタント  
**監査範囲**: コードベース全体の詳細分析

---

## エグゼクティブサマリー

本レポートは、FLMアプリケーションのプライバシーに関する詳細な再監査結果をまとめたものです。前回の監査を基に、実際のコード実装を詳細に分析し、新たに発見された問題点と改善提案を提示します。

### 総合評価

**プライバシー保護レベル**: ⚠️ **中程度（前回と同様）**

### 新たに発見された重要な問題

1. **デバイスIDの外部送信**: リモート同期時にデバイスIDが外部サービスに送信される
2. **コンソールログの過剰出力**: 本番環境でも多くのログが出力される可能性
3. **設定データの完全なエクスポート**: APIキー以外の設定が暗号化されずにエクスポートされる可能性
4. **OAuthトークンの保存方法**: トークンの暗号化保存が確認できない

---

## 1. 暗号化実装の詳細分析

### 1.1 APIキーの暗号化（✅ 良好）

**ファイル**: `src-tauri/src/database/encryption.rs`

#### 実装詳細
- **暗号化方式**: AES-256-GCM
- **キー管理**: 
  - **優先**: OSキーストア（Windows Credential Manager、macOS Keychain、Linux Secret Service）
  - **フォールバック**: ファイルシステム（`encryption_key.bin`）
- **Nonce**: 毎回ランダム生成（12バイト）
- **エンコーディング**: Base64

#### 評価: ✅ **優秀**
- OSキーストアを優先的に使用している
- フォールバック機能が適切に実装されている
- 暗号化方式は業界標準

#### 改善提案
- キーローテーション機能の追加（現在は実装されていない）
- キーストア移行時の古いキーファイル削除の確実性向上

### 1.2 OAuthトークンの保存

**ファイル**: `src-tauri/src/commands/oauth.rs`

#### 現状
- OAuthトークンは`OAuthTokenOutput`として返されるが、保存場所が不明確
- データベースに保存される可能性があるが、暗号化の有無が確認できない

#### 評価: ⚠️ **要確認**
- **推奨事項**:
  - OAuthトークンの保存場所を明確に文書化
  - トークンの暗号化保存を実装（APIキーと同様）
  - OSキーストアの使用を検討

---

## 2. リモート同期機能の詳細分析

### 2.1 エクスポートされるデータ

**ファイル**: `src-tauri/src/utils/remote_sync.rs`

#### エクスポート内容
```rust
let export_data = serde_json::json!({
    "apis": apis,  // API設定情報（APIキーは含まれない）
    "exported_at": chrono::Utc::now().to_rfc3339(),
    "version": "1.0.0",
});
```

#### 評価: ⚠️ **改善推奨**
- **良い点**: APIキーはエクスポートされない
- **懸念点**:
  - API名、モデル名、ポート番号などの設定情報が含まれる
  - デバイスIDが外部サービスに送信される
  - エクスポート前に機密情報のマスク処理がない

#### 推奨事項
- エクスポート前に機密情報をマスク
- ユーザーに明示的な同意を取得
- エクスポート内容のプレビュー機能

### 2.2 デバイスIDの使用

#### 現状
- UUID v4で生成されるデバイスIDが以下で使用される:
  - GitHub Gistの説明文: `"FLM Settings Sync - {device_id}"`
  - Google Driveファイル名: `"flm_settings_{device_id}.json"`
  - Dropboxファイルパス: `"/flm_settings_{device_id}.json"`

#### 評価: ⚠️ **中程度のリスク**
- **懸念点**:
  - デバイスIDが外部サービスのメタデータに含まれる
  - デバイスIDからユーザーを特定できる可能性は低いが、追跡に使用される可能性
- **推奨事項**:
  - デバイスIDの使用目的を明確に文書化
  - ユーザーにデバイスIDの使用について通知
  - オプトアウト機能の提供

### 2.3 リモート同期のプライバシー設定

#### 現状
- GitHub Gist: `"public": false` で非公開設定
- Google Drive: ファイルの共有設定が不明確
- Dropbox: ファイルの共有設定が不明確

#### 評価: ⚠️ **改善推奨**
- **推奨事項**:
  - すべてのクラウドプロバイダーで非公開設定を確認
  - ユーザーに同期先のプライバシー設定を明示
  - 同期前にユーザーに確認ダイアログを表示

---

## 3. ログ記録の詳細分析

### 3.1 リクエストログ

**ファイル**: `src/backend/auth/server.ts`

#### 保存される情報
- HTTPメソッド、パス
- リクエストボディ（10KB以下、マスク処理あり）
- レスポンスステータス、レスポンス時間
- エラーメッセージ
- タイムスタンプ

#### マスク処理の実装
```typescript
const sensitiveFields = [
  'api_key', 'apiKey', 'apikey',
  'password', 'passwd', 'pwd',
  'token', 'access_token', 'refresh_token',
  'secret', 'secret_key', 'private_key',
  'authorization',
];
```

#### 評価: ⚠️ **改善推奨**
- **良い点**: 基本的な機密情報はマスクされている
- **改善点**:
  - メールアドレス、電話番号、クレジットカード番号などの個人情報がマスクされていない
  - IPアドレスのログ記録が確認できない（良い点）
  - ログ保存期間の設定がない

### 3.2 コンソールログ

#### 発見されたログ出力
- **TypeScript/JavaScript**: 137箇所の`console.log/warn/error`呼び出し
- **Rust**: 45箇所の`eprintln!`呼び出し

#### 評価: ⚠️ **要改善**
- **懸念点**:
  - 本番環境でも多くのログが出力される可能性
  - エラーログに機密情報が含まれる可能性
  - ログレベルによる制御が不十分

#### 推奨事項
- 本番環境では`console.log`を無効化
- ログレベルの設定機能を追加
- 機密情報を含むログの出力を避ける
- 構造化ログの導入を検討

### 3.3 デバッグログ

**ファイル**: `src-tauri/src/lib.rs`

#### 実装
```rust
#[cfg(debug_assertions)]
macro_rules! debug_log {
    ($($arg:tt)*) => {
        eprintln!("[DEBUG] {}", format!($($arg)*));
    };
}

#[cfg(not(debug_assertions))]
macro_rules! debug_log {
    ($($arg:tt)*) => {};
}
```

#### 評価: ✅ **良好**
- デバッグビルドでのみログが出力される
- リリースビルドでは無効化される

---

## 4. データベースのプライバシー

### 4.1 データベースファイルの場所

#### 現状
- SQLiteデータベースファイルがアプリケーションデータディレクトリに保存される
- ファイルパーミッションの設定が不明確

#### 評価: ⚠️ **改善推奨**
- **推奨事項**:
  - データベースファイルのパーミッション設定を確認
  - Windows: 適切なACL設定
  - macOS/Linux: ファイルパーミッションを600に設定
  - データベース全体の暗号化を検討（SQLCipher）

### 4.2 データベースの整合性チェック

**ファイル**: `src-tauri/src/commands/database.rs`

#### 実装
- データベース整合性チェック機能が実装されている
- 自動修正機能も実装されている

#### 評価: ✅ **良好**
- データの整合性が保たれる

---

## 5. ネットワーク通信の詳細分析

### 5.1 Content Security Policy (CSP)

**ファイル**: `src-tauri/tauri.conf.json`

#### 設定
```json
"csp": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' http://localhost:11434 http://localhost:1420 https://api.github.com https://huggingface.co https://*.huggingface.co; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests;"
```

#### 評価: ✅ **適切**
- 外部接続先が明確に制限されている
- HTTPSへのアップグレードが強制されている

### 5.2 外部API通信

#### 確認された外部接続先
1. **GitHub API** (`https://api.github.com`)
   - 用途: アップデートチェック、Gist同期
   - 評価: ✅ 問題なし

2. **Hugging Face** (`https://huggingface.co`, `https://*.huggingface.co`)
   - 用途: モデル取得
   - 評価: ✅ 問題なし

3. **Google Drive API** (`https://www.googleapis.com`)
   - 用途: リモート同期
   - 評価: ⚠️ OAuth認証の確認が必要

4. **Dropbox API** (`https://content.dropboxapi.com`)
   - 用途: リモート同期
   - 評価: ⚠️ OAuth認証の確認が必要

#### 評価: ⚠️ **改善推奨**
- すべての外部通信でHTTPSが使用されている（✅）
- OAuth認証の実装詳細を確認する必要がある

---

## 6. 新たに発見された問題点

### 6.1 設定データのエクスポート

#### 問題
- `export_settings_for_remote()`関数で、API設定情報が暗号化されずにエクスポートされる
- APIキーは含まれないが、他の設定情報が含まれる

#### リスクレベル: 🟡 中
- **推奨事項**:
  - エクスポート前に機密情報をマスク
  - エクスポート内容のプレビュー機能
  - ユーザーへの明示的な同意取得

### 6.2 デバイスIDの追跡可能性

#### 問題
- デバイスIDが外部サービスのメタデータに含まれる
- 複数のデバイス間で同じデバイスIDが使用される可能性

#### リスクレベル: 🟡 中
- **推奨事項**:
  - デバイスIDの使用目的を明確に文書化
  - ユーザーへの通知
  - オプトアウト機能

### 6.3 コンソールログの過剰出力

#### 問題
- 本番環境でも多くの`console.log`が出力される可能性
- エラーログに機密情報が含まれる可能性

#### リスクレベル: 🟡 中
- **推奨事項**:
  - 本番環境でのログレベル制御
  - ログ出力の構造化
  - 機密情報のマスク

---

## 7. 前回の監査からの改善状況

### 7.1 改善された点

1. **暗号化実装の確認**: OSキーストアの使用が確認された（✅）
2. **デバッグログの制御**: リリースビルドで無効化される（✅）

### 7.2 依然として改善が必要な点

1. **リクエストログの管理**: ログ保存期間の設定がない（⚠️）
2. **データ保持期間**: 不明確（⚠️）
3. **プライバシーポリシー**: 未作成（⚠️）
4. **OAuthトークンの保存**: 暗号化の有無が不明確（⚠️）

---

## 8. 優先度別改善提案（更新版）

### 🔴 高優先度（即座に対応すべき項目）

1. **OAuthトークンの暗号化保存**
   - トークンの保存場所を確認
   - APIキーと同様の暗号化を実装

2. **コンソールログの制御**
   - 本番環境でのログレベル設定
   - 機密情報のログ出力を避ける

3. **プライバシーポリシーの作成**
   - データ収集・使用・保存に関する明確な説明
   - デバイスIDの使用目的の明記

### 🟡 中優先度（近い将来に対応すべき項目）

1. **リクエストログの改善**
   - ログ保存期間の設定機能
   - 自動ログ削除機能
   - マスク処理の強化（メールアドレス、電話番号など）

2. **リモート同期の改善**
   - エクスポート前の機密情報マスク
   - ユーザーへの明示的な同意取得
   - 同期先のプライバシー設定の確認

3. **データ保持期間の明確化**
   - データ保持期間の設定機能
   - 自動削除機能の実装

### 🟢 低優先度（長期的に対応すべき項目）

1. **データベースの暗号化**
   - SQLCipherなどの使用を検討

2. **デバイスIDの改善**
   - オプトアウト機能の提供
   - デバイスIDの使用目的の明確化

---

## 9. コード実装の推奨事項

### 9.1 OAuthトークンの暗号化保存

```rust
// src-tauri/src/database/encryption.rs に追加
pub fn encrypt_oauth_token(token: &str) -> Result<String, AppError> {
    // APIキーと同様の暗号化処理を使用
    encrypt_api_key(token)
}

pub fn decrypt_oauth_token(encrypted: &str) -> Result<String, AppError> {
    // APIキーと同様の復号化処理を使用
    decrypt_api_key(encrypted)
}
```

### 9.2 ログレベルの制御

```typescript
// src/utils/logger.ts に追加
const LOG_LEVEL = process.env.NODE_ENV === 'production' 
  ? 'error' 
  : 'debug';

export function log(level: 'debug' | 'info' | 'warn' | 'error', message: string, ...args: any[]) {
  if (shouldLog(level)) {
    console[level](message, ...args);
  }
}
```

### 9.3 エクスポート前のマスク処理

```rust
// src-tauri/src/utils/remote_sync.rs に追加
fn mask_sensitive_settings(settings: &str) -> Result<String, AppError> {
    // 機密情報をマスクしてからエクスポート
    // ...
}
```

---

## 10. 結論

### 総合評価

- **暗号化実装**: ✅ 優秀（OSキーストアの使用）
- **データ収集**: ⚠️ 中程度のリスク（ログ管理の改善が必要）
- **データ保存**: ⚠️ 中程度のリスク（OAuthトークンの暗号化が必要）
- **データ送信**: ⚠️ 中程度のリスク（リモート同期の改善が必要）
- **ユーザーコントロール**: ⚠️ 改善が必要（プライバシー設定の追加）

### 前回監査との比較

- **改善された点**: 暗号化実装の詳細が確認された
- **新たに発見された問題**: デバイスIDの追跡可能性、コンソールログの過剰出力
- **依然として改善が必要**: ログ管理、データ保持期間、プライバシーポリシー

### 次のステップ

1. 高優先度項目の実装（OAuthトークンの暗号化、ログ制御）
2. プライバシーポリシーの作成
3. ユーザーへの通知と同意取得
4. 定期的な監査の実施（3ヶ月ごと推奨）

---

## 付録

### A. 確認したファイル一覧（詳細版）

#### Rust実装
- `src-tauri/src/database/encryption.rs` - 暗号化実装（✅ 優秀）
- `src-tauri/src/commands/database.rs` - データベース操作
- `src-tauri/src/commands/oauth.rs` - OAuth認証（⚠️ 改善必要）
- `src-tauri/src/utils/remote_sync.rs` - リモート同期（⚠️ 改善必要）
- `src-tauri/src/utils/audit_log.rs` - 監査ログ
- `src-tauri/src/lib.rs` - メインライブラリ（✅ デバッグログ制御良好）

#### TypeScript実装
- `src/backend/auth/server.ts` - 認証サーバー、リクエストログ（⚠️ ログ制御改善必要）
- `src/backend/auth/database.ts` - データベース操作
- `src/utils/logger.ts` - ロガー（⚠️ ログレベル制御改善必要）

#### 設定ファイル
- `src-tauri/tauri.conf.json` - Tauri設定、CSPポリシー（✅ 適切）
- `DOCKS/DATABASE_SCHEMA.sql` - データベーススキーマ

### B. 外部サービス一覧（詳細版）

1. **GitHub API** (`https://api.github.com`)
   - 用途: アップデートチェック、Gist同期
   - 送信データ: アプリケーション名、バージョン、設定データ（Gist）
   - プライバシーリスク: 低（技術情報のみ）

2. **Hugging Face API** (`https://huggingface.co`, `https://*.huggingface.co`)
   - 用途: モデル取得
   - 送信データ: モデル名、ダウンロードリクエスト
   - プライバシーリスク: 低（技術情報のみ）

3. **Google Drive API** (`https://www.googleapis.com`)
   - 用途: リモート同期
   - 送信データ: 設定データ、デバイスID
   - プライバシーリスク: 中（設定データが含まれる）

4. **Dropbox API** (`https://content.dropboxapi.com`)
   - 用途: リモート同期
   - 送信データ: 設定データ、デバイスID
   - プライバシーリスク: 中（設定データが含まれる）

### C. ログ出力の統計

- **TypeScript/JavaScript**: 137箇所の`console.log/warn/error`
- **Rust**: 45箇所の`eprintln!`
- **デバッグログ**: リリースビルドで無効化（✅）

---

**レポート作成日**: 2025年1月（再監査）  
**次回監査推奨日**: 2025年4月（3ヶ月後）  
**監査方法**: コードベース全体の詳細分析、実装コードの確認

