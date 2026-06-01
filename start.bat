@echo off
echo ================================================
echo  Garden Mapper
echo ================================================
echo.
echo Starting Garden Mapper (port 5200)...
start "Garden Mapper - App" cmd /k "cd /d C:\Users\RG\.openclaw\workspace\projects\garden-planner\app && npx vite"

timeout /t 4 /nobreak > nul

echo Starting Cloudflare Tunnel (public HTTPS access)...
start "Garden Mapper - Tunnel" cmd /k "C:\cloudflared\cloudflared.exe tunnel --url http://localhost:5200"

timeout /t 3 /nobreak > nul

echo Opening browser...
start http://localhost:5200

echo.
echo Garden Mapper is running.
echo Local:  http://localhost:5200
echo Public: Check the 'Garden Mapper - Tunnel' window for the trycloudflare.com URL.
echo Close the terminal windows to shut down.
echo.
pause
