@echo off
setlocal
cd /d "%~dp0"

echo.
echo ==========================================
echo   Job Hunter Junior - Local PC Backend
echo ==========================================
echo.
echo Storage: E:\JobHunter
echo API:     http://127.0.0.1:8788
echo Ollama:  http://127.0.0.1:11434
echo.
echo Syncing Node packages...
call npm install
if errorlevel 1 goto :error

if not exist "E:\JobHunter" mkdir "E:\JobHunter"
if not exist "E:\JobHunter\resumes" mkdir "E:\JobHunter\resumes"

echo Starting backend...
echo.
call npm run server
goto :eof

:error
echo.
echo Dependency install failed.
echo Run: npm install
pause
exit /b 1
