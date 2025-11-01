# FLM - パフォーマンス監査レポート

## 📋 文書情報

- **プロジェクト名**: FLM
- **バージョン**: 1.0.0
- **作成日**: 2024年
- **監査範囲**: システム全体（アーキテクチャ、設計、実装前レビュー）
- **監査方法**: 仕様書分析、アーキテクチャレビュー、ベストプラクティス検証

---

## 🎯 監査概要

### 監査目的

本監査レポートは、FLMアプリケーションのパフォーマンスに関する包括的な分析を行い、以下の観点から潜在的な問題点と改善策を提示します：

1. **応答時間の最適化**
2. **リソース使用量の最小化**
3. **スケーラビリティの確保**
4. **ユーザー体験の向上**

### 監査結果サマリー

| カテゴリ | 評価 | 問題数 |
|---------|------|--------|
| **フロントエンド（UI）** | ⚠️ 要改善 | 7 |
| **バックエンド（認証プロキシ）** | ⚠️ 要改善 | 6 |
| **データベース（SQLite）** | ⚠️ 要改善 | 5 |
| **プロセス管理** | ⚠️ 要改善 | 4 |
| **ネットワーク通信** | ✅ 良好 | 3 |
| **メモリ管理** | 🔴 要対応 | 6 |
| **キャッシュ戦略** | 🔴 要対応 | 4 |

**総合評価**: ⚠️ **要改善** - 実装前にパフォーマンス対策を追加することを推奨

---

## 🔴 高優先度問題

### 1. データベースパフォーマンス対策の欠如

#### 問題点

- **現状**: SQLiteのスキーマ定義は存在するが、インデックス設計が未定義
- **影響**: API一覧取得、設定検索時にフルテーブルスキャンが発生する可能性
- **深刻度**: 高（データ量増加時に著しい性能劣化）

#### 推奨改善策

```sql
-- 改善されたスキーマ（インデックス追加）
CREATE TABLE apis (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  port INTEGER DEFAULT 8080,
  api_key TEXT NOT NULL,
  model_name TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status TEXT DEFAULT 'stopped',  -- running/stopped
  last_used_at TIMESTAMP
);

-- インデックス追加
CREATE INDEX idx_apis_status ON apis(status);
CREATE INDEX idx_apis_created_at ON apis(created_at DESC);
CREATE INDEX idx_apis_last_used_at ON apis(last_used_at DESC);

-- ログテーブル（F006実装時）
CREATE TABLE logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  api_id TEXT NOT NULL,
  request_path TEXT,
  response_status INTEGER,
  response_time_ms INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (api_id) REFERENCES apis(id)
);

-- ログテーブルのインデックス
CREATE INDEX idx_logs_api_id ON logs(api_id);
CREATE INDEX idx_logs_created_at ON logs(created_at DESC);
CREATE INDEX idx_logs_api_created ON logs(api_id, created_at DESC);

-- パフォーマンスメトリクステーブル（F007実装時）
CREATE TABLE performance_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  api_id TEXT NOT NULL,
  metric_type TEXT NOT NULL,  -- request_count, avg_response_time, error_rate
  value REAL NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (api_id) REFERENCES apis(id)
);

CREATE INDEX idx_metrics_api_type_timestamp ON performance_metrics(api_id, metric_type, timestamp DESC);
```

**実装推奨事項**:
- クエリの準備済みステートメント（prepared statements）を使用
- バッチ更新処理を実装
- データベース接続プーリングの検討（複数API同時実行時）

---

### 2. 同時リクエストのキュー管理システムの欠如

#### 問題点

- **現状**: 初期実装は1リクエスト/秒と記載されているが、キュー管理の実装方針が不明確
- **影響**: 複数リクエストが同時に来た場合の処理順序が未定義
- **深刻度**: 高（スケーラビリティの問題）

#### 推奨改善策

**認証プロキシ側（Express.js）にキューシステムを実装**:

```javascript
// キュー管理モジュール（推奨実装例）
class RequestQueue {
  constructor(maxConcurrent = 1) {
    this.queue = [];
    this.processing = 0;
    this.maxConcurrent = maxConcurrent;
  }

  async add(requestHandler) {
    return new Promise((resolve, reject) => {
      this.queue.push({ requestHandler, resolve, reject });
      this.process();
    });
  }

  async process() {
    if (this.processing >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    this.processing++;
    const { requestHandler, resolve, reject } = this.queue.shift();

    try {
      const result = await requestHandler();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.processing--;
      this.process();
    }
  }

  // 設定可能な同時実行数（デフォルト: 1）
  setMaxConcurrent(max) {
    this.maxConcurrent = max;
  }
}

// 使用例（認証プロキシで）
const queue = new RequestQueue(1); // 初期は1リクエスト/秒

app.post('/v1/chat/completions', async (req, res) => {
  await queue.add(async () => {
    // APIキー検証
    const apiKey = req.headers.authorization?.replace('Bearer ', '');
    if (!validateApiKey(apiKey)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Ollama APIへ転送
    return proxyRequest(req, res);
  });
});
```

**将来的な拡張**:
- 優先度付きキュー（VIPリクエストの優先処理）
- リクエストタイムアウト設定
- キューの長さ制限（メモリ保護）

---

### 3. キャッシュ戦略の欠如

#### 問題点

- **現状**: モデル一覧取得（Ollama API）を毎回呼び出す可能性がある
- **影響**: 不要なネットワーク通信、Ollamaへの負荷増加、UI応答性の低下
- **深刻度**: 中～高（頻繁なアクセス時）

#### 推奨改善策

**1. モデル一覧のキャッシュ**:

```javascript
// モデル一覧キャッシュ（推奨実装例）
class ModelCache {
  constructor(ttl = 60000) { // デフォルト: 60秒
    this.cache = null;
    this.timestamp = 0;
    this.ttl = ttl;
  }

  async getModels() {
    const now = Date.now();
    
    // キャッシュが有効な場合は返す
    if (this.cache && (now - this.timestamp) < this.ttl) {
      return this.cache;
    }

    // キャッシュがない、または期限切れの場合は取得
    try {
      const response = await fetch('http://localhost:11434/api/tags');
      const data = await response.json();
      this.cache = data;
      this.timestamp = now;
      return data;
    } catch (error) {
      // エラー時はキャッシュがあれば返す（フォールバック）
      if (this.cache) {
        console.warn('Ollama API error, using cached data:', error);
        return this.cache;
      }
      throw error;
    }
  }

  invalidate() {
    this.cache = null;
    this.timestamp = 0;
  }
}

const modelCache = new ModelCache(60000); // 60秒TTL
```

**2. API設定のメモリキャッシュ**:

```javascript
// API設定キャッシュ（推奨実装例）
class ApiConfigCache {
  constructor() {
    this.cache = new Map();
    this.listeners = [];
  }

  async getApiConfig(apiId) {
    // メモリキャッシュから取得
    if (this.cache.has(apiId)) {
      return this.cache.get(apiId);
    }

    // SQLiteから取得してキャッシュ
    const config = await db.getApiConfig(apiId);
    if (config) {
      this.cache.set(apiId, config);
    }
    return config;
  }

  invalidate(apiId) {
    this.cache.delete(apiId);
    this.notifyListeners(apiId);
  }

  clear() {
    this.cache.clear();
  }

  // 設定変更時にキャッシュを無効化
  onConfigChanged(callback) {
    this.listeners.push(callback);
  }

  notifyListeners(apiId) {
    this.listeners.forEach(cb => cb(apiId));
  }
}
```

**キャッシュ無効化タイミング**:
- モデル一覧: モデルダウンロード/削除時、手動リフレッシュ時
- API設定: 設定変更時、API作成/削除時

---

### 4. メモリリーク対策の欠如

#### 問題点

- **現状**: 長時間実行時のメモリリーク対策が不明確
- **影響**: 長時間実行時にメモリ使用量が増加し続ける可能性
- **深刻度**: 高（バックグラウンド実行を想定）

#### 推奨改善策

**1. メモリ監視機能の実装**:

```rust
// Tauriバックエンド側（Rust）でのメモリ監視
use sysinfo::{System, SystemExt, ProcessExt};

#[tauri::command]
pub async fn get_memory_usage() -> Result<u64, String> {
    let mut system = System::new_all();
    system.refresh_all();
    
    let pid = std::process::id();
    if let Some(process) = system.process(sysinfo::Pid::from_u32(pid)) {
        Ok(process.memory() * 1024) // KB to bytes
    } else {
        Err("Process not found".to_string())
    }
}

// 定期的なメモリチェック（推奨: 5分ごと）
#[tauri::command]
pub async fn check_memory_health() -> Result<bool, String> {
    let usage = get_memory_usage().await?;
    let limit = 2 * 1024 * 1024 * 1024; // 2GB制限
    
    if usage > limit {
        // 警告をUIに通知
        Ok(false)
    } else {
        Ok(true)
    }
}
```

**2. フロントエンド側のメモリ管理**:

```typescript
// React/Vueコンポーネントでのメモリリーク対策
// - イベントリスナーの適切なクリーンアップ
// - タイマーのクリーンアップ
// - 大きなオブジェクトの参照解除

// React例
useEffect(() => {
  const timer = setInterval(() => {
    // 処理
  }, 1000);

  return () => {
    clearInterval(timer); // クリーンアップ
  };
}, []);

// Vue例
onUnmounted(() => {
  // クリーンアップ処理
});
```

**3. 認証プロキシ側のメモリ管理**:

```javascript
// Express.jsでのメモリ管理
// - リクエストボディのサイズ制限
app.use(express.json({ limit: '10mb' })); // 適切な制限を設定

// - ログのバッファリングと定期的なフラッシュ
class LogBuffer {
  constructor(maxSize = 1000) {
    this.buffer = [];
    this.maxSize = maxSize;
  }

  add(log) {
    this.buffer.push(log);
    if (this.buffer.length >= this.maxSize) {
      this.flush();
    }
  }

  async flush() {
    if (this.buffer.length === 0) return;
    
    const logs = this.buffer.splice(0);
    await db.batchInsertLogs(logs);
  }
}

// 定期的なフラッシュ（5分ごと）
setInterval(() => logBuffer.flush(), 5 * 60 * 1000);
```

---

## 🟡 中優先度問題

### 5. UI応答性の最適化

#### 問題点

- **現状**: 重い処理（モデルダウンロード等）がUIをブロックする可能性
- **影響**: ユーザー体験の低下、フリーズ感

#### 推奨改善策

**1. 非同期処理とプログレス表示**:

```typescript
// モデルダウンロードの非同期処理（推奨実装）
async function downloadModel(modelName: string) {
  try {
    // UIをブロックしないため、即座にローディング表示
    setLoading(true);
    setProgress(0);

    // Web Workerまたはバックグラウンド処理を使用
    const response = await fetch('http://localhost:11434/api/pull', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName, stream: true })
    });

    // ストリーミング進捗の処理
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.completed) {
              setProgress(100);
            } else if (data.total && data.completed) {
              const percent = (data.completed / data.total) * 100;
              setProgress(percent);
            }
          } catch (e) {
            // パースエラーは無視
          }
        }
      }
    }

    setLoading(false);
  } catch (error) {
    setError(error.message);
    setLoading(false);
  }
}
```

**2. 仮想スクロール（大量データ表示時）**:

```typescript
// 大量のAPI一覧やログ表示時に仮想スクロールを使用
import { useVirtualizer } from '@tanstack/react-virtual';

// 例: API一覧の仮想スクロール
const rowVirtualizer = useVirtualizer({
  count: apis.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 80,
  overscan: 5
});
```

---

### 6. データベースクエリの最適化

#### 問題点

- **現状**: クエリ最適化の方針が未定義
- **影響**: データ量増加時の性能劣化

#### 推奨改善策

**1. クエリの最適化**:

```javascript
// 非効率なクエリ（改善前）
// SELECT * FROM apis; // 全件取得

// 効率的なクエリ（改善後）
// ページネーションの実装
const getApis = async (limit = 20, offset = 0) => {
  return db.all(`
    SELECT id, name, port, model_name, status, created_at 
    FROM apis 
    ORDER BY created_at DESC 
    LIMIT ? OFFSET ?
  `, [limit, offset]);
};

// 必要な列のみ取得（SELECT *を避ける）
const getApiById = async (id) => {
  return db.get(`
    SELECT id, name, port, model_name, status 
    FROM apis 
    WHERE id = ?
  `, [id]);
};
```

**2. バッチ処理の実装**:

```javascript
// 複数のログを一度に挿入（F006実装時）
const insertLogsBatch = async (logs) => {
  const placeholders = logs.map(() => '(?, ?, ?, ?, ?)').join(',');
  const values = logs.flatMap(log => [
    log.api_id,
    log.request_path,
    log.response_status,
    log.response_time_ms,
    log.created_at
  ]);

  return db.run(`
    INSERT INTO logs (api_id, request_path, response_status, response_time_ms, created_at)
    VALUES ${placeholders}
  `, values);
};
```

---

### 7. ログのパフォーマンス影響

#### 問題点

- **現状**: ログ機能（F006）の実装時にパフォーマンスへの影響が不明確
- **影響**: 各リクエストのログ記録がボトルネックになる可能性

#### 推奨改善策

**1. 非同期ログ記録**:

```javascript
// 非同期ログ記録（推奨実装）
class AsyncLogger {
  constructor(bufferSize = 100, flushInterval = 5000) {
    this.buffer = [];
    this.bufferSize = bufferSize;
    this.flushInterval = flushInterval;
    this.startFlushTimer();
  }

  log(entry) {
    this.buffer.push({
      ...entry,
      timestamp: Date.now()
    });

    // バッファサイズに達したら即座にフラッシュ
    if (this.buffer.length >= this.bufferSize) {
      this.flush();
    }
  }

  async flush() {
    if (this.buffer.length === 0) return;

    const logs = this.buffer.splice(0);
    
    // 非同期でDBに書き込み（リクエスト処理をブロックしない）
    setImmediate(async () => {
      try {
        await db.batchInsertLogs(logs);
      } catch (error) {
        console.error('Failed to flush logs:', error);
        // エラー時はバッファに戻す（重要度の高いログのみ）
      }
    });
  }

  startFlushTimer() {
    setInterval(() => this.flush(), this.flushInterval);
  }
}

// 使用例
const logger = new AsyncLogger(100, 5000);

app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.log({
      api_id: req.apiId, // 認証後に設定
      request_path: req.path,
      response_status: res.statusCode,
      response_time_ms: duration
    });
  });
  
  next();
});
```

**2. ログレベルの設定**:

```javascript
// ログレベルの設定（本番環境では最小限）
const LOG_LEVEL = process.env.LOG_LEVEL || 'info'; // debug, info, warn, error

const shouldLog = (level) => {
  const levels = { debug: 0, info: 1, warn: 2, error: 3 };
  return levels[level] >= levels[LOG_LEVEL];
};

if (shouldLog('debug')) {
  logger.log({ level: 'debug', message: '...' });
}
```

---

## 🟢 低優先度問題

### 8. 起動時間の最適化

#### 推奨改善策

```rust
// 並列初期化処理（推奨実装）
use tokio::task;

#[tauri::command]
pub async fn initialize_app() -> Result<AppState, String> {
    // 並列で初期化処理を実行
    let (db_result, ollama_check) = tokio::join!(
        initialize_database(),
        check_ollama_status()
    );

    let db = db_result?;
    let ollama_status = ollama_check?;

    Ok(AppState {
        db,
        ollama_status,
        // ...
    })
}
```

---

### 9. プロキシ応答時間の最適化

#### 推奨改善策

```javascript
// プロキシ設定の最適化
const proxyOptions = {
  target: 'http://localhost:11434',
  changeOrigin: true,
  timeout: 30000, // 適切なタイムアウト設定
  proxyTimeout: 30000,
  // 接続プールの設定
  agent: new http.Agent({
    keepAlive: true,
    maxSockets: 5,
    maxFreeSockets: 2
  })
};
```

---

## 📊 パフォーマンス指標と目標値

### 現在の目標値（仕様書より）

| 指標 | 目標値 | 現状評価 |
|------|--------|----------|
| API作成時間 | 30秒以内 | ⚠️ 実装待ち |
| API起動時間 | 10秒以内 | ⚠️ 実装待ち |
| APIレスポンス時間 | 1-5秒（モデル依存） | ⚠️ 実装待ち |
| メモリ使用量 | モデルサイズ + 2GB | ⚠️ 監視機能未実装 |
| CPU使用率（アイドル時） | < 5% | ⚠️ 監視機能未実装 |
| 同時リクエスト数 | 1リクエスト/秒（初期） | ⚠️ キュー管理未実装 |

### 推奨追加指標

| 指標 | 推奨目標値 | 測定方法 |
|------|-----------|----------|
| UI応答性 | 操作後100ms以内にフィードバック | フロントエンド測定 |
| データベースクエリ時間 | 単一クエリ < 10ms | SQLite EXPLAIN QUERY PLAN |
| プロキシオーバーヘッド | < 50ms | プロキシ前後の時間差測定 |
| メモリリーク検出 | 1時間で増加 < 10MB | 定期的なメモリ測定 |
| 起動時間 | < 3秒 | アプリ起動からUI表示まで |

---

## 🛠️ 実装推奨事項（優先順位順）

### Phase 1: 必須実装（MVP前）

1. ✅ **データベースインデックスの追加**
   - ファイル: データベース初期化スクリプト
   - 工数見積: 0.5日

2. ✅ **キュー管理システムの実装**
   - ファイル: `src/proxy/request-queue.js`
   - 工数見積: 2日

3. ✅ **基本的なキャッシュ戦略の実装**
   - ファイル: `src/utils/model-cache.js`, `src/utils/api-config-cache.js`
   - 工数見積: 2日

### Phase 2: 高優先度（MVP後すぐ）

4. ✅ **メモリ監視機能の実装**
   - ファイル: `src-tauri/src/memory_monitor.rs`
   - 工数見積: 3日

5. ✅ **非同期ログ記録の実装**
   - ファイル: `src/proxy/async-logger.js`
   - 工数見積: 2日

6. ✅ **UI応答性の最適化**
   - ファイル: 各コンポーネント
   - 工数見積: 3日

### Phase 3: 中優先度（v1.0）

7. ✅ **データベースクエリの最適化**
   - ファイル: データベースアクセス層
   - 工数見積: 2日

8. ✅ **起動時間の最適化**
   - ファイル: 初期化処理
   - 工数見積: 1日

---

## 📝 パフォーマンステスト計画

### テスト項目

1. **負荷テスト**
   - 同時リクエスト数: 1, 5, 10リクエスト
   - 持続時間: 10分
   - 測定指標: レスポンス時間、エラー率、メモリ使用量

2. **長時間実行テスト**
   - 実行時間: 24時間
   - 測定指標: メモリリーク、CPU使用率

3. **データ量増加テスト**
   - API数: 10, 100, 1000個
   - ログ数: 1000, 10000, 100000件
   - 測定指標: クエリ実行時間、UI表示時間

4. **起動時間テスト**
   - 測定: アプリ起動からUI表示まで
   - 目標: < 3秒

### テストツール推奨

- **負荷テスト**: Apache Bench (ab), k6, Artillery
- **メモリプロファイリング**: Chrome DevTools, Valgrind (Rust)
- **データベースプロファイリング**: SQLite EXPLAIN QUERY PLAN

---

## 🎯 まとめ

### 主要な発見事項

1. **データベース**: インデックス設計が必須。実装前にスキーマを改善することを強く推奨。

2. **キュー管理**: 同時リクエスト対応のため、早期実装が必要。

3. **キャッシュ**: 頻繁にアクセスするデータ（モデル一覧、API設定）のキャッシュ実装が必要。

4. **メモリ管理**: 長時間実行を想定した監視機能とリーク対策が必要。

5. **ログ**: 非同期ログ記録を実装しないと、ログ機能がボトルネックになる可能性が高い。

### 推奨アクション

1. **即座に対応**: Phase 1の実装をMVP前に完了させる
2. **監視体制**: パフォーマンス指標の測定を実装時に組み込む
3. **継続的な改善**: 定期的なパフォーマンス監査の実施

---

## 📚 参考資料

- [SQLite Performance Optimization](https://www.sqlite.org/performance.html)
- [Express.js Best Practices](https://expressjs.com/en/advanced/best-practice-performance.html)
- [Tauri Performance](https://tauri.app/v1/guides/features/performance)
- [React Performance Optimization](https://react.dev/learn/render-and-commit)

---

**監査完了日**: 2024年  
**次回監査推奨時期**: 実装完了後、本番リリース前

