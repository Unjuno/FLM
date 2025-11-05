# FLM - Tauriアプリ起動後にテストを実行するスクリプト

Write-Host "=== FLM テスト実行スクリプト ===" -ForegroundColor Cyan
Write-Host ""

# Tauriアプリが起動しているか確認
Write-Host "1. Tauriアプリの起動を確認中..." -ForegroundColor Yellow
$maxRetries = 5
$retryCount = 0
$tauriProcess = $null

while ($retryCount -lt $maxRetries -and -not $tauriProcess) {
    $tauriProcess = Get-Process | Where-Object { 
        $_.MainWindowTitle -like "*FLM*" -or 
        $_.ProcessName -like "*flm*" -or
        $_.ProcessName -like "*tauri*"
    }
    
    if (-not $tauriProcess) {
        $retryCount++
        if ($retryCount -lt $maxRetries) {
            Write-Host "   Tauriアプリの起動を待機中... ($retryCount/$maxRetries)" -ForegroundColor Gray
            Start-Sleep -Seconds 2
        }
    }
}

if ($tauriProcess) {
    Write-Host "✅ Tauriアプリが起動しています" -ForegroundColor Green
    Write-Host "   プロセス: $($tauriProcess.ProcessName)" -ForegroundColor Gray
    
    # アプリが完全に起動するまで少し待機（データベース初期化など）
    Write-Host "   アプリの完全起動を待機中..." -ForegroundColor Gray
    Start-Sleep -Seconds 3
} else {
    Write-Host "⚠️  Tauriアプリが起動していません" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "以下のコマンドでTauriアプリを起動してください:" -ForegroundColor Yellow
    Write-Host "   npm run tauri:dev" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "起動後、このスクリプトを再度実行してください。" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# 単体テストを実行（Tauri不要）
Write-Host "2. 単体テストを実行中..." -ForegroundColor Yellow
npm test -- tests/unit --no-coverage
$unitTestExit = $LASTEXITCODE

Write-Host ""

# 証明書自動生成テストを実行（Tauri不要）
Write-Host "3. 証明書自動生成テストを実行中..." -ForegroundColor Yellow
npm test -- tests/integration/certificate-auto-generation.test.ts --no-coverage
$certificateTestExit = $LASTEXITCODE

Write-Host ""

# 統合テストを実行（Tauri必要）
Write-Host "4. 統合テストを実行中..." -ForegroundColor Yellow

# F001: API作成機能
Write-Host "   - F001 API作成機能" -ForegroundColor Gray
npm test -- tests/integration/f001-api-creation.test.ts --no-coverage
$f001Exit = $LASTEXITCODE

# F003: API管理機能
Write-Host "   - F003 API管理機能" -ForegroundColor Gray
npm test -- tests/integration/f003-api-management.test.ts --no-coverage
$f003Exit = $LASTEXITCODE

# F004: モデル管理機能
Write-Host "   - F004 モデル管理機能" -ForegroundColor Gray
npm test -- tests/integration/f004-model-management.test.ts --no-coverage
$f004Exit = $LASTEXITCODE

# F006: ログ表示機能
Write-Host "   - F006 ログ表示機能" -ForegroundColor Gray
npm test -- tests/integration/f006-log-display.test.ts --no-coverage
$f006Exit = $LASTEXITCODE

# F007: パフォーマンス監視機能
Write-Host "   - F007 パフォーマンス監視機能" -ForegroundColor Gray
npm test -- tests/integration/f007-performance-monitoring.test.ts --no-coverage
$f007Exit = $LASTEXITCODE

# マルチエンジン対応機能
Write-Host "   - マルチエンジン対応機能" -ForegroundColor Gray
npm test -- tests/integration/multi-engine.test.ts --no-coverage
$multiEngineExit = $LASTEXITCODE

# 証明書生成統合テスト（Tauri必要）
Write-Host "   - 証明書生成統合テスト" -ForegroundColor Gray
npm test -- tests/integration/certificate-generation.test.ts --no-coverage
$certificateIntegrationExit = $LASTEXITCODE

Write-Host ""
Write-Host "=== テスト完了 ===" -ForegroundColor Cyan
Write-Host ""

# テスト結果のサマリー
$allTestsPassed = $true
$failedTests = @()

if ($unitTestExit -ne 0) {
    $allTestsPassed = $false
    $failedTests += "単体テスト"
}

if ($certificateTestExit -ne 0) {
    $allTestsPassed = $false
    $failedTests += "証明書自動生成テスト"
}

if ($f001Exit -ne 0) {
    $allTestsPassed = $false
    $failedTests += "F001 API作成機能"
}

if ($f003Exit -ne 0) {
    $allTestsPassed = $false
    $failedTests += "F003 API管理機能"
}

if ($f004Exit -ne 0) {
    $allTestsPassed = $false
    $failedTests += "F004 モデル管理機能"
}

if ($f006Exit -ne 0) {
    $allTestsPassed = $false
    $failedTests += "F006 ログ表示機能"
}

if ($f007Exit -ne 0) {
    $allTestsPassed = $false
    $failedTests += "F007 パフォーマンス監視機能"
}

if ($multiEngineExit -ne 0) {
    $allTestsPassed = $false
    $failedTests += "マルチエンジン対応機能"
}

if ($certificateIntegrationExit -ne 0) {
    $allTestsPassed = $false
    $failedTests += "証明書生成統合テスト"
}

# 結果を表示
if ($allTestsPassed) {
    Write-Host "✅ すべてのテストが成功しました！" -ForegroundColor Green
    Write-Host ""
    Write-Host "成功したテスト:" -ForegroundColor Green
    Write-Host "   ✅ 単体テスト" -ForegroundColor Gray
    Write-Host "   ✅ 証明書自動生成テスト" -ForegroundColor Gray
    Write-Host "   ✅ F001 API作成機能" -ForegroundColor Gray
    Write-Host "   ✅ F003 API管理機能" -ForegroundColor Gray
    Write-Host "   ✅ F004 モデル管理機能" -ForegroundColor Gray
    Write-Host "   ✅ F006 ログ表示機能" -ForegroundColor Gray
    Write-Host "   ✅ F007 パフォーマンス監視機能" -ForegroundColor Gray
    Write-Host "   ✅ マルチエンジン対応機能" -ForegroundColor Gray
    Write-Host "   ✅ 証明書生成統合テスト" -ForegroundColor Gray
    exit 0
} else {
    Write-Host "❌ 一部のテストが失敗しました" -ForegroundColor Red
    Write-Host ""
    Write-Host "失敗したテスト:" -ForegroundColor Red
    foreach ($test in $failedTests) {
        Write-Host "   ❌ $test" -ForegroundColor Yellow
    }
    Write-Host ""
    Write-Host "成功したテスト:" -ForegroundColor Green
    if ($unitTestExit -eq 0) {
        Write-Host "   ✅ 単体テスト" -ForegroundColor Gray
    }
    if ($certificateTestExit -eq 0) {
        Write-Host "   ✅ 証明書自動生成テスト" -ForegroundColor Gray
    }
    if ($f001Exit -eq 0) {
        Write-Host "   ✅ F001 API作成機能" -ForegroundColor Gray
    }
    if ($f003Exit -eq 0) {
        Write-Host "   ✅ F003 API管理機能" -ForegroundColor Gray
    }
    if ($f004Exit -eq 0) {
        Write-Host "   ✅ F004 モデル管理機能" -ForegroundColor Gray
    }
    if ($f006Exit -eq 0) {
        Write-Host "   ✅ F006 ログ表示機能" -ForegroundColor Gray
    }
    if ($f007Exit -eq 0) {
        Write-Host "   ✅ F007 パフォーマンス監視機能" -ForegroundColor Gray
    }
    if ($multiEngineExit -eq 0) {
        Write-Host "   ✅ マルチエンジン対応機能" -ForegroundColor Gray
    }
    if ($certificateIntegrationExit -eq 0) {
        Write-Host "   ✅ 証明書生成統合テスト" -ForegroundColor Gray
    }
    exit 1
}

