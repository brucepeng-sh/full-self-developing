@echo off
title Full-Self-Developing Bootstrapper
cd /d "%~dp0"

echo ========================================================
echo   Starting Full-Self-Developing Desktop Application     
echo ========================================================
echo.

echo [System] Checking for orphaned MCP Relay processes on port 9223...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":9223" ^| find "LISTENING"') do (
    echo [System] Port 9223 is in use by PID %%a, terminating...
    taskkill /F /PID %%a >nul 2>&1
)
echo.

echo [System] Checking Node dependencies in root...
if not exist node_modules (
    echo [System] node_modules not found. Installing packages...
    call npm install
)

echo [System] Checking Node dependencies in client...
if not exist client\node_modules (
    echo [System] client\node_modules not found. Installing client packages...
    cd client
    call npm install
    cd ..
)

echo [System] Starting secure loopback local API Server and Vite Dev Server...
echo [System] Please wait for Vite to show the local URL (usually http://localhost:5173/)
echo [System] Auto-reload enabled (Modifying backend or frontend code will auto-refresh).
set NODE_OPTIONS=--no-deprecation
npx -y concurrently "npx nodemon --watch server.js --watch agents -e js server.js" "npm --prefix client run dev"

pause
