#!/bin/bash
# Local Build Test Script
#
# This script tests local builds and signature verification for all platforms.
# It can be run on any platform, but will only test the current platform.
#
# Usage: ./scripts/local-build-test.sh [--platform windows|macos|linux]

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
        Darwin*)
            echo "macos"
            ;;
        MINGW*|MSYS*|CYGWIN*)
            echo "windows"
            ;;
        *)
            error "Unknown platform: $(uname -s)"
            exit 1
            ;;
    esac
}

PLATFORM="${1:-$(detect_platform)}"

section "Local Build Test - $PLATFORM"

# Check prerequisites
section "Checking Prerequisites"
if ! command -v node &> /dev/null; then
    error "Node.js is not installed"
    exit 1
fi
info "Node.js version: $(node --version)"

if ! command -v cargo &> /dev/null; then
    error "Rust is not installed"
    exit 1
fi
info "Rust version: $(rustc --version)"

if ! command -v npm &> /dev/null; then
    error "npm is not installed"
    exit 1
fi
info "npm version: $(npm --version)"

# Install dependencies
section "Installing Dependencies"
if [ ! -d "node_modules" ]; then
    info "Installing npm dependencies..."
    npm ci
else
    info "npm dependencies already installed"
fi

# Build frontend
section "Building Frontend"
info "Building frontend..."
npm run build
if [ $? -eq 0 ]; then
    info "Frontend build succeeded"
else
    error "Frontend build failed"
    exit 1
fi

# Platform-specific build and verification
case "$PLATFORM" in
    windows)
        section "Windows Build"
        info "Building Windows installer..."
        npm run tauri:build:windows
        
        section "Windows Signature Verification"
        if command -v signtool &> /dev/null; then
            info "Verifying MSI signatures..."
            if ls src-tauri/target/x86_64-pc-windows-msvc/release/bundle/msi/*.msi 2>/dev/null; then
                for msi in src-tauri/target/x86_64-pc-windows-msvc/release/bundle/msi/*.msi; do
                    if signtool verify /pa "$msi"; then
                        info "MSI signature verified: $(basename "$msi")"
                    else
                        warn "MSI signature verification failed: $(basename "$msi")"
                    fi
                done
            else
                warn "No MSI files found"
            fi
            
            info "Verifying NSIS signatures..."
            if ls src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/*.exe 2>/dev/null; then
                for exe in src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/*.exe; do
                    if signtool verify /pa "$exe"; then
                        info "NSIS signature verified: $(basename "$exe")"
                    else
                        warn "NSIS signature verification failed: $(basename "$exe")"
                    fi
                done
            else
                warn "No NSIS installers found"
            fi
        else
            warn "signtool not found, skipping signature verification"
        fi
        ;;
    macos)
        section "macOS Build"
        info "Building macOS installer..."
        npm run tauri build
        
        section "macOS Signature Verification"
        info "Verifying DMG signatures..."
        if ls src-tauri/target/release/*.dmg 2>/dev/null; then
            for dmg in src-tauri/target/release/*.dmg; do
                if spctl --assess --type execute --verbose "$dmg" 2>/dev/null; then
                    info "DMG signature verified: $(basename "$dmg")"
                else
                    warn "DMG signature verification failed: $(basename "$dmg")"
                fi
            done
        else
            warn "No DMG files found"
        fi
        
        info "Verifying App bundle signatures..."
        if find src-tauri/target/release/bundle/macos -name "*.app" -type d 2>/dev/null | head -1 | read; then
            find src-tauri/target/release/bundle/macos -name "*.app" -exec codesign --verify --verbose {} \; 2>/dev/null && \
                info "App bundle signatures verified" || \
                warn "App bundle signature verification failed"
        else
            warn "No App bundles found"
        fi
        ;;
    linux)
        section "Linux Build"
        info "Building Linux installer..."
        npm run tauri build
        
        section "Linux GPG Signature Verification"
        if command -v gpg &> /dev/null; then
            info "Checking for GPG signatures..."
            if ls src-tauri/target/release/bundle/deb/*.deb.sig 2>/dev/null; then
                info "Verifying DEB package signatures..."
                for sig in src-tauri/target/release/bundle/deb/*.deb.sig; do
                    file="${sig%.sig}"
                    if [ -f "$file" ]; then
                        if gpg --verify "$sig" "$file" 2>/dev/null; then
                            info "DEB signature verified: $(basename "$file")"
                        else
                            warn "DEB signature verification failed: $(basename "$file")"
                        fi
                    fi
                done
            else
                warn "No GPG signatures found for DEB packages"
            fi
            
            if ls src-tauri/target/release/*.AppImage.sig 2>/dev/null; then
                info "Verifying AppImage signatures..."
                for sig in src-tauri/target/release/*.AppImage.sig; do
                    file="${sig%.sig}"
                    if [ -f "$file" ]; then
                        if gpg --verify "$sig" "$file" 2>/dev/null; then
                            info "AppImage signature verified: $(basename "$file")"
                        else
                            warn "AppImage signature verification failed: $(basename "$file")"
                        fi
                    fi
                done
            else
                warn "No GPG signatures found for AppImage files"
            fi
        else
            warn "gpg not found, skipping signature verification"
        fi
        ;;
    *)
        error "Unsupported platform: $PLATFORM"
        exit 1
        ;;
esac

section "Summary"
info "Local build test completed for $PLATFORM"
info "Check the build outputs in src-tauri/target/"

