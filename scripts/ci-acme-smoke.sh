#!/bin/bash
# CI ACME Smoke Test Script
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
# Usage: ./scripts/ci-acme-smoke.sh [--challenge http-01|dns-01] [--domain DOMAIN] [--email EMAIL] [--port PORT] [--skip-if-no-domain]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

# Default values
ACME_CHALLENGE="${ACME_CHALLENGE:-http-01}"
ACME_DOMAIN="${ACME_DOMAIN:-}"
ACME_EMAIL="${ACME_EMAIL:-ci@example.test}"
ACME_STAGING="${ACME_STAGING:-true}"
PROXY_PORT="${PROXY_PORT:-8080}"
SKIP_IF_NO_DOMAIN=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --challenge)
            ACME_CHALLENGE="$2"
            shift 2
            ;;
        --domain)
            ACME_DOMAIN="$2"
            shift 2
            ;;
        --email)
            ACME_EMAIL="$2"
            shift 2
            ;;
        --port)
            PROXY_PORT="$2"
            shift 2
            ;;
        --skip-if-no-domain)
            SKIP_IF_NO_DOMAIN=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--challenge http-01|dns-01] [--domain DOMAIN] [--email EMAIL] [--port PORT] [--skip-if-no-domain]"
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

# Check if domain is provided
if [ -z "$ACME_DOMAIN" ]; then
    if [ "$SKIP_IF_NO_DOMAIN" = true ]; then
        warn "No domain provided and --skip-if-no-domain is set. Skipping ACME smoke test."
        exit 0
    else
        error "ACME_DOMAIN environment variable or --domain option is required"
        error "Set ACME_DOMAIN or use --skip-if-no-domain to skip this test"
        exit 1
    fi
fi

# Validate challenge type
if [ "$ACME_CHALLENGE" != "http-01" ] && [ "$ACME_CHALLENGE" != "dns-01" ]; then
    error "Invalid challenge type: $ACME_CHALLENGE. Use 'http-01' or 'dns-01'"
    exit 1
fi

info "Starting ACME smoke test..."
info "Configuration:"
info "  Domain: $ACME_DOMAIN"
info "  Email: $ACME_EMAIL"
info "  Challenge: $ACME_CHALLENGE"
info "  Staging: $ACME_STAGING"
info "  Port: $PROXY_PORT"

# Build the CLI tool
info "Building flm-cli..."
if ! cargo build --release --bin flm; then
    error "Failed to build flm-cli"
    exit 1
fi

FLM_BIN="$PROJECT_ROOT/target/release/flm"
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
    FLM_BIN="$FLM_BIN.exe"
fi

if [ ! -f "$FLM_BIN" ]; then
    error "flm binary not found at $FLM_BIN"
    exit 1
fi

# Create temporary directories for test databases
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

CONFIG_DB="$TEMP_DIR/config.db"
SECURITY_DB="$TEMP_DIR/security.db"

info "Using temporary databases:"
info "  Config DB: $CONFIG_DB"
info "  Security DB: $SECURITY_DB"

# Step 1: Start proxy with ACME
info "Starting proxy with ACME certificate issuance..."
info "This may take up to 90 seconds for certificate issuance..."

START_TIME=$(date +%s)

# Build the command
ACME_CMD="$FLM_BIN proxy start"
ACME_CMD="$ACME_CMD --mode https-acme"
ACME_CMD="$ACME_CMD --port $PROXY_PORT"
ACME_CMD="$ACME_CMD --challenge $ACME_CHALLENGE"
ACME_CMD="$ACME_CMD --domain $ACME_DOMAIN"
ACME_CMD="$ACME_CMD --email $ACME_EMAIL"
ACME_CMD="$ACME_CMD --db-path-config $CONFIG_DB"
ACME_CMD="$ACME_CMD --db-path-security $SECURITY_DB"
ACME_CMD="$ACME_CMD --no-daemon"

# Start proxy in background
info "Executing: $ACME_CMD"
$ACME_CMD > "$TEMP_DIR/proxy.log" 2>&1 &
PROXY_PID=$!

# Wait for certificate issuance (max 90 seconds as per spec)
CERT_ISSUED=false
for i in {1..90}; do
    sleep 1
    
    # Check if proxy process is still running
    if ! kill -0 $PROXY_PID 2>/dev/null; then
        error "Proxy process exited unexpectedly"
        cat "$TEMP_DIR/proxy.log"
        exit 1
    fi
    
    # Check if HTTPS endpoint is responding (indicates certificate is ready)
    if curl -k -s "https://localhost:$((PROXY_PORT + 1))/health" > /dev/null 2>&1; then
        ELAPSED=$(($(date +%s) - START_TIME))
        info "Certificate issued successfully in ${ELAPSED} seconds"
        CERT_ISSUED=true
        break
    fi
done

if [ "$CERT_ISSUED" = false ]; then
    ELAPSED=$(($(date +%s) - START_TIME))
    error "Certificate issuance timed out after ${ELAPSED} seconds (limit: 90s)"
    cat "$TEMP_DIR/proxy.log"
    
    # Clean up
    kill $PROXY_PID 2>/dev/null || true
    wait $PROXY_PID 2>/dev/null || true
    
    exit 1
fi

# Step 2: Verify HTTPS endpoint
info "Verifying HTTPS endpoint..."
HTTPS_PORT=$((PROXY_PORT + 1))

# Test health endpoint over HTTPS
if ! curl -k -s "https://localhost:${HTTPS_PORT}/health" > /dev/null; then
    error "HTTPS health endpoint failed"
    kill $PROXY_PID 2>/dev/null || true
    wait $PROXY_PID 2>/dev/null || true
    exit 1
fi

info "HTTPS health endpoint is working"

# Step 3: Test /v1/models endpoint (if API key is available)
if [ -n "${API_KEY:-}" ]; then
    info "Testing /v1/models endpoint over HTTPS..."
    if curl -k -s -H "Authorization: Bearer $API_KEY" "https://localhost:${HTTPS_PORT}/v1/models" > /dev/null; then
        info "HTTPS /v1/models endpoint is working"
    else
        warn "HTTPS /v1/models endpoint test failed (this may be expected if no engines are registered)"
    fi
else
    warn "API_KEY not set, skipping /v1/models endpoint test"
fi

# Step 4: Stop proxy
info "Stopping proxy..."
if ! "$FLM_BIN" proxy stop --port "$PROXY_PORT" --db-path-config "$CONFIG_DB" --db-path-security "$SECURITY_DB" > /dev/null 2>&1; then
    warn "Proxy stop command failed, attempting to kill process"
    kill $PROXY_PID 2>/dev/null || true
    wait $PROXY_PID 2>/dev/null || true
fi

# Wait a moment for cleanup
sleep 2

info "ACME smoke test completed successfully!"
info "Certificate was issued in ${ELAPSED} seconds (< 90s limit)"

