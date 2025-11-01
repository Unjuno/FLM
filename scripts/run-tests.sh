#!/bin/bash

# FLM - テスト実行スクリプト
# 
# フェーズ4: QAエージェント (QA) 実装
# 全てのテストを実行し、カバレッジレポートを生成

set -e

echo "=========================================="
echo "FLM - テスト実行"
echo "=========================================="

# 単体テスト
echo ""
echo "単体テストを実行中..."
if command -v npm &> /dev/null; then
  npm test -- --testPathPattern=unit --coverage
  echo "✓ 単体テスト完了"
else
  echo "⚠ npmが見つかりません。スキップします。"
fi

# 統合テスト
echo ""
echo "統合テストを実行中..."
if command -v npm &> /dev/null; then
  npm test -- --testPathPattern=integration --coverage
  echo "✓ 統合テスト完了"
else
  echo "⚠ npmが見つかりません。スキップします。"
fi

# E2Eテスト
echo ""
echo "E2Eテストを実行中..."
if command -v npm &> /dev/null; then
  npm test -- --testPathPattern=e2e --coverage
  echo "✓ E2Eテスト完了"
else
  echo "⚠ npmが見つかりません。スキップします。"
fi

# カバレッジレポート生成
echo ""
echo "カバレッジレポートを生成中..."
if command -v npm &> /dev/null; then
  npm run test:coverage
  echo "✓ カバレッジレポート生成完了"
  echo ""
  echo "カバレッジレポート: coverage/index.html"
else
  echo "⚠ npmが見つかりません。スキップします。"
fi

echo ""
echo "=========================================="
echo "テスト実行完了"
echo "=========================================="

