# ボットネット対策実装計画

> Status: Planning | Audience: Security engineers, Core developers | Updated: 2025-01-27

**注意**: このドキュメントは開発者向けの実装計画です。ユーザー向けの使い方は `docs/guides/SECURITY_BOTNET_PROTECTION.md` を参照してください。

## 1. 概要

### 1.1 目的

FLMプロキシサーバーが外部公開される際に、以下の脅威から保護する：

1. **ボットネット化**: 不正アクセスによりPCがボットネットの一部になることを防止
2. **リソース悪用**: CPU/メモリの異常使用によるサービス停止を防止
3. **データ窃取**: APIキーの不正取得を防止
4. **DDoS攻撃**: 大量リクエストによるサービス停止を防止

### 1.2 基本方針

- **デフォルトで有効**: 外部公開時（`0.0.0.0`にバインド）は自動的にすべての防御機能を有効化
- **初心者でも使える**: 設定不要、自動動作
- **段階的ブロック**: 警告 → 一時ブロック → 永続ブロック
- **監視とログ**: すべてのセキュリティイベントを記録

### 1.3 対象ユーザー

- **個人利用・シングルユーザー環境**
- **外部公開するユーザー**（`0.0.0.0`にバインド）
- **初心者でも使える**（設定不要）

## 2. 実装する機能

### 2.1 自動IPブロック機能 🔴 必須

#### 目的
ブルートフォース攻撃でAPIキーを突破されないようにする

#### 機能仕様

```rust
pub struct IpBlocklist {
    // IP -> (failure_count, first_failure_time, blocked_until, permanent_block)
    blocked_ips: Arc<RwLock<HashMap<IpAddr, BlocklistEntry>>>,
}

struct BlocklistEntry {
    failure_count: u32,
    first_failure_time: Instant,
    blocked_until: Option<Instant>,
    permanent_block: bool,
    last_attempt: Instant,
}
```

#### ブロックルール

| 失敗回数 | ブロック時間 | 自動解除 |
|---------|------------|---------|
| 1-4回 | なし（警告のみ） | - |
| 5回 | 30分 | ✅ 自動 |
| 10回 | 24時間 | ✅ 自動 |
| 20回 | 永続 | ❌ 手動解除のみ |

#### 実装ファイル

- `crates/flm-proxy/src/middleware.rs` - IPブロックチェック
- `crates/flm-proxy/src/security/ip_blocklist.rs` - ブロックリスト管理（新規）
- `crates/flm-core/src/domain/security.rs` - ドメインモデル拡張

#### データベーススキーマ

```sql
CREATE TABLE IF NOT EXISTS ip_blocklist (
    ip TEXT PRIMARY KEY,
    failure_count INTEGER NOT NULL DEFAULT 0,
    first_failure_at TEXT NOT NULL,
    blocked_until TEXT,
    permanent_block INTEGER NOT NULL DEFAULT 0,
    last_attempt TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ip_blocklist_blocked_until 
ON ip_blocklist(blocked_until) WHERE blocked_until IS NOT NULL;
```

### 2.2 侵入検知システム（簡易版） 🔴 必須

#### 目的
不正アクセスの試行を検出し、ボットネット化の前兆を捉える

#### 検出パターン

1. **SQLインジェクション試行**
   - パスやクエリパラメータに `'`, `;`, `--`, `/*`, `*/` が含まれる
   - スコア: +20

2. **パストラバーサル試行**
   - パスに `../`, `..\\`, `%2e%2e%2f` が含まれる
   - スコア: +20

3. **異常なUser-Agent**
   - スキャナーツール（`sqlmap`, `nikto`, `nmap`, `masscan`等）
   - User-Agentが空
   - スコア: +10

4. **存在しないエンドポイントへの大量アクセス**
   - 404エラーが短時間で大量発生
   - スコア: +15（10回/分以上）

5. **異常なHTTPメソッド**
   - 通常使用しないメソッド（`TRACE`, `OPTIONS`等）の大量使用
   - スコア: +10

#### スコアリングシステム

```rust
pub struct IntrusionDetection {
    // IP -> (score, first_detection_time, last_detection_time)
    ip_scores: Arc<RwLock<HashMap<IpAddr, IntrusionScore>>>,
}

struct IntrusionScore {
    score: u32,
    first_detection: Instant,
    last_detection: Instant,
    patterns: Vec<String>,  // 検出されたパターン
}
```

#### アクション

| スコア | アクション |
|--------|----------|
| 0-49 | ログ記録のみ |
| 50-99 | 警告ログ + 監視強化 |
| 100-199 | 1時間ブロック |
| 200以上 | 24時間ブロック |

#### 実装ファイル

- `crates/flm-proxy/src/security/intrusion_detection.rs` - 侵入検知ロジック（新規）
- `crates/flm-proxy/src/middleware.rs` - ミドルウェア統合

#### データベーススキーマ

```sql
CREATE TABLE IF NOT EXISTS intrusion_attempts (
    id TEXT PRIMARY KEY,
    ip TEXT NOT NULL,
    pattern TEXT NOT NULL,
    score INTEGER NOT NULL,
    request_path TEXT,
    user_agent TEXT,
    method TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_intrusion_attempts_ip 
ON intrusion_attempts(ip, created_at);
```

### 2.3 異常検知システム（簡易版） 🔴 必須

#### 目的
異常なリクエストパターンを検出し、ボットネットの活動を早期に発見

#### 検出項目

1. **大量リクエスト**
   - 1秒間に100リクエスト以上
   - 1分間に1000リクエスト以上
   - スコア: +30

2. **異常に大きなリクエストボディ**
   - 10MB制限を超える試行
   - スコア: +20

3. **異常に長いリクエスト時間**
   - 60秒タイムアウトを超える試行
   - スコア: +15

4. **異常なエンドポイントへのアクセス**
   - 存在しないエンドポイントへの連続アクセス
   - スコア: +10

5. **異常なリクエストパターン**
   - 同じリクエストの繰り返し
   - スコア: +10

#### 実装ファイル

- `crates/flm-proxy/src/security/anomaly_detection.rs` - 異常検知ロジック（新規）
- `crates/flm-proxy/src/middleware.rs` - ミドルウェア統合

#### データベーススキーマ

```sql
CREATE TABLE IF NOT EXISTS anomaly_detections (
    id TEXT PRIMARY KEY,
    ip TEXT NOT NULL,
    anomaly_type TEXT NOT NULL,
    score INTEGER NOT NULL,
    details TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_anomaly_detections_ip 
ON anomaly_detections(ip, created_at);
```

### 2.4 リソース保護 🔴 必須

#### 目的
CPU/メモリの異常使用を検出し、サービス停止を防止

#### 監視項目

1. **CPU使用率**
   - 閾値: 90%
   - 超過時: 警告ログ + 新規接続の一時拒否

2. **メモリ使用率**
   - 閾値: 90%
   - 超過時: 警告ログ + 新規接続の一時拒否

3. **同時接続数**
   - 閾値: 100接続（既存）
   - 超過時: 新規接続拒否

#### 実装ファイル

- `crates/flm-proxy/src/security/resource_protection.rs` - リソース監視（新規）
- `crates/flm-proxy/src/middleware.rs` - ミドルウェア統合

#### データベーススキーマ

```sql
CREATE TABLE IF NOT EXISTS resource_alerts (
    id TEXT PRIMARY KEY,
    alert_type TEXT NOT NULL,  -- 'cpu', 'memory', 'connections'
    value REAL NOT NULL,
    threshold REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_resource_alerts_created_at 
ON resource_alerts(created_at);
```

### 2.5 監査ログ 🔴 必須

#### 目的
すべてのセキュリティイベントを記録し、攻撃の追跡と分析を可能にする

#### 記録項目

1. **認証イベント**
   - 認証成功/失敗
   - APIキーID（ハッシュ化）
   - IPアドレス
   - タイムスタンプ

2. **ブロックイベント**
   - ブロックされたIP
   - ブロック理由
   - ブロック期間

3. **侵入検知イベント**
   - 検出されたパターン
   - スコア
   - IPアドレス

4. **異常検知イベント**
   - 異常タイプ
   - スコア
   - IPアドレス

5. **リソースアラート**
   - アラートタイプ
   - 値
   - 閾値

#### 実装ファイル

- `crates/flm-proxy/src/security/audit_logger.rs` - 監査ログ記録（新規）
- `crates/flm-core/src/domain/security.rs` - ドメインモデル

#### データベーススキーマ

```sql
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,  -- 'auth_success', 'auth_failure', 'ip_blocked', 'intrusion', 'anomaly', 'resource_alert'
    ip TEXT,
    api_key_id TEXT,  -- ハッシュ化
    details TEXT,  -- JSON形式
    severity TEXT NOT NULL,  -- 'low', 'medium', 'high', 'critical'
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type 
ON audit_logs(event_type, created_at);

CREATE INDEX IF NOT EXISTS idx_audit_logs_ip 
ON audit_logs(ip, created_at);

CREATE INDEX IF NOT EXISTS idx_audit_logs_severity 
ON audit_logs(severity, created_at);
```

### 2.6 IPベースレート制限 ⚠️ 推奨

#### 目的
単一IPからの大量リクエストを制限し、DDoS攻撃を防止

#### 機能仕様

- デフォルト: 有効（外部公開時）
- 制限: 1000 req/min（APIキーベースと併用）
- ストリーミングエンドポイント: 除外

#### 実装ファイル

- `crates/flm-proxy/src/middleware.rs` - レート制限拡張

### 2.7 ハニーポットエンドポイント ⚠️ 推奨

#### 目的
攻撃者の早期検出

#### エンドポイント

- `/admin` - 管理エンドポイント（存在しない）
- `/api/v1/users` - ユーザー管理（存在しない）
- `/wp-admin` - WordPress管理（存在しない）
- `/phpmyadmin` - phpMyAdmin（存在しない）

#### アクション

- アクセス時: 警告ログ + IPスコア +10
- 即座にブロックしない（誤検知を避ける）

#### 実装ファイル

- `crates/flm-proxy/src/controller.rs` - ハニーポットエンドポイント追加

## 3. 実装順序と優先順位

### Phase 1: 緊急（1週間以内）

1. **自動IPブロック機能** 🔴
   - 推定工数: 8-12時間
   - 依存: なし
   - 優先度: 最高

2. **監査ログ** 🔴
   - 推定工数: 6-8時間
   - 依存: なし
   - 優先度: 最高

3. **侵入検知システム（簡易版）** 🔴
   - 推定工数: 12-16時間
   - 依存: 監査ログ
   - 優先度: 高

### Phase 2: 短期（2週間以内）

4. **異常検知システム（簡易版）** 🔴
   - 推定工数: 10-14時間
   - 依存: 監査ログ
   - 優先度: 高

5. **リソース保護** 🔴
   - 推定工数: 8-10時間
   - 依存: 監査ログ
   - 優先度: 高

6. **IPベースレート制限** ⚠️
   - 推定工数: 4-6時間
   - 依存: なし
   - 優先度: 中

### Phase 3: 中期（1ヶ月以内）

7. **ハニーポットエンドポイント** ⚠️
   - 推定工数: 4-6時間
   - 依存: 侵入検知システム
   - 優先度: 中

8. **UI統合**（オプション）
   - ダッシュボードでのブロック状況表示
   - ブロック解除機能
   - 推定工数: 8-12時間

## 4. データベースマイグレーション

### 4.1 マイグレーションファイル

`crates/flm-core/migrations/20250127000001_add_botnet_protection.sql`

```sql
-- IPブロックリスト
CREATE TABLE IF NOT EXISTS ip_blocklist (
    ip TEXT PRIMARY KEY,
    failure_count INTEGER NOT NULL DEFAULT 0,
    first_failure_at TEXT NOT NULL,
    blocked_until TEXT,
    permanent_block INTEGER NOT NULL DEFAULT 0,
    last_attempt TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ip_blocklist_blocked_until 
ON ip_blocklist(blocked_until) WHERE blocked_until IS NOT NULL;

-- 侵入検知
CREATE TABLE IF NOT EXISTS intrusion_attempts (
    id TEXT PRIMARY KEY,
    ip TEXT NOT NULL,
    pattern TEXT NOT NULL,
    score INTEGER NOT NULL,
    request_path TEXT,
    user_agent TEXT,
    method TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_intrusion_attempts_ip 
ON intrusion_attempts(ip, created_at);

-- 異常検知
CREATE TABLE IF NOT EXISTS anomaly_detections (
    id TEXT PRIMARY KEY,
    ip TEXT NOT NULL,
    anomaly_type TEXT NOT NULL,
    score INTEGER NOT NULL,
    details TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_anomaly_detections_ip 
ON anomaly_detections(ip, created_at);

-- リソースアラート
CREATE TABLE IF NOT EXISTS resource_alerts (
    id TEXT PRIMARY KEY,
    alert_type TEXT NOT NULL,
    value REAL NOT NULL,
    threshold REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_resource_alerts_created_at 
ON resource_alerts(created_at);

-- 監査ログ（拡張）
-- 既存のaudit_logsテーブルがある場合は、カラム追加のみ
-- 新規の場合は上記のスキーマを使用
```

### 4.2 マイグレーション実行タイミング

- プロキシ起動時（`flm proxy start`）
- 自動実行（既存のマイグレーションシステムを使用）

## 5. API設計

### 5.1 SecurityPolicy JSONスキーマ拡張

```jsonc
{
  "ip_whitelist": ["127.0.0.1", "192.168.0.0/16"],
  "cors": { "allowed_origins": ["https://example.com"] },
  "rate_limit": { "rpm": 60, "burst": 10 },
  
  // 新規追加
  "ip_blocklist": {
    "enabled": true,              // デフォルト: 外部公開時はtrue
    "max_failures": 5,            // 5回でブロック開始
    "block_duration_minutes": 30, // 初期ブロック時間
    "permanent_block_threshold": 20 // 永続ブロック閾値
  },
  "intrusion_detection": {
    "enabled": true,              // デフォルト: 外部公開時はtrue
    "score_threshold": 100,       // ブロック開始スコア
    "warning_threshold": 50       // 警告開始スコア
  },
  "anomaly_detection": {
    "enabled": true,              // デフォルト: 外部公開時はtrue
    "request_rate_threshold": 100, // 1秒100リクエスト
    "auto_block": true
  },
  "resource_protection": {
    "enabled": true,              // デフォルト: 外部公開時はtrue
    "cpu_threshold": 90,          // CPU 90%
    "memory_threshold": 90        // メモリ 90%
  },
  "ip_rate_limit": {
    "enabled": true,              // デフォルト: 外部公開時はtrue
    "rpm": 1000                   // IPあたり1000 req/min
  }
}
```

### 5.2 CLIコマンド拡張

```bash
# IPブロックリスト管理
flm security ip-blocklist list          # ブロックされたIP一覧
flm security ip-blocklist unblock <ip>  # IPのブロック解除
flm security ip-blocklist clear         # すべてのブロック解除（永続ブロック除く）

# 監査ログ
flm security audit-logs list [--severity <level>] [--ip <ip>] [--limit <n>]
flm security audit-logs export [--format json|csv] [--output <file>]

# セキュリティ統計
flm security stats                      # セキュリティイベントの統計
```

## 6. 実装詳細

### 6.1 ディレクトリ構造

```
crates/flm-proxy/src/
├── security/
│   ├── mod.rs
│   ├── ip_blocklist.rs          # IPブロックリスト管理
│   ├── intrusion_detection.rs   # 侵入検知
│   ├── anomaly_detection.rs     # 異常検知
│   ├── resource_protection.rs   # リソース保護
│   └── audit_logger.rs          # 監査ログ
├── middleware.rs                 # ミドルウェア統合
└── controller.rs                 # ハニーポットエンドポイント
```

### 6.2 モジュール間の依存関係

```
middleware.rs
  ├─ ip_blocklist.rs
  ├─ intrusion_detection.rs
  ├─ anomaly_detection.rs
  ├─ resource_protection.rs
  └─ audit_logger.rs
```

### 6.3 パフォーマンス考慮事項

1. **メモリ内キャッシュ**
   - IPブロックリストはメモリ内に保持
   - 定期的にDBに同期（5分ごと）

2. **非同期処理**
   - ログ記録は非同期（リクエストをブロックしない）
   - バッチ処理でDB書き込み

3. **インデックス最適化**
   - 頻繁にクエリされるカラムにインデックス
   - 古いログの自動削除（7日以上）

## 7. テスト計画

### 7.1 単体テスト

- IPブロックリストの追加/削除/検索
- 侵入検知パターンマッチング
- 異常検知の統計計算
- リソース監視の閾値チェック

### 7.2 統合テスト

- 認証失敗時の自動ブロック
- 侵入検知スコアの累積
- 異常検知による自動ブロック
- リソース超過時の接続拒否

### 7.3 負荷テスト

- 大量リクエスト時のパフォーマンス
- メモリ使用量の監視
- DB書き込みの負荷

## 8. ロールアウト計画

### 8.1 段階的展開

1. **Phase 1**: 監査ログのみ実装（影響なし）
2. **Phase 2**: IPブロックリスト実装（警告モード）
3. **Phase 3**: 侵入検知・異常検知実装（警告モード）
4. **Phase 4**: すべての機能を有効化

### 8.2 ロールバック計画

- 各機能は個別に無効化可能
- 設定ファイルで即座に無効化
- データベースは保持（ログ分析用）

## 9. ドキュメント

### 9.1 ユーザー向けドキュメント

- `docs/guides/SECURITY_BOTNET_PROTECTION.md` - ボットネット対策ガイド
- UIでのセキュリティ設定説明

### 9.2 開発者向けドキュメント

- API仕様書の更新
- セキュリティ機能のアーキテクチャ説明

## 10. 成功基準

### 10.1 機能要件

- ✅ 認証失敗5回で自動ブロック
- ✅ 侵入検知スコア100以上で自動ブロック
- ✅ 異常検知による自動ブロック
- ✅ リソース超過時の接続拒否
- ✅ すべてのセキュリティイベントのログ記録

### 10.2 非機能要件

- パフォーマンス: リクエスト処理時間への影響 < 10ms
- 可用性: セキュリティ機能による誤検知率 < 0.1%
- 保守性: コードカバレッジ 80%以上

## 11. リスクと対策

### 11.1 リスク

1. **誤検知による正当なユーザーのブロック**
   - 対策: 段階的ブロック、ホワイトリスト機能

2. **パフォーマンスへの影響**
   - 対策: 非同期処理、メモリ内キャッシュ

3. **データベースの肥大化**
   - 対策: ログローテーション、自動削除

### 11.2 対策

- すべての機能は設定で無効化可能
- ブロック解除機能を提供
- 定期的なログクリーンアップ

---

**更新日**: 2025-01-27  
**作成者**: Security Planning Team  
**ステータス**: Planning → Implementation

**関連ドキュメント**:
- `docs/guides/SECURITY_BOTNET_PROTECTION.md` - ユーザー向けガイド（使い方、設定方法）
- `docs/specs/PROXY_SPEC.md` - プロキシ仕様
- `docs/specs/CORE_API.md` - コアAPI仕様
- `docs/planning/PLAN.md` - メインプロジェクト計画

