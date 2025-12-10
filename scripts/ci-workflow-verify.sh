#!/bin/bash
# CI Workflow Verification Script
#
# This script verifies that the CI workflow file is correctly configured
# for code signing and signature verification.
#
# Usage: ./scripts/ci-workflow-verify.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

section() {
    echo -e "\n${BLUE}=== $1 ===${NC}"
}

WORKFLOW_FILE=".github/workflows/build.yml"

if [ ! -f "$WORKFLOW_FILE" ]; then
    error "Workflow file not found: $WORKFLOW_FILE"
    exit 1
fi

info "Verifying CI workflow file: $WORKFLOW_FILE"

# Check if yamllint is available (optional)
if command -v yamllint &> /dev/null; then
    section "YAML Syntax Check"
    if yamllint "$WORKFLOW_FILE"; then
        info "YAML syntax is valid"
    else
        warn "YAML syntax check failed (yamllint may have strict rules)"
    fi
else
    warn "yamllint not found, skipping YAML syntax check"
fi

# Check Windows signature verification step
section "Windows Signature Verification"
if grep -q "Verify Windows signatures" "$WORKFLOW_FILE"; then
    if grep -A 20 "Verify Windows signatures" "$WORKFLOW_FILE" | grep -q "signtool verify"; then
        info "Windows signature verification step found"
    else
        error "Windows signature verification step found but signtool verify command is missing"
        exit 1
    fi
else
    error "Windows signature verification step not found"
    exit 1
fi

# Check macOS signature verification step
section "macOS Signature Verification"
if grep -q "Verify macOS signatures" "$WORKFLOW_FILE"; then
    if grep -A 20 "Verify macOS signatures" "$WORKFLOW_FILE" | grep -q "codesign --verify"; then
        info "macOS signature verification step found"
    else
        error "macOS signature verification step found but codesign verify command is missing"
        exit 1
    fi
else
    error "macOS signature verification step not found"
    exit 1
fi

# Check Linux GPG signature verification step
section "Linux GPG Signature Verification"
if grep -q "Verify Linux GPG signatures" "$WORKFLOW_FILE"; then
    if grep -A 20 "Verify Linux GPG signatures" "$WORKFLOW_FILE" | grep -q "gpg --verify"; then
        info "Linux GPG signature verification step found"
    else
        error "Linux GPG signature verification step found but gpg verify command is missing"
        exit 1
    fi
else
    error "Linux GPG signature verification step not found"
    exit 1
fi

# Check build log recording step
section "Build Log Recording"
if grep -q "Record signature verification results" "$WORKFLOW_FILE"; then
    info "Build log recording step found"
else
    warn "Build log recording step not found (optional but recommended)"
fi

# Check checksums generation
section "Checksums Generation"
if grep -q "Generate checksums" "$WORKFLOW_FILE"; then
    if grep -A 10 "Generate checksums" "$WORKFLOW_FILE" | grep -q "sha256sum"; then
        info "Checksums generation step found"
    else
        warn "Checksums generation step found but sha256sum command may be missing"
    fi
else
    warn "Checksums generation step not found"
fi

# Check GPG signing of checksums
section "GPG Signing of Checksums"
if grep -q "Sign checksums with GPG" "$WORKFLOW_FILE"; then
    info "GPG signing of checksums step found"
else
    warn "GPG signing of checksums step not found (optional but recommended)"
fi

# Check release notes generation
section "Release Notes Generation"
if grep -q "Generate release notes" "$WORKFLOW_FILE"; then
    info "Release notes generation step found"
else
    warn "Release notes generation step not found"
fi

section "Summary"
info "CI workflow verification completed successfully"
info "All required signature verification steps are present"

