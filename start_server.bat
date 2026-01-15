@echo off
chcp 65001 >nul
echo ===================================================
echo       Meeting App Server Launcher
echo ===================================================

echo [1/4] Stopping any ghost Node.js processes...
taskkill /F /IM node.exe >nul 2>&1

echo [2/4] Navigate to project directory...
cd /d "%~dp0meeting-app"

echo [3/4] Cleaning build cache (fixes stuck issues)...
if exist .next (
    echo     Found .next cache, removing...
    rmdir /s /q .next
)

echo [4/4] Starting Next.js Dev Server...
echo.
echo ---------------------------------------------------
echo  Server URL: http://localhost:3500
echo  Please wait for 'Ready in xxx ms' message...
echo ---------------------------------------------------
echo.

npm run dev
pause
