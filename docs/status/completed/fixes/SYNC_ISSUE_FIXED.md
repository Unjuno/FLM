# EngineProcessController Sync問題の解決

> Status: Completed | Date: 2025-11-21

## 実施した修正

### 1. `EngineProcessController`トレイトに`Send + Sync`バウンドを追加

**ファイル**: `crates/flm-core/src/ports/engine.rs`

```rust
// 修正前
pub trait EngineProcessController {
    fn detect_binaries(&self) -> Vec<EngineBinaryInfo>;
    fn detect_running(&self) -> Vec<EngineRuntimeInfo>;
}

// 修正後
pub trait EngineProcessController: Send + Sync {
    fn detect_binaries(&self) -> Vec<EngineBinaryInfo>;
    fn detect_running(&self) -> Vec<EngineRuntimeInfo>;
}
```

### 2. `AppState`に`engine_service`を復元

**ファイル**: `crates/flm-proxy/src/middleware.rs`

- `engine_service`フィールドを復元
- `Arc<EngineService>`として保持

### 3. 認証ミドルウェアを復元

**ファイル**: `crates/flm-proxy/src/controller.rs`

- `auth_middleware`をルーターに追加
- `from_fn_with_state`を使用

## 影響範囲

### 既存の実装への影響

1. ✅ `NoopProcessController` (`flm-proxy`)
   - 既に`unsafe impl Sync`と`unsafe impl Send`を実装済み
   - 影響なし

2. ✅ `DefaultEngineProcessController` (`flm-cli`)
   - 内部状態を持たない構造体
   - `Send + Sync`を自動実装
   - 影響なし

3. ✅ テスト内の`NoopProcessController` (`flm-core`)
   - 内部状態を持たない構造体
   - `Send + Sync`を自動実装
   - 影響なし

## 検証結果

- ✅ `flm-core`: コンパイル成功
- ✅ `flm-cli`: コンパイル成功
- ✅ `flm-proxy`: コンパイル成功
- ✅ ワークスペース全体: コンパイル成功

## 次のステップ

axum 0.7の`State`エクストラクタ問題の解決に進みます。

