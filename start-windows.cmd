@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (echo Install Node.js 24 LTS from https://nodejs.org then run this file again. & pause & exit /b 1)
if exist dist\index.html goto :ready
call npm ci || goto :failed
call npm run build || goto :failed
:ready
start "" "http://localhost:3000"
call npm start
pause
exit /b
:failed
echo Setup failed. Check the error above.
pause
exit /b 1
