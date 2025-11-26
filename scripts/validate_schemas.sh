#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCHEMA_DIR="$ROOT_DIR/docs/specs/schemas"

to_platform_path() {
  if command -v wslpath >/dev/null 2>&1; then
    wslpath -w "$1"
  else
    echo "$1"
  fi
}

if ! command -v npx >/dev/null 2>&1; then
  echo "npx is required to run schema validation (install Node.js >= 18)." >&2
  exit 1
fi

SCHEMA_FILE="$SCHEMA_DIR/security_policy.schema.json"
EXAMPLE_FILE="$SCHEMA_DIR/examples/security_policy.valid.json"
SCHEMA_FILE_NATIVE="$(to_platform_path "$SCHEMA_FILE")"
EXAMPLE_FILE_NATIVE="$(to_platform_path "$EXAMPLE_FILE")"

echo "👉 Compiling schema: ${SCHEMA_FILE_NATIVE}"
npx --yes ajv-cli@5 compile --spec=draft2020 -s "${SCHEMA_FILE_NATIVE}"

echo "👉 Validating example data: ${EXAMPLE_FILE_NATIVE}"
npx --yes ajv-cli@5 validate --spec=draft2020 -s "${SCHEMA_FILE_NATIVE}" -d "${EXAMPLE_FILE_NATIVE}"

echo "✅ SecurityPolicy schema validated successfully."

