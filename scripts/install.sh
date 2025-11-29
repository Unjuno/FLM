#!/usr/bin/env bash
# FLM CLI Installer for Linux/macOS
# This script installs the FLM CLI binary and optionally registers the root CA certificate

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_PREFIX="${INSTALL_PREFIX:-/usr/local}"
BIN_DIR="${INSTALL_PREFIX}/bin"
CERT_DIR="${HOME}/.flm/certs"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

error() {
    echo -e "${RED}Error: $*${NC}" >&2
    exit 1
}

info() {
    echo -e "${GREEN}Info: $*${NC}"
}

warn() {
    echo -e "${YELLOW}Warning: $*${NC}"
}

# Check if running as root (for system-wide installation)
check_root() {
    if [ "$EUID" -eq 0 ]; then
        warn "Running as root. System-wide installation will be performed."
        BIN_DIR="/usr/local/bin"
    fi
}

# Find the flm binary
find_binary() {
    local binary_path
    if [ -f "${SCRIPT_DIR}/../target/release/flm" ]; then
        binary_path="${SCRIPT_DIR}/../target/release/flm"
    elif [ -f "${SCRIPT_DIR}/flm" ]; then
        binary_path="${SCRIPT_DIR}/flm"
    else
        error "FLM binary not found. Please build the project first with 'cargo build --release'"
    fi
    echo "$binary_path"
}

# Install the binary
install_binary() {
    local binary_path="$1"
    local target_path="${BIN_DIR}/flm"
    
    info "Installing FLM CLI to ${target_path}"
    
    # Create bin directory if it doesn't exist
    sudo mkdir -p "${BIN_DIR}"
    
    # Copy binary
    sudo cp "${binary_path}" "${target_path}"
    sudo chmod +x "${target_path}"
    
    info "FLM CLI installed successfully"
}

# Install root CA certificate (optional)
install_certificate() {
    local cert_path="${CERT_DIR}/flm-ca.crt"
    
    if [ ! -f "${cert_path}" ]; then
        warn "Root CA certificate not found at ${cert_path}. Skipping certificate installation."
        return 0
    fi
    
    info "Installing root CA certificate to system trust store"
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain "${cert_path}" || {
            warn "Failed to install certificate to system keychain. Trying user keychain..."
            security add-trusted-cert -d -r trustRoot -k ~/Library/Keychains/login.keychain-db "${cert_path}" || {
                error "Failed to install certificate"
            }
        }
        info "Certificate installed to macOS keychain"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        local target_cert="/usr/local/share/ca-certificates/flm-ca.crt"
        sudo cp "${cert_path}" "${target_cert}"
        
        if command -v update-ca-certificates >/dev/null 2>&1; then
            sudo update-ca-certificates
        elif command -v update-ca-trust >/dev/null 2>&1; then
            sudo update-ca-trust extract
        else
            error "Neither update-ca-certificates nor update-ca-trust found. Please install ca-certificates package."
        fi
        info "Certificate installed to Linux trust store"
    else
        warn "Unsupported OS: $OSTYPE. Certificate installation skipped."
    fi
}

# Main installation
main() {
    info "FLM CLI Installer"
    info "=================="
    
    check_root
    
    local binary_path
    binary_path=$(find_binary)
    
    install_binary "${binary_path}"
    
    # Ask user if they want to install the certificate
    if [ -f "${CERT_DIR}/flm-ca.crt" ]; then
        read -p "Do you want to install the root CA certificate? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            install_certificate
        fi
    fi
    
    info "Installation complete!"
    info "You can now use 'flm' command from anywhere."
    info "Run 'flm --help' to get started."
}

main "$@"

