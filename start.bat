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
if not exist "%PYTHON_DIR%\python.exe" (
    echo Local Python not found.
    echo Running setup...
    call localpysetup.bat
    if errorlevel 1 (
        echo Setup failed! Please check the errors above.
        pause
        exit /b 1
    )
) else (
    if not exist "%PYTHON_DIR%\Scripts\pip.exe" (
        echo pip not found in local Python.
        echo Running setup...
        call localpysetup.bat
        if errorlevel 1 (
            echo Setup failed! Please check the errors above.
            pause
            exit /b 1
        )
    ) else (
        echo Local Python and pip found. Skipping setup.
    )
)

if exist requirements.txt (
    echo Installing requirements...
    %PYTHON_DIR%\python.exe -m pip install --target="%PYTHON_DIR%\Lib\site-packages" -r requirements.txt
    color 07
)

echo.
echo Starting Hitler Particle Accelerator...
echo The browser should open automatically...
echo If not, navigate to http://127.0.0.1:5000
echo.

"%PYTHON_DIR%\python.exe" main.py

pause
