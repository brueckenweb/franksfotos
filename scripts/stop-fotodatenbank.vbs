' Beendet den lokalen Fotodatenbank-Prozessor (Port 4567).
' Diese Datei als Desktop-Verknüpfung ablegen.
'
' Der Prozess wird anhand des Ports 4567 identifiziert und gezielt beendet,
' ohne andere laufende Node-Prozesse zu stören.

Dim WshShell, oExec, strOut, pid, lines, i, parts, j

Set WshShell = CreateObject("WScript.Shell")

' netstat -ano ausführen und Ausgabe lesen
Set oExec = WshShell.Exec("cmd /c netstat -ano -p TCP")
strOut = oExec.StdOut.ReadAll
oExec.Terminate
Set oExec = Nothing

' Zeilenweise nach ":4567" suchen
pid = ""
lines = Split(strOut, vbCrLf)
For i = 0 To UBound(lines)
    Dim line
    line = lines(i)
    If InStr(line, ":4567 ") > 0 And InStr(line, "LISTENING") > 0 Then
        ' Letzte Spalte = PID
        parts = Split(Trim(line), " ")
        For j = UBound(parts) To 0 Step -1
            If Trim(parts(j)) <> "" Then
                pid = Trim(parts(j))
                Exit For
            End If
        Next
        Exit For
    End If
Next

If pid = "" Then
    MsgBox "Fotodatenbank-Prozessor läuft nicht (Port 4567 nicht gefunden).", _
           vbInformation, "Fotodatenbank – Stopp"
Else
    WshShell.Run "cmd /c taskkill /PID " & pid & " /F", 0, True
    MsgBox "Fotodatenbank-Prozessor (PID " & pid & ") wurde beendet.", _
           vbInformation, "Fotodatenbank – Stopp"
End If

Set WshShell = Nothing
