@echo off
setlocal
chcp 65001 >nul
set "PYTHONUTF8=1"
cd /d "%~dp0"
set "AURORA_BASH="
if exist "%ProgramFiles%\Git\bin\bash.exe" set "AURORA_BASH=%ProgramFiles%\Git\bin\bash.exe"
if not defined AURORA_BASH if exist "%ProgramFiles(x86)%\Git\bin\bash.exe" set "AURORA_BASH=%ProgramFiles(x86)%\Git\bin\bash.exe"
if not defined AURORA_BASH if exist "%LocalAppData%\Programs\Git\bin\bash.exe" set "AURORA_BASH=%LocalAppData%\Programs\Git\bin\bash.exe"
if not defined AURORA_BASH (
  echo Git Bash was not found. Install Git for Windows from https://git-scm.com/download/win
  pause
  exit /b 1
)
"%AURORA_BASH%" tools/setup-email.sh
set "AURORA_SETUP_RESULT=%ERRORLEVEL%"
echo.
pause
exit /b %AURORA_SETUP_RESULT%
