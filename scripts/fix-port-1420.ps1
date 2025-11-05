# ポート1420を解放するスクリプト

Write-Host "=== ポート1420解放スクリプト ===" -ForegroundColor Cyan
Write-Host ""

# ポート1420を使用しているプロセスを確認
Write-Host "1. ポート1420の使用状況を確認中..." -ForegroundColor Yellow
$connections = Get-NetTCPConnection -LocalPort 1420 -ErrorAction SilentlyContinue

if ($connections) {
    Write-Host "ポート1420を使用中のプロセスが見つかりました" -ForegroundColor Yellow
    foreach ($conn in $connections) {
        $process = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
        if ($process) {
            Write-Host "  プロセス名: $($process.ProcessName), PID: $($process.Id)" -ForegroundColor Gray
            Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
            Write-Host "  プロセスを終了しました" -ForegroundColor Green
        }
    }
} else {
    Write-Host "ポート1420は使用されていません" -ForegroundColor Green
}

Write-Host ""

# Nodeプロセスを確認
Write-Host "2. Nodeプロセスを確認中..." -ForegroundColor Yellow
$nodeProcesses = Get-Process node -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    Write-Host "Nodeプロセスが見つかりました: $($nodeProcesses.Count)個" -ForegroundColor Yellow
    $nodeProcesses | ForEach-Object {
        Write-Host "  PID: $($_.Id), 開始時刻: $($_.StartTime)" -ForegroundColor Gray
        Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
        Write-Host "  プロセスを終了しました" -ForegroundColor Green
    }
} else {
    Write-Host "Nodeプロセスは見つかりませんでした" -ForegroundColor Green
}

Write-Host ""

# 少し待機
Write-Host "3. 2秒待機中..." -ForegroundColor Yellow
Start-Sleep -Seconds 2

# 再度確認
Write-Host "4. 最終確認..." -ForegroundColor Yellow
$finalCheck = Get-NetTCPConnection -LocalPort 1420 -ErrorAction SilentlyContinue
if ($finalCheck) {
    Write-Host "警告: ポート1420がまだ使用中です" -ForegroundColor Red
    $finalCheck | ForEach-Object {
        $proc = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue
        Write-Host "  プロセス: $($proc.ProcessName), PID: $($proc.Id)" -ForegroundColor Red
    }
} else {
    Write-Host "✅ ポート1420は解放されました" -ForegroundColor Green
}

Write-Host ""
Write-Host "=== 完了 ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "以下のコマンドでTauriアプリを起動できます:" -ForegroundColor Yellow
Write-Host "  npm run tauri:dev" -ForegroundColor Cyan

