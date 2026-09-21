@echo off
REM Launches the built app offline using the portable Node in %USERPROFILE%\node-portable.
setlocal
set "NODEDIR=%USERPROFILE%\node-portable\node-v24.21.0-win-x64"

if not exist "%NODEDIR%\node.exe" (
  echo Portable Node was not found at "%NODEDIR%".
  echo Install Node, or re-extract the portable build to that folder.
  pause
  exit /b 1
)

set "PATH=%NODEDIR%;%PATH%"
set "NODE_ENV=production"
cd /d "%~dp0"

if not exist "dist\server.cjs" (
  echo Building the app for the first time...
  call npm run build || (echo Build failed. & pause & exit /b 1)
)

start "" http://localhost:3000/
echo.
echo Mahopac Operations Manager is starting on http://localhost:3000/
echo Close this window to stop the server.
echo.
node dist\server.cjs
