# FLM Certificate Resources

This directory contains the root CA certificate for the `packaged-ca` mode.

## Files

- `flm-ca.crt` - Root CA certificate in PEM format (will be generated during build or at runtime)

## Usage

The certificate is automatically loaded by the `packaged-ca` mode when starting the proxy server. If the certificate is not found, a new one will be generated automatically.

## Installation

To install the certificate to the OS trust store:

- **Windows**: Run `resources/scripts/install-ca.ps1`
- **macOS/Linux**: Run `resources/scripts/install-ca.sh`

## Uninstallation

To remove the certificate from the OS trust store:

- **Windows**: Run `resources/scripts/uninstall-ca.ps1`
- **macOS/Linux**: Run `resources/scripts/uninstall-ca.sh`

