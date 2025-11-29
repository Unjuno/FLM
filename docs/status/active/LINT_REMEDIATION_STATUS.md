# Lint Remediation Status

> Status: In Progress | Audience: All contributors | Updated: 2025-11-25

## Summary

`cargo clippy --workspace -- -D warnings` の実行で、`flm-core` と `flm-proxy` の主要なClippyエラーは修正済み。`flm-cli` には多数の `uninlined_format_args` と未使用変数の警告が残っているが、これらは後続のタスクで修正予定。

## 2025-11-25 更新

- ✅ `flm-core`: すべてのClippyエラーを修正（`uninlined_format_args`, `redundant_closure`, `unnecessary_filter_map`）
- ✅ `flm-proxy`: 主要なClippyエラーを修正（`uninlined_format_args`, `redundant_pattern_matching`, `manual_range_contains`, `needless_borrows_for_generic_args`）
- ⏳ `flm-cli`: 多数の `uninlined_format_args` と未使用変数の警告が残っている（後続タスクで修正予定）

## 2025-11-26 更新

- ✅ `flm-core`: `ResponseModality` に `Default` を導入し、`rcgen 0.13` への互換修正（`KeyPair::generate_for`, SAN 生成, `CertificateParams::*` API）を実施。
- ✅ `flm-proxy`: `handle_embeddings` のエラーパス修正と `packaged-ca` ルート/サーバ証明書生成を bin でも参照できるよう `certificate` モジュールを公開。
- ✅ エンジン各 crate: `EngineCapabilities` 初期化から不要な struct update を排除（`clippy::needless-update` 解消）。
- ✅ `cargo fmt --check` / `cargo clippy -- -D warnings` をワークスペースで実行し、ゼロエラーを確認。
- 🔁 残タスクなし。CI では `cargo clippy --workspace -- -D warnings` を継続実行。

## Previously Tracked Failures (Resolved)

| Crate / Target | Location | Lint / Error | Notes |
| --- | --- | --- | --- |
| `flm-core` (tests) | `crates/core/flm-core/tests/proxy_service_test.rs` | `E0046` – `MockProxyRepository` missing `save_active_handle`, `remove_active_handle` | Add no-op implementations so trait matches production API. |
| `flm-proxy` | `src/middleware.rs:47` | `unused_mut` | Drop `mut` from `request` argument. |
| `flm-proxy` | `src/adapters.rs:43` | `clippy::manual_clamp` | Replace chained `max/min` with `.clamp(1, 100)`. |
| `flm-proxy` | `src/adapters.rs:302` | `clippy::too_many_arguments` | Consider grouping audit log metadata into a struct or builder to drop parameter count below 8. |
| `flm-proxy` | `src/adapters.rs:463` | `clippy::too_many_arguments` | Same as above for intrusion logging. |
| `flm-proxy` | `src/controller.rs:286,295` | `clippy::uninlined_format_args` | Use inline formatting `{var}` syntax. |
| `flm-proxy` | `src/controller.rs:622` | `clippy::manual_range_contains` | Switch to `!(0.0..=2.0).contains(&temp)`. |
| `flm-proxy` | `src/controller.rs:756-1096` (multiple) | `clippy::redundant-pattern-matching` | Replace `if let Err(_) = ...` with `.is_err()` checks across validation helpers. |
| `flm-proxy` | `src/middleware.rs:300`, `src/utils.rs:19` | `clippy::uninlined_format_args` | Adopt inline formatting syntax. |
| `flm-proxy` | `src/security/intrusion_detection.rs:86` | `clippy::collapsible_if` | Collapse nested method checks into a single conditional. |

## Remediation Strategy

1. **Trait compliance first (flm-core tests)**  
   - Implement the missing repository methods so the entire workspace compiles before clippy analyzes downstream crates.

2. **Low-risk mechanical fixes (flm-proxy formatting & redundant matches)**  
   - Apply formatter-friendly changes: inline format args, remove redundant pattern matches, replace manual range checks. These have minimal behavioral risk.

3. **API-shape changes (audit/intrusion logging).**  
   - For `save_audit_log` / `save_intrusion_attempt`, introduce small DTO structs (e.g., `AuditLogParams`) to reduce argument counts without touching database schema.

4. **Re-run clippy after each category.**  
   - Expect multiple passes; stop when `cargo clippy --all-targets --all-features -- -D warnings` exits 0.

5. **Avoid blanket `#[allow(...)]`.**  
   - Only consider scoped `#[allow]` if a refactor would meaningfully increase risk (currently not anticipated).

## Coordination Notes

- Changes touch `flm-proxy` hot paths; run `cargo test -p flm-proxy --all-targets` after refactors.
- Once lint debt is cleared, enforce clippy in CI to prevent regressions.

