@echo off
title Hitler Particle Accelerator - Python Setup

setlocal EnableDelayedExpansion

set "PYTHON_DIR=python"
set "PYTHON_VERSION=3.12.4"
set "PYTHON_INSTALLER_URL=https://www.python.org/ftp/python/%PYTHON_VERSION%/python-%PYTHON_VERSION%-embed-amd64.zip"
set "INSTALLER_FILE=python_installer.zip"

echo ========================================
echo   Python %PYTHON_VERSION% Setup
echo ========================================
echo.

:: Check if already installed
if exist "%PYTHON_DIR%\python.exe" (
    echo Python already installed in %PYTHON_DIR%
    goto :success
)

echo This will download and install Python %PYTHON_VERSION% locally...
echo.

:: Create python directory
if not exist "%PYTHON_DIR%" mkdir "%PYTHON_DIR%"

echo Downloading Python %PYTHON_VERSION%...
powershell -Command "Invoke-WebRequest -Uri '%PYTHON_INSTALLER_URL%' -OutFile '%INSTALLER_FILE%'"

if errorlevel 1 (
    echo Failed to download Python!
    echo Trying alternative download method...
    curl -L -o "%INSTALLER_FILE%" "%PYTHON_INSTALLER_URL%"
    if errorlevel 1 (
        echo All download methods failed!
        pause
        exit /b 1
    )
)

echo Extracting Python...
powershell -Command "Expand-Archive -Path '%INSTALLER_FILE%' -DestinationPath '%PYTHON_DIR%' -Force"

if errorlevel 1 (
    echo Failed to extract Python!
    pause
    exit /b 1
)

:: Clean up
del "%INSTALLER_FILE%" 2>nul

:: Add necessary files for pip to work
echo Adding package management support...
cd "%PYTHON_DIR%"

:: Download get-pip.py for package management
echo Installing package manager...
powershell -Command "Invoke-WebRequest -Uri 'https://bootstrap.pypa.io/get-pip.py' -OutFile 'get-pip.py'"
python.exe get-pip.py
del get-pip.py 2>nul

cd ..

echo.
echo Python %PYTHON_VERSION% installed successfully!
echo.

:success
:: Verify installation
if exist "%PYTHON_DIR%\python.exe" (
    echo Python verification: OK
) else (
    echo Python verification: FAILED
    pause
    exit /b 1
)

echo.
echo Setup completed successfully!
echo You can now use: %PYTHON_DIR%\python.exe
echo.

endlocal