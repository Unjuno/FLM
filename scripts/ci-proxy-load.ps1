# CI Proxy Load Test Script (PowerShell)
#
# This script runs load tests for the FLM proxy server.
# It uses k6 or wrk2 to generate load and measures latency/error rates.
#
# Prerequisites:
# - k6: https://k6.io/docs/getting-started/installation/
# - wrk2: https://github.com/giltene/wrk2 (optional, fallback)
#
# Usage: .\scripts\ci-proxy-load.ps1 [-Port PORT] [-Duration SECONDS] [-Rate RPS] [-Tool k6|wrk2]

param(
    [int]$Port = 9000,
    [int]$Duration = 600,  # 10 minutes
    [int]$Rate = 100,      # requests per minute
    [string]$Tool = "k6"
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

# Check if proxy is running
function Test-Proxy {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:${Port}/health" -UseBasicParsing -TimeoutSec 5 -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            Write-Info "Proxy is running on port ${Port}"
            return $true
        }
    } catch {
        Write-Error "Proxy is not running on port ${Port}"
        Write-Error "Please start the proxy first: flm proxy start --mode dev-selfsigned --port ${Port}"
        return $false
    }
    return $false
}

# Create k6 test script
function New-K6Script {
    $scriptFile = Join-Path $ProjectRoot "target\ci-proxy-load-test.js"
    $targetDir = Split-Path -Parent $scriptFile
    if (-not (Test-Path $targetDir)) {
        New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
    }
    
    $scriptContent = @'
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
    stages: [
        { duration: '1m', target: __ENV.RATE || 100 },
        { duration: __ENV.DURATION || '10m', target: __ENV.RATE || 100 },
        { duration: '1m', target: 0 },
    ],
    thresholds: {
        'http_req_duration': ['p(95)<2000', 'p(99)<5000'],
        'errors': ['rate<0.005'],
    },
};

const PROXY_URL = __ENV.PROXY_URL || 'http://localhost:9000';
const API_KEY = __ENV.API_KEY || '';

export default function () {
    let healthRes = http.get(`${PROXY_URL}/health`);
    check(healthRes, {
        'health status is 200': (r) => r.status === 200,
    }) || errorRate.add(1);

    if (API_KEY) {
        let modelsRes = http.get(`${PROXY_URL}/v1/models`, {
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
            },
        });
        check(modelsRes, {
            'models status is 200': (r) => r.status === 200,
            'models response has data': (r) => {
                try {
                    const body = JSON.parse(r.body);
                    return body.object === 'list' && Array.isArray(body.data);
                } catch {
                    return false;
                }
            },
        }) || errorRate.add(1);
    }

    sleep(1);
}
'@
    
    Set-Content -Path $scriptFile -Value $scriptContent
    return $scriptFile
}

# Run k6 load test
function Start-K6Test {
    Write-Info "Running k6 load test..."
    
    if (-not (Get-Command k6 -ErrorAction SilentlyContinue)) {
        Write-Error "k6 is not installed. Please install it from https://k6.io/docs/getting-started/installation/"
        exit 1
    }
    
    $scriptFile = New-K6Script
    $proxyUrl = "http://localhost:${Port}"
    $ratePerSec = [math]::Floor($Rate / 60)
    
    Write-Info "Test configuration:"
    Write-Info "  Proxy URL: ${proxyUrl}"
    Write-Info "  Rate: ${Rate} req/min (${ratePerSec} req/sec)"
    Write-Info "  Duration: ${Duration} seconds"
    
    $env:PROXY_URL = $proxyUrl
    $env:RATE = $ratePerSec
    $env:DURATION = "${Duration}s"
    
    $resultsFile = Join-Path $ProjectRoot "target\ci-proxy-load-results.json"
    k6 run $scriptFile --out "json=$resultsFile"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Info "k6 load test completed successfully"
        Write-Info "Results saved to $resultsFile"
    } else {
        Write-Error "k6 load test failed"
        exit 1
    }
}

# Main execution
function Main {
    Write-Info "Starting proxy load test..."
    
    if (-not (Test-Proxy)) {
        exit 1
    }
    
    switch ($Tool) {
        "k6" {
            Start-K6Test
        }
        default {
            Write-Error "Unknown tool: $Tool. Use 'k6'"
            exit 1
        }
    }
    
    Write-Info "Load test completed!"
}

Main

