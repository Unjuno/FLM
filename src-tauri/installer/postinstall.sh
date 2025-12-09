#!/usr/bin/env bash
# DMG postinstall script for macOS
# This script is executed after the DMG installation completes
# It prompts the user to install the root CA certificate

set -euo pipefail

# Get the application bundle path
APP_BUNDLE="/Applications/FLM.app"
CERT_PATH="$APP_BUNDLE/Contents/Resources/resources/certs/flm-ca.crt"
INSTALL_SCRIPT="$APP_BUNDLE/Contents/Resources/resources/scripts/install-ca.sh"

# Check if certificate file exists
if [ ! -f "$CERT_PATH" ]; then
    echo "Certificate file not found at $CERT_PATH"
    exit 0
fi

# Ask user if they want to install the certificate
osascript <<EOF
set userChoice to button returned of (display dialog "FLM Root CA certificate found." & return & return & "Would you like to install it to the system trust store?" & return & return & "This is required for packaged-ca mode to work properly." buttons {"Skip", "Install"} default button "Install" with icon caution)
if userChoice is "Install" then
    do shell script "bash '$INSTALL_SCRIPT' '$CERT_PATH'" with administrator privileges
end if
EOF

exit 0

