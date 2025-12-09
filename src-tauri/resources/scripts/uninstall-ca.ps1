# FLM CA Certificate Uninstaller for Windows
# This script removes the FLM root CA certificate from the OS trust store

param(
    [switch]$Force
)

$ErrorActionPreference = "Stop"

function Write-Info {
    Write-Host "Info: $args" -ForegroundColor Green
}

function Write-Warn {
    Write-Host "Warning: $args" -ForegroundColor Yellow
}

function Write-Error {
    Write-Host "Error: $args" -ForegroundColor Red
    exit 1
}

Write-Info "FLM CA Certificate Uninstaller"
Write-Info "=============================="

# Find and remove certificate
$certFound = $false

# Try LocalMachine first
try {
    $certs = Get-ChildItem Cert:\LocalMachine\Root | Where-Object { $_.Subject -like "*FLM Local CA*" }
    if ($certs) {
        $certFound = $true
        if ($Force) {
            $certs | Remove-Item -Force
            Write-Info "Certificate removed from LocalMachine store"
        } else {
            Write-Info "Found certificate in LocalMachine store:"
            $certs | ForEach-Object { Write-Info "  - $($_.Subject)" }
            $confirm = Read-Host "Remove this certificate? (y/N)"
            if ($confirm -eq 'y' -or $confirm -eq 'Y') {
                $certs | Remove-Item -Force
                Write-Info "Certificate removed from LocalMachine store"
            } else {
                Write-Info "Removal cancelled"
            }
        }
    }
} catch {
    Write-Warn "Failed to check LocalMachine store: $_"
}

# Try CurrentUser if not found in LocalMachine
if (-not $certFound) {
    try {
        $certs = Get-ChildItem Cert:\CurrentUser\Root | Where-Object { $_.Subject -like "*FLM Local CA*" }
        if ($certs) {
            $certFound = $true
            if ($Force) {
                $certs | Remove-Item -Force
                Write-Info "Certificate removed from CurrentUser store"
            } else {
                Write-Info "Found certificate in CurrentUser store:"
                $certs | ForEach-Object { Write-Info "  - $($_.Subject)" }
                $confirm = Read-Host "Remove this certificate? (y/N)"
                if ($confirm -eq 'y' -or $confirm -eq 'Y') {
                    $certs | Remove-Item -Force
                    Write-Info "Certificate removed from CurrentUser store"
                } else {
                    Write-Info "Removal cancelled"
                }
            }
        }
    } catch {
        Write-Warn "Failed to check CurrentUser store: $_"
    }
}

if (-not $certFound) {
    Write-Warn "FLM Local CA certificate not found in trust store"
}

Write-Info "Uninstallation complete!"

