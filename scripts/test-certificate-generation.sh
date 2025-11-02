#!/bin/bash

# FLM - 証明書自動生成機能テスト実行スクリプト
# 
# TEST_EXECUTION_GUIDE.mdに基づくテスト実行スクリプト
# 証明書自動生成機能のテストを自動実行します

set -e

echo ""
echo "=========================================="
echo "FLM - 証明書自動生成機能テスト"
echo "=========================================="
echo ""

# OpenSSLの確認
echo "1. OpenSSLの確認中..."
if command -v openssl &> /dev/null; then
    OPENSSL_VERSION=$(openssl version 2>&1)
    echo "   ✅ OpenSSLが利用可能です: $OPENSSL_VERSION"
else
    echo "   ⚠️  OpenSSLが利用できません"
    echo "      macOS: brew install openssl"
    echo "      Linux: apt-get install openssl"
fi
echo ""

# Node.jsの確認
echo "2. Node.jsの確認中..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "   ✅ Node.jsが利用可能です: $NODE_VERSION"
else
    echo "   ❌ Node.jsが見つかりません"
    exit 1
fi
echo ""

# npmの確認
echo "3. npmの確認中..."
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo "   ✅ npmが利用可能です: $NPM_VERSION"
else
    echo "   ❌ npmが見つかりません"
    exit 1
fi
echo ""

# 単体テストの実行
echo "4. 証明書自動生成機能単体テストを実行中..."
echo ""

if npm test -- tests/unit/certificate-generation.test.ts; then
    echo ""
    echo "   ✅ 単体テストが成功しました"
    UNIT_TEST_RESULT=0
else
    echo ""
    echo "   ❌ 単体テストが失敗しました"
    UNIT_TEST_RESULT=1
fi
echo ""

# 統合テストの実行
echo "5. 証明書自動生成機能統合テストを実行中..."
echo ""

if npm test -- tests/integration/certificate-auto-generation.test.ts; then
    echo ""
    echo "   ✅ 統合テストが成功しました"
    INTEGRATION_TEST_RESULT=0
else
    echo ""
    echo "   ❌ 統合テストが失敗しました"
    INTEGRATION_TEST_RESULT=1
fi
echo ""

# テスト結果のサマリー
echo "=========================================="
echo "テスト結果サマリー"
echo "=========================================="
echo ""

if [ $UNIT_TEST_RESULT -eq 0 ]; then
    echo "✅ 単体テスト: 成功"
else
    echo "❌ 単体テスト: 失敗"
fi

if [ $INTEGRATION_TEST_RESULT -eq 0 ]; then
    echo "✅ 統合テスト: 成功"
else
    echo "❌ 統合テスト: 失敗"
fi

echo ""

if [ $UNIT_TEST_RESULT -eq 0 ] && [ $INTEGRATION_TEST_RESULT -eq 0 ]; then
    echo "✅ すべてのテストが成功しました！"
    echo ""
    echo "次のステップ:"
    echo "1. Tauriアプリケーションから実際のAPIを作成してテスト"
    echo "2. ブラウザでAPIエンドポイントにアクセスして確認"
    echo "3. 外部デバイスからアクセスして外部公開を確認"
    exit 0
else
    echo "❌ 一部のテストが失敗しました"
    echo ""
    echo "トラブルシューティング:"
    echo "1. OpenSSLが正しくインストールされているか確認"
    echo "2. データディレクトリの書き込み権限を確認"
    echo "3. ディスク容量を確認"
    echo "4. TEST_EXECUTION_GUIDE.mdを参照"
    exit 1
fi

