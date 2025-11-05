# データベーススキーマ説明文書

この文書は、FLMプロジェクトで使用するSQLiteデータベースのスキーマ設計と使用方法を説明します。

---

## 概要

FLMでは、アプリケーションのデータを永続化するためにSQLiteデータベースを使用しています。データベースはアプリケーションのデータディレクトリに保存され、ユーザーのAPI設定、APIキー、モデル情報などを管理します。

---

## データベースファイルの場所

- **Windows**: `%APPDATA%\FLM\flm.db`
- **macOS**: `~/Library/Application Support/FLM/flm.db`
- **Linux**: `~/.local/share/FLM/flm.db`

---

## テーブル構造

### 1. `apis` テーブル

API設定情報を保存します。

#### スキーマ

```sql
CREATE TABLE apis (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    model TEXT NOT NULL,
    port INTEGER NOT NULL,
    enable_auth INTEGER NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
```

#### カラム説明

| カラム名 | 型 | 説明 |
|---------|-----|------|
| `id` | TEXT | APIの一意識別子（UUID） |
| `name` | TEXT | API名（ユーザーが設定） |
| `model` | TEXT | 使用するOllamaモデル名（例: "llama3:8b"） |
| `port` | INTEGER | 認証プロキシのポート番号（例: 8080） |
| `enable_auth` | INTEGER | 認証が有効かどうか（0: 無効, 1: 有効） |
| `status` | TEXT | APIのステータス（"running", "stopped", "error"） |
| `created_at` | TEXT | 作成日時（RFC3339形式） |
| `updated_at` | TEXT | 更新日時（RFC3339形式） |

#### 使用例

```rust
// APIを作成
let api = Api {
    id: Uuid::new_v4().to_string(),
    name: "My API".to_string(),
    model: "llama3:8b".to_string(),
    port: 8080,
    enable_auth: true,
    status: ApiStatus::Stopped,
    created_at: Utc::now(),
    updated_at: Utc::now(),
};
```

---

### 2. `api_keys` テーブル

APIキー情報を暗号化して保存します。

#### スキーマ

```sql
CREATE TABLE api_keys (
    id TEXT PRIMARY KEY,
    api_id TEXT NOT NULL,
    key_hash TEXT NOT NULL,
    encrypted_key BLOB NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (api_id) REFERENCES apis(id) ON DELETE CASCADE
);
```

#### カラム説明

| カラム名 | 型 | 説明 |
|---------|-----|------|
| `id` | TEXT | APIキーの一意識別子（UUID） |
| `api_id` | TEXT | 関連するAPIのID（外部キー） |
| `key_hash` | TEXT | APIキーのSHA-256ハッシュ（検証用） |
| `encrypted_key` | BLOB | 暗号化されたAPIキー（AES-256-GCM） |
| `created_at` | TEXT | 作成日時（RFC3339形式） |
| `updated_at` | TEXT | 更新日時（RFC3339形式） |

#### セキュリティ

- APIキーは**AES-256-GCM**で暗号化されて保存されます
- ハッシュは認証プロキシでの検証に使用されます
- 元のAPIキーは作成時のみ表示され、その後は復号化して表示します

---

### 3. `models_catalog` テーブル

モデルカタログ情報をキャッシュします。

#### スキーマ

```sql
CREATE TABLE models_catalog (
    name TEXT PRIMARY KEY,
    description TEXT,
    size INTEGER,
    parameters INTEGER,
    category TEXT,
    recommended INTEGER,
    author TEXT,
    license TEXT,
    tags TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
```

#### カラム説明

| カラム名 | 型 | 説明 |
|---------|-----|------|
| `name` | TEXT | モデル名（主キー、例: "llama3:8b"） |
| `description` | TEXT | モデルの説明 |
| `size` | INTEGER | モデルのサイズ（バイト） |
| `parameters` | INTEGER | パラメータ数 |
| `category` | TEXT | カテゴリ（"chat", "code", "translation"など） |
| `recommended` | INTEGER | 推奨モデルかどうか（0: 非推奨, 1: 推奨） |
| `author` | TEXT | 作成者名 |
| `license` | TEXT | ライセンス情報 |
| `tags` | TEXT | タグ（JSON配列形式の文字列） |
| `created_at` | TEXT | 作成日時（RFC3339形式） |
| `updated_at` | TEXT | 更新日時（RFC3339形式） |

---

### 4. `installed_models` テーブル

インストール済みモデルの情報を管理します。

#### スキーマ

```sql
CREATE TABLE installed_models (
    name TEXT PRIMARY KEY,
    size INTEGER NOT NULL,
    parameters INTEGER,
    installed_at TEXT NOT NULL,
    last_used_at TEXT,
    usage_count INTEGER NOT NULL DEFAULT 0
);
```

#### カラム説明

| カラム名 | 型 | 説明 |
|---------|-----|------|
| `name` | TEXT | モデル名（主キー） |
| `size` | INTEGER | モデルのサイズ（バイト） |
| `parameters` | INTEGER | パラメータ数（オプション） |
| `installed_at` | TEXT | インストール日時（RFC3339形式） |
| `last_used_at` | TEXT | 最終使用日時（RFC3339形式、NULL可） |
| `usage_count` | INTEGER | 使用回数（デフォルト: 0） |

---

### 5. `user_settings` テーブル

ユーザー設定を保存します。

#### スキーマ

```sql
CREATE TABLE user_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
```

#### カラム説明

| カラム名 | 型 | 説明 |
|---------|-----|------|
| `key` | TEXT | 設定キー（主キー、例: "theme", "language"） |
| `value` | TEXT | 設定値（JSON形式） |
| `updated_at` | TEXT | 更新日時（RFC3339形式） |

---

## データアクセス層（Repository パターン）

FLMでは、Repository パターンを使用してデータベースアクセスを抽象化しています。

### 主なRepository

1. **`ApiRepository`**: API設定の管理
2. **`ApiKeyRepository`**: APIキーの管理
3. **`ModelCatalogRepository`**: モデルカタログ情報の管理
4. **`InstalledModelRepository`**: インストール済みモデルの管理
5. **`UserSettingRepository`**: ユーザー設定の管理

### 使用例

```rust
use crate::database::connection::get_connection;
use crate::database::repository::ApiRepository;

// データベース接続を取得
let conn = get_connection()?;

// Repositoryを作成
let api_repo = ApiRepository::new(&conn);

// APIを作成
api_repo.create(&api)?;

// APIを取得
let api = api_repo.find_by_id(&api_id)?;

// APIを更新
api_repo.update(&api)?;

// APIを削除
api_repo.delete(&api_id)?;
```

---

## データマイグレーション

データベーススキーマの変更は、マイグレーション機能を使用して管理されます。

### マイグレーションの実行

アプリケーション起動時に、`database::init_database()`が自動的にマイグレーションを実行します。

### マイグレーションの作成

新しいマイグレーションを作成する場合は、`src-tauri/src/database/migrations.rs`に追加します。

```rust
pub fn migration_v2() -> Migration {
    Migration {
        version: 2,
        name: "add_new_column".to_string(),
        up: "ALTER TABLE apis ADD COLUMN new_column TEXT;".to_string(),
        down: "ALTER TABLE apis DROP COLUMN new_column;".to_string(),
    }
}
```

---

## エラーハンドリング

データベース操作は、`DatabaseError`型でエラーを返します。エラーメッセージは非開発者向けに作成されています。

### エラー例

```rust
match api_repo.find_by_id(&api_id) {
    Ok(api) => println!("API found: {}", api.name),
    Err(DatabaseError::NotFound) => println!("API not found"),
    Err(e) => println!("Database error: {}", e),
}
```

---

## セキュリティ考慮事項

1. **APIキーの暗号化**: すべてのAPIキーはAES-256-GCMで暗号化されます
2. **SQLインジェクション対策**: パラメータ化クエリを使用
3. **外部キー制約**: データ整合性を保証

---

## トラブルシューティング

### データベースが見つからない

- アプリケーションデータディレクトリが正しく作成されているか確認
- データベースファイルのパスを確認

### マイグレーションエラー

- マイグレーション履歴を確認（`migrations`テーブル）
- 必要に応じてデータベースをリセット

### パフォーマンス問題

- インデックスの追加を検討
- クエリの最適化

---

## 関連ドキュメント

- `DOCKS/DATABASE_SCHEMA.sql`: SQLスキーマ定義
- `src-tauri/src/database/schema.rs`: Rust実装
- `src-tauri/src/database/repository.rs`: Repository実装
