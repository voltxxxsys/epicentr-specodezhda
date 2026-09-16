@echo off
REM apply.bat - run apply.ps1 with the right interpreter flags from cmd.exe/PowerShell.
REM Usage:  apply.bat            (apply)
REM         apply.bat -WhatIf    (dry run, writes nothing)
setlocal
set "SCRIPT=%~dp0apply.ps1"
where pwsh >nul 2>nul
if %ERRORLEVEL%==0 (
  pwsh -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%" %*
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%" %*
)
set "RC=%ERRORLEVEL%"
echo.
echo [apply.bat] exit code: %RC%
endlocal & exit /b %RC%
