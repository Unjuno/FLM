# 厳格セキュリティ監査レポート

> Status: 🔴 Critical Issues Found | Date: 2025-01-27 | Phase: Strict Security Audit

## 監査概要

本レポートは、FLMプロキシサーバー（`crates/flm-proxy`）に対する厳格なセキュリティ監査の結果です。既存の監査レポートを踏まえ、より深い分析と追加の問題点を特定しました。

## 監査範囲

1. **認証・認可の実装詳細**
2. **タイミング攻撃対策**
3. **入力検証の完全性**
4. **エラーハンドリングと情報漏洩**
5. **リソース管理とDoS対策**
6. **ストリーミング処理のセキュリティ**
7. **ログ出力と監査証跡**
8. **並行処理と競合状態**

## 🔴 重大な問題（即座に対応が必要）

### 1. タイミング攻撃の脆弱性（Critical）

**問題**: APIキー検証で早期リターンによりタイミング情報が漏洩

**発見箇所**: 
```258:275:crates/flm-core/src/services/security.rs
pub async fn verify_api_key(&self, plain_key: &str) -> Result<Option<ApiKeyRecord>, RepoError> {
    let records = self.repo.list_active_api_keys().await?;
    
    for record in records {
        if verify_api_key_hash(plain_key, &record.hash)? {
            return Ok(Some(record));  // ⚠️ 早期リターン
        }
    }
    
    Ok(None)
}
```

**影響**:
- 有効なAPIキーの存在を推測可能
- キーの位置によって検証時間が異なる
- 大量のリクエストでキーリストの順序を推測可能

**攻撃シナリオ**:
1. 攻撃者が大量の無効なキーでリクエストを送信
2. レスポンス時間を測定
3. キーの位置を特定（最初のキーは速く、最後のキーは遅い）
4. 有効なキーの存在を推測

**推奨修正**:
```rust
pub async fn verify_api_key(&self, plain_key: &str) -> Result<Option<ApiKeyRecord>, RepoError> {
    let records = self.repo.list_active_api_keys().await?;
    
    // すべてのキーを検証（タイミング攻撃対策）
    let mut matched_record: Option<ApiKeyRecord> = None;
    for record in records {
        // 常にすべてのキーを検証（定数時間）
        if verify_api_key_hash(plain_key, &record.hash)? {
            matched_record = Some(record.clone());
        }
    }
    
    // すべての検証が完了してから結果を返す
    Ok(matched_record)
}
```

**代替案（パフォーマンス重視）**:
- ハッシュインデックスを使用して直接検索
- APIキーのハッシュを計算してDBで直接検索

**関連ファイル**:
- `crates/flm-core/src/services/security.rs:258-275`

**推定工数**: 4-6時間（テスト含む）

---

### 2. エラーメッセージからの情報漏洩（High）

**問題**: `eprintln!`で詳細なエラー情報を出力しており、ログファイルから情報が漏洩する可能性

**発見箇所**:
```1031:1058:crates/flm-proxy/src/controller.rs
eprintln!("ERROR: Engine not found: {}", engine_id);
eprintln!("ERROR: Network error starting stream: {}", reason);
eprintln!("ERROR: Invalid response starting stream: {}", reason);
eprintln!("ERROR: API error starting stream: {}", reason);
eprintln!("ERROR: Unknown error starting stream: {:?}", e);
```

**影響**:
- ログファイルに機密情報が記録される
- エンジンID、ネットワークエラーの詳細が漏洩
- 攻撃者が内部構造を推測可能

**推奨修正**:
1. 構造化ログ（`tracing`）を使用
2. 機密情報をマスク（IPアドレス、エンジンID等）
3. ログレベルを適切に設定
4. 本番環境では詳細エラーを出力しない

```rust
// 修正例
use tracing::{error, warn};

// 機密情報をマスク
let masked_engine_id = mask_identifier(&engine_id);
error!(engine_id = %masked_engine_id, "Engine not found");

// または、エラーの種類のみ記録
error!(error_type = "engine_not_found", "Engine lookup failed");
```

**関連ファイル**:
- `crates/flm-proxy/src/controller.rs` (17箇所)
- `crates/flm-proxy/src/middleware.rs` (4箇所)
- `crates/flm-proxy/src/engine_repo.rs` (2箇所)
- `crates/flm-proxy/src/adapters.rs` (1箇所)

**推定工数**: 8-12時間（ログシステムの導入含む）

---

### 3. レート制限の永続化不足（High）

**問題**: レート制限の状態がメモリ内のみに保存されており、サーバー再起動時にリセットされる

**発見箇所**:
```349:389:crates/flm-proxy/src/middleware.rs
async fn check_rate_limit_with_info(
    state: &AppState,
    api_key_id: &str,
    _rpm: u32,
    burst: u32,
) -> (bool, u32, std::time::SystemTime) {
    let mut rate_limit_state = state.rate_limit_state.write().await;
    // メモリ内のみの状態管理
}
```

**影響**:
- サーバー再起動でレート制限がリセット
- 分散環境でレート制限が機能しない
- データベースに`rate_limit_states`テーブルが定義されているが未使用

**推奨修正**:
1. データベースにレート制限状態を永続化
2. または、Redis等の外部ストアを使用
3. メモリキャッシュとDBのハイブリッド方式

**関連ファイル**:
- `crates/flm-proxy/src/middleware.rs:349-389`
- `crates/flm-core/migrations/` (rate_limit_statesテーブル定義)

**推定工数**: 12-16時間（DB統合含む）

---

### 4. ストリーミングエンドポイントのタイムアウト不足（High）

**問題**: ストリーミングエンドポイント（`/v1/chat/completions`）にタイムアウトが設定されていない

**発見箇所**:
```268:281:crates/flm-proxy/src/controller.rs
// Create separate router for streaming endpoint (no timeout)
let streaming_router = Router::new()
    .route("/v1/chat/completions", post(handle_chat_completions))
    // ⚠️ タイムアウトミドルウェアが適用されていない
```

**影響**:
- 長時間実行されるストリームでリソースが枯渇
- クライアントが切断してもストリームが継続
- DoS攻撃のリスク

**推奨修正**:
```rust
// ストリーミング用の長いタイムアウトを設定（例: 30分）
.layer(tower::timeout::TimeoutLayer::new(Duration::from_secs(1800)))
// または、ストリームの最大継続時間を制限
```

**関連ファイル**:
- `crates/flm-proxy/src/controller.rs:268-281`

**推定工数**: 2-3時間

---

### 5. expect()の使用によるパニックリスク（Medium-High）

**問題**: `expect()`が使用されており、パニックのリスクがある

**発見箇所**:
```273:273:crates/flm-proxy/src/middleware.rs
.expect("127.0.0.1 is a valid IP address")
```

**影響**:
- 理論的には発生しないが、並行処理やバグでパニックの可能性
- サーバーが予期せずクラッシュ

**推奨修正**:
```rust
// 修正前
.unwrap_or_else(|| {
    "127.0.0.1"
        .parse()
        .expect("127.0.0.1 is a valid IP address")
})

// 修正後
.unwrap_or_else(|| {
    "127.0.0.1"
        .parse()
        .unwrap_or_else(|_| {
            // ログを出力してデフォルトIPを返す
            eprintln!("CRITICAL: Failed to parse 127.0.0.1, this should never happen");
            std::net::IpAddr::V4(std::net::Ipv4Addr::new(127, 0, 0, 1))
        })
})
```

**関連ファイル**:
- `crates/flm-proxy/src/middleware.rs:273`

**推定工数**: 1時間

---

## 🟡 中優先度の問題（短期対応推奨）

### 6. CORS設定のデフォルト動作（Medium）

**問題**: ポリシーが存在しない場合、デフォルトで`permissive()`が使用される

**発見箇所**:
```315:383:crates/flm-proxy/src/controller.rs
// Default: allow all
TowerCorsLayer::permissive()
```

**影響**:
- 設定ミス時にすべてのオリジンを許可
- セキュリティポリシーの意図と異なる動作

**推奨修正**:
- デフォルトは`deny all`に変更
- 明示的な設定が必要な場合のみ許可

**関連ファイル**:
- `crates/flm-proxy/src/controller.rs:315-383`

**推定工数**: 1-2時間

---

### 7. 入力検証の不完全性（Medium）

**問題**: 一部の入力検証が不十分

**発見箇所**:
```451:502:crates/flm-proxy/src/controller.rs
fn validate_engine_id(engine_id: &str) -> Result<(), &'static str> {
    // 基本的な検証のみ
}
```

**改善点**:
1. `temperature`の範囲チェック（0.0-2.0）が未実装
2. `max_tokens`の上限チェックが未実装
3. メッセージの`role`の検証が不十分（"tool"の検証）

**推奨修正**:
```rust
// temperatureの検証を追加
if let Some(temp) = req.temperature {
    if temp < 0.0 || temp > 2.0 {
        return Err("Temperature must be between 0.0 and 2.0");
    }
}

// max_tokensの上限を設定（例: 1,000,000）
if let Some(max) = req.max_tokens {
    if max > 1_000_000 {
        return Err("max_tokens exceeds maximum limit");
    }
}
```

**関連ファイル**:
- `crates/flm-proxy/src/controller.rs:435-502`

**推定工数**: 2-3時間

---

### 8. ストリーミングエラーの処理（Medium）

**問題**: ストリーミング中のエラーが適切にクライアントに通知されない可能性

**発見箇所**:
```1120:1142:crates/flm-proxy/src/controller.rs
Err(e) => {
    // エラーをログに出力するが、クライアントへの通知が不十分
    Err(axum::Error::new(std::io::Error::other(error_msg)))
}
```

**影響**:
- クライアントがエラーを検知できない
- ストリームが突然終了する可能性

**推奨修正**:
- エラーイベントをSSE形式で送信
- クライアントに適切なエラーメッセージを送信

**関連ファイル**:
- `crates/flm-proxy/src/controller.rs:1120-1142`

**推定工数**: 3-4時間

---

### 9. データベース接続プールのサイズ（Low-Medium）

**問題**: 接続プールサイズが5に固定されており、高負荷時にボトルネックになる可能性

**発見箇所**:
```40:42:crates/flm-proxy/src/adapters.rs
let pool = SqlitePoolOptions::new()
    .max_connections(5)  // 固定値
```

**推奨修正**:
- 環境変数や設定ファイルから読み込む
- デフォルト値を適切に設定（例: 10-20）

**関連ファイル**:
- `crates/flm-proxy/src/adapters.rs:40-42`

**推定工数**: 1-2時間

---

## 🟢 低優先度（長期的改善）

### 10. 監査ログの未実装（Low）

**問題**: `audit_logs`テーブルは定義されているが、実際の記録機能は未実装

**影響**:
- セキュリティイベントの追跡ができない
- コンプライアンス要件を満たせない

**推奨修正**:
- 監査ログ記録機能を実装
- 重要な操作（APIキー作成、削除、ポリシー変更）を記録

**推定工数**: 16-24時間

---

### 11. 構造化ログの未実装（Low）

**問題**: `eprintln!`を使用した簡易的なログ出力のみ

**推奨修正**:
- `tracing`クレートを使用した構造化ログを実装
- ログレベル、フィルタリング、出力先の設定

**推定工数**: 8-12時間

---

## 既に実装されているセキュリティ対策（確認済み）

### ✅ 実装済み

1. **SQLインジェクション対策** ✅
   - すべてのSQLクエリでパラメータ化クエリを使用
   - `sqlx`の型安全なクエリビルダーを使用

2. **APIキーのハッシュ化** ✅
   - Argon2を使用したハッシュ化
   - 平文は作成時のみ返却

3. **セキュリティヘッダー** ✅
   - X-Content-Type-Options, X-Frame-Options, CSP等を設定
   - `add_security_headers`ミドルウェアで実装

4. **リクエストボディサイズ制限** ✅
   - 10MBの制限を設定
   - `DefaultBodyLimit::max(10 * 1024 * 1024)`

5. **同時接続数制限** ✅
   - 100接続の制限を設定
   - `ConcurrencyLimitLayer::new(100)`

6. **リクエストタイムアウト** ✅
   - 非ストリーミングエンドポイントに60秒のタイムアウト
   - `request_timeout_middleware`で実装

7. **入力検証** ✅（一部改善の余地あり）
   - `engine_id`, `model_name`, `messages`の検証を実装
   - サイズ制限を設定

8. **IPホワイトリスト** ✅
   - セキュリティポリシーに基づくIPホワイトリスト
   - CIDR記法をサポート

9. **X-Forwarded-For検証** ✅
   - 信頼できるプロキシのIPリストを設定可能
   - IPスプーフィング攻撃を防止

10. **データベースファイル権限** ✅
    - Unix系OSで`chmod 600`を設定
    - 機密情報の漏洩リスクを削減

---

## セキュリティスコア（厳格評価）

| カテゴリ | スコア | 状態 | 主要な問題 |
|---------|--------|------|-----------|
| 認証・認可 | 70% | ⚠️ 改善が必要 | タイミング攻撃の脆弱性 |
| 入力検証 | 85% | ✅ 良好 | 一部の検証が不十分 |
| エラーハンドリング | 60% | ⚠️ 改善が必要 | 情報漏洩のリスク |
| リソース管理 | 75% | ⚠️ 改善の余地あり | ストリーミングタイムアウト不足 |
| HTTPセキュリティ | 85% | ✅ 良好 | CORSデフォルト動作 |
| ログ・監査 | 40% | 🔴 改善が必要 | 構造化ログ未実装 |
| データ保護 | 90% | ✅ 良好 | - |
| 並行処理 | 80% | ✅ 良好 | expect()の使用 |

**総合スコア: 73% - 改善が必要**

---

## 推奨される修正順序

### Phase 1: 緊急修正（1週間以内）

1. **タイミング攻撃の修正**（Critical）
   - すべてのAPIキーを検証してから結果を返す
   - または、ハッシュインデックスを使用

2. **エラーメッセージのマスク**（High）
   - 構造化ログの導入
   - 機密情報のマスク処理

3. **ストリーミングタイムアウト**（High）
   - ストリーミングエンドポイントにタイムアウトを設定

### Phase 2: 短期修正（1ヶ月以内）

4. **レート制限の永続化**（High）
   - データベースへの永続化
   - または、Redis等の外部ストア

5. **expect()の修正**（Medium-High）
   - 適切なエラーハンドリングに置き換え

6. **CORSデフォルト動作**（Medium）
   - デフォルトを`deny all`に変更

7. **入力検証の強化**（Medium）
   - `temperature`, `max_tokens`の検証を追加

### Phase 3: 長期的改善（3ヶ月以内）

8. **監査ログの実装**（Low）
9. **構造化ログの実装**（Low）

---

## 結論

FLMプロキシサーバーは基本的なセキュリティ対策が実装されていますが、以下の重大な問題が発見されました：

1. **タイミング攻撃の脆弱性**（Critical）- 即座に対応が必要
2. **エラーメッセージからの情報漏洩**（High）- 早期対応が必要
3. **レート制限の永続化不足**（High）- 短期対応が必要
4. **ストリーミングタイムアウト不足**（High）- 短期対応が必要

これらの修正を実施することで、セキュリティレベルを大幅に向上させることができます。

---

**最終更新**: 2025-01-27  
**監査者**: Strict Security Audit  
**次回監査推奨日**: 2025-02-27（1ヶ月後、Phase 1修正後）

