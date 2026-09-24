@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

if not exist node_modules (
  echo Устанавливаю зависимости...
  npm install
  if errorlevel 1 (
    echo.
    echo Установка зависимостей не удалась.
    pause
    exit /b 1
  )
)

echo Запускаю dev-сервер (окно сервера останется открытым)...
start "mini-figma dev server" cmd /k "npm run dev"

echo Жду готовности сервера на http://localhost:5173 ...
for /l %%i in (1,1,60) do (
  timeout /t 1 /nobreak >nul
  powershell -NoProfile -Command "try { Invoke-WebRequest -Uri 'http://localhost:5173' -UseBasicParsing -TimeoutSec 1 | Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1
  if !errorlevel!==0 goto open
)

echo Сервер не поднялся за 60 секунд. Проверьте установку Node.js.
pause
exit /b 1

:open
start "" http://localhost:5173
echo.
echo Сервер запущен и открыт в браузере.
exit /b 0