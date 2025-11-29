; NSIS Custom Script for FLM CA Certificate Installation
; This script is executed after the main installation completes
; It prompts the user to install the root CA certificate

!macro customInstall
  ; Get the installation directory
  ReadRegStr $0 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\FLM" "InstallLocation"
  StrCmp $0 "" 0 +2
    ReadRegStr $0 HKLM "Software\FLM" "InstallLocation"
  
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

!macro customUninstall
  ; Get the installation directory
  ReadRegStr $0 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\FLM" "InstallLocation"
  StrCmp $0 "" 0 +2
    ReadRegStr $0 HKLM "Software\FLM" "InstallLocation"
  
  ; Ask user if they want to remove the certificate
  MessageBox MB_YESNO|MB_ICONQUESTION "Would you like to remove the FLM Root CA certificate from the system trust store?" IDYES remove_cert IDNO skip_remove
  
  remove_cert:
    ; Run the uninstall-ca.ps1 script
    IfFileExists "$0\resources\scripts\uninstall-ca.ps1" 0 +2
      ExecWait 'powershell.exe -ExecutionPolicy Bypass -File "$0\resources\scripts\uninstall-ca.ps1" -Force'
  
  skip_remove:
!macroend



