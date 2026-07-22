@echo off
cd /d "%~dp0"

echo ========================================
echo  Enterprise AI OS - Setup & Launch
echo ========================================

echo.
echo [1/4] Installing Python dependencies...
pip install -r backend\requirements.txt --quiet
if %errorlevel% neq 0 (
    echo [!] pip install failed. Make sure Python is installed.
    pause
    exit /b 1
)
echo  Done.

echo.
echo [2/4] Installing Node dependencies (frontend)...
cd frontend
call npm install --legacy-peer-deps --silent
if %errorlevel% neq 0 (
    echo [!] npm install failed. Make sure Node.js is installed.
    pause
    exit /b 1
)
cd ..

echo.
echo [3/4] Starting backend server (port 8000)...
start "AI-OS-Backend" cmd /c "cd /d "%~dp0backend" && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"
echo  Waiting for backend...
timeout /t 5 /nobreak >nul

echo.
echo [4/4] Starting frontend dev server (port 8080)...
start "AI-OS-Frontend" cmd /c "cd /d "%~dp0frontend" && npx vite --host"
echo  Waiting for frontend...
timeout /t 5 /nobreak >nul

echo.
echo ========================================
echo  Opening browser...
echo ========================================
start http://localhost:8080

echo.
echo  Backend:  http://localhost:8000
echo  Frontend: http://localhost:8080
echo  Close this window to stop.
echo.
pause
