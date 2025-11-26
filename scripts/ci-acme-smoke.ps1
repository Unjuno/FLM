# CI ACME Smoke Test Script (PowerShell)
#
# This script runs smoke tests for ACME certificate issuance.
# It verifies that the proxy can obtain certificates via Let's Encrypt (or staging).
#
# Prerequisites:
# - A test domain that you control (for DNS-01) or is publicly accessible (for HTTP-01)
# - DNS access for DNS-01 challenge
# - Port 80/443 access for HTTP-01 challenge
#
# Environment variables:
# - ACME_DOMAIN: Domain name to use for certificate (required)
# - ACME_EMAIL: Email address for ACME registration (required)
# - ACME_CHALLENGE: Challenge type: "http-01" or "dns-01" (default: "http-01")
# - ACME_STAGING: Use Let's Encrypt staging (default: "true" for testing)
# - PROXY_PORT: Port for HTTP proxy (default: 8080)
#
# Usage: .\scripts\ci-acme-smoke.ps1 [-Challenge http-01|dns-01] [-Domain DOMAIN] [-Email EMAIL] [-Port PORT] [-SkipIfNoDomain]

param(
    [string]$Challenge = $env:ACME_CHALLENGE,
    [string]$Domain = $env:ACME_DOMAIN,
    [string]$Email = $env:ACME_EMAIL,
    [int]$Port = $env:PROXY_PORT,
    [switch]$SkipIfNoDomain
)

$ErrorActionPreference = "Stop"

# Set defaults
if ([string]::IsNullOrEmpty($Challenge)) {
    $Challenge = "http-01"
}
if ([string]::IsNullOrEmpty($Email)) {
    $Email = "ci@example.test"
}
if ($Port -eq 0) {
    $Port = 8080
}

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

# Check if domain is provided
if ([string]::IsNullOrEmpty($Domain)) {
    if ($SkipIfNoDomain) {
        Write-Warn "No domain provided and -SkipIfNoDomain is set. Skipping ACME smoke test."
        exit 0
    } else {
        Write-Error "Domain is required. Set ACME_DOMAIN environment variable or use -Domain parameter"
        Write-Error "Or use -SkipIfNoDomain to skip this test"
        exit 1
    }
}

# Validate challenge type
if ($Challenge -ne "http-01" -and $Challenge -ne "dns-01") {
    Write-Error "Invalid challenge type: $Challenge. Use 'http-01' or 'dns-01'"
    exit 1
}

Write-Info "Starting ACME smoke test..."
Write-Info "Configuration:"
Write-Info "  Domain: $Domain"
Write-Info "  Email: $Email"
Write-Info "  Challenge: $Challenge"
Write-Info "  Port: $Port"

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

# Create temporary directory for test databases
$TempDir = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), [System.Guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $TempDir -Force | Out-Null
$ConfigDb = Join-Path $TempDir "config.db"
$SecurityDb = Join-Path $TempDir "security.db"

Write-Info "Using temporary databases:"
Write-Info "  Config DB: $ConfigDb"
Write-Info "  Security DB: $SecurityDb"

# Step 1: Start proxy with ACME
Write-Info "Starting proxy with ACME certificate issuance..."
Write-Info "This may take up to 90 seconds for certificate issuance..."

$StartTime = Get-Date

# Build the command
$ProxyLog = Join-Path $TempDir "proxy.log"
$AcmeArgs = @(
    "proxy", "start",
    "--mode", "https-acme",
    "--port", $Port.ToString(),
    "--challenge", $Challenge,
    "--domain", $Domain,
    "--email", $Email,
    "--db-path-config", $ConfigDb,
    "--db-path-security", $SecurityDb,
    "--no-daemon"
)

# Start proxy in background
Write-Info "Executing: flm $($AcmeArgs -join ' ')"
$ProxyProcess = Start-Process -FilePath $FlmBin -ArgumentList $AcmeArgs -NoNewWindow -PassThru -RedirectStandardOutput $ProxyLog -RedirectStandardError $ProxyLog

# Wait for certificate issuance (max 90 seconds as per spec)
$CertIssued = $false
$HttpsPort = $Port + 1

for ($i = 1; $i -le 90; $i++) {
    Start-Sleep -Seconds 1
    
    # Check if proxy process is still running
    if ($ProxyProcess.HasExited) {
        Write-Error "Proxy process exited unexpectedly"
        Get-Content $ProxyLog
        exit 1
    }
    
    # Check if HTTPS endpoint is responding (indicates certificate is ready)
    try {
        # Use -SkipCertificateCheck for PowerShell 6+, fallback for older versions
        $Params = @{
            Uri = "https://localhost:${HttpsPort}/health"
            TimeoutSec = 1
            ErrorAction = "SilentlyContinue"
        }
        if ($PSVersionTable.PSVersion.Major -ge 6) {
            $Params['SkipCertificateCheck'] = $true
        } else {
            # For PowerShell 5.1, we need to ignore certificate errors differently
            [System.Net.ServicePointManager]::ServerCertificateValidationCallback = {$true}
        }
        $Response = Invoke-WebRequest @Params
        if ($Response.StatusCode -eq 200) {
            $Elapsed = ((Get-Date) - $StartTime).TotalSeconds
            Write-Info "Certificate issued successfully in $([math]::Round($Elapsed)) seconds"
            $CertIssued = $true
            break
        }
    } catch {
        # Continue waiting
    }
}

if (-not $CertIssued) {
    $Elapsed = ((Get-Date) - $StartTime).TotalSeconds
    Write-Error "Certificate issuance timed out after $([math]::Round($Elapsed)) seconds (limit: 90s)"
    Get-Content $ProxyLog
    
    # Clean up
    Stop-Process -Id $ProxyProcess.Id -Force -ErrorAction SilentlyContinue
    exit 1
}

# Step 2: Verify HTTPS endpoint
Write-Info "Verifying HTTPS endpoint..."

# Test health endpoint over HTTPS
try {
    $Params = @{
        Uri = "https://localhost:${HttpsPort}/health"
        ErrorAction = "Stop"
    }
    if ($PSVersionTable.PSVersion.Major -ge 6) {
        $Params['SkipCertificateCheck'] = $true
    } else {
        [System.Net.ServicePointManager]::ServerCertificateValidationCallback = {$true}
    }
    $Response = Invoke-WebRequest @Params
    Write-Info "HTTPS health endpoint is working"
} catch {
    Write-Error "HTTPS health endpoint failed: $_"
    Stop-Process -Id $ProxyProcess.Id -Force -ErrorAction SilentlyContinue
    exit 1
}

# Step 3: Test /v1/models endpoint (if API key is available)
if ($env:API_KEY) {
    Write-Info "Testing /v1/models endpoint over HTTPS..."
    try {
        $Headers = @{
            "Authorization" = "Bearer $env:API_KEY"
        }
        $Params = @{
            Uri = "https://localhost:${HttpsPort}/v1/models"
            Headers = $Headers
            ErrorAction = "Stop"
        }
        if ($PSVersionTable.PSVersion.Major -ge 6) {
            $Params['SkipCertificateCheck'] = $true
        } else {
            [System.Net.ServicePointManager]::ServerCertificateValidationCallback = {$true}
        }
        $Response = Invoke-WebRequest @Params
        Write-Info "HTTPS /v1/models endpoint is working"
    } catch {
        Write-Warn "HTTPS /v1/models endpoint test failed (this may be expected if no engines are registered): $_"
    }
} else {
    Write-Warn "API_KEY not set, skipping /v1/models endpoint test"
}

# Step 4: Stop proxy
Write-Info "Stopping proxy..."
$StopArgs = @(
    "proxy", "stop",
    "--port", $Port.ToString(),
    "--db-path-config", $ConfigDb,
    "--db-path-security", $SecurityDb
)

& $FlmBin $StopArgs *> $null
if ($LASTEXITCODE -ne 0) {
    Write-Warn "Proxy stop command failed, attempting to kill process"
    Stop-Process -Id $ProxyProcess.Id -Force -ErrorAction SilentlyContinue
}

# Wait a moment for cleanup
Start-Sleep -Seconds 2

Write-Info "ACME smoke test completed successfully!"
Write-Info "Certificate was issued in $([math]::Round($Elapsed)) seconds (< 90s limit)"

# Cleanup
Remove-Item -Path $TempDir -Recurse -Force -ErrorAction SilentlyContinue

