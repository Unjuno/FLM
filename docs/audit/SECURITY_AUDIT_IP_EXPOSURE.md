# セキュリティ監査レポート: IP公開問題とセキュリティ脆弱性

> Status: ⚠️ Critical Issues Found | Date: 2025-01-27 | Phase: Security Audit | Run ID: security-audit-ip-exposure

## 1. 監査概要

- **監査対象**: FLMプロキシサーバーのセキュリティ実装（特にIP公開問題）
- **監査日**: 2025-01-27
- **監査者**: Security Audit System
- **ステータス**: ⚠️ 重大な問題を発見
- **関連ドキュメント**: 
  - `docs/specs/PROXY_SPEC.md` - プロキシ仕様
  - `docs/specs/CORE_API.md` - Core API仕様
  - `docs/guides/SECURITY_FIREWALL_GUIDE.md` - セキュリティガイド

## 2. 発見された問題

### 🔴 高優先度（即座対応必要）

#### 2.1 ネットワークバインド設定: VPN経由でもIPが公開される

**問題**: `crates/services/flm-proxy/src/controller.rs:211` で `0.0.0.0` にハードコードされており、すべてのネットワークインターフェース（VPN含む）でリッスンしている。

```211:211:crates/services/flm-proxy/src/controller.rs
    let addr = SocketAddr::from(([0, 0, 0, 0], config.port));
```

**影響**:
- VPN使用時でも、VPN経由でIPアドレスが公開される
- 意図しない外部公開のリスク
- ファイアウォール設定に依存する必要がある

**推奨修正**:
1. `ProxyConfig` に `listen_addr: Option<String>` フィールドを追加
2. デフォルトを `127.0.0.1`（localhostのみ）に変更
3. 外部公開が必要な場合のみ `0.0.0.0` を明示的に指定
4. CLIオプション `--bind <address>` を追加

**関連ファイル**:
- `crates/services/flm-proxy/src/controller.rs:99, 211`
- `crates/core/flm-core/src/domain/proxy.rs:42-61`

#### 2.2 X-Forwarded-For ヘッダーの信頼性問題

**問題**: `crates/services/flm-proxy/src/middleware.rs:238-246` で、検証なしに `X-Forwarded-For` ヘッダーを信頼している。

```238:246:crates/services/flm-proxy/src/middleware.rs
    if let Some(forwarded_for) = headers.get("x-forwarded-for") {
        if let Ok(forwarded_str) = forwarded_for.to_str() {
            // X-Forwarded-For can contain multiple IPs, take the first one
            if let Some(first_ip) = forwarded_str.split(',').next() {
                if let Ok(ip) = first_ip.trim().parse::<IpAddr>() {
                    return ip;
                }
            }
        }
    }
```

**影響**:
- IPスプーフィング攻撃の可能性
- IPホワイトリスト回避のリスク
- 信頼できないクライアントが任意のIPアドレスを偽装可能

**推奨修正**:
1. 信頼できるプロキシのIPアドレスリストを設定可能にする
2. リバースプロキシ経由の場合のみ `X-Forwarded-For` を使用
3. 直接接続の場合は `X-Forwarded-For` を無視
4. `X-Real-IP` も同様に検証

**関連ファイル**:
- `crates/services/flm-proxy/src/middleware.rs:236-270`

#### 2.3 セキュリティポリシーのデフォルト動作: Fail Open

**問題**: `crates/services/flm-proxy/src/middleware.rs:44-51` で、ポリシー未設定時やエラー時に「fail open」（すべて許可）となっている。

```44:51:crates/services/flm-proxy/src/middleware.rs
        Ok(None) => {
            // No policy configured, allow all
            return next.run(request).await;
        }
        Err(_) => {
            // Error fetching policy, allow (fail open for availability)
            return next.run(request).await;
        }
```

**影響**:
- 設定ミス時のセキュリティホール
- データベースエラー時にすべてのアクセスが許可される
- デフォルトポリシーが空のホワイトリスト（すべて許可）として動作

**推奨修正**:
1. デフォルトポリシーを「fail closed」（すべて拒否）に変更
2. エラー時は警告ログを出力し、管理者に通知
3. 明示的な「すべて許可」設定が必要な場合のみ許可
4. デフォルトポリシーの初期化時に警告を表示

**関連ファイル**:
- `crates/services/flm-proxy/src/middleware.rs:42-61`
- `crates/core/flm-core/migrations/20250101000003_init_security_policy.sql:8`

### 🟡 中優先度（短期対応推奨）

#### 2.4 APIキー検証のタイミング攻撃リスク

**問題**: `crates/core/flm-core/src/services/security.rs:253-266` で、複数のAPIキーを順次チェックしており、有効なキーが見つかった時点で早期リターンしている。

```253:266:crates/core/flm-core/src/services/security.rs
    pub async fn verify_api_key(&self, plain_key: &str) -> Result<Option<ApiKeyRecord>, RepoError> {
        // Get only active (non-revoked) API keys for better performance
        let records = self.repo.list_active_api_keys().await?;

        // Check each key
        for record in records {
            // Verify the hash using Argon2 (hash is already in the record)
            if verify_api_key_hash(plain_key, &record.hash)? {
                return Ok(Some(record));
            }
        }

        Ok(None)
    }
```

**影響**:
- タイミング攻撃により、有効なAPIキーの存在を推測可能
- キーの位置によって検証時間が異なる
- Argon2の検証自体は安全だが、早期リターンがタイミング情報を漏洩

**推奨修正**:
1. すべてのキーを検証してから結果を返す（パフォーマンスとのトレードオフ）
2. または、固定時間で検証を実行（ダミー検証を含む）
3. キー数が多い場合は、ハッシュインデックスを使用して直接検索

**関連ファイル**:
- `crates/core/flm-core/src/services/security.rs:253-266`

#### 2.5 レート制限の永続化不足

**問題**: `crates/services/flm-proxy/src/middleware.rs:298-331` で、レート制限の状態がメモリ内のみに保存されており、サーバー再起動時にリセットされる。また、データベースに`rate_limit_states`テーブルが定義されているのに使用されていない。

```298:331:crates/services/flm-proxy/src/middleware.rs
async fn check_rate_limit_with_info(
    state: &AppState,
    api_key_id: &str,
    _rpm: u32,
    burst: u32,
) -> (bool, u32, std::time::SystemTime) {
    let mut rate_limit_state = state.rate_limit_state.write().await;
    let now = Instant::now();
    let window_duration = Duration::from_secs(60); // 1 minute window

    // Get or create rate limit entry
    let (count, reset_time) = rate_limit_state
        .entry(api_key_id.to_string())
        .or_insert_with(|| (0, now + window_duration));
    // ...
}
```

**影響**:
- サーバー再起動時にレート制限がリセットされる
- 複数インスタンス間でレート制限状態が共有されない
- メモリリークのリスク（古いエントリが削除されない）

**推奨修正**:
1. データベースの`rate_limit_states`テーブルを使用
2. 定期的にメモリ内の状態をデータベースに同期
3. 古いエントリの自動クリーンアップを実装
4. 複数インスタンス対応のため、データベースを信頼できるソースとする

**関連ファイル**:
- `crates/services/flm-proxy/src/middleware.rs:290-331`
- `crates/core/flm-core/migrations/20250101000002_create_security_db.sql:33-39`

#### 2.6 データベースファイルの権限設定不足

**問題**: `crates/services/flm-proxy/src/adapters.rs:26-54` で、データベースファイルの権限設定が行われていない。`flm-cli`ではUnix系OSで`chmod 600`が設定されているが、`flm-proxy`では実装されていない。

```26:54:crates/services/flm-proxy/src/adapters.rs
    pub async fn new<P: AsRef<Path>>(db_path: P) -> Result<Self, RepoError> {
        let path_str = db_path
            .as_ref()
            .to_str()
            .ok_or_else(|| RepoError::IoError {
                reason: "Invalid database path (non-UTF8)".to_string(),
            })?;

        let options = SqliteConnectOptions::new()
            .filename(path_str)
            .create_if_missing(true);

        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .connect_with(options)
            .await
            .map_err(|e| RepoError::IoError {
                reason: format!("Failed to connect to security.db: {e}"),
            })?;
        // ...
    }
```

**影響**:
- データベースファイルが不適切な権限で作成される可能性
- 他のユーザーがデータベースファイルを読み取れるリスク
- 機密情報（APIキーハッシュ）の漏洩リスク

**推奨修正**:
1. `flm-cli`と同様に、Unix系OSで`chmod 600`を設定
2. Windowsでは適切なACLを設定
3. データベースファイル作成直後に権限を設定

**関連ファイル**:
- `crates/services/flm-proxy/src/adapters.rs:26-54`
- `crates/apps/flm-cli/src/adapters/security.rs:229-238`（参考実装）

#### 2.7 監査ログの未実装

**問題**: `crates/core/flm-core/migrations/20250101000002_create_security_db.sql:21-31` で`audit_logs`テーブルが定義されているが、実際にログを記録する機能が実装されていない。

**影響**:
- セキュリティインシデントの追跡が困難
- コンプライアンス要件を満たせない
- 攻撃の痕跡が残らない

**推奨修正**:
1. 監査ログ記録機能を実装
2. 重要な操作（APIキー作成、削除、ポリシー変更）を記録
3. リクエストログ（エンドポイント、ステータス、レイテンシ）を記録
4. IPアドレスはハッシュ化して記録（プライバシー保護）

**関連ファイル**:
- `crates/core/flm-core/migrations/20250101000002_create_security_db.sql:21-31`
- `crates/services/flm-proxy/src/middleware.rs`（新規実装が必要）

#### 2.8 エラーメッセージへの内部情報漏洩

**問題**: エラーメッセージに `engine_id` などの内部情報が含まれている。

```474:478:crates/services/flm-proxy/src/controller.rs
                axum::Json(serde_json::json!({
                    "error": {
                        "message": format!("Engine not found: {}", engine_id),
                        "type": "invalid_request_error",
                        "code": "engine_not_found"
                    }
                })),
```

**影響**:
- システム内部構造の情報漏洩
- 攻撃者への手がかり提供
- エンジンIDの列挙攻撃の可能性

**推奨修正**:
1. エラーメッセージを一般化（例: "Engine not found"）
2. デバッグモード時のみ詳細情報を出力
3. ログには詳細情報を記録し、レスポンスには含めない

**関連ファイル**:
- `crates/services/flm-proxy/src/controller.rs:474, 650`
- `crates/services/flm-proxy/src/controller.rs:475, 651`

#### 2.5 ログ出力の不足

**問題**: 現在のコードベースではログ出力がほとんどない（`println!`が1箇所のみ）。

**影響**:
- セキュリティインシデントの追跡が困難
- 監査ログの不足
- デバッグ時の情報不足

**推奨修正**:
1. 構造化ログ（`tracing` または `log`）を導入
2. リクエストログ（IPアドレス、エンドポイント、ステータス）を記録
3. セキュリティイベント（認証失敗、ポリシー違反）を記録
4. IPアドレスはハッシュ化して記録（プライバシー保護）

**関連ファイル**:
- `crates/services/flm-proxy/src/main.rs:18`
- `crates/services/flm-proxy/src/controller.rs`（全般）

### 🟢 低優先度（監視継続）

#### 2.6 CORS設定のデフォルト動作

**問題**: `crates/services/flm-proxy/src/controller.rs:274-276` で、ポリシー未設定時はすべてのOriginを許可している。

**影響**:
- 設定ミス時のCORS脆弱性
- クロスオリジンリクエストの制御不足

**推奨修正**:
1. デフォルトを「すべて拒否」に変更
2. 明示的な設定が必要な場合のみ許可

**関連ファイル**:
- `crates/services/flm-proxy/src/controller.rs:265-325`

## 3. セキュリティ評価

### スコア評価

- **ネットワークセキュリティ**: ⭐☆☆☆☆ (重大な問題あり)
- **認証・認可**: ⭐⭐⭐☆☆ (APIキーは適切、ポリシー適用に問題)
- **入力検証**: ⭐⭐⭐☆☆ (基本的な検証は実装済み)
- **エラーハンドリング**: ⭐⭐☆☆☆ (情報漏洩のリスク)
- **ログ・監査**: ⭐☆☆☆☆ (ログ出力が不足)

### 統計

- **総合評価**: ⭐⭐☆☆☆ (改善が必要)
- **修正必要項目**: 9件（高優先度3件、中優先度5件、低優先度1件）
- **推奨改善項目**: 1件（低優先度）
- **監査完了率**: 100%

## 4. 推奨改善事項

### 4.1 即座対応が必要な項目

1. **バインドアドレスの設定可能化**
   - `ProxyConfig` に `listen_addr` フィールドを追加
   - デフォルトを `127.0.0.1` に変更
   - CLIオプションを追加

2. **X-Forwarded-For の検証**
   - 信頼できるプロキシのIPリストを設定可能にする
   - 直接接続時は `X-Forwarded-For` を無視

3. **セキュリティポリシーのデフォルト動作**
   - デフォルトを「fail closed」に変更
   - エラー時の警告ログを追加

### 4.2 短期対応推奨項目

4. **エラーメッセージの一般化**
   - 内部情報をレスポンスから除外
   - デバッグモード時のみ詳細情報を出力

5. **ログ出力の実装**
   - 構造化ログを導入
   - セキュリティイベントを記録
   - IPアドレスはハッシュ化して記録

### 4.3 長期的な改善提案

6. **監査ログ機能の実装**
   - `audit_logs` テーブルへの記録
   - 重要な操作の記録（APIキー作成、削除、ポリシー変更）
   - ログの改ざん防止

7. **セキュリティヘッダーの追加**
   - `X-Content-Type-Options: nosniff`
   - `X-Frame-Options: DENY`
   - `X-XSS-Protection: 1; mode=block`
   - `Strict-Transport-Security` (HTTPS時)

## 5. 修正計画

### Phase 1: 緊急修正（最優先）

1. **バインドアドレスの設定可能化**
   - ファイル: `crates/core/flm-core/src/domain/proxy.rs`
   - ファイル: `crates/services/flm-proxy/src/controller.rs`
   - ファイル: `crates/apps/flm-cli/src/cli/proxy.rs`
   - 推定工数: 2-3時間

2. **X-Forwarded-For の検証**
   - ファイル: `crates/services/flm-proxy/src/middleware.rs`
   - ファイル: `crates/core/flm-core/src/domain/proxy.rs` (設定追加)
   - 推定工数: 2-3時間

3. **セキュリティポリシーのデフォルト動作**
   - ファイル: `crates/services/flm-proxy/src/middleware.rs`
   - ファイル: `crates/core/flm-core/migrations/20250101000003_init_security_policy.sql`
   - 推定工数: 1-2時間

### Phase 2: 短期修正

4. **APIキー検証のタイミング攻撃対策**
   - ファイル: `crates/core/flm-core/src/services/security.rs`
   - 推定工数: 2-3時間

5. **レート制限の永続化**
   - ファイル: `crates/services/flm-proxy/src/middleware.rs`
   - ファイル: `crates/core/flm-core/src/ports/security.rs` (必要に応じて)
   - 推定工数: 4-6時間

6. **データベースファイルの権限設定**
   - ファイル: `crates/services/flm-proxy/src/adapters.rs`
   - 推定工数: 1-2時間

7. **監査ログの実装**
   - ファイル: `crates/services/flm-proxy/src/` (新規)
   - 推定工数: 6-8時間

8. **エラーメッセージの一般化**
   - ファイル: `crates/services/flm-proxy/src/controller.rs`
   - 推定工数: 1-2時間

9. **ログ出力の実装**
   - ファイル: `crates/services/flm-proxy/src/` (全般)
   - 推定工数: 4-6時間

### Phase 3: 長期的改善

6. **監査ログ機能の実装**
   - ファイル: `crates/services/flm-proxy/src/` (新規)
   - 推定工数: 8-12時間

7. **セキュリティヘッダーの追加**
   - ファイル: `crates/services/flm-proxy/src/middleware.rs`
   - 推定工数: 2-3時間

## 6. 次のステップ

1. [ ] Phase 1の緊急修正を実施
2. [ ] 修正後の再監査
3. [ ] Phase 2の短期修正を実施
4. [ ] セキュリティテストの実施
5. [ ] ドキュメントの更新

---

**最終更新**: 2025-01-27
**次回監査予定**: Phase 1修正後

