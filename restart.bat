@echo off
echo ================================================
echo  Garden Mapper — Clean Restart
echo ================================================
echo.

echo Killing stale Vite servers (ports 5200-5203)...
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":5200 \|:5201 \|:5202 \|:5203 "') do (
    taskkill /PID %%a /F >nul 2>&1
)

echo Killing stale Cloudflare tunnels...
taskkill /IM cloudflared.exe /F >nul 2>&1

timeout /t 2 /nobreak > nul

echo Starting Garden Mapper (port 5200)...
start "Garden Mapper - App" cmd /k "cd /d C:\Users\RG\.openclaw\workspace\projects\garden-planner\app && npx vite"

timeout /t 4 /nobreak > nul

echo Starting Cloudflare Tunnel...
start "Garden Mapper - Tunnel" cmd /k "C:\cloudflared\cloudflared.exe tunnel --url http://localhost:5200 2>&1"

timeout /t 3 /nobreak > nul

echo Opening browser...
start http://localhost:5200

echo.
echo Garden Mapper is running.
echo Local:  http://localhost:5200
echo Public: Check the 'Garden Mapper - Tunnel' window for the trycloudflare.com URL.
echo         (URL takes ~5 seconds to appear)
echo.
echo To shut down: close both terminal windows, or run this script again.
echo.
pause
