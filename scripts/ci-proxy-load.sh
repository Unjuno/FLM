#!/bin/bash
# CI Proxy Load Test Script
#
# This script runs load tests for the FLM proxy server.
# It uses k6 or wrk2 to generate load and measures latency/error rates.
#
# Prerequisites:
# - k6: https://k6.io/docs/getting-started/installation/
# - wrk2: https://github.com/giltene/wrk2 (optional, fallback)
# - vLLM mock server (optional, for realistic testing)
#
# Usage: ./scripts/ci-proxy-load.sh [--port PORT] [--duration SECONDS] [--rate RPS] [--tool k6|wrk2]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

# Default values
PROXY_PORT=9000
DURATION=600  # 10 minutes
RATE=100      # requests per minute (as per TEST_STRATEGY.md)
TOOL="k6"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --port)
            PROXY_PORT="$2"
            shift 2
            ;;
        --duration)
            DURATION="$2"
            shift 2
            ;;
        --rate)
            RATE="$2"
            shift 2
            ;;
        --tool)
            TOOL="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--port PORT] [--duration SECONDS] [--rate RPS] [--tool k6|wrk2]"
            exit 1
            ;;
    esac
done

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if proxy is running
check_proxy() {
    if ! curl -s "http://localhost:${PROXY_PORT}/health" > /dev/null 2>&1; then
        error "Proxy is not running on port ${PROXY_PORT}"
        error "Please start the proxy first: flm proxy start --mode dev-selfsigned --port ${PROXY_PORT}"
        exit 1
    fi
    info "Proxy is running on port ${PROXY_PORT}"
}

# Create k6 test script
create_k6_script() {
    local script_file="$PROJECT_ROOT/target/ci-proxy-load-test.js"
    mkdir -p "$(dirname "$script_file")"
    
    cat > "$script_file" << 'EOF'
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
    stages: [
        { duration: '1m', target: __ENV.RATE || 100 },  // Ramp up
        { duration: __ENV.DURATION || '10m', target: __ENV.RATE || 100 },  // Sustained load
        { duration: '1m', target: 0 },  // Ramp down
    ],
    thresholds: {
        'http_req_duration': ['p(95)<2000', 'p(99)<5000'],  // 95th percentile < 2s, 99th < 5s
        'errors': ['rate<0.005'],  // Error rate < 0.5%
    },
};

const PROXY_URL = __ENV.PROXY_URL || 'http://localhost:9000';
const API_KEY = __ENV.API_KEY || '';

export default function () {
    // Test 1: Health endpoint (no auth required)
    let healthRes = http.get(`${PROXY_URL}/health`);
    check(healthRes, {
        'health status is 200': (r) => r.status === 200,
    }) || errorRate.add(1);

    // Test 2: /v1/models endpoint (requires auth)
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

    // Test 3: SSE endpoint (streaming, if available)
    // Note: k6 doesn't support SSE natively, so we skip this for now

    sleep(1);  // Rate limiting: 1 request per second = 60 req/min
}
EOF

    echo "$script_file"
}

# Run k6 load test
run_k6_test() {
    info "Running k6 load test..."
    
    if ! command -v k6 &> /dev/null; then
        error "k6 is not installed. Please install it from https://k6.io/docs/getting-started/installation/"
        exit 1
    fi
    
    local script_file=$(create_k6_script)
    local proxy_url="http://localhost:${PROXY_PORT}"
    local rate_per_sec=$((RATE / 60))  # Convert req/min to req/sec
    
    info "Test configuration:"
    info "  Proxy URL: ${proxy_url}"
    info "  Rate: ${RATE} req/min (${rate_per_sec} req/sec)"
    info "  Duration: ${DURATION} seconds"
    
    # Run k6 with environment variables
    PROXY_URL="$proxy_url" \
    RATE="$rate_per_sec" \
    DURATION="${DURATION}s" \
    k6 run "$script_file" --out json=target/ci-proxy-load-results.json
    
    if [ $? -eq 0 ]; then
        info "k6 load test completed successfully"
        info "Results saved to target/ci-proxy-load-results.json"
    else
        error "k6 load test failed"
        exit 1
    fi
}

# Run wrk2 load test (fallback)
run_wrk2_test() {
    info "Running wrk2 load test..."
    
    if ! command -v wrk &> /dev/null; then
        error "wrk2 is not installed. Please install it from https://github.com/giltene/wrk2"
        exit 1
    fi
    
    local proxy_url="http://localhost:${PROXY_PORT}"
    local rate_per_sec=$((RATE / 60))  # Convert req/min to req/sec
    
    info "Test configuration:"
    info "  Proxy URL: ${proxy_url}"
    info "  Rate: ${RATE} req/min (${rate_per_sec} req/sec)"
    info "  Duration: ${DURATION} seconds"
    
    # Create a simple Lua script for wrk2
    local lua_script="$PROJECT_ROOT/target/ci-proxy-load.lua"
    mkdir -p "$(dirname "$lua_script")"
    cat > "$lua_script" << 'EOF'
request = function()
    return wrk.format("GET", "/health")
end
EOF
    
    # Run wrk2
    wrk -t4 -c100 -d"${DURATION}s" -R"${rate_per_sec}" -L -s "$lua_script" "$proxy_url" > target/ci-proxy-load-wrk2-results.txt
    
    if [ $? -eq 0 ]; then
        info "wrk2 load test completed successfully"
        info "Results saved to target/ci-proxy-load-wrk2-results.txt"
        cat target/ci-proxy-load-wrk2-results.txt
    else
        error "wrk2 load test failed"
        exit 1
    fi
}

# Main execution
main() {
    info "Starting proxy load test..."
    
    # Check if proxy is running
    check_proxy
    
    # Run the appropriate tool
    case "$TOOL" in
        k6)
            run_k6_test
            ;;
        wrk2)
            run_wrk2_test
            ;;
        *)
            error "Unknown tool: $TOOL. Use 'k6' or 'wrk2'"
            exit 1
            ;;
    esac
    
    info "Load test completed!"
}

main

