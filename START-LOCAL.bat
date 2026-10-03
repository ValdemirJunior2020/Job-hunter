@echo off
setlocal
cd /d "%~dp0"

echo.
echo ==========================================
echo   Job Hunter Junior - Local
echo ==========================================
echo.
echo Syncing Node packages...
call npm install
if errorlevel 1 goto :error

start "Job Hunter Backend" cmd /k "npm run server"
timeout /t 2 /nobreak >nul
start "Job Hunter Frontend" cmd /k "npm run client"
timeout /t 2 /nobreak >nul
start "" "http://localhost:5180"
exit /b 0

:error
echo.
echo Dependency install failed.
echo Run: npm install
pause
exit /b 1
