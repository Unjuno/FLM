; NSIS Custom Script for FLM CA Certificate Installation
; This script is executed after the main installation completes
; It prompts the user to install the root CA certificate
;
; Tauri 2.0 uses NSIS_HOOK_POSTINSTALL and NSIS_HOOK_POSTUNINSTALL macros

!macro NSIS_HOOK_POSTINSTALL
  ; Get the installation directory
  ; Tauri 2.0 installs to $INSTDIR
  StrCpy $0 "$INSTDIR"
  
  ; Check if certificate file exists
  IfFileExists "$0\resources\certs\flm-ca.crt" 0 +10
    ; Certificate file found, ask user if they want to install it
    MessageBox MB_YESNO|MB_ICONQUESTION "FLM Root CA certificate found.$\n$\nWould you like to install it to the system trust store?$\n$\nThis is required for packaged-ca mode to work properly." IDYES install_cert IDNO skip_cert
    
    install_cert:
      ; Run the install-ca.ps1 script
      ExecWait 'powershell.exe -ExecutionPolicy Bypass -File "$0\resources\scripts\install-ca.ps1" -CertPath "$0\resources\certs\flm-ca.crt"'
      Goto skip_cert
    
    skip_cert:
      ; User chose not to install certificate
      MessageBox MB_OK "Certificate installation skipped.$\n$\nYou can install it later by running:$\n$\n$0\resources\scripts\install-ca.ps1"
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  ; Get the installation directory
  ; Tauri 2.0 uses $INSTDIR during uninstall
  StrCpy $0 "$INSTDIR"
  
  ; Ask user if they want to remove the certificate
  MessageBox MB_YESNO|MB_ICONQUESTION "Would you like to remove the FLM Root CA certificate from the system trust store?" IDYES remove_cert IDNO skip_remove
  
  remove_cert:
    ; Check if uninstall script exists
    IfFileExists "$0\resources\scripts\uninstall-ca.ps1" 0 script_not_found
      ; Run the uninstall-ca.ps1 script with error handling
      ClearErrors
      ExecWait 'powershell.exe -ExecutionPolicy Bypass -File "$0\resources\scripts\uninstall-ca.ps1" -Force' $1
      IfErrors exec_error
        ; Check exit code
        IntCmp $1 0 exec_success exec_error exec_error
        exec_success:
          ; Certificate removal succeeded
          Goto skip_remove
        exec_error:
          ; Certificate removal failed
          MessageBox MB_OK|MB_ICONEXCLAMATION "Failed to remove FLM Root CA certificate.$\n$\nExit code: $1$\n$\nYou can remove it manually by running:$\n$\n$0\resources\scripts\uninstall-ca.ps1"
          Goto skip_remove
      script_not_found:
        ; Script not found, inform user
        MessageBox MB_OK|MB_ICONEXCLAMATION "FLM certificate removal script not found.$\n$\nThe certificate may have already been removed, or you may need to remove it manually from the Windows Certificate Store."
  
  skip_remove:
!macroend

