# セキュリティチェックスクリプト（PowerShell版）
# npm auditとcargo auditを実行して依存関係の脆弱性をチェックします

Write-Host "🔍 セキュリティチェックを開始します..." -ForegroundColor Cyan

# npm auditの実行
Write-Host ""
Write-Host "📦 npm依存関係の脆弱性チェック..." -ForegroundColor Yellow
npm audit --audit-level=moderate

# cargo auditの実行（cargo-auditがインストールされている場合）
if (Get-Command cargo-audit -ErrorAction SilentlyContinue) {
    Write-Host ""
    Write-Host "🦀 Cargo依存関係の脆弱性チェック..." -ForegroundColor Yellow
    Push-Location src-tauri
    cargo audit
    Pop-Location
} else {
    Write-Host ""
    Write-Host "⚠️  cargo-auditがインストールされていません。" -ForegroundColor Yellow
    Write-Host "   インストールするには: cargo install cargo-audit" -ForegroundColor Gray
    Write-Host "   または: cargo install --locked cargo-audit" -ForegroundColor Gray
}

Write-Host ""
Write-Host "✅ セキュリティチェックが完了しました。" -ForegroundColor Green

