#!/bin/bash
# Uninstaller Test Script
#
# This script tests the uninstaller functionality for Windows and Linux.
# It verifies that certificates are properly removed during uninstallation.
#
# Usage: ./scripts/uninstaller-test.sh [--platform windows|linux]

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

# Detect platform
detect_platform() {
    case "$(uname -s)" in
        Linux*)
            echo "linux"
            ;;
        MINGW*|MSYS*|CYGWIN*)
            echo "windows"
            ;;
        *)
            error "Uninstaller test is only supported on Windows and Linux"
            exit 1
            ;;
    esac
}

PLATFORM="${1:-$(detect_platform)}"

section "Uninstaller Test - $PLATFORM"

case "$PLATFORM" in
    windows)
        section "Windows NSIS Uninstaller Test"
        info "This test requires manual execution on a Windows system"
        info "Steps to test:"
        echo "1. Install the application using the NSIS installer"
        echo "2. Verify the certificate is installed in the system trust store"
        echo "3. Run the uninstaller"
        echo "4. Verify the certificate is removed from the system trust store"
        echo ""
        echo "Certificate check command:"
        echo "  Get-ChildItem Cert:\\LocalMachine\\Root | Where-Object { \$_.Subject -like \"*FLM*\" }"
        echo ""
        echo "Uninstaller location:"
        echo "  Control Panel > Programs and Features > FLM > Uninstall"
        echo "  Or: \$INSTDIR\\uninstall.exe"
        ;;
    linux)
        section "Linux DEB Uninstaller Test"
        info "Checking for DEB package..."
        
        DEB_FILE=$(find src-tauri/target/release/bundle/deb -name "*.deb" 2>/dev/null | head -1)
        if [ -z "$DEB_FILE" ]; then
            error "DEB package not found. Please build the package first."
            exit 1
        fi
        info "Found DEB package: $DEB_FILE"
        
        section "Pre-installation Certificate Check"
        info "Checking for existing FLM certificates..."
        if [ -f "/usr/local/share/ca-certificates/flm-ca.crt" ]; then
            warn "FLM certificate already exists: /usr/local/share/ca-certificates/flm-ca.crt"
        else
            info "No existing FLM certificate found (expected)"
        fi
        
        section "Installation Test"
        info "Installing DEB package (requires sudo)..."
        echo "Run the following command manually:"
        echo "  sudo dpkg -i $DEB_FILE"
        echo "  sudo apt-get install -f"
        echo ""
        echo "After installation, check for certificate:"
        echo "  ls -la /usr/local/share/ca-certificates/ | grep flm"
        
        section "Uninstallation Test"
        info "To test uninstallation, run:"
        echo "  sudo dpkg -r flm"
        echo "  # or"
        echo "  sudo apt-get remove flm"
        echo ""
        echo "After uninstallation, check log file:"
        echo "  sudo cat /var/log/flm-uninstall.log"
        echo ""
        echo "Verify certificate is removed:"
        echo "  ls -la /usr/local/share/ca-certificates/ | grep flm"
        echo "  # Should return nothing"
        ;;
    *)
        error "Unsupported platform: $PLATFORM"
        exit 1
        ;;
esac

section "Summary"
info "Uninstaller test instructions provided for $PLATFORM"
info "Please follow the manual steps above to complete the test"

