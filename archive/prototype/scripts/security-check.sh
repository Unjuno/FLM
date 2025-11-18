#!/bin/bash
# セキュリティチェックスクリプト
# npm auditとcargo auditを実行して依存関係の脆弱性をチェックします

set -e

echo "🔍 セキュリティチェックを開始します..."

# npm auditの実行
echo ""
echo "📦 npm依存関係の脆弱性チェック..."
npm audit --audit-level=moderate

# cargo auditの実行（cargo-auditがインストールされている場合）
if command -v cargo-audit &> /dev/null; then
    echo ""
    echo "🦀 Cargo依存関係の脆弱性チェック..."
    cd src-tauri
    cargo audit
    cd ..
else
    echo ""
    echo "⚠️  cargo-auditがインストールされていません。"
    echo "   インストールするには: cargo install cargo-audit"
    echo "   または: cargo install --locked cargo-audit"
fi

echo ""
echo "✅ セキュリティチェックが完了しました。"

