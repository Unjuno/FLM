#!/bin/bash
# CI CLI Integration Test Script
#
# This script runs integration tests for the FLM CLI tool.
# It performs:
# 1. Format check
# 2. Clippy check
# 3. Unit tests
# 4. Integration smoke tests
#
# Usage: ./scripts/ci-cli.sh [--skip-format] [--skip-clippy] [--skip-tests]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

# Default values
SKIP_FORMAT=false
SKIP_CLIPPY=false
SKIP_TESTS=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-format)
            SKIP_FORMAT=true
            shift
            ;;
        --skip-clippy)
            SKIP_CLIPPY=true
            shift
            ;;
        --skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--skip-format] [--skip-clippy] [--skip-tests]"
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

# Step 1: Format check
if [ "$SKIP_FORMAT" = false ]; then
    info "Running format check..."
    if ! cargo fmt --all -- --check; then
        error "Format check failed. Run 'cargo fmt --all' to fix."
        exit 1
    fi
    info "Format check passed"
else
    warn "Skipping format check"
fi

# Step 2: Clippy check
if [ "$SKIP_CLIPPY" = false ]; then
    info "Running clippy check..."
    if ! cargo clippy --all-targets --all-features -- -D warnings; then
        error "Clippy check failed"
        exit 1
    fi
    info "Clippy check passed"
else
    warn "Skipping clippy check"
fi

# Step 3: Unit tests
if [ "$SKIP_TESTS" = false ]; then
    info "Running unit tests..."
    if ! cargo test --workspace --no-fail-fast; then
        error "Unit tests failed"
        exit 1
    fi
    info "Unit tests passed"
else
    warn "Skipping unit tests"
fi

# Step 4: Integration smoke tests
if [ "$SKIP_TESTS" = false ]; then
    info "Running integration smoke tests..."
    
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
    
    # Test: engines detect
    info "Testing: flm engines detect --format json"
    if ! "$FLM_BIN" engines detect --format json > /dev/null 2>&1; then
        warn "engines detect failed (this is expected if no engines are running)"
    else
        info "engines detect succeeded"
    fi
    
    # Test: models list (if engines are available)
    info "Testing: flm models list"
    if ! "$FLM_BIN" models list > /dev/null 2>&1; then
        warn "models list failed (this is expected if no engines are running)"
    else
        info "models list succeeded"
    fi
    
    # Test: proxy start/stop (use a high port to avoid conflicts)
    TEST_PORT=19999
    info "Testing: flm proxy start --mode local-http --port $TEST_PORT"
    if "$FLM_BIN" proxy start --mode local-http --port "$TEST_PORT" > /dev/null 2>&1; then
        info "Proxy started successfully"
        
        # Wait a moment for the proxy to start
        sleep 2
        
        # Test: proxy status
        info "Testing: flm proxy status"
        if "$FLM_BIN" proxy status > /dev/null 2>&1; then
            info "proxy status succeeded"
        else
            warn "proxy status failed"
        fi
        
        # Test: proxy stop
        info "Testing: flm proxy stop --all"
        if "$FLM_BIN" proxy stop --all > /dev/null 2>&1; then
            info "proxy stop succeeded"
        else
            warn "proxy stop failed"
        fi
        
        # Wait a moment for the proxy to stop
        sleep 1
    else
        warn "proxy start failed (this is expected if port $TEST_PORT is in use)"
    fi
    
    info "Integration smoke tests completed"
else
    warn "Skipping integration smoke tests"
fi

info "All CI CLI checks passed!"

