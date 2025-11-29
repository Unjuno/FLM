# FLM CLI Installer for Windows
# This script installs the FLM CLI binary and optionally registers the root CA certificate

param(
    [string]$InstallPath = "$env:LOCALAPPDATA\flm\bin",
    [string]$CertPath = "$env:APPDATA\flm\certs\flm-ca.crt",
    [switch]$InstallCert,
    [switch]$SystemWide
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

# Determine binary location
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BinaryPath = $null

if (Test-Path "$ScriptDir\..\target\release\flm.exe") {
    $BinaryPath = "$ScriptDir\..\target\release\flm.exe"
} elseif (Test-Path "$ScriptDir\flm.exe") {
    $BinaryPath = "$ScriptDir\flm.exe"
} else {
    Write-Error "FLM binary not found. Please build the project first with 'cargo build --release'"
}

# Determine installation path
if ($SystemWide) {
    if (-not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        Write-Error "System-wide installation requires administrator privileges. Please run as administrator."
    }
    $InstallPath = "$env:ProgramFiles\flm\bin"
}

Write-Info "FLM CLI Installer"
Write-Info "=================="

# Create installation directory
Write-Info "Installing FLM CLI to $InstallPath"
New-Item -ItemType Directory -Force -Path $InstallPath | Out-Null

# Copy binary
Copy-Item -Path $BinaryPath -Destination "$InstallPath\flm.exe" -Force
Write-Info "Binary installed successfully"

# Add to PATH if not already present
$CurrentPath = [Environment]::GetEnvironmentVariable("Path", [EnvironmentVariableTarget]::User)
if ($CurrentPath -notlike "*$InstallPath*") {
    Write-Info "Adding $InstallPath to PATH"
    [Environment]::SetEnvironmentVariable("Path", "$CurrentPath;$InstallPath", [EnvironmentVariableTarget]::User)
    $env:Path += ";$InstallPath"
    Write-Info "PATH updated. Please restart your terminal for changes to take effect."
} else {
    Write-Info "Installation path already in PATH"
}

# Install certificate if requested
if ($InstallCert -or (Test-Path $CertPath)) {
    if (Test-Path $CertPath) {
        Write-Info "Installing root CA certificate"
        
        try {
            # Try CurrentUser first
            Import-Certificate -FilePath $CertPath -CertStoreLocation Cert:\CurrentUser\Root -ErrorAction Stop | Out-Null
            Write-Info "Certificate installed to CurrentUser store"
        } catch {
            # Try LocalMachine if CurrentUser fails
            try {
                Import-Certificate -FilePath $CertPath -CertStoreLocation Cert:\LocalMachine\Root -ErrorAction Stop | Out-Null
                Write-Info "Certificate installed to LocalMachine store"
            } catch {
                Write-Warn "Failed to install certificate: $_"
                Write-Warn "You may need to run as administrator for system-wide certificate installation."
            }
        }
    } else {
        Write-Warn "Certificate not found at $CertPath. Skipping certificate installation."
    }
} else {
    Write-Info "Certificate installation skipped. Use -InstallCert to install the certificate."
}

Write-Info "Installation complete!"
Write-Info "You can now use 'flm' command from anywhere."
Write-Info "Run 'flm --help' to get started."

