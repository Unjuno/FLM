# Secrets Syntax Fix

> Status: Fixed | Updated: 2025-02-01

## Issue

GitHub Actions workflow was showing errors:
```
Unrecognized named-value: 'secrets'. Located at position 1 within expression: secrets.TAURI_SIGNING_PRIVATE_KEY != ''
```

## Root Cause

In GitHub Actions `if` conditions, when checking if a secret exists, using `secrets.SECRET_NAME != ''` inside `${{ }}` can cause parsing issues. The correct syntax is to use the secret directly as a boolean check.

## Fix Applied

Changed all `secrets` checks from:
- `if: ${{ secrets.SECRET_NAME != '' }}`

To:
- `if: ${{ secrets.SECRET_NAME }}`

## Fixed Lines

1. **Line 86**: Windows signature verification
   - `if: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}`

2. **Line 183**: macOS signature verification
   - `if: ${{ secrets.APPLE_CERTIFICATE }}`

3. **Line 276**: Linux GPG setup
   - `if: ${{ startsWith(github.ref, 'refs/tags/v') && secrets.LINUX_GPG_KEY }}`

4. **Line 285**: Linux GPG signing
   - `if: ${{ startsWith(github.ref, 'refs/tags/v') && secrets.LINUX_GPG_KEY && secrets.LINUX_GPG_KEY_PASS }}`

5. **Line 308**: Linux GPG signature verification
   - `if: ${{ startsWith(github.ref, 'refs/tags/v') && secrets.LINUX_GPG_KEY }}`

6. **Line 437**: Checksums GPG signing
   - `if: ${{ secrets.LINUX_GPG_KEY && secrets.LINUX_GPG_KEY_PASS }}`

## Explanation

In GitHub Actions expressions:
- `secrets.SECRET_NAME` evaluates to an empty string if the secret doesn't exist
- `secrets.SECRET_NAME` evaluates to the secret value if it exists
- Using `secrets.SECRET_NAME` directly in a boolean context checks if the secret exists and is non-empty
- Using `secrets.SECRET_NAME != ''` inside `${{ }}` can cause parsing issues in some contexts

## Expected Result

After this fix:
- ✅ Workflow file should validate successfully
- ✅ No "Unrecognized named-value" errors
- ✅ Conditional steps should execute correctly based on secrets availability

---

**Fix Applied By**: Automated  
**Fix Date**: 2025-02-01

