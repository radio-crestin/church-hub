; Church Hub NSIS Installer Hooks
; File association helper macros (from electron-builder/Saivert)

; APP_ASSOCIATE macro - registers file extension with icon
!macro APP_ASSOCIATE EXT FILECLASS DESCRIPTION ICON COMMANDTEXT COMMAND
  WriteRegStr SHELL_CONTEXT "Software\Classes\.${EXT}" "" "${FILECLASS}"
  WriteRegNone SHELL_CONTEXT "Software\Classes\.${EXT}\OpenWithProgids" "${FILECLASS}"

  WriteRegStr SHELL_CONTEXT "Software\Classes\${FILECLASS}" "" `${DESCRIPTION}`
  WriteRegStr SHELL_CONTEXT "Software\Classes\${FILECLASS}\DefaultIcon" "" `${ICON}`
  WriteRegStr SHELL_CONTEXT "Software\Classes\${FILECLASS}\shell" "" "open"
  WriteRegStr SHELL_CONTEXT "Software\Classes\${FILECLASS}\shell\open" "" `${COMMANDTEXT}`
  WriteRegStr SHELL_CONTEXT "Software\Classes\${FILECLASS}\shell\open\command" "" `${COMMAND}`
!macroend

; APP_UNASSOCIATE macro - removes file extension registration
!macro APP_UNASSOCIATE EXT FILECLASS
  DeleteRegValue SHELL_CONTEXT "Software\Classes\.${EXT}\OpenWithProgids" "${FILECLASS}"
  DeleteRegKey SHELL_CONTEXT `Software\Classes\${FILECLASS}`
!macroend

; Shell notification defines
!define SHCNE_ASSOCCHANGED 0x08000000
!define SHCNF_FLUSH        0x1000

!macro UPDATEFILEASSOC
  System::Call "shell32::SHChangeNotify(i,i,i,i) (${SHCNE_ASSOCCHANGED}, ${SHCNF_FLUSH}, 0, 0)"
!macroend

; Post-install hook - register file associations with custom icons
!macro NSIS_HOOK_POSTINSTALL
  ; Register .opensong files
  !insertmacro APP_ASSOCIATE "opensong" "ChurchHub.OpenSong" "Church Hub Song" \
    "$INSTDIR\church-hub.exe,0" "Open with Church Hub" "$INSTDIR\church-hub.exe $\"%1$\""

  ; Register .churchprogram files
  !insertmacro APP_ASSOCIATE "churchprogram" "ChurchHub.Program" "Church Hub Schedule" \
    "$INSTDIR\church-hub.exe,0" "Open with Church Hub" "$INSTDIR\church-hub.exe $\"%1$\""

  ; Register .pptx files (as secondary handler - won't override PowerPoint)
  !insertmacro APP_ASSOCIATE "pptx" "ChurchHub.PowerPoint" "PowerPoint Presentation" \
    "$INSTDIR\church-hub.exe,0" "Import to Church Hub" "$INSTDIR\church-hub.exe $\"%1$\""

  ; Notify shell of changes
  !insertmacro UPDATEFILEASSOC
!macroend

; Post-uninstall hook - remove file associations
!macro NSIS_HOOK_POSTUNINSTALL
  ; Unregister .opensong files
  !insertmacro APP_UNASSOCIATE "opensong" "ChurchHub.OpenSong"

  ; Unregister .churchprogram files
  !insertmacro APP_UNASSOCIATE "churchprogram" "ChurchHub.Program"

  ; Unregister .pptx files
  !insertmacro APP_UNASSOCIATE "pptx" "ChurchHub.PowerPoint"

  ; Notify shell of changes
  !insertmacro UPDATEFILEASSOC
!macroend
