# rcgen API Drift Fix

> Status: Completed | Date: 2025-11-26

## Problem

`crates/core/flm-core/src/services/certificate.rs`でrcgen 0.13のAPI変更に対応していなかった。

## Solution

`CertificateParams::new(Vec::<String>::new())`を`CertificateParams::default()`に変更。

## Changes

- `crates/core/flm-core/src/services/certificate.rs`:
  - Line 47: `CertificateParams::new(Vec::<String>::new())` → `CertificateParams::default()`
  - Line 138: `CertificateParams::new(Vec::<String>::new())` → `CertificateParams::default()`

## Verification

- ✅ `cargo check --package flm-core --all-targets` succeeds
- ✅ No linter errors

## Related

- `docs/status/active/COMPILATION_ISSUE.md` - Updated to reflect fix
- `docs/status/PROGRESS_REPORT.md` - Progress tracking

