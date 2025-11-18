# FLM - 証明書自動生成機能テスト実行スクリプト
# 
# TEST_EXECUTION_GUIDE.mdに基づくテスト実行スクリプト
# 証明書自動生成機能のテストを自動実行します

param(
    [switch]$SkipUnitTests,
    [switch]$SkipIntegrationTests,
    [switch]$Verbose
)

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "FLM - 証明書自動生成機能テスト" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

$ErrorActionPreference = "Stop"
$testResults = @{
    UnitTests = $null
    IntegrationTests = $null
}

# OpenSSLの確認
Write-Host "1. OpenSSLの確認中..." -ForegroundColor Yellow
try {
    $opensslVersion = & openssl version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ OpenSSLが利用可能です: $opensslVersion" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  OpenSSLが利用できない可能性があります" -ForegroundColor Yellow
        Write-Host "      Windows: Git for Windowsをインストールしてください" -ForegroundColor Gray
        Write-Host "      macOS/Linux: brew install openssl または apt-get install openssl" -ForegroundColor Gray
    }
} catch {
    Write-Host "   ⚠️  OpenSSLが見つかりません" -ForegroundColor Yellow
    Write-Host "      Windows: Git for Windowsをインストールしてください" -ForegroundColor Gray
    Write-Host "      macOS/Linux: brew install openssl または apt-get install openssl" -ForegroundColor Gray
}
Write-Host ""

# Node.jsの確認
Write-Host "2. Node.jsの確認中..." -ForegroundColor Yellow
try {
    $nodeVersion = & node --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Node.jsが利用可能です: $nodeVersion" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Node.jsが見つかりません" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "   ❌ Node.jsが見つかりません" -ForegroundColor Red
    exit 1
}
Write-Host ""

# npmの確認
Write-Host "3. npmの確認中..." -ForegroundColor Yellow
try {
    $npmVersion = & npm --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ npmが利用可能です: $npmVersion" -ForegroundColor Green
    } else {
        Write-Host "   ❌ npmが見つかりません" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "   ❌ npmが見つかりません" -ForegroundColor Red
    exit 1
}
Write-Host ""

# 単体テストの実行
if (-not $SkipUnitTests) {
    Write-Host "4. 証明書自動生成機能単体テストを実行中..." -ForegroundColor Yellow
    Write-Host ""
    
    try {
        if ($Verbose) {
            npm test -- tests/unit/certificate-generation.test.ts --verbose
        } else {
            npm test -- tests/unit/certificate-generation.test.ts --silent
        }
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "   ✅ 単体テストが成功しました" -ForegroundColor Green
            $testResults.UnitTests = $true
        } else {
            Write-Host ""
            Write-Host "   ❌ 単体テストが失敗しました" -ForegroundColor Red
            $testResults.UnitTests = $false
        }
    } catch {
        Write-Host ""
        Write-Host "   ❌ 単体テストの実行中にエラーが発生しました: $_" -ForegroundColor Red
        $testResults.UnitTests = $false
    }
    Write-Host ""
} else {
    Write-Host "4. 単体テストをスキップします" -ForegroundColor Gray
    Write-Host ""
}

# 統合テストの実行
if (-not $SkipIntegrationTests) {
    Write-Host "5. 証明書自動生成機能統合テストを実行中..." -ForegroundColor Yellow
    Write-Host ""
    
    try {
        if ($Verbose) {
            npm test -- tests/integration/certificate-auto-generation.test.ts --verbose
        } else {
            npm test -- tests/integration/certificate-auto-generation.test.ts --silent
        }
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "   ✅ 統合テストが成功しました" -ForegroundColor Green
            $testResults.IntegrationTests = $true
        } else {
            Write-Host ""
            Write-Host "   ❌ 統合テストが失敗しました" -ForegroundColor Red
            $testResults.IntegrationTests = $false
        }
    } catch {
        Write-Host ""
        Write-Host "   ❌ 統合テストの実行中にエラーが発生しました: $_" -ForegroundColor Red
        $testResults.IntegrationTests = $false
    }
    Write-Host ""
} else {
    Write-Host "5. 統合テストをスキップします" -ForegroundColor Gray
    Write-Host ""
}

# テスト結果のサマリー
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "テスト結果サマリー" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

$allPassed = $true

if (-not $SkipUnitTests) {
    if ($testResults.UnitTests -eq $true) {
        Write-Host "✅ 単体テスト: 成功" -ForegroundColor Green
    } elseif ($testResults.UnitTests -eq $false) {
        Write-Host "❌ 単体テスト: 失敗" -ForegroundColor Red
        $allPassed = $false
    } else {
        Write-Host "⚠️  単体テスト: 実行されませんでした" -ForegroundColor Yellow
    }
}

if (-not $SkipIntegrationTests) {
    if ($testResults.IntegrationTests -eq $true) {
        Write-Host "✅ 統合テスト: 成功" -ForegroundColor Green
    } elseif ($testResults.IntegrationTests -eq $false) {
        Write-Host "❌ 統合テスト: 失敗" -ForegroundColor Red
        $allPassed = $false
    } else {
        Write-Host "⚠️  統合テスト: 実行されませんでした" -ForegroundColor Yellow
    }
}

Write-Host ""

if ($allPassed) {
    Write-Host "✅ すべてのテストが成功しました！" -ForegroundColor Green
    Write-Host ""
    Write-Host "次のステップ:" -ForegroundColor Cyan
    Write-Host "1. Tauriアプリケーションから実際のAPIを作成してテスト" -ForegroundColor Gray
    Write-Host "2. ブラウザでAPIエンドポイントにアクセスして確認" -ForegroundColor Gray
    Write-Host "3. 外部デバイスからアクセスして外部公開を確認" -ForegroundColor Gray
    exit 0
} else {
    Write-Host "❌ 一部のテストが失敗しました" -ForegroundColor Red
    Write-Host ""
    Write-Host "トラブルシューティング:" -ForegroundColor Yellow
    Write-Host "1. OpenSSLが正しくインストールされているか確認" -ForegroundColor Gray
    Write-Host "2. データディレクトリの書き込み権限を確認" -ForegroundColor Gray
    Write-Host "3. ディスク容量を確認" -ForegroundColor Gray
    Write-Host "4. TEST_EXECUTION_GUIDE.mdを参照" -ForegroundColor Gray
    exit 1
}

