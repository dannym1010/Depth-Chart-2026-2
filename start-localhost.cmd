@echo off
REM Starts the ops app on this computer (http://localhost:3000/) for practice.
setlocal
set "NODEDIR=%USERPROFILE%\node-portable\node-v24.21.0-win-x64"
if exist "%NODEDIR%\node.exe" set "PATH=%NODEDIR%;%PATH%"

cd /d "%~dp0"

where npm >nul 2>&1
if errorlevel 1 (
  echo npm was not found. Install Node, or use the portable Node folder at:
  echo   %NODEDIR%
  pause
  exit /b 1
)

echo.
echo Field General Operations Manager is starting on http://localhost:3000/
echo Close this window to stop the server.
echo.

start "" http://localhost:3000/
call npm run practice
