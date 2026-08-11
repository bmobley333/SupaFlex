@echo off
title SupaFlex Local Dev Server (http://localhost:3000)
echo ========================================================
echo   🌌 SupaFlex Companion - Local Development Server
echo ========================================================
echo.

:: 1. Ensure Jodar Command Deck (Port 4000) is running
echo Checking Jodar Command Deck status (Port 4000)...
netstat -ano | findstr :4000 | findstr LISTENING >nul 2>&1
if %errorlevel% neq 0 (
    echo [Jodar Command Deck] Starting background server on http://localhost:4000...
    powershell.exe -ExecutionPolicy Bypass -File "C:\Repos\Jodar\services\command-deck\start-console.ps1"
) else (
    echo [Jodar Command Deck] Server active on http://localhost:4000
)

echo.
echo Starting Vite dev server on http://localhost:3000...
echo Keep this window open while testing. Close to stop server.
echo.
cd /d "%~dp0"
npm run dev

