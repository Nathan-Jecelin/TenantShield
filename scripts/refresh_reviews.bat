@echo off
REM TenantShield Weekly Review Refresh
REM Schedule via Task Scheduler: Weekly, Sunday 3:00 AM
REM Program: C:\Users\Nate\tenantshield\scripts\refresh_reviews.bat

setlocal

set PYTHON=C:\Users\Nate\AppData\Local\Programs\Python\Python312\python.exe
set SCRIPT_DIR=C:\Users\Nate\tenantshield\scripts
set LOG=%SCRIPT_DIR%\refresh.log

REM Supabase credentials (read from persistent Windows env vars)
if defined SUPABASE_URL (
    set SUPABASE_URL=%SUPABASE_URL%
)
if defined SUPABASE_SERVICE_KEY (
    set SUPABASE_SERVICE_KEY=%SUPABASE_SERVICE_KEY%
)

echo ========================================== >> "%LOG%"
echo TenantShield Review Refresh — %date% %time% >> "%LOG%"
echo ========================================== >> "%LOG%"

REM Regenerate buildings list from top viewed addresses
echo Generating buildings list from analytics... >> "%LOG%"
"%PYTHON%" "%SCRIPT_DIR%\generate_buildings_csv.py" --limit 50 --output "%SCRIPT_DIR%\sample_buildings.csv" >> "%LOG%" 2>&1

REM Back up previous output
if exist "%SCRIPT_DIR%\tenant_reviews_output.json" (
    copy "%SCRIPT_DIR%\tenant_reviews_output.json" "%SCRIPT_DIR%\tenant_reviews_output.%date:~-4%-%date:~4,2%-%date:~7,2%.bak.json" >nul 2>&1
    echo Backed up previous output >> "%LOG%"
)

REM Run the scraper
"%PYTHON%" "%SCRIPT_DIR%\scrape_reviews.py" --buildings "%SCRIPT_DIR%\sample_buildings.csv" --output "%SCRIPT_DIR%\tenant_reviews_output.json" >> "%LOG%" 2>&1

echo Refresh complete at %date% %time% >> "%LOG%"
echo. >> "%LOG%"
