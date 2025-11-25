param (
    [string]$CertPath = "$PSScriptRoot\..\..\..\AppData\Roaming\flm\certs\flm-ca.crt"
)

if (!(Test-Path -Path $CertPath)) {
    Write-Error "Certificate not found: $CertPath"
    exit 1
}

try {
    Import-Certificate -FilePath $CertPath -CertStoreLocation Cert:\LocalMachine\Root | Out-Null
} catch {
    Write-Error $_.Exception.Message
    exit 1
}

