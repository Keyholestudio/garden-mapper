@echo off
echo ================================================
echo  Garden Mapper
echo ================================================
echo.
echo Starting Garden Mapper dev server (port 5200)...
start "Garden Mapper - Dev" cmd /k "cd /d C:\Users\RG\.openclaw\workspace\projects\garden-planner\app && npx vite"

timeout /t 3 /nobreak > nul

echo Opening browser...
start http://localhost:5200

echo.
echo Garden Mapper is running.
echo Local:  http://localhost:5200
echo Public: https://app.gardenmapper.ca  (auto-updates on git push)
echo Close the terminal window to shut down.
echo.
pause
