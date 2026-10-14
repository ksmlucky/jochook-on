@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy RemoteSigned -NoExit -File "%~dp0scripts\Enter-DevShell.ps1"
