@echo off
title Hitler Particle Accelerator
echo ========================================
echo   Hitler Particle Accelerator
echo ========================================
echo.

setlocal EnableDelayedExpansion

set "PYTHON_DIR=python"
set "PYTHON_VERSION=3.12.4"

echo Checking environment...

:: Check if local Python exists and has pip
if exist "%PYTHON_DIR%\python.exe" (
    if exist "%PYTHON_DIR%\Scripts\pip.exe" (
        echo Local Python %PYTHON_VERSION% found.
        goto :install_deps
    )
)

echo Local Python not found or incomplete.
echo Running setup...
call localpysetup.bat

if errorlevel 1 (
    echo Setup failed! Please check the errors above.
    pause
    exit /b 1
)

:install_deps
echo Installing/updating dependencies...
"%PYTHON_DIR%\python.exe" -m pip install --upgrade pip
"%PYTHON_DIR%\python.exe" -m pip install -r requirements.txt

if errorlevel 1 (
    echo Failed to install dependencies!
    pause
    exit /b 1
)

echo.
echo Starting Hitler Particle Accelerator...
echo The browser should open automatically...
echo If not, navigate to http://127.0.0.1:5000
echo.

"%PYTHON_DIR%\python.exe" main.py

pause