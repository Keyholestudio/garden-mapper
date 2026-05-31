@echo off
echo ================================================
echo  Garden Mapper
echo ================================================
echo.

echo Stopping any existing Vite processes...
taskkill /f /im node.exe >nul 2>&1
timeout /t 1 /nobreak > nul

echo Starting Garden Mapper dev server (port 5173)...
start "Garden Mapper - Dev Server" cmd /k "cd /d C:\Users\RG\.openclaw\workspace\projects\garden-planner\app && npx vite --host"

timeout /t 5 /nobreak > nul

echo Starting Cloudflare Tunnel (public HTTPS access)...
start "Garden Mapper - Tunnel" cmd /k "C:\cloudflared\cloudflared.exe tunnel --url http://localhost:5173"

timeout /t 3 /nobreak > nul

echo Opening browser (local)...
start http://localhost:5173

echo.
echo Garden Mapper is running.
echo - Local:  http://localhost:5173
echo - Public: check the 'Garden Mapper - Tunnel' window for your trycloudflare.com URL
echo.
echo Close the terminal windows to shut down.
echo.
pause
