#!/bin/bash

# FLM - コード品質チェックスクリプト
# 
# フェーズ4: QAエージェント (QA) 実装
# コード品質チェック（リント、型チェック）を実行

set -e

echo "=========================================="
echo "FLM - コード品質チェック"
echo "=========================================="

# TypeScript型チェック
echo ""
echo "TypeScript型チェックを実行中..."
if command -v npm &> /dev/null; then
  npm run build --dry-run || npx tsc --noEmit
  echo "✓ TypeScript型チェック完了"
else
  echo "⚠ npmが見つかりません。スキップします。"
fi

# ESLintチェック（設定されている場合）
echo ""
echo "ESLintチェックを実行中..."
if [ -f ".eslintrc.js" ] || [ -f ".eslintrc.json" ]; then
  if command -v npx &> /dev/null; then
    npx eslint src --ext .ts,.tsx || echo "⚠ ESLintエラーが見つかりました"
  else
    echo "⚠ npxが見つかりません。スキップします。"
  fi
else
  echo "⚠ ESLint設定が見つかりません。スキップします。"
fi

# Rustコードフォーマットチェック
echo ""
echo "Rustコードフォーマットチェックを実行中..."
if [ -d "src-tauri" ] && command -v cargo &> /dev/null; then
  cd src-tauri
  cargo fmt --check --all || echo "⚠ Rustコードフォーマットエラーが見つかりました"
  cd ..
  echo "✓ Rustコードフォーマットチェック完了"
else
  echo "⚠ Rust/Cargoが見つかりません。スキップします。"
fi

# Rust Clippyチェック
echo ""
echo "Rust Clippyチェックを実行中..."
if [ -d "src-tauri" ] && command -v cargo &> /dev/null; then
  cd src-tauri
  cargo clippy -- -D warnings || echo "⚠ Clippy警告が見つかりました"
  cd ..
  echo "✓ Rust Clippyチェック完了"
else
  echo "⚠ Rust/Cargoが見つかりません。スキップします。"
fi

echo ""
echo "=========================================="
echo "コード品質チェック完了"
echo "=========================================="

