# Local Build Test Script (PowerShell)
#
# This script tests local builds and signature verification for Windows.
#
# Usage: .\scripts\local-build-test.ps1

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir

Set-Location $ProjectRoot

function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Green
}

function Write-Warn {
    param([string]$Message)
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

function Write-Section {
    param([string]$Title)
    Write-Host "`n=== $Title ===" -ForegroundColor Cyan
}

# Check prerequisites
Write-Section "Checking Prerequisites"
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "Node.js is not installed"
    exit 1
}
Write-Info "Node.js version: $(node --version)"

if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
    Write-Error "Rust is not installed"
    exit 1
}
Write-Info "Rust version: $(rustc --version)"

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Error "npm is not installed"
    exit 1
}
Write-Info "npm version: $(npm --version)"

# Install dependencies
Write-Section "Installing Dependencies"
if (-not (Test-Path "node_modules")) {
    Write-Info "Installing npm dependencies..."
    npm ci
} else {
    Write-Info "npm dependencies already installed"
}

# Build frontend
Write-Section "Building Frontend"
Write-Info "Building frontend..."
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Error "Frontend build failed"
    exit 1
}
Write-Info "Frontend build succeeded"

# Windows build
Write-Section "Windows Build"
Write-Info "Building Windows installer..."
npm run tauri:build:windows
if ($LASTEXITCODE -ne 0) {
    Write-Error "Windows build failed"
    exit 1
}

# Windows signature verification
Write-Section "Windows Signature Verification"
if (Get-Command signtool -ErrorAction SilentlyContinue) {
    Write-Info "Verifying MSI signatures..."
    $msiFiles = Get-ChildItem "src-tauri/target/x86_64-pc-windows-msvc/release/bundle/msi/*.msi" -ErrorAction SilentlyContinue
    if ($msiFiles) {
        foreach ($msi in $msiFiles) {
            signtool verify /pa $msi.FullName
            if ($LASTEXITCODE -eq 0) {
                Write-Info "MSI signature verified: $($msi.Name)"
            } else {
                Write-Warn "MSI signature verification failed: $($msi.Name)"
            }
        }
    } else {
        Write-Warn "No MSI files found"
    }
    
    Write-Info "Verifying NSIS signatures..."
    $exeFiles = Get-ChildItem "src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/*.exe" -ErrorAction SilentlyContinue
    if ($exeFiles) {
        foreach ($exe in $exeFiles) {
            signtool verify /pa $exe.FullName
            if ($LASTEXITCODE -eq 0) {
                Write-Info "NSIS signature verified: $($exe.Name)"
            } else {
                Write-Warn "NSIS signature verification failed: $($exe.Name)"
            }
        }
    } else {
        Write-Warn "No NSIS installers found"
    }
} else {
    Write-Warn "signtool not found, skipping signature verification"
    Write-Warn "Install Windows SDK to get signtool.exe"
}

Write-Section "Summary"
Write-Info "Local build test completed for Windows"
Write-Info "Check the build outputs in src-tauri/target/x86_64-pc-windows-msvc/release/bundle/"

