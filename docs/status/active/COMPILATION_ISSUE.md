# コンパイルエラー調査レポート

> Status: In Progress | Date: 2025-11-21

## 問題の概要

`flm-proxy`クレートで、以下の2つのコンパイルエラーが発生しています：

1. `handle_models`と`handle_chat_completions`ハンドラー関数がaxumの`Handler`トレイトを実装していない
2. `EngineProcessController`トレイトオブジェクトが`Sync`を実装していない

## エラーメッセージ

### エラー1: Handlerトレイト
```
error[E0277]: the trait bound `fn(State<AppState>) -> ... {handle_models}: Handler<_, _>` is not satisfied
```

### エラー2: Syncトレイト
```
error[E0277]: `(dyn EngineProcessController + 'static)` cannot be shared between threads safely
help: the trait `Sync` is not implemented for `(dyn EngineProcessController + 'static)`
```

## 調査結果

### 1. 現在の実装

- `handle_models`: `State<AppState>`エクストラクタを使用
- `handle_chat_completions`: `State<AppState>`と`Json<OpenAiChatRequest>`エクストラクタを使用
- `handle_health`: エクストラクタを使用せず、正常に動作
- `EngineService`: `Box<dyn EngineProcessController>`を保持
- `AppState`: `Arc<EngineService>`を保持（`Sync`が必要）

### 2. 試行した解決策

#### エラー1（Handlerトレイト）:
1. ✅ 未使用インポート警告の修正（完了）
2. ❌ `Router::with_state()`の順序変更（効果なし）
3. ❌ クロージャでのラップ（効果なし）
4. ✅ 一時的にコメントアウト（エラー1は回避）

#### エラー2（Syncトレイト）:
1. ✅ `NoopProcessController`に`Clone`を追加（効果なし）
2. ✅ `NoopProcessController`に`unsafe impl Sync`を追加（効果なし）
3. ⏳ トレイトオブジェクトの問題のため、`EngineService`の構造変更が必要

### 3. 原因の仮説

#### エラー1:
axum 0.7では、`State`エクストラクタを使うハンドラー関数の型推論に問題がある可能性があります。

#### エラー2:
`EngineService`が`Arc`で保持されているため、`Sync`が必要ですが、`dyn EngineProcessController`が`Sync`を実装していません。これは既存の問題で、`EngineService`の構造を変更する必要があります。

## 次のステップ

### エラー1の解決策:
1. axum 0.7のドキュメントを確認
2. `Extension`エクストラクタを使う方法を試す
3. ハンドラー関数のシグネチャを明示的に指定する方法を試す
4. 既存の動作している実装（Phase 2完了時）を確認

### エラー2の解決策:
1. `EngineService`を`Arc`で保持しない方法を検討
2. `EngineProcessController`トレイトに`Sync`バウンドを追加（破壊的変更）
3. `EngineService`を`AppState`から分離

## 参考情報

- axum 0.7.9を使用
- `AppState`は`Clone`を実装
- `auth_middleware`は`State`エクストラクタを使用して正常に動作（ただし、現在はコメントアウト中）

## 現在の状態

- `/health`エンドポイント: ✅ 動作
- `/v1/models`エンドポイント: ⏸️ コメントアウト中
- `/v1/chat/completions`エンドポイント: ⏸️ コメントアウト中
- 認証ミドルウェア: ⏸️ コメントアウト中
