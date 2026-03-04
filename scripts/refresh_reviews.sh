#!/usr/bin/env bash
# TenantShield Weekly Review Refresh
# Run manually or schedule with cron / Task Scheduler
#
# Cron (Linux/Mac):
#   0 3 * * 0 /path/to/tenantshield/scripts/refresh_reviews.sh >> /path/to/tenantshield/scripts/refresh.log 2>&1
#
# Windows Task Scheduler:
#   Program: bash.exe
#   Arguments: C:\Users\Nate\tenantshield\scripts\refresh_reviews.sh
#   Trigger: Weekly, Sunday 3:00 AM

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PYTHON="/c/Users/Nate/AppData/Local/Programs/Python/Python312/python.exe"
OUTPUT_DIR="$SCRIPT_DIR"
DATE=$(date +%Y-%m-%d)

echo "=========================================="
echo "TenantShield Review Refresh — $DATE"
echo "=========================================="

cd "$SCRIPT_DIR"

# Back up previous output if it exists
if [ -f "$OUTPUT_DIR/tenant_reviews_output.json" ]; then
  cp "$OUTPUT_DIR/tenant_reviews_output.json" "$OUTPUT_DIR/tenant_reviews_output.${DATE}.bak.json"
  echo "Backed up previous output"
fi

# Run the scraper
"$PYTHON" "$SCRIPT_DIR/scrape_reviews.py" \
  --buildings "$SCRIPT_DIR/sample_buildings.csv" \
  --output "$OUTPUT_DIR/tenant_reviews_output.json"

echo ""
echo "Refresh complete at $(date)"
