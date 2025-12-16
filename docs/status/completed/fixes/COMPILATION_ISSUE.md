<!-- SPDX-License-Identifier: MIT OR Apache-2.0 -->
# flm-proxy Compilation Issue Tracker

- **Owner**: Proxy maintainers
- **Updated**: 2025-11-26
- **Status**: ✅ `flm-proxy` builds restored | ✅ rcgen API drift fixed (2025-11-26)

## Timeline

| Date | Event |
| --- | --- |
| 2025-11-25 | `cargo check --package flm-proxy` failed because Axum handlers no longer satisfied `Send + Sync` bounds during the proxy/router refactor. |
| 2025-11-26 | `handle_embeddings` rewritten to obtain engines from `AppState`, validate models/inputs, and return OpenAI-compatible responses. Helper utilities (`AttachmentLimits`, converters) are now at module scope again, which unblocks route registration. |

## Current Verification

- `cargo check --package flm-proxy` ✅
- FORMAT_CMD `cargo fmt --all -- --check` ✅
- LINT_CMD `cargo clippy --all-targets --all-features -- -D warnings` ❌ (fails in `flm-core` + engine crates; no proxy-specific lints outstanding)
- TYPECHECK_CMD `cargo check --workspace --all-targets` ✅ (rcgen API drift fixed: `CertificateParams::new()` → `CertificateParams::default()`)
- TEST_CMD `cargo test --workspace --all-targets` ⚠️ blocked until TYPECHECK_CMD passes
- Latest log: `reports/BUILD_LOG_20251126.md`

## Next Steps

1. Drive `docs/status/active/LINT_REMEDIATION_STATUS.md` items (clippy errors listed above) to green.
2. ✅ Update `crates/core/flm-core/src/services/certificate.rs` for current `rcgen` API - **COMPLETED** (2025-11-26)
3. Once typecheck succeeds, re-run TEST_CMD and attach the resulting log to `reports/`.


