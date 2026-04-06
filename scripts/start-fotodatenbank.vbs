' Startet den lokalen Fotodatenbank-Prozessor ohne sichtbares Konsolenfenster.
' Diese Datei als Desktop-Verknüpfung ablegen.
'
' HINWEIS: Das Fenster ist bewusst versteckt (0 = kein Fenster).
' Zum Beenden: stop-fotodatenbank.vbs ausführen (Desktop-Verknüpfung).

Dim fso, scriptDir, projectDir, nodeCmd

Set fso = CreateObject("Scripting.FileSystemObject")

' Projektverzeichnis = Elternordner von "scripts/"
scriptDir  = fso.GetParentFolderName(WScript.ScriptFullName)
projectDir = fso.GetParentFolderName(scriptDir)

' node.exe aus PATH verwenden
nodeCmd = "node """ & projectDir & "\scripts\local-fotodatenbank.mjs"""

Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = projectDir

' 0 = kein Fenster, False = nicht warten
WshShell.Run "cmd /c " & nodeCmd, 0, False

Set WshShell = Nothing
Set fso = Nothing
