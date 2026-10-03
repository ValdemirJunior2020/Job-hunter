@echo off
setlocal
cd /d "%~dp0"

if not exist node_modules (
  call npm install
  if errorlevel 1 pause & exit /b 1
)

if not exist "D:\JobHunter" mkdir "D:\JobHunter"
if not exist "D:\JobHunter\resumes" mkdir "D:\JobHunter\resumes"

start "Job Hunter Backend" cmd /k "npm run server"
timeout /t 2 /nobreak >nul
start "Job Hunter Frontend" cmd /k "npm run client"
timeout /t 2 /nobreak >nul
start "" "http://localhost:5180"
