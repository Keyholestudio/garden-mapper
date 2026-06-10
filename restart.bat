@echo off
echo ================================================
echo  Garden Mapper - Dev Server Restart
echo ================================================
echo.

echo Killing stale Vite servers (ports 5200-5203)...
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":5200 \|:5201 \|:5202 \|:5203 "') do (
    taskkill /PID %%a /F >nul 2>&1
)

timeout /t 2 /nobreak > nul

echo Starting Garden Mapper dev server (port 5200)...
start "Garden Mapper - Dev" cmd /k "cd /d C:\Users\RG\.openclaw\workspace\projects\garden-planner\app && npx vite"

timeout /t 3 /nobreak > nul

echo Opening browser...
start http://localhost:5200

echo.
echo Garden Mapper is running.
echo Local:  http://localhost:5200
echo Public: https://app.gardenmapper.ca  (auto-updates on git push)
echo.
echo To shut down: close the terminal window.
echo.
pause
