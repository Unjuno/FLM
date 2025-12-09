#!/usr/bin/env bash
set -euo pipefail

CERT_PATH="${1:-$HOME/.flm/certs/flm-ca.crt}"
TARGET="/usr/local/share/ca-certificates/flm-ca.crt"

if [ ! -f "$CERT_PATH" ]; then
  echo "Certificate not found: $CERT_PATH" >&2
  exit 1
fi

sudo mkdir -p /usr/local/share/ca-certificates
sudo cp "$CERT_PATH" "$TARGET"

if command -v update-ca-certificates >/dev/null 2>&1; then
  sudo update-ca-certificates
elif command -v update-ca-trust >/dev/null 2>&1; then
  sudo update-ca-trust extract
else
  echo "Install ca-certificates utilities to refresh trust store." >&2
  exit 1
fi

echo "Certificate installed successfully to system trust store"

