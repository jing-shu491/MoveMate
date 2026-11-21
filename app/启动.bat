@echo off
chcp 65001 >nul
cd /d "%~dp0"
start "" "runtime\pythonw.exe" "desktop_windows.py"
exit /b
