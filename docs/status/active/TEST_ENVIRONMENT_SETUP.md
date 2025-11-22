# テスト環境整備ガイド

> Status: Setup Guide | Date: 2025-11-21

## 前提条件

### 必要なツール

1. **Rust ツールチェーン**
   - プロジェクトは `rust-toolchain.toml` で `nightly` を指定
   - `edition2024` を要求する依存関係（`home`, `base64ct`）に対応するため

2. **システム依存関係**
   - OpenSSL開発ヘッダ（Windows: vcpkg、Linux: `libssl-dev`、macOS: `openssl` via Homebrew）

## 環境整備手順

### 1. Rust ツールチェーンのインストール

```bash
# nightlyツールチェーンのインストール
rustup toolchain install nightly

# 必要なコンポーネントの追加
rustup component add rustfmt clippy --toolchain nightly
```

### 2. プロジェクトの確認

`rust-toolchain.toml` が存在する場合、自動的にnightlyツールチェーンが使用されます。

```bash
# ツールチェーンの確認
rustup show

# プロジェクトディレクトリで確認
cd /path/to/FLM
rustup run nightly cargo --version
```

### 3. 依存関係の確認

```bash
# コンパイルチェック
rustup run nightly cargo check --workspace

# フォーマットチェック
rustup run nightly cargo fmt --all -- --check

# Clippyチェック
rustup run nightly cargo clippy --workspace --all-targets -- -D warnings
```

### 4. テストの実行

```bash
# すべてのテストを実行
rustup run nightly cargo test --workspace

# ライブラリテストのみ
rustup run nightly cargo test --workspace --lib

# 統合テストのみ
rustup run nightly cargo test --workspace --test '*'
```

## 環境変数

### 推奨設定

```bash
# Windows (PowerShell)
$env:CARGO_TARGET_DIR = "target"
$env:RUST_BACKTRACE = "1"

# Linux/macOS
export CARGO_TARGET_DIR=target
export RUST_BACKTRACE=1
```

## トラブルシューティング

### 問題1: `edition2024` エラー

**症状**: 
```
error: edition 2024 is unstable and only available with `-Z unstable-options`
```

**解決策**:
- `rust-toolchain.toml` で `nightly` を指定
- `rustup toolchain install nightly` を実行

### 問題2: OpenSSL エラー

**症状**:
```
error: failed to run custom build command for `openssl-sys`
```

**解決策**:
- **Windows**: vcpkgを使用してOpenSSLをインストール
- **Linux**: `sudo apt-get install libssl-dev pkg-config`
- **macOS**: `brew install openssl pkg-config`

### 問題3: テストが実行できない

**症状**: テストがタイムアウトまたは失敗する

**解決策**:
- 一時ファイルのクリーンアップ: `cargo clean`
- テストの並列実行を無効化: `cargo test -- --test-threads=1`
- デバッグモードで実行: `RUST_BACKTRACE=1 cargo test`

## 検証コマンド

環境が正しく整備されているか確認するためのコマンド：

```bash
# 1. ツールチェーンの確認
rustup show

# 2. コンパイルチェック
rustup run nightly cargo check --workspace

# 3. フォーマットチェック
rustup run nightly cargo fmt --all -- --check

# 4. Clippyチェック
rustup run nightly cargo clippy --workspace --all-targets -- -D warnings

# 5. テスト実行
rustup run nightly cargo test --workspace --lib
```

すべてのコマンドが成功すれば、テスト環境は整備されています。

## CI/CD環境

### GitHub Actions での使用例

```yaml
- name: Install Rust nightly
  uses: actions-rs/toolchain@v1
  with:
    toolchain: nightly
    components: rustfmt, clippy
    override: true

- name: Check
  run: cargo check --workspace

- name: Format
  run: cargo fmt --all -- --check

- name: Clippy
  run: cargo clippy --workspace --all-targets -- -D warnings

- name: Test
  run: cargo test --workspace
```

## 参考資料

- `rust-toolchain.toml`: プロジェクトのツールチェーン設定
- `docs/status/PHASE1_TEST_VERIFICATION.md`: テスト実装状況
- `docs/status/PHASE1_SAFETY_SUMMARY.md`: 安全性チェック結果

---

**作成日**: 2025-11-21  
**更新日**: 2025-11-21

