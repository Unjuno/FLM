# Uninstaller Test Results

> Status: Template | Updated: 2025-02-01 | Test Date: [YYYY-MM-DD]

## Test Information

- **Platform**: [Windows / Linux]
- **OS Version**: [Version]
- **Test Date**: [YYYY-MM-DD HH:MM:SS]
- **Test Executor**: [Name]
- **Installer Version**: [Version]

## Windows NSIS Uninstaller Test

### Pre-Installation State
- **Certificate Installed**: [Yes / No]
- **Certificate Location**: [Path]
- **Certificate Subject**: [Subject]

### Installation
- **Installer Used**: [Path to .exe]
- **Installation Status**: [✅ Success / ❌ Failed]
- **Installation Directory**: [Path]
- **Certificate Installation**: [✅ Success / ❌ Failed / ⚠️ Skipped]

### Post-Installation Verification
- **Certificate in Trust Store**: [✅ Yes / ❌ No]
- **Certificate Verification Command**: [Command used]
- **Certificate Details**: [Details]

### Uninstallation
- **Uninstaller Method**: [Control Panel / uninstall.exe / Other]
- **Uninstallation Status**: [✅ Success / ❌ Failed]
- **Certificate Removal Prompt**: [✅ Shown / ❌ Not shown]
- **User Response**: [Yes / No / N/A]

### Post-Uninstallation Verification
- **Certificate Removed**: [✅ Yes / ❌ No]
- **Certificate Verification Command**: [Command used]
- **Remaining Files**: [List / None]

### Error Handling
- **Script Not Found Error**: [✅ Handled / ❌ Not handled]
- **Permission Error**: [✅ Handled / ❌ Not handled]
- **Certificate Not Found Error**: [✅ Handled / ❌ Not handled]

### Issues Found
- [None / List of issues]

---

## Linux DEB Uninstaller Test

### Pre-Installation State
- **Certificate Installed**: [Yes / No]
- **Certificate Location**: [Path]

### Installation
- **DEB Package**: [Path]
- **Installation Command**: [Command used]
- **Installation Status**: [✅ Success / ❌ Failed]
- **Certificate Installation**: [✅ Success / ❌ Failed / ⚠️ Skipped]

### Post-Installation Verification
- **Certificate in Trust Store**: [✅ Yes / ❌ No]
- **Certificate Location**: [Path]
- **Certificate Verification Command**: [Command used]

### Uninstallation
- **Uninstallation Command**: [Command used]
- **Uninstallation Status**: [✅ Success / ❌ Failed]
- **Interactive Prompt**: [✅ Shown / ❌ Not shown (non-interactive)]
- **User Response**: [Yes / No / N/A]

### Post-Uninstallation Verification
- **Certificate Removed**: [✅ Yes / ❌ No]
- **Certificate Verification Command**: [Command used]
- **Log File Generated**: [✅ Yes / ❌ No]
- **Log File Location**: [/var/log/flm-uninstall.log]
- **Log File Content**: [Summary / Full content]

### Error Handling
- **Script Not Found (Alternative Paths)**: [✅ Handled / ❌ Not handled]
- **Non-Interactive Mode**: [✅ Handled / ❌ Not handled]
- **Permission Error**: [✅ Handled / ❌ Not handled]

### Issues Found
- [None / List of issues]

---

## Overall Assessment

### Success Criteria
- [ ] Installation succeeded
- [ ] Certificate installed correctly
- [ ] Uninstallation succeeded
- [ ] Certificate removed correctly
- [ ] Error handling works correctly
- [ ] Log files generated (Linux)

### Test Conclusion
[Overall assessment of the test results]

### Recommendations
- [List any recommendations for improvements]

---

## Next Steps

1. [Action items based on test results]
2. [Follow-up tests if needed]

---

**Test Completed By**: [Name]  
**Test Duration**: [Total time]  
**Test Environment**: [VM / Physical Machine / Other]

