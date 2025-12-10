# CI Workflow Verification Script (PowerShell)
#
# This script verifies that the CI workflow file is correctly configured
# for code signing and signature verification.
#
# Usage: .\scripts\ci-workflow-verify.ps1

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

$WorkflowFile = ".github/workflows/build.yml"

if (-not (Test-Path $WorkflowFile)) {
    Write-Error "Workflow file not found: $WorkflowFile"
    exit 1
}

Write-Info "Verifying CI workflow file: $WorkflowFile"

# Check Windows signature verification step
Write-Section "Windows Signature Verification"
$windowsVerify = Select-String -Path $WorkflowFile -Pattern "Verify Windows signatures"
if ($windowsVerify) {
    $windowsContent = Get-Content $WorkflowFile | Select-Object -Skip ($windowsVerify.LineNumber - 1) -First 20
    if ($windowsContent -match "signtool verify") {
        Write-Info "Windows signature verification step found"
    } else {
        Write-Error "Windows signature verification step found but signtool verify command is missing"
        exit 1
    }
} else {
    Write-Error "Windows signature verification step not found"
    exit 1
}

# Check macOS signature verification step
Write-Section "macOS Signature Verification"
$macosVerify = Select-String -Path $WorkflowFile -Pattern "Verify macOS signatures"
if ($macosVerify) {
    $macosContent = Get-Content $WorkflowFile | Select-Object -Skip ($macosVerify.LineNumber - 1) -First 20
    if ($macosContent -match "codesign --verify") {
        Write-Info "macOS signature verification step found"
    } else {
        Write-Error "macOS signature verification step found but codesign verify command is missing"
        exit 1
    }
} else {
    Write-Error "macOS signature verification step not found"
    exit 1
}

# Check Linux GPG signature verification step
Write-Section "Linux GPG Signature Verification"
$linuxVerify = Select-String -Path $WorkflowFile -Pattern "Verify Linux GPG signatures"
if ($linuxVerify) {
    $linuxContent = Get-Content $WorkflowFile | Select-Object -Skip ($linuxVerify.LineNumber - 1) -First 20
    if ($linuxContent -match "gpg --verify") {
        Write-Info "Linux GPG signature verification step found"
    } else {
        Write-Error "Linux GPG signature verification step found but gpg verify command is missing"
        exit 1
    }
} else {
    Write-Error "Linux GPG signature verification step not found"
    exit 1
}

# Check build log recording step
Write-Section "Build Log Recording"
$buildLog = Select-String -Path $WorkflowFile -Pattern "Record signature verification results"
if ($buildLog) {
    Write-Info "Build log recording step found"
} else {
    Write-Warn "Build log recording step not found (optional but recommended)"
}

# Check checksums generation
Write-Section "Checksums Generation"
$checksums = Select-String -Path $WorkflowFile -Pattern "Generate checksums"
if ($checksums) {
    $checksumsContent = Get-Content $WorkflowFile | Select-Object -Skip ($checksums.LineNumber - 1) -First 10
    if ($checksumsContent -match "sha256sum") {
        Write-Info "Checksums generation step found"
    } else {
        Write-Warn "Checksums generation step found but sha256sum command may be missing"
    }
} else {
    Write-Warn "Checksums generation step not found"
}

# Check GPG signing of checksums
Write-Section "GPG Signing of Checksums"
$gpgSign = Select-String -Path $WorkflowFile -Pattern "Sign checksums with GPG"
if ($gpgSign) {
    Write-Info "GPG signing of checksums step found"
} else {
    Write-Warn "GPG signing of checksums step not found (optional but recommended)"
}

# Check release notes generation
Write-Section "Release Notes Generation"
$releaseNotes = Select-String -Path $WorkflowFile -Pattern "Generate release notes"
if ($releaseNotes) {
    Write-Info "Release notes generation step found"
} else {
    Write-Warn "Release notes generation step not found"
}

Write-Section "Summary"
Write-Info "CI workflow verification completed successfully"
Write-Info "All required signature verification steps are present"

