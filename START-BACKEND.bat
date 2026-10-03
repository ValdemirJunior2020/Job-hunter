@echo off
setlocal
cd /d "%~dp0"

echo.
echo ==========================================
echo   Job Hunter Junior - Local PC Backend
echo ==========================================
echo.
echo Storage: D:\JobHunter
echo API:     http://127.0.0.1:8788
echo Ollama:  http://127.0.0.1:11434
echo.

if not exist node_modules (
  echo Installing Node packages...
  call npm install
  if errorlevel 1 goto :error
)

if not exist "D:\JobHunter" mkdir "D:\JobHunter"
if not exist "D:\JobHunter\resumes" mkdir "D:\JobHunter\resumes"

echo Starting backend...
echo.
call npm run server
goto :eof

:error
echo.
echo Setup failed.
pause
exit /b 1
