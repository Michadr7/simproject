@echo off
rem Starts the Mikkadr Hub (with runs and the chat switched on) and opens it in your browser.
rem Close this window to stop the hub. Do not close it while a run is working.
cd /d "%~dp0"
title Mikkadr Hub
start "" /min cmd /c "timeout /t 4 /nobreak >nul & start "" http://127.0.0.1:8765"
call npm run hub -- --runs
echo.
echo The hub has stopped. Press any key to close this window.
pause >nul
