@echo off
echo Starting Meeting App on Port 3500...
cd /d "%~dp0"
start "" "http://localhost:3500"
npm run dev -- -p 3500
pause
