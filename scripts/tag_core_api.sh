#!/usr/bin/env bash
# SPDX-License-Identifier: MIT OR Apache-2.0

set -euo pipefail

usage() {
  cat <<'EOF'
Usage: scripts/tag_core_api.sh <version> [options]

Options:
  --dry-run          Print actions without modifying files or creating tags
  --no-sign          Create an annotated tag instead of a signed tag
  --skip-docs        Skip documentation updates (assumes they are already committed)
  --skip-tag         Skip git tag creation (only update docs/commit)
  --tag-message MSG  Custom tag message (default: "Core API <version>")
  -h, --help         Show this help

Environment:
  PYTHON_BIN         Override python executable (defaults to python3/python)
EOF
}

if [[ $# -lt 1 ]]; then
  usage
  exit 1
fi

VERSION="$1"
shift

if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "error: version must match SemVer (e.g., 1.2.3)" >&2
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CORE_SPEC="${ROOT_DIR}/docs/specs/CORE_API.md"
DATE="$(date -u +%Y-%m-%d)"
TAG="core-api-v${VERSION}"
TAG_MESSAGE="Core API ${VERSION}"
DRY_RUN=0
SKIP_DOCS=0
SKIP_TAG=0
SIGN_TAG=1

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --no-sign)
      SIGN_TAG=0
      shift
      ;;
    --skip-docs)
      SKIP_DOCS=1
      shift
      ;;
    --skip-tag)
      SKIP_TAG=1
      shift
      ;;
    --tag-message)
      if [[ $# -lt 2 ]]; then
        echo "error: --tag-message requires an argument" >&2
        exit 1
      fi
      TAG_MESSAGE="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "error: unknown option '$1'" >&2
      usage
      exit 1
      ;;
  esac
done

run_cmd() {
  if [[ "${DRY_RUN}" -eq 1 ]]; then
    printf '[dry-run] %s\n' "$*"
  else
    "$@"
  fi
}

require_clean_tree() {
  if ! git diff --quiet --ignore-submodules --; then
    echo "error: working tree has unstaged changes" >&2
    exit 1
  fi
  if ! git diff --cached --quiet --ignore-submodules --; then
    echo "error: working tree has staged but uncommitted changes" >&2
    exit 1
  fi
}

resolve_python() {
  if [[ -n "${PYTHON_BIN:-}" ]]; then
    if command -v "$PYTHON_BIN" >/dev/null 2>&1; then
      echo "$PYTHON_BIN"
      return
    fi
    echo "error: PYTHON_BIN='$PYTHON_BIN' not found" >&2
    exit 1
  fi

  if command -v python3 >/dev/null 2>&1; then
    echo "python3"
    return
  fi
  if command -v python >/dev/null 2>&1; then
    echo "python"
    return
  fi

  echo "error: python3 is required" >&2
  exit 1
}

update_core_spec() {
  local python_bin
  python_bin="$(resolve_python)"

  "$python_bin" - "${CORE_SPEC}" "${VERSION}" "${DATE}" <<'PY'
import re
import sys
from pathlib import Path

spec_path = Path(sys.argv[1])
version = sys.argv[2]
release_date = sys.argv[3]

text = spec_path.read_text(encoding="utf-8")
updated_re = re.compile(r"(Updated:\s*)(\d{4}-\d{2}-\d{2})")
text, replacements = updated_re.subn(rf"\1{release_date}", text, count=1)
if replacements != 1:
    raise SystemExit("failed to update 'Updated:' line in CORE_API.md")

lines = text.rstrip("\n").splitlines()

if not any(line.strip() == "## Changelog" for line in lines):
    lines.extend(("", "## Changelog", ""))

header_idx = None
for idx, line in enumerate(lines):
    if line.strip() == "## Changelog":
        header_idx = idx
        break

if header_idx is None:
    raise SystemExit("failed to locate '## Changelog' header")

entry_header = f"### [{version}] - {release_date}"
if any(line.strip() == entry_header for line in lines):
    raise SystemExit(f"changelog entry for {version} already exists")

insert_idx = header_idx + 1
if insert_idx >= len(lines) or lines[insert_idx].strip() != "":
    lines.insert(insert_idx, "")
    insert_idx += 1

entry = [
    entry_header,
    f"- docs: Tagged release core-api-v{version}",
    ""
]

lines[insert_idx:insert_idx] = entry
spec_path.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")
PY
}

if [[ "${SKIP_DOCS}" -eq 0 ]]; then
  require_clean_tree
  if [[ "${DRY_RUN}" -eq 1 ]]; then
    printf '[dry-run] updating %s for version %s on %s\n' "${CORE_SPEC}" "${VERSION}" "${DATE}"
  else
    update_core_spec
  fi

  run_cmd git add "${CORE_SPEC}"
  run_cmd git commit -m "docs: tag Core API v${VERSION}"
fi

if [[ "${SKIP_TAG}" -eq 0 ]]; then
  TAG_ARGS=(-m "${TAG_MESSAGE}" "${TAG}")
  if [[ "${SIGN_TAG}" -eq 1 ]]; then
    TAG_ARGS=(-s "${TAG_ARGS[@]}")
  else
    TAG_ARGS=(-a "${TAG_ARGS[@]}")
  fi
  run_cmd git tag "${TAG_ARGS[@]}"
fi

if [[ "${DRY_RUN}" -eq 1 ]]; then
  echo "dry-run complete (no changes made)"
fi

