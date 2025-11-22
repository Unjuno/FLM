# ストリーミング対応の改善完了

> Status: Completed | Date: 2025-11-21

## 実施した改善

### 1. エラーハンドリングの改善

**ファイル**: `crates/flm-proxy/src/controller.rs`

- `Err(_)`を具体的なエラー型に変更
- エラーの種類に応じた適切なHTTPステータスコードを返す
- エラーメッセージを詳細化

### 2. `unwrap()`の削除

**ファイル**: `crates/flm-proxy/src/controller.rs`

- `Event::default().json_data(data).unwrap()`を`match`式に変更
- シリアライゼーションエラーを適切に処理

### 3. ストリーム終了処理の改善

**ファイル**: `crates/flm-proxy/src/controller.rs`

- `is_done`チェックを早期に実行
- `[DONE]`マーカーの送信タイミングを改善

### 4. 使用統計の処理改善

**ファイル**: `crates/flm-proxy/src/controller.rs`

- `chunk.usage`が`Option<UsageStats>`なので、存在する場合のみレスポンスに含める
- 使用統計の形式をOpenAI互換に統一

## 改善内容の詳細

### エラーハンドリング

```rust
// 改善前
Err(_) => {
    return (StatusCode::INTERNAL_SERVER_ERROR, ...)
}

// 改善後
Err(e) => {
    let (status, message) = match e {
        EngineError::NotFound { .. } => (StatusCode::NOT_FOUND, "Engine not found"),
        EngineError::NetworkError { .. } => (StatusCode::BAD_GATEWAY, "Network error"),
        EngineError::InvalidResponse { .. } => (StatusCode::BAD_GATEWAY, "Invalid response from engine"),
        _ => (StatusCode::INTERNAL_SERVER_ERROR, "Failed to start streaming chat"),
    };
    return (status, ...)
}
```

### ストリームエラーの処理

```rust
// 改善前
Err(_) => Err(axum::Error::new(...))

// 改善後
Err(e) => {
    let error_msg = match e {
        EngineError::NetworkError { reason } => reason,
        EngineError::InvalidResponse { reason } => reason,
        EngineError::ApiError { reason, .. } => reason,
        _ => "Stream error".to_string(),
    };
    Err(axum::Error::new(...))
}
```

## 検証結果

- ✅ ワークスペース全体: コンパイル成功
- ✅ フォーマット: 問題なし
- ✅ Clippy: 警告なし

## 次のステップ

1. エンジンアダプターのテスト実装

