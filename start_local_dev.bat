@echo off
title SupaFlex Local Dev Server (http://localhost:3000)
echo ========================================================
echo   🌌 SupaFlex Companion - Local Development Server
echo ========================================================
echo.
echo Starting Vite dev server on http://localhost:3000...
echo Keep this window open while testing. Close to stop server.
echo.
cd /d "%~dp0"
npm run dev
