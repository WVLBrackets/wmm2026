@echo off
echo Starting WMM2026 Development Server...
echo.
echo The server will be available at: http://localhost:3000
echo Press Ctrl+C to stop the server
echo.
cd /d "%~dp0"
npm run dev
pause
