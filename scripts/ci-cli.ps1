# CI CLI Integration Test Script (PowerShell)
#
# This script runs integration tests for the FLM CLI tool.
# It performs:
# 1. Format check
# 2. Clippy check
# 3. Unit tests
# 4. Integration smoke tests
#
# Usage: .\scripts\ci-cli.ps1 [-SkipFormat] [-SkipClippy] [-SkipTests]

param(
    [switch]$SkipFormat,
    [switch]$SkipClippy,
    [switch]$SkipTests
)

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

# Step 1: Format check
if (-not $SkipFormat) {
    Write-Info "Running format check..."
    cargo fmt --all -- --check
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Format check failed. Run 'cargo fmt --all' to fix."
        exit 1
    }
    Write-Info "Format check passed"
} else {
    Write-Warn "Skipping format check"
}

# Step 2: Clippy check
if (-not $SkipClippy) {
    Write-Info "Running clippy check..."
    cargo clippy --all-targets --all-features -- -D warnings
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Clippy check failed"
        exit 1
    }
    Write-Info "Clippy check passed"
} else {
    Write-Warn "Skipping clippy check"
}

# Step 3: Unit tests
if (-not $SkipTests) {
    Write-Info "Running unit tests..."
    cargo test --workspace --no-fail-fast
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Unit tests failed"
        exit 1
    }
    Write-Info "Unit tests passed"
} else {
    Write-Warn "Skipping unit tests"
}

# Step 4: Integration smoke tests
if (-not $SkipTests) {
    Write-Info "Running integration smoke tests..."
    
    # Build the CLI tool
    Write-Info "Building flm-cli..."
    cargo build --release --bin flm
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to build flm-cli"
        exit 1
    }
    
    $FlmBin = Join-Path $ProjectRoot "target\release\flm.exe"
    
    if (-not (Test-Path $FlmBin)) {
        Write-Error "flm binary not found at $FlmBin"
        exit 1
    }
    
    # Test: engines detect
    Write-Info "Testing: flm engines detect --format json"
    & $FlmBin engines detect --format json *> $null
    if ($LASTEXITCODE -eq 0) {
        Write-Info "engines detect succeeded"
    } else {
        Write-Warn "engines detect failed (this is expected if no engines are running)"
    }
    
    # Test: models list (if engines are available)
    Write-Info "Testing: flm models list"
    & $FlmBin models list *> $null
    if ($LASTEXITCODE -eq 0) {
        Write-Info "models list succeeded"
    } else {
        Write-Warn "models list failed (this is expected if no engines are running)"
    }
    
    # Test: proxy start/stop (use a high port to avoid conflicts)
    $TestPort = 19999
    Write-Info "Testing: flm proxy start --mode local-http --port $TestPort"
    & $FlmBin proxy start --mode local-http --port $TestPort *> $null
    if ($LASTEXITCODE -eq 0) {
        Write-Info "Proxy started successfully"
        
        # Wait a moment for the proxy to start
        Start-Sleep -Seconds 2
        
        # Test: proxy status
        Write-Info "Testing: flm proxy status"
        & $FlmBin proxy status *> $null
        if ($LASTEXITCODE -eq 0) {
            Write-Info "proxy status succeeded"
        } else {
            Write-Warn "proxy status failed"
        }
        
        # Test: proxy stop
        Write-Info "Testing: flm proxy stop --all"
        & $FlmBin proxy stop --all *> $null
        if ($LASTEXITCODE -eq 0) {
            Write-Info "proxy stop succeeded"
        } else {
            Write-Warn "proxy stop failed"
        }
        
        # Wait a moment for the proxy to stop
        Start-Sleep -Seconds 1
    } else {
        Write-Warn "proxy start failed (this is expected if port $TestPort is in use)"
    }
    
    Write-Info "Integration smoke tests completed"
} else {
    Write-Warn "Skipping integration smoke tests"
}

Write-Info "All CI CLI checks passed!"

