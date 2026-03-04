#!/usr/bin/env python3
"""
Generate buildings CSV from top viewed addresses in Supabase.
Pulls the most-visited addresses from address_views and writes
a CSV that the review scraper can consume.

Usage:
  python generate_buildings_csv.py
  python generate_buildings_csv.py --limit 100
  python generate_buildings_csv.py --output my_buildings.csv
"""

import argparse
import csv
import os
import sys
from collections import Counter

import requests

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")


def fetch_top_addresses(limit: int = 50) -> list[str]:
    """Fetch the most-viewed addresses from Supabase address_views table."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY env vars required.")
        sys.exit(1)

    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    }

    # Fetch all address views (paginate in chunks of 1000)
    all_addresses: list[str] = []
    offset = 0
    page_size = 1000

    while True:
        r = requests.get(
            f"{SUPABASE_URL}/rest/v1/address_views",
            headers=headers,
            params={
                "select": "address",
                "limit": page_size,
                "offset": offset,
            },
            timeout=30,
        )
        if r.status_code != 200:
            print(f"ERROR: Failed to fetch address_views ({r.status_code}): {r.text[:200]}")
            sys.exit(1)

        rows = r.json()
        if not rows:
            break

        for row in rows:
            addr = row.get("address", "").strip()
            if addr:
                all_addresses.append(addr)

        offset += page_size
        if len(rows) < page_size:
            break

    # Count views per address and take top N
    counter = Counter(all_addresses)

    # Filter to valid street addresses (must start with a number)
    valid = {addr: count for addr, count in counter.items() if addr and addr[0].isdigit()}

    print(f"Found {len(counter)} unique addresses from {len(all_addresses)} total views.")
    print(f"Filtered to {len(valid)} valid street addresses.")

    top = sorted(valid.items(), key=lambda x: x[1], reverse=True)[:limit]
    print(f"Selecting top {len(top)} by view count.")

    return [addr for addr, _ in top]


def load_existing_buildings(path: str) -> dict[str, dict]:
    """Load existing buildings CSV to preserve building_name and management_company."""
    existing: dict[str, dict] = {}
    if not os.path.exists(path):
        return existing
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            addr = row.get("address", "").strip().upper()
            if addr:
                existing[addr] = {
                    "building_name": row.get("building_name", "").strip(),
                    "management_company": row.get("management_company", "").strip(),
                }
    return existing


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate buildings CSV from top viewed addresses")
    parser.add_argument("--limit", type=int, default=50, help="Number of top addresses to include (default: 50)")
    parser.add_argument("--output", default="sample_buildings.csv", help="Output CSV path (default: sample_buildings.csv)")
    args = parser.parse_args()

    # Preserve any manually-entered building names/management companies
    existing = load_existing_buildings(args.output)

    addresses = fetch_top_addresses(args.limit)

    rows = []
    for addr in addresses:
        info = existing.get(addr.upper(), {})
        rows.append({
            "address": addr,
            "building_name": info.get("building_name", ""),
            "management_company": info.get("management_company", ""),
        })

    with open(args.output, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["address", "building_name", "management_company"])
        writer.writeheader()
        writer.writerows(rows)

    print(f"Wrote {len(rows)} buildings to {args.output}")


if __name__ == "__main__":
    main()
