@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ========================================
echo       PROYECTO GALENO - DEMOSTRACION
echo ========================================
echo.
echo Abre http://localhost:3000 en tu navegador.
echo Para cerrar, presiona Ctrl+C.
echo.
npm start
pause
