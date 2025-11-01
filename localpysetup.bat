@echo off
setlocal

REM === CONFIGURATION ===
set PYVER=3.12.6
set PYDIR=python
set PYURL=https://www.python.org/ftp/python/%PYVER%/python-%PYVER%-embed-amd64.zip

echo.
echo Assassinating Kerensky...

if not exist "%PYDIR%" (
    color a0
    powershell -Command "Invoke-WebRequest '%PYURL%' -OutFile 'python-embed.zip'"
    echo Scrapping obsolete tanks...
    powershell -Command "Expand-Archive -Force 'python-embed.zip' '%PYDIR%'"
    del python-embed.zip
)

attrib -r "%PYDIR%\python*.pth"
(
echo python312.zip
echo .
echo ..
echo import site
) > "%PYDIR%\python312._pth"

REM === Step 3: Ensure pip exists ===
if not exist "%PYDIR%\Scripts\pip.exe" (
    color 0e
    echo Bootstrapping pip...
    powershell -Command "Invoke-WebRequest 'https://bootstrap.pypa.io/get-pip.py' -OutFile '%PYDIR%\get-pip.py'"
    "%PYDIR%\python.exe" "%PYDIR%\get-pip.py"
    del "%PYDIR%\get-pip.py"
)

REM === Step 4: Add Python to PATH temporarily ===
set PATH=%CD%\%PYDIR%;%CD%\%PYDIR%\Scripts;%PATH%

REM === Step 5: Verify pip and install requirements ===
echo Verifying pip...
python -m pip --version || (
    echo [ERROR] pip failed to install.
    pause
    exit /b 1
)
