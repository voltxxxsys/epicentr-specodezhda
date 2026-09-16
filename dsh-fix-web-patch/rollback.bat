@echo off
REM rollback.bat - run rollback.ps1 with the right interpreter flags from cmd.exe/PowerShell.
REM Usage:  rollback.bat            (undo apply)
REM         rollback.bat -WhatIf    (dry run, writes nothing)
setlocal
set "SCRIPT=%~dp0rollback.ps1"
where pwsh >nul 2>nul
if %ERRORLEVEL%==0 (
  pwsh -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%" %*
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%" %*
)
set "RC=%ERRORLEVEL%"
echo.
echo [rollback.bat] exit code: %RC%
endlocal & exit /b %RC%
