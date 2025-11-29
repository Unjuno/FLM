# Code Signing Policy (Draft)

> Status: Draft (Phase 3 packaging) | Updated: 2025-11-26  
> Owners: Packaging WG, Release Engineering

This document defines how FLM installers and packaged artifacts are signed during Phase 3. It aligns with `docs/planning/PHASE3_PACKAGING_PLAN.md` (Step 5-7) and is referenced by `docs/status/active/PHASE1_PROGRESS.md`.

## Objectives

- Guarantee end-users can validate Windows/MSI, macOS/DMG, and Linux packages via platform-trusted signatures.
- Keep private keys outside of the repository; only CI runners with explicit approval can access signing material.
- Provide rotation, revocation, and audit steps before public distribution (Hacker News prep checklist).

## Secrets & Key Material

| Secret | Location | Purpose | Rotation |
| ------ | -------- | ------- | -------- |
| `TAURI_SIGNING_PRIVATE_KEY` | GitHub Actions secret | Windows/MSI & NSIS signing (Tauri) | Regenerate quarterly or on breach; upload encrypted PKCS#12 bundle |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | GitHub Actions secret | Unlocks the above key | Rotate along with key bundle |
| `APPLE_CERTIFICATE` | GitHub Actions secret (base64 P12) | Apple Developer ID Application cert | Revoke + reissue annually via Apple Developer portal |
| `APPLE_CERTIFICATE_PASSWORD` | GitHub Actions secret | Unlocks Apple cert bundle | Rotate whenever certificate rotates |
| `APPLE_SIGNING_IDENTITY` | Repository secret | Identifier like `Developer ID Application: FLM Inc. (TEAMID)` | Update if developer org or certificate subject changes |
| `LINUX_GPG_KEY` | GitHub Actions + local smart card | Detached signature of `.tar.zst` / `.deb` / `.AppImage` | Hardware token preferred; rotate yearly |
| `LINUX_GPG_KEY_ID` | Repository secret | Public fingerprint (short) used in release notes | Update after rotation |

Key storage requirements:

1. Keys reside in an HSM or OS-provided secure enclave when generated. Exported material must be password-protected and encrypted.
2. CI runners never echo secrets; all signing commands redirect logs to redacted buffers.
3. Compromise response: revoke certificate, regenerate CA, update trust store instructions, and document in `docs/status/active/INCIDENT_LOG.md` (future).

## Platform Policies

### Windows (MSI / NSIS)

1. Build pipeline (`.github/workflows/build.yml`) runs `cargo tauri build --target x86_64-pc-windows-msvc`.
2. After bundling, `tauri signer sign` consumes `TAURI_SIGNING_PRIVATE_KEY*` secrets. Timestamp server default: `http://timestamp.digicert.com`.
3. `tauri.conf.json` must keep `bundle.windows.digestAlgorithm = "sha256"` and `windows.certificateThumbprint = null` (we sign dynamically, not hard-coded).
4. EV certificate optional for GA; Phase 3 uses OV-level cert plus Microsoft SmartScreen reputation building.
5. Verification steps:
   - `signtool verify /pa installer.msi`
   - Publish SHA256 hash + signing certificate subject in release notes.

### macOS (DMG / .app)

1. Import Apple Developer ID Application certificate from `APPLE_CERTIFICATE` at build time using `security import`.
2. Codesign command (executed by Tauri) uses `APPLE_SIGNING_IDENTITY`; entitlements remain `null` until sandboxing milestones.
3. After signing, run `xcrun stapler staple` to attach notarization tickets once Apple Notary integration is enabled (Phase 3.5).
4. Verification: `spctl --assess --type execute --verbose FLM.dmg`.

### Linux (AppImage / deb)

1. Produce `.deb` and `.AppImage` via Tauri bundle step.
2. Generate detached signatures:
   - `gpg --batch --pinentry-mode loopback --passphrase $LINUX_GPG_KEY_PASS --default-key $LINUX_GPG_KEY_ID --armor --output flm.deb.sig --detach-sign flm.deb`
   - Repeat for AppImage/tarballs.
3. Publish public key fingerprint and import commands in README + release notes.

## Release Checklist Integration

1. CI stages: `build → sign → hash → upload`. Hash artifacts (SHA256) are recorded in `reports/BUILD_LOG_YYYYMMDD.md`.
2. For every release, attach:
   - Signed installers (MSI, DMG, AppImage/deb)
   - Detached GPG signatures (Linux)
   - `checksums.txt` with SHA256 per file + PGP signature
3. Document verification steps in README + `docs/guides/SECURITY_FIREWALL_GUIDE.md`.

## Rotation & Incident Response

1. **Planned rotation**: update secrets, re-run CI, republish installers with new signatures, add note to `CHANGELOG`.
2. **Emergency**: revoke compromised cert, rebuild installers with new key, notify users via release page and `docs/status/active/INCIDENT_LOG.md`.
3. Update `docs/planning/PHASE3_PACKAGING_PLAN.md` Step 6 checklist after every rotation.

## References

- `docs/planning/PHASE3_PACKAGING_PLAN.md`
- `docs/specs/PROXY_SPEC.md` §10.6
- `docs/status/active/PHASE1_PROGRESS.md` (tracking item)
- GitHub Actions workflow: `.github/workflows/build.yml`

