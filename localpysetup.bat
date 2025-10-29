@echo off
title Hitler Particle Accelerator - Python Setup

setlocal EnableDelayedExpansion

set "PYTHON_DIR=python"
set "PYTHON_VERSION=3.12.4"
set "PYTHON_INSTALLER_URL=https://www.python.org/ftp/python/%PYTHON_VERSION%/python-%PYTHON_VERSION%-amd64.exe"
set "INSTALLER_FILE=python_installer.exe"

echo ========================================
echo   Python %PYTHON_VERSION% Setup
echo ========================================
echo.

:: Check if already installed
if exist "%PYTHON_DIR%\python.exe" (
    echo Python already installed in %PYTHON_DIR%
    exit /b 0
)

echo This will download and install Python %PYTHON_VERSION% locally...
echo.

:: Create python directory
if not exist "%PYTHON_DIR%" mkdir "%PYTHON_DIR%"

echo Downloading Python %PYTHON_VERSION% Installer...
powershell -Command "Invoke-WebRequest -Uri '%PYTHON_INSTALLER_URL%' -OutFile '%INSTALLER_FILE%'"

if errorlevel 1 (
    echo Failed to download Python installer!
    pause
    exit /b 1
)

echo Installing Python %PYTHON_VERSION% to %PYTHON_DIR%...
:: Install Python to our local directory
start /wait "" "%INSTALLER_FILE%" /quiet InstallAllUsers=0 PrependPath=0 Include_test=0 TargetDir="%~dp0%PYTHON_DIR%"

if errorlevel 1 (
    echo Failed to install Python!
    pause
    exit /b 1
)

:: Clean up
del "%INSTALLER_FILE%"

echo.
echo Python %PYTHON_VERSION% installed successfully!
echo.

:: Verify installation
if exist "%PYTHON_DIR%\python.exe" (
    echo Python verification: OK
) else (
    echo Python verification: FAILED
    pause
    exit /b 1
)

if exist "%PYTHON_DIR%\Scripts\pip.exe" (
    echo Pip verification: OK
) else (
    echo Pip verification: FAILED
    pause
    exit /b 1
)

endlocal