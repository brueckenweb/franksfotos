@echo off
cd /d "%~dp0.."
echo Starte Lokalen Fotodatenbank-Prozessor...
node scripts/local-fotodatenbank.mjs
pause
