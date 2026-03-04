@echo off
REM TenantShield Weekly Review Refresh
REM Schedule via Task Scheduler: Weekly, Sunday 3:00 AM
REM Program: C:\Users\Nate\tenantshield\scripts\refresh_reviews.bat

setlocal

set PYTHON=C:\Users\Nate\AppData\Local\Programs\Python\Python312\python.exe
set SCRIPT_DIR=C:\Users\Nate\tenantshield\scripts
set LOG=%SCRIPT_DIR%\refresh.log

echo ========================================== >> "%LOG%"
echo TenantShield Review Refresh — %date% %time% >> "%LOG%"
echo ========================================== >> "%LOG%"

REM Back up previous output
if exist "%SCRIPT_DIR%\tenant_reviews_output.json" (
    copy "%SCRIPT_DIR%\tenant_reviews_output.json" "%SCRIPT_DIR%\tenant_reviews_output.%date:~-4%-%date:~4,2%-%date:~7,2%.bak.json" >nul 2>&1
    echo Backed up previous output >> "%LOG%"
)

REM Run the scraper
"%PYTHON%" "%SCRIPT_DIR%\scrape_reviews.py" --buildings "%SCRIPT_DIR%\sample_buildings.csv" --output "%SCRIPT_DIR%\tenant_reviews_output.json" >> "%LOG%" 2>&1

echo Refresh complete at %date% %time% >> "%LOG%"
echo. >> "%LOG%"
