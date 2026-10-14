@echo off
echo This opens the official Docker Desktop installer in per-user mode.
echo Review the installer prompts and terms yourself.
echo WSL setup may require administrator access and a later restart.
start "" /wait "%LOCALAPPDATA%\Programs\HanaDevTools\Installers\Docker Desktop Installer.exe" install --user
pause
