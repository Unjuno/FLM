# Final Workflow Fix - Environment Variables for Secrets

> Status: Fixed | Updated: 2025-02-01

## Issue

GitHub Actions workflow was showing errors:
```
Unrecognized named-value: 'secrets'. Located at position 1 within expression: secrets.TAURI_SIGNING_PRIVATE_KEY != ''
```

## Root Cause

GitHub Actions does not support direct `secrets` references in `if` conditions. The recommended approach is to use environment variables.

## Solution

Instead of using `secrets` directly in `if` conditions, we now:
1. Set environment variables at the job level that check if secrets exist
2. Use those environment variables in `if` conditions

## Implementation

### Windows Build Job

**Added**:
```yaml
env:
  HAS_SIGNING_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY != '' }}
```

**Changed**:
- `if: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}`
- → `if: env.HAS_SIGNING_KEY == 'true'`

### macOS Build Job

**Added**:
```yaml
env:
  HAS_APPLE_CERT: ${{ secrets.APPLE_CERTIFICATE != '' }}
```

**Changed**:
- `if: ${{ secrets.APPLE_CERTIFICATE }}`
- → `if: env.HAS_APPLE_CERT == 'true'`

### Linux Build Job

**Added**:
```yaml
env:
  HAS_LINUX_GPG_KEY: ${{ secrets.LINUX_GPG_KEY != '' }}
  HAS_LINUX_GPG_PASS: ${{ secrets.LINUX_GPG_KEY_PASS != '' }}
  IS_TAG: ${{ startsWith(github.ref, 'refs/tags/v') }}
```

**Changed**:
- `if: ${{ startsWith(github.ref, 'refs/tags/v') && secrets.LINUX_GPG_KEY }}`
- → `if: env.IS_TAG == 'true' && env.HAS_LINUX_GPG_KEY == 'true'`

- `if: ${{ startsWith(github.ref, 'refs/tags/v') && secrets.LINUX_GPG_KEY && secrets.LINUX_GPG_KEY_PASS }}`
- → `if: env.IS_TAG == 'true' && env.HAS_LINUX_GPG_KEY == 'true' && env.HAS_LINUX_GPG_PASS == 'true'`

### Create Release Job

**Added**:
```yaml
env:
  HAS_LINUX_GPG_KEY: ${{ secrets.LINUX_GPG_KEY != '' }}
  HAS_LINUX_GPG_PASS: ${{ secrets.LINUX_GPG_KEY_PASS != '' }}
```

**Changed**:
- `if: ${{ secrets.LINUX_GPG_KEY && secrets.LINUX_GPG_KEY_PASS }}`
- → `if: env.HAS_LINUX_GPG_KEY == 'true' && env.HAS_LINUX_GPG_PASS == 'true'`

## Fixed Lines

1. **Line 86**: Windows signature verification
2. **Line 183**: macOS signature verification
3. **Line 280**: Linux GPG setup
4. **Line 293**: Linux GPG signing
5. **Line 316**: Linux GPG signature verification
6. **Line 441**: Checksums GPG signing

## Why This Works

- Environment variables are set at the job level using `${{ }}` syntax (this works)
- `if` conditions reference environment variables using `env.VARIABLE_NAME` (this is supported)
- This avoids the "Unrecognized named-value: 'secrets'" error

## Expected Result

After this fix:
- ✅ Workflow file should validate successfully
- ✅ No "Unrecognized named-value" errors
- ✅ Conditional steps should execute correctly based on secrets availability
- ✅ All secrets checks work through environment variables

---

**Fix Applied By**: Automated  
**Fix Date**: 2025-02-01  
**Commit**: Latest commit

