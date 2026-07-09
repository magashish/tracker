; NSIS installer for the Tracker desktop agent.
; Installs the binary, registers it as a Windows Service
; (SERVICE_AUTO_START, matching "starts automatically when the user logs
; in" via the service auto-start policy), and starts it.

!define APP_NAME "Tracker Agent"
!define SERVICE_NAME "TrackerAgent"
!define INSTALL_DIR "$PROGRAMFILES64\TrackerAgent"

OutFile "tracker-agent-setup.exe"
InstallDir "${INSTALL_DIR}"
RequestExecutionLevel admin

Section "Install"
  SetOutPath "${INSTALL_DIR}"
  File "tracker-agent.exe"

  ; Register and start the Windows Service.
  ExecWait 'sc.exe create ${SERVICE_NAME} binPath= "${INSTALL_DIR}\tracker-agent.exe" start= auto DisplayName= "${APP_NAME}"'
  ExecWait 'sc.exe description ${SERVICE_NAME} "Employee monitoring background agent"'
  ExecWait 'sc.exe failure ${SERVICE_NAME} reset= 86400 actions= restart/5000/restart/5000/restart/5000'
  ExecWait 'sc.exe start ${SERVICE_NAME}'

  WriteUninstaller "${INSTALL_DIR}\uninstall.exe"
SectionEnd

Section "Uninstall"
  ExecWait 'sc.exe stop ${SERVICE_NAME}'
  ExecWait 'sc.exe delete ${SERVICE_NAME}'
  Delete "${INSTALL_DIR}\tracker-agent.exe"
  Delete "${INSTALL_DIR}\uninstall.exe"
  RMDir "${INSTALL_DIR}"
SectionEnd
