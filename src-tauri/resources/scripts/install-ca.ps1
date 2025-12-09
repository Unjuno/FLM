param (
    [string]$CertPath = "$PSScriptRoot\..\certs\flm-ca.crt"
)

if (!(Test-Path -Path $CertPath)) {
    Write-Error "Certificate not found: $CertPath"
    exit 1
}

try {
    Import-Certificate -FilePath $CertPath -CertStoreLocation Cert:\LocalMachine\Root | Out-Null
    Write-Host "Certificate installed successfully to LocalMachine\Root" -ForegroundColor Green
} catch {
    Write-Error $_.Exception.Message
    exit 1
}

