# Code Signing Policy

> Status: Implemented (Phase 3 Step 6 & Step 7) | Updated: 2025-02-01  
> Owners: Packaging WG, Release Engineering

This document defines how FLM installers and packaged artifacts are signed during Phase 3. It aligns with `docs/planning/PHASE3_PACKAGING_PLAN.md` (Step 5-7) and is referenced by `docs/status/active/NEXT_STEPS.md`.

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
| `LINUX_GPG_KEY` | GitHub Actions secret | Detached signature of `.tar.zst` / `.deb` / `.AppImage` | Hardware token preferred; rotate yearly |
| `LINUX_GPG_KEY_PASS` | GitHub Actions secret | Passphrase for GPG key | Rotate along with key |
| `LINUX_GPG_KEY_ID` | Repository secret | Public fingerprint (short) used in release notes | Update after rotation |

### Linux GPG Secrets Setup Instructions

To configure Linux GPG signing in GitHub Actions:

1. **Generate GPG Key Pair** (if not already done):
   ```bash
   gpg --full-generate-key
   # Select RSA and RSA (default)
   # Key size: 4096
   # Validity: 1y (or as needed)
   # Enter your name and email
   # Set a strong passphrase
   ```

2. **Export Private Key**:
   ```bash
   gpg --armor --export-secret-keys YOUR_KEY_ID > private-key.asc
   ```

3. **Get Key ID**:
   ```bash
   gpg --list-secret-keys --keyid-format LONG
   # Use the ID after "rsa4096/" (e.g., "ABC123DEF456")
   ```

4. **Set GitHub Secrets**:
   - Go to repository Settings → Secrets and variables → Actions
   - Add the following secrets:
     - `LINUX_GPG_KEY`: Paste the entire contents of `private-key.asc`
     - `LINUX_GPG_KEY_PASS`: The passphrase you set when generating the key
     - `LINUX_GPG_KEY_ID`: The key ID (e.g., "ABC123DEF456")

5. **Export Public Key** (for release notes):
   ```bash
   gpg --armor --export YOUR_KEY_ID > .github/gpg-public-key.asc
   ```
   Commit this file to the repository so users can import it for verification.

6. **Verify Setup**:
   - Push a tag starting with `v` (e.g., `v1.0.0`)
   - Check the build workflow logs to ensure GPG signing steps execute
   - Verify signatures are generated in the release artifacts

Key storage requirements:

1. Keys reside in an HSM or OS-provided secure enclave when generated. Exported material must be password-protected and encrypted.
2. CI runners never echo secrets; all signing commands redirect logs to redacted buffers.
3. Compromise response: revoke certificate, regenerate CA, update trust store instructions, and document in `docs/status/active/INCIDENT_LOG.md` (future).

### GitHub Secrets Access Control

To protect signing keys and certificates, configure access restrictions in GitHub repository settings:

1. **Repository Settings → Secrets and variables → Actions**
   - Review and restrict access to secrets
   - Enable "Require approval for all outside collaborators" if applicable
   - Set up environment protection rules for production secrets

2. **Required Secrets List** (for reference):
   - `TAURI_SIGNING_PRIVATE_KEY` - Windows code signing certificate (PKCS#12)
   - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` - Password for Windows certificate
   - `APPLE_CERTIFICATE` - macOS Developer ID certificate (base64 P12)
   - `APPLE_CERTIFICATE_PASSWORD` - Password for macOS certificate
   - `APPLE_SIGNING_IDENTITY` - macOS signing identity string
   - `APPLE_ID` - Apple ID for notarization (optional, Phase 3.5)
   - `APPLE_APP_SPECIFIC_PASSWORD` - App-specific password for notarization (optional, Phase 3.5)
   - `LINUX_GPG_KEY` - GPG private key for Linux package signing
   - `LINUX_GPG_KEY_PASS` - Passphrase for GPG key
   - `LINUX_GPG_KEY_ID` - GPG key ID (public fingerprint)

3. **Access Restriction Best Practices**:
   - Limit secret access to specific workflows (`.github/workflows/build.yml` only)
   - Use environment secrets for production builds
   - Enable audit logging for secret access
   - Rotate secrets regularly (quarterly for Windows, annually for macOS/Linux)
   - Document all secret rotations in `CHANGELOG.md`

4. **Workflow Permissions**:
   - Ensure workflows have minimal required permissions
   - Use `permissions:` block in workflow files to restrict access
   - Never expose secrets in workflow logs or outputs

## Platform Policies

### Windows (MSI / NSIS)

1. ✅ Build pipeline (`.github/workflows/build.yml`) runs `npm run tauri:build:windows` which executes `cargo tauri build --target x86_64-pc-windows-msvc`.
2. ✅ Tauri automatically signs installers when `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` secrets are set. Timestamp server default: `http://timestamp.digicert.com`.
3. ✅ `tauri.conf.json` keeps `bundle.windows.digestAlgorithm = "sha256"` and `windows.certificateThumbprint = null` (we sign dynamically, not hard-coded).
4. EV certificate optional for GA; Phase 3 uses OV-level cert plus Microsoft SmartScreen reputation building.
5. ✅ Verification steps implemented in CI (2025-02-01):
   - ✅ `signtool verify /pa installer.msi` (automated in build workflow, `Verify Windows signatures` step)
   - ✅ `signtool verify /pa installer.exe` (NSIS installer verification)
   - ✅ SHA256 hash published in `checksums.txt` in release notes
   - ✅ Signature verification results recorded in build logs (`reports/BUILD_LOG_YYYYMMDD.md`)

### macOS (DMG / .app)

1. ✅ Apple Developer ID Application certificate imported from `APPLE_CERTIFICATE` at build time using `security import` (automated in build workflow).
2. ✅ Codesign command (executed by Tauri) uses `APPLE_SIGNING_IDENTITY`; entitlements remain `null` until sandboxing milestones.
3. ⏳ After signing, run `xcrun stapler staple` to attach notarization tickets once Apple Notary integration is enabled (Phase 3.5).
4. ✅ Verification implemented in CI (2025-02-01):
   - ✅ `spctl --assess --type execute --verbose FLM.dmg` (automated in build workflow, `Verify macOS signatures` step)
   - ✅ `codesign --verify --verbose FLM.app` (App bundle verification)
   - ✅ Signature verification results recorded in build logs (`reports/BUILD_LOG_YYYYMMDD.md`)

### Linux (AppImage / deb)

1. ✅ Produce `.deb` and `.AppImage` via Tauri bundle step.
2. ✅ Generate detached signatures (automated in build workflow):
   - `gpg --batch --pinentry-mode loopback --passphrase $LINUX_GPG_KEY_PASS --default-key $LINUX_GPG_KEY_ID --armor --output flm.deb.sig --detach-sign flm.deb`
   - Repeat for AppImage/tarballs.
   - Signatures generated only when `LINUX_GPG_KEY`, `LINUX_GPG_KEY_PASS`, and `LINUX_GPG_KEY_ID` secrets are set.
3. ✅ Verification implemented in CI (2025-02-01):
   - ✅ `gpg --verify` for all signature files (automated in build workflow, `Verify Linux GPG signatures` step)
   - ✅ Signature verification results recorded in build logs (`reports/BUILD_LOG_YYYYMMDD.md`)
4. ✅ Publish public key fingerprint and import commands in release notes (automated in release workflow).

## Release Checklist Integration

1. CI stages: `build → sign → verify → hash → upload`. 
   - ✅ Signature verification steps added (2025-02-01):
     - Windows: `Verify Windows signatures` step verifies MSI and NSIS installers
     - macOS: `Verify macOS signatures` step verifies DMG and App bundles
     - Linux: `Verify Linux GPG signatures` step verifies all GPG signatures
   - Hash artifacts (SHA256) are recorded in `reports/BUILD_LOG_YYYYMMDD.md`.
   - ✅ Signature verification results are recorded in build logs (2025-02-01).
2. For every release, attach:
   - Signed installers (MSI, DMG, AppImage/deb)
   - Detached GPG signatures (Linux)
   - `checksums.txt` with SHA256 per file + PGP signature
3. ✅ Document verification steps in release notes (automated, 2025-02-01):
   - Windows signature verification commands
   - macOS signature verification commands
   - Linux GPG signature verification commands (including public key import)
4. Document verification steps in README + `docs/guides/SECURITY_FIREWALL_GUIDE.md`.

## Rotation & Incident Response

1. **Planned rotation**: update secrets, re-run CI, republish installers with new signatures, add note to `CHANGELOG`.
2. **Emergency**: revoke compromised cert, rebuild installers with new key, notify users via release page and `docs/status/active/INCIDENT_LOG.md`.
3. Update `docs/planning/PHASE3_PACKAGING_PLAN.md` Step 6 checklist after every rotation.

## References

- `docs/planning/PHASE3_PACKAGING_PLAN.md`
- `docs/specs/PROXY_SPEC.md` §10.6
- `docs/status/active/NEXT_STEPS.md` (tracking item)
- GitHub Actions workflow: `.github/workflows/build.yml`

