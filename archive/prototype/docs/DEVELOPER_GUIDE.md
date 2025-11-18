# 開発者ガイド

このドキュメントは、FLMプロジェクトの開発者向けガイドです。

## 目次

1. [開発環境セットアップ](#開発環境セットアップ)
2. [プロジェクト構造](#プロジェクト構造)
3. [データベースマイグレーション](#データベースマイグレーション)
4. [コントリビューションガイド](#コントリビューションガイド)

---

## 開発環境セットアップ

詳細は [開発環境セットアップ](./DEVELOPMENT_SETUP.md) を参照してください。

---

## プロジェクト構造

詳細は [プロジェクト構造](./PROJECT_STRUCTURE.md) を参照してください。

---

## データベースマイグレーション

### 概要

FLMでは、データベーススキーマの変更をマイグレーションシステムで管理しています。

### マイグレーションファイル

マイグレーションは `src-tauri/src/database/migrations.rs` で定義されています。

### マイグレーションの実行

マイグレーションは、アプリケーション起動時に自動的に実行されます：

```rust
// src-tauri/src/database/mod.rs
pub fn initialize_database() -> Result<Connection, DatabaseError> {
    let conn = get_connection()?;
    
    // スキーマ作成
    if let Err(e) = schema::create_schema(&conn) {
        return Err(e);
    }
    
    // マイグレーション実行
    let mut conn = conn;
    if let Err(e) = migrations::run_migrations(&mut conn) {
        return Err(e);
    }
    
    Ok(conn)
}
```

### 新しいマイグレーションの追加

新しいマイグレーションを追加する場合は、以下の手順に従ってください：

1. **`migrations.rs`の`run_migrations`関数に新しいマイグレーションを追加**

```rust
pub fn run_migrations(conn: &mut Connection) -> Result<(), DatabaseError> {
    let current_version = get_current_version(conn)?;
    
    // 既存のマイグレーション...
    
    // 新しいマイグレーションを追加
    if current_version < 4 {
        apply_migration(conn, 4, "your_migration_name", |conn_ref| {
            // マイグレーション処理を実装
            conn_ref.execute(
                "ALTER TABLE apis ADD COLUMN new_column TEXT",
                [],
            )?;
            Ok(())
        })?;
    }
    
    Ok(())
}
```

2. **マイグレーションのテスト**

マイグレーションを追加したら、必ずテストを実行してください：

```bash
cd src-tauri
cargo test --test migrations
```

3. **スキーマ定義の更新**

`DOCKS/DATABASE_SCHEMA.sql` も更新してください。

### マイグレーション履歴の確認

マイグレーション履歴は、`migrations`テーブルで確認できます：

```sql
SELECT version, name, applied_at FROM migrations ORDER BY version;
```

### マイグレーションのロールバック

現在の実装では、マイグレーションのロールバック機能は提供されていません。スキーマ変更が必要な場合は、新しいマイグレーションで対応してください。

### ベストプラクティス

1. **後方互換性の維持**: 既存のデータを壊さないように注意してください
2. **トランザクションの使用**: マイグレーションは自動的にトランザクション内で実行されます
3. **インデックスの追加**: パフォーマンスに影響する場合は、インデックスの追加も検討してください
4. **テストの追加**: マイグレーションごとにテストを追加してください

---

## コントリビューションガイド

### コードスタイル

- **TypeScript**: ESLintとPrettierを使用
- **Rust**: `cargo fmt`と`cargo clippy`を使用

### コミットメッセージ

コミットメッセージは、以下の形式に従ってください：

```
<type>: <subject>

<body>
```

**type**: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

### プルリクエスト

1. 新しいブランチを作成: `git checkout -b feature/your-feature-name`
2. 変更をコミット: `git commit -m "feat: add new feature"`
3. ブランチをプッシュ: `git push origin feature/your-feature-name`
4. プルリクエストを作成

### テスト

プルリクエストを送信する前に、必ずテストを実行してください：

```bash
# 全テスト実行
npm test

# カバレッジ確認
npm run test:coverage

# Rustテスト
cd src-tauri
cargo test
```

---

## その他のリソース

- [アーキテクチャ設計書](../DOCKS/ARCHITECTURE.md)
- [API仕様書](../DOCKS/INTERFACE_SPEC.md)
- [データベーススキーマ](../DOCKS/DATABASE_SCHEMA.sql)
