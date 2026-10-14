@echo off
cd /d "%~dp0"
echo JochookON - Prepare WSL for Docker Desktop
echo This installs Windows Subsystem for Linux without an Ubuntu distribution.
echo It does not restart this PC automatically.
echo.
fltmc >nul 2>&1
if errorlevel 1 (
  echo Administrator access is required for this Windows feature.
  echo Close this window, right-click Prepare-WSL.cmd, and choose Run as administrator.
  pause
  exit /b 1
)
wsl.exe --install --no-distribution --web-download
set "JOCHOOK_ON_WSL_EXIT=%ERRORLEVEL%"
echo.
if "%JOCHOOK_ON_WSL_EXIT%"=="0" (
  echo WSL installation command completed. Follow any restart instructions above.
) else if "%JOCHOOK_ON_WSL_EXIT%"=="3010" (
  echo Installation completed. Save your work and restart Windows.
) else (
  echo WSL installation returned code %JOCHOOK_ON_WSL_EXIT%.
  echo Keep the message above and send it to the JochookON conversation.
)
echo After any required restart, double-click Install-Docker.cmd in this folder.
pause
