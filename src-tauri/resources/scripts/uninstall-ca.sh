#!/usr/bin/env bash
# FLM CA Certificate Uninstaller for Linux/macOS
# This script removes the FLM root CA certificate from the OS trust store

set -euo pipefail

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

# Remove certificate from trust store
remove_certificate() {
    info "Removing FLM root CA certificate from system trust store"
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if sudo security find-certificate -c "FLM Local CA" -a /Library/Keychains/System.keychain >/dev/null 2>&1; then
            sudo security delete-certificate -c "FLM Local CA" /Library/Keychains/System.keychain || {
                warn "Failed to remove certificate from system keychain. Trying user keychain..."
                security delete-certificate -c "FLM Local CA" ~/Library/Keychains/login.keychain-db || {
                    error "Failed to remove certificate"
                }
            }
            info "Certificate removed from macOS keychain"
        else
            warn "FLM Local CA certificate not found in keychain"
        fi
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        local target_cert="/usr/local/share/ca-certificates/flm-ca.crt"
        if [ -f "${target_cert}" ]; then
            sudo rm "${target_cert}"
            
            if command -v update-ca-certificates >/dev/null 2>&1; then
                sudo update-ca-certificates
            elif command -v update-ca-trust >/dev/null 2>&1; then
                sudo update-ca-trust extract
            else
                warn "Neither update-ca-certificates nor update-ca-trust found. Certificate file removed but trust store may not be updated."
            fi
            info "Certificate removed from Linux trust store"
        else
            warn "FLM CA certificate not found at ${target_cert}"
        fi
    else
        error "Unsupported OS: $OSTYPE"
    fi
}

# Main uninstallation
main() {
    info "FLM CA Certificate Uninstaller"
    info "==============================="
    
    # Check for non-interactive flag
    local force=false
    if [[ "${1:-}" == "-y" ]] || [[ "${1:-}" == "--yes" ]] || [[ "${1:-}" == "-f" ]] || [[ "${1:-}" == "--force" ]]; then
        force=true
    fi
    
    # Ask for confirmation unless force flag is set
    if [ "$force" = false ]; then
        read -p "Do you want to remove the FLM root CA certificate from the system trust store? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            info "Uninstallation cancelled"
            exit 0
        fi
    fi
    
    remove_certificate
    
    info "Uninstallation complete!"
}

main "$@"

